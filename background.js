/*
 * background.js
 * -------------------------------------------------------------
 * Две независимые задачи в одном service worker'е (в MV3 он может
 * быть только один на расширение):
 *
 * 1. Блокировка трекеров — включает/выключает заранее заготовленный
 *    набор правил (rules/trackers.json) через declarativeNetRequest.
 *    Работает на уровне браузера, до того как запрос вообще уйдёт в
 *    сеть — не нужно ничего перехватывать через JS на странице.
 *
 * 2. Модуль "Математика" (следующее задание) — Skyeng часто меняет
 *    страницу без полной перезагрузки (SPA, history.pushState),
 *    а обычные content_scripts из манифеста запускаются только при
 *    полной загрузке. Здесь мы следим за такими "виртуальными"
 *    переходами и вручную впрыскиваем нужный скрипт заново.
 * -------------------------------------------------------------
 */

// ---------- 1. Блокировка трекеров ----------

const RULESET_ID = 'block_trackers';

async function setTrackerBlocking(enabled) {
    if (enabled) {
        await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [RULESET_ID] });
    } else {
        await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [RULESET_ID] });
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    const { blockTrackers } = await chrome.storage.local.get(['blockTrackers']);
    // По умолчанию блокировка ВКЛЮЧЕНА (не отслеживать по умолчанию) —
    // свежая установка, когда попап ни разу не открывали и в storage
    // ещё ничего нет (undefined), не должна означать "не блокировать".
    // Явно выключено (false) — единственный случай, когда блокировки нет.
    await setTrackerBlocking(blockTrackers !== false);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.blockTrackers) {
        setTrackerBlocking(!!changes.blockTrackers.newValue);
    }
});

// ---------- 2. Модуль "Математика": повторная инъекция при SPA-переходах ----------

function injectMathListPage(tabId) {
    chrome.scripting.executeScript({ target: { tabId }, files: ['math/list-page.js'] })
        .catch(e => console.warn('[SkyMod/math] Не удалось внедрить list-page.js:', e));
}

function injectMathTaskPage(tabId) {
    chrome.scripting.insertCSS({ target: { tabId }, files: ['math/style.css'] }).catch(() => {});
    chrome.scripting.executeScript({ target: { tabId }, files: ['math/task-page.js'] })
        .catch(e => console.warn('[SkyMod/math] Не удалось внедрить task-page.js:', e));
}

function handleNavigation(details) {
    if (details.frameId !== 0) return; // только главный фрейм страницы
    keepTabLoaded(details.tabId);
    const url = details.url || '';
    if (/\/student\/test-preparation\//.test(url)) {
        injectMathListPage(details.tabId);
    } else if (/\/code\/task\//.test(url)) {
        injectMathTaskPage(details.tabId);
    }
}

chrome.webNavigation.onCompleted.addListener(handleNavigation, {
    url: [{ hostEquals: 'avatar.skyeng.ru' }],
});
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigation, {
    url: [{ hostEquals: 'avatar.skyeng.ru' }],
});


// ---------- 3. Внешние ссылки: открыть во вкладке ----------
// content.js не может сам надёжно открыть фоновую вкладку (window.open всегда
// выводит её на передний план), поэтому просит background открыть через
// chrome.tabs.create. Разрешение "tabs" для этого не нужно.
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || msg.type !== 'skymod-open-tab' || !sender.tab) return;
    let url;
    try { url = new URL(String(msg.url)); } catch (e) { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    chrome.tabs.create({
        url: url.href,
        active: !!msg.active,
        index: sender.tab.index + 1,
        openerTabId: sender.tab.id,
    }).catch(e => console.warn('[SkyMod] Не удалось открыть вкладку:', e));
});


// Вкладки сайта не выгружаются из памяти. Chrome (Memory Saver) выгружает давно
// неактивные вкладки, а при возврате перезагружает страницу: со стороны это выглядит
// как "сайт заблокировался и просит перезагрузить".
async function keepTabLoaded(tabId) {
    try {
        const { antiLockEnabled } = await chrome.storage.local.get('antiLockEnabled');
        if (antiLockEnabled === false) return;
        await chrome.tabs.update(tabId, { autoDiscardable: false });
    } catch (e) { /* вкладку уже закрыли */ }
}

// Напоминания в Telegram. Без общего сервера: у пользователя свой бот (токен лежит
// в chrome.storage.local), расписание приходит из content.js под ключом
// siteWeekLessons: { "2026-10-05": [{ id, title, kind, type, startMin, endMin }] }.
// Раз в минуту будильник проверяет, не пора ли отправить. Работает, пока открыт Chrome:
// если браузер был закрыт и занятие уже началось, старые напоминания не шлются.
const TG_ALARM = 'skymod-tg-tick';
const TG_MAX_PER_HOUR = 20;
const TG_SEND_GAP_MS = 1200;

function ensureTgAlarm() {
    chrome.alarms.get(TG_ALARM, alarm => {
        if (!alarm) chrome.alarms.create(TG_ALARM, { periodInMinutes: 1 });
    });
}
ensureTgAlarm();
chrome.runtime.onInstalled.addListener(ensureTgAlarm);
chrome.runtime.onStartup.addListener(ensureTgAlarm);

async function tgSend(token, chatId, text) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok) return { ok: true };
    return {
        ok: false,
        error: (data && data.description) || ('HTTP ' + res.status),
        code: (data && data.error_code) || res.status,
        retryAfter: data && data.parameters && data.parameters.retry_after,
    };
}

function tgPad(n) { return String(n).padStart(2, '0'); }
function tgClock(min) { return tgPad(Math.floor(min / 60) % 24) + ':' + tgPad(min % 60); }

function tgDateStr(d) { return d.getFullYear() + '-' + tgPad(d.getMonth() + 1) + '-' + tgPad(d.getDate()); }

// Свои блоки из расписания (customBlocks) на ближайшие 8 дней в том же виде, что и
// занятия со страницы: { "YYYY-MM-DD": [{ id, title, kind, type: 'custom', startMin, endMin }] }.
function tgExpandCustom(blocks, now) {
    const out = {};
    if (!Array.isArray(blocks)) return out;
    for (let i = 0; i < 8; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const date = tgDateStr(d);
        const weekday = (d.getDay() + 6) % 7;
        blocks.forEach(b => {
            if (!b || !b.id || !Number.isFinite(b.startMin) || !Number.isFinite(b.endMin) || b.endMin <= b.startMin) return;
            const applies = b.date ? b.date === date : (Array.isArray(b.weekdays) && b.weekdays.includes(weekday));
            if (!applies) return;
            (out[date] = out[date] || []).push({ id: 'c' + b.id, title: String(b.title || '').slice(0, 60), kind: 'Своё', type: 'custom', startMin: b.startMin, endMin: b.endMin });
        });
    }
    return out;
}

function tgBuildText(lesson, startTs, now) {
    const left = Math.max(0, Math.ceil((startTs - now) / 60000));
    const isTest = lesson.type === 'test';
    const head = lesson.type === 'custom' ? 'Событие' : (lesson.kind || (isTest ? 'Контрольная' : 'Занятие')) + (isTest ? ' (тест)' : '');
    const when = left <= 0 ? 'начинается сейчас' : 'начало через ' + left + ' мин';
    return `${head}: ${lesson.title || 'без названия'}\n${tgClock(lesson.startMin)}-${tgClock(lesson.endMin)}, ${when}`;
}

let tgTickBusy = false;
async function tgTick() {
    if (tgTickBusy) return;
    tgTickBusy = true;
    try {
        const st = await chrome.storage.local.get([
            'tgEnabled', 'tgBotToken', 'tgChatId', 'tgLeadMinutes', 'tgNotifyLessons', 'tgNotifyTests', 'tgNotifyCustom', 'customBlocks',
            'tgMuteUntil', 'siteWeekLessons', 'tgSentLog', 'tgSendTimes',
        ]);
        if (!st.tgEnabled || !st.tgBotToken || !st.tgChatId) return;
        const now = Date.now();
        if ((Number(st.tgMuteUntil) || 0) > now) return;

        const lead = Math.max(0, Math.min(180, parseInt(st.tgLeadMinutes ?? 15, 10) || 0));
        const wantLessons = st.tgNotifyLessons !== false;
        const wantTests = st.tgNotifyTests !== false;
        const wantCustom = st.tgNotifyCustom !== false;
        const week = st.siteWeekLessons && typeof st.siteWeekLessons === 'object' ? { ...st.siteWeekLessons } : {};
        const customByDate = wantCustom ? tgExpandCustom(st.customBlocks, now) : {};
        Object.keys(customByDate).forEach(date => { week[date] = (week[date] || []).concat(customByDate[date]); });
        const sent = st.tgSentLog && typeof st.tgSentLog === 'object' ? { ...st.tgSentLog } : {};
        let times = Array.isArray(st.tgSendTimes) ? st.tgSendTimes.filter(t => now - t < 3600e3) : [];

        const due = [];
        Object.keys(week).forEach(date => {
            const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m || !Array.isArray(week[date])) return;
            week[date].forEach(lesson => {
                const isTest = lesson.type === 'test';
                const isCustom = lesson.type === 'custom';
                if (isCustom ? !wantCustom : (isTest ? !wantTests : !wantLessons)) return;
                const startTs = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, lesson.startMin, 0, 0).getTime();
                const fireTs = startTs - lead * 60000;
                const graceEnd = startTs + (lead === 0 ? 2 * 60000 : 0);
                if (now < fireTs || now >= graceEnd) return;
                const key = `${date}|${lesson.id || lesson.startMin}|${lead}`;
                if (sent[key]) return;
                due.push({ key, lesson, startTs });
            });
        });
        if (!due.length) return;
        due.sort((a, b) => a.startTs - b.startTs);

        for (const item of due) {
            if (times.length >= TG_MAX_PER_HOUR) break;
            const res = await tgSend(st.tgBotToken, st.tgChatId, tgBuildText(item.lesson, item.startTs, Date.now()));
            if (res.ok) {
                sent[item.key] = now;
                times.push(Date.now());
                await chrome.storage.local.set({ tgLastError: '' });
            } else {
                await chrome.storage.local.set({ tgLastError: res.error });
                if (res.code === 401 || res.code === 403 || res.code === 400) {
                    await chrome.storage.local.set({ tgEnabled: false });
                }
                break;
            }
            await new Promise(r => setTimeout(r, TG_SEND_GAP_MS));
        }

        Object.keys(sent).forEach(k => { if (now - sent[k] > 3 * 86400e3) delete sent[k]; });
        await chrome.storage.local.set({ tgSentLog: sent, tgSendTimes: times });
    } catch (e) {
        console.warn('[SkyMod] Ошибка напоминаний:', e);
    } finally {
        tgTickBusy = false;
    }
}

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === TG_ALARM) tgTick(); });
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.tgEnabled || changes.tgLeadMinutes || changes.tgMuteUntil || changes.siteWeekLessons || changes.customBlocks)) tgTick();
});

// Тестовое сообщение и приветствие из попапа. Только от страниц самого расширения:
// у content-скриптов на сайте sender.tab заполнен, их отбрасываем.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'skymod-tg-send') return;
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    (async () => {
        const { tgBotToken, tgChatId } = await chrome.storage.local.get(['tgBotToken', 'tgChatId']);
        if (!tgBotToken || !tgChatId) { sendResponse({ ok: false, error: 'бот не привязан' }); return; }
        const res = await tgSend(tgBotToken, tgChatId, String(msg.text || '').slice(0, 500));
        if (res.ok) await chrome.storage.local.set({ tgLastError: '' });
        sendResponse(res);
    })().catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
});

// ---------- 4. Проверка новых версий через GitHub ----------
// Только проверка и подсказка: расширение ничего не скачивает и не ставит.
// Единственный сетевой запрос — GET releases/latest репозитория проекта.
// Результат лежит в chrome.storage.local под ключом updateInfo:
// { latestVersion, releaseUrl, checkedAt, isNewer, lastError? }.
// Попап ничего не ждёт: показывает полоску по данным из storage.

const UPDATE_ALARM = 'skymod-update-check';
const UPDATE_API_URL = 'https://api.github.com/repos/sploofer1/SkyMod/releases/latest';
const UPDATE_RELEASES_URL = 'https://github.com/sploofer1/SkyMod/releases';
const UPDATE_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_TIMEOUT_MS = 10000;
const UPDATE_BADGE_COLOR = '#f59e0b';
let updateCheckPromise = null;

// 'v2.21.0' -> '2.21.0'; всё, что не похоже на версию, -> null.
function updateParseVersion(tag) {
    const m = /^v?(\d+(?:\.\d+){1,3})$/.exec(String(tag || '').trim());
    return m ? m[1] : null;
}

function updateIsNewer(latest, current) {
    const l = updateParseVersion(latest);
    const c = updateParseVersion(current);
    if (!l || !c) return false;
    const pl = l.split('.').map(Number);
    const pc = c.split('.').map(Number);
    for (let i = 0; i < Math.max(pl.length, pc.length); i++) {
        const d = (pl[i] || 0) - (pc[i] || 0);
        if (d) return d > 0;
    }
    return false;
}

// Ответ сети — недоверенные данные: ссылку принимаем только на релизы нашего репозитория.
function updateSafeReleaseUrl(url) {
    return typeof url === 'string' && url.length < 300 && url.startsWith(UPDATE_RELEASES_URL + '/') ? url : UPDATE_RELEASES_URL;
}

function ensureUpdateAlarm() {
    chrome.alarms.get(UPDATE_ALARM, alarm => {
        if (!alarm) chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 1440 });
    });
}

// Бейдж не переживает перезапуск браузера, поэтому его всегда можно
// восстановить из кэша, без сети. isNewer сверяем с текущей версией заново:
// после ручного обновления расширения кэш может ещё говорить «есть новее».
async function updateApplyBadge() {
    const { updateCheckEnabled, updateInfo, dismissedVersion } = await chrome.storage.local.get(['updateCheckEnabled', 'updateInfo', 'dismissedVersion']);
    const info = updateInfo && typeof updateInfo === 'object' ? updateInfo : {};
    const show = updateCheckEnabled !== false
        && updateIsNewer(info.latestVersion, chrome.runtime.getManifest().version)
        && info.latestVersion !== dismissedVersion;
    chrome.action.setBadgeText({ text: show ? '\u2191' : '' });
    if (show) chrome.action.setBadgeBackgroundColor({ color: UPDATE_BADGE_COLOR });
}

async function updateRecomputeCached() {
    const { updateInfo } = await chrome.storage.local.get(['updateInfo']);
    if (!updateInfo || typeof updateInfo !== 'object') return;
    const isNewer = updateIsNewer(updateInfo.latestVersion, chrome.runtime.getManifest().version);
    if (updateInfo.isNewer !== isNewer) await chrome.storage.local.set({ updateInfo: { ...updateInfo, isNewer } });
}

async function updateCheckRun() {
    const { updateCheckEnabled, updateInfo } = await chrome.storage.local.get(['updateCheckEnabled', 'updateInfo']);
    if (updateCheckEnabled === false) { await updateApplyBadge(); return; }

    const prev = updateInfo && typeof updateInfo === 'object' ? updateInfo : null;
    const now = Date.now();
    // Не чаще раза в 12 часов. Отрицательный возраст (часы переведены назад) считаем устаревшим кэшем.
    const age = prev && Number.isFinite(prev.checkedAt) ? now - prev.checkedAt : -1;
    if (age >= 0 && age < UPDATE_MIN_INTERVAL_MS) { await updateApplyBadge(); return; }

    const next = {
        latestVersion: prev && typeof prev.latestVersion === 'string' ? prev.latestVersion : '',
        releaseUrl: prev && typeof prev.releaseUrl === 'string' ? prev.releaseUrl : '',
        checkedAt: now,
        isNewer: false,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
        const res = await fetch(UPDATE_API_URL, {
            headers: { Accept: 'application/vnd.github+json' },
            cache: 'no-store',
            signal: controller.signal,
        });
        if (res.status === 404) {
            // Релизов ещё нет: это не ошибка.
            next.latestVersion = '';
            next.releaseUrl = '';
        } else if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        } else {
            const data = await res.json();
            const version = updateParseVersion(data && data.tag_name);
            if (!version) throw new Error('непонятный tag_name');
            next.latestVersion = version;
            next.releaseUrl = updateSafeReleaseUrl(data.html_url);
        }
    } catch (e) {
        // Сеть, лимит GitHub, мусор в ответе: прежние данные остаются, checkedAt сдвигаем,
        // чтобы не долбить сеть при каждом старте.
        next.lastError = String((e && e.message) || e).slice(0, 200);
    } finally {
        clearTimeout(timer);
    }
    next.isNewer = updateIsNewer(next.latestVersion, chrome.runtime.getManifest().version);
    await chrome.storage.local.set({ updateInfo: next });
    await updateApplyBadge();
}

// Несколько триггеров подряд (старт, установка, будильник) дают один запрос.
function updateCheck() {
    if (updateCheckPromise) return updateCheckPromise;
    updateCheckPromise = updateCheckRun()
        .catch(e => console.warn('[SkyMod] проверка обновлений:', e))
        .finally(() => { updateCheckPromise = null; });
    return updateCheckPromise;
}

ensureUpdateAlarm();
chrome.runtime.onInstalled.addListener(async () => {
    ensureUpdateAlarm();
    try { await updateRecomputeCached(); } catch (e) { /* кэш не критичен */ }
    updateApplyBadge();
    updateCheck();
});
chrome.runtime.onStartup.addListener(() => {
    ensureUpdateAlarm();
    updateApplyBadge();
    updateCheck();
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === UPDATE_ALARM) updateCheck(); });
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // Опцию включили: проверка (с учётом кэша); выключили: проверка сама снимет бейдж.
    if (changes.updateCheckEnabled) updateCheck();
    if (changes.updateCheckEnabled || changes.updateInfo || changes.dismissedVersion) updateApplyBadge();
});
