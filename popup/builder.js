// SkyMod — логика страницы конструктора (builder.html).
// Обычная страница расширения (CSP без eval), поэтому весь код — в этом
// внешнем файле, никаких инлайновых <script>/onclick.

const $ = sel => document.querySelector(sel);

// ---------- Переключатель режима: Попап / Сайт ----------
// Два независимых конструктора делили одну длинную страницу — сложно
// понять, где заканчивается один и начинается другой. Теперь виден
// только активный, переключение — как обычные табы.
const MODE_STORAGE_KEY = 'builderPageMode';

function setMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    document.querySelectorAll('[data-scope]').forEach(el => { el.hidden = el.dataset.scope !== mode; });
    $('#layout').classList.toggle('mode-site', mode === 'site');
    $('#mode-hint').textContent = mode === 'popup'
        ? 'Свой фон и анимация в окне расширения. Виден, только пока попап открыт.'
        : 'Свой фон и стили элементов прямо на avatar.skyeng.ru. Работает, пока открыта вкладка сайта.';
    chrome.storage.local.set({ [MODE_STORAGE_KEY]: mode }).catch(() => {});
    renderStatusBar();
}


// ---------- Цвет-или-градиент: те же функции, что в popup.js/content.js —
// дублируются, т.к. это три независимых контекста без общих модулей.
// Нужны здесь только чтобы посчитать theme-палитру для песочницы. ----------
const RAINBOW_STOPS = [
    { color: '#ff0000', pos: 0 }, { color: '#ff9900', pos: 16 }, { color: '#ffee00', pos: 33 },
    { color: '#33ff00', pos: 50 }, { color: '#00c3ff', pos: 66 }, { color: '#7000ff', pos: 83 },
    { color: '#ff0000', pos: 100 },
];
function normalizeColorValue(raw, fallbackHex) {
    if (raw && typeof raw === 'object') {
        return {
            mode: raw.mode || 'solid',
            solid: raw.solid || fallbackHex,
            stops: (Array.isArray(raw.stops) && raw.stops.length >= 2) ? raw.stops : [{ color: fallbackHex, pos: 0 }, { color: fallbackHex, pos: 100 }],
            custom: raw.custom || '',
        };
    }
    const solid = (typeof raw === 'string' && raw) ? raw : fallbackHex;
    return { mode: 'solid', solid, stops: [{ color: solid, pos: 0 }, { color: solid, pos: 100 }], custom: '' };
}
function colorValueRepresentative(value) {
    if (value.mode === 'solid') return value.solid;
    if (value.mode === 'gradient') return (value.stops[0] && value.stops[0].color) || value.solid;
    if (value.mode === 'rgb') return RAINBOW_STOPS[0].color;
    const match = (value.custom || '').match(/#[0-9a-fA-F]{3,8}/);
    return match ? match[0] : value.solid;
}

// ---------- Хранилище: те же ключи, что читает/пишет popup.js реального
// попапа — конструктор здесь только редактирует их, применяет их по-прежнему
// popup.html (сам попап и iframe предпросмотра — это один и тот же код). ----------
const BUILDER_KEYS = SKYMOD_KEY_GROUPS.builder;
const SITE_BUILDER_KEYS = SKYMOD_KEY_GROUPS.siteBuilder;
// Ключи, которые только читаются при загрузке страницы (цвета для theme песочниц
// и сохранённый CSS частей интерфейса сайта).
// scheduleSubjectColors раньше не читался, и в песочницах конструктора цвета предметов
// всегда были стандартными, хотя в попапе и на сайте они свои.
const THEME_KEYS = ['popupUiColor', 'modColor', 'pulseColor', 'sitePartsCss', 'popupSize', 'scheduleSubjectColors'];
// Всё, что конструктор читает и может получить из другого контекста (вторая вкладка
// конструктора, попап, импорт): по этим ключам синхронизируется currentValues.
const SYNCED_KEYS = new Set([...BUILDER_KEYS, ...SITE_BUILDER_KEYS, ...THEME_KEYS, 'builderPresets', 'siteBuilderPresets']);
const POPUP_CODE_KEYS = new Set(['builderHtml', 'builderCss', 'builderJs']);
const SITE_CODE_KEYS = new Set(['siteBuilderHtml', 'siteBuilderCss', 'siteBuilderJs']);
const THEME_COLOR_KEYS = new Set(['popupUiColor', 'modColor', 'pulseColor']);

// Пауза после последнего нажатия клавиши, после которой код сохраняется и уходит в предпросмотр.
const AUTOSAVE_DELAY_MS = 300;

let currentValues = {};
let presets = [];

let saveStatusTimer = null;
function showSaved() {
    const indicator = $('#save-status');
    if (!indicator) return;
    indicator.textContent = 'Сохранено';
    indicator.classList.remove('error');
    indicator.classList.add('visible');
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => indicator.classList.remove('visible'), 1500);
}

// Ошибка записи не исчезает сама: раньше она уходила только в console.error,
// и человек думал, что всё сохранено.
function showSaveError() {
    const indicator = $('#save-status');
    if (!indicator) return;
    clearTimeout(saveStatusTimer);
    indicator.textContent = 'Не удалось сохранить';
    indicator.classList.add('error', 'visible');
}

// Зелёная точка на кнопке режима, если в нём что-то включено: сразу видно,
// где конструктор работает, даже когда открыта вкладка другого режима.
function updateModeDots() {
    const dots = {
        popup: !!currentValues.builderEnabled,
        site: !!currentValues.siteBuilderEnabled || Object.values(getPartsData()).some(p => p && p.enabled && p.css && p.css.trim()),
    };
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('on', !!dots[btn.dataset.mode]));
}

// ---------- Строка состояния: включено или нет, и что с этим делать ----------
// Главная жалоба на конструктор: «написал код, а ничего нет». Причина почти
// всегда одна: переключатель «Включить» выключен или спрятан в боковой панели.
// Поэтому наверху всегда видно крупно: что включено (зелёный), что выключено
// (красный) и что написано, но не применяется (жёлтый), с кнопкой на месте.
function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function toggleCheckbox(selector) {
    const cb = $(selector);
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
}

function buildStatusItem({ kind, title, text, button, onClick, stop }) {
    const item = document.createElement('div');
    item.className = 'status-item ' + kind;
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    const box = document.createElement('div');
    box.className = 'status-text';
    const b = document.createElement('b');
    b.textContent = title;
    const span = document.createElement('span');
    span.textContent = text;
    box.append(b, span);
    item.append(dot, box);
    if (button) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'status-btn' + (stop ? ' stop' : '');
        btn.textContent = button;
        btn.addEventListener('click', onClick);
        item.appendChild(btn);
    }
    return item;
}

function popupStatusItem() {
    const on = !!currentValues.builderEnabled;
    const hasCode = hasText(currentValues.builderHtml) || hasText(currentValues.builderCss) || hasText(currentValues.builderJs);
    const layer = currentValues.builderLayer === 'over' ? 'поверх интерфейса' : 'под интерфейсом';
    const click = () => toggleCheckbox('#opt-enabled');
    if (on) return { kind: 'on', title: 'Конструктор попапа: включён', text: 'Ваш код работает в окне расширения (' + layer + '). Откройте попап, чтобы увидеть результат.', button: 'Выключить', stop: true, onClick: click };
    if (hasCode) return { kind: 'warn', title: 'Конструктор попапа: выключен', text: 'Код написан, но в попапе его не видно, пока вы не нажмёте «Включить».', button: 'Включить', onClick: click };
    return { kind: 'off', title: 'Конструктор попапа: выключен', text: 'Вставьте пример или напишите код ниже, затем нажмите «Включить».', button: 'Включить', onClick: click };
}

function siteBgStatusItem() {
    const on = !!currentValues.siteBuilderEnabled;
    const hasCode = hasText(currentValues.siteBuilderHtml) || hasText(currentValues.siteBuilderCss) || hasText(currentValues.siteBuilderJs);
    const click = () => toggleCheckbox('#site-opt-enabled');
    if (on) return { kind: 'on', title: 'Фон сайта: включён', text: 'Работает на открытых вкладках avatar.skyeng.ru, обновлять их не нужно.', button: 'Выключить', stop: true, onClick: click };
    if (hasCode) return { kind: 'warn', title: 'Фон сайта: выключен', text: 'Код фона написан, но на сайте его нет, пока вы не нажмёте «Включить».', button: 'Включить', onClick: click };
    return { kind: 'off', title: 'Фон сайта: выключен', text: 'Выберите пример в блоке «Песочница фона сайта» или вставьте свой код, затем нажмите «Включить».', button: 'Включить', onClick: click };
}

function partsStatusItem() {
    const data = getPartsData();
    const withCss = SKYMOD_PARTS.filter(p => data[p.id] && (hasText(data[p.id].css) || hasText(data[p.id].html) || hasText(data[p.id].js)));
    const active = withCss.filter(p => data[p.id].enabled);
    const idle = withCss.filter(p => !data[p.id].enabled);
    if (idle.length) {
        return {
            kind: 'warn',
            title: 'Части интерфейса: ' + (idle.length === 1 ? 'часть «' + idle[0].name + '»' : idle.length + ' части') + ' не применяется',
            text: 'Код написан, но часть выключена, поэтому на сайте ничего не меняется.',
            button: 'Включить',
            onClick: () => {
                const all = { ...getPartsData() };
                idle.forEach(p => { all[p.id] = { ...all[p.id], enabled: true }; });
                saveKey('sitePartsCss', all);
                renderPartInfo();
            },
        };
    }
    if (active.length) {
        return { kind: 'on', title: 'Части интерфейса: применяется ' + active.length, text: active.map(p => p.name).join(', ') + '.' };
    }
    return { kind: 'idle', title: 'Части интерфейса: пока не настроены', text: 'Выберите часть ниже, вставьте CSS от ИИ, и она включится сама.' };
}

function renderStatusBar() {
    const bar = $('#status-bar');
    if (!bar) return;
    const active = document.querySelector('.mode-btn.active');
    const mode = active ? active.dataset.mode : 'popup';
    bar.innerHTML = '';
    const items = mode === 'site' ? [siteBgStatusItem(), partsStatusItem()] : [popupStatusItem()];
    items.forEach(it => bar.appendChild(buildStatusItem(it)));
}

// Запись набора ключей ОДНИМ вызовом storage.set. Попап (предпросмотр) и content.js
// получают по одному событию onChanged на вызов, поэтому код из трёх полей и пресет
// применяются целиком, а не тремя шагами с промежуточным состоянием (новый HTML
// со старым JS и лишние перезапуски песочницы).
const ECHO_WINDOW_MS = 3000;
const ECHO_HISTORY_LIMIT = 6;
const recentWrites = new Map(); // ключ → [{ json, at }] последних записей отсюда
let pendingWriteCount = 0;

function rememberWrite(key, value) {
    const history = recentWrites.get(key) || [];
    history.push({ json: JSON.stringify(value), at: Date.now() });
    if (history.length > ECHO_HISTORY_LIMIT) history.shift();
    recentWrites.set(key, history);
}

// onChanged приходит и на наши собственные записи: их отличаем от чужих правок
// по значению, записанному недавно.
function isOwnWriteEcho(key, json, now) {
    const history = recentWrites.get(key);
    return !!history && history.some(entry => entry.json === json && now - entry.at < ECHO_WINDOW_MS);
}

function commitKeys(patch) {
    const keys = Object.keys(patch);
    if (!keys.length) return Promise.resolve();
    keys.forEach(key => {
        currentValues[key] = patch[key];
        rememberWrite(key, patch[key]);
    });
    // currentValues уже новый, поэтому статус и точки режимов обновляем сразу,
    // а не после ответа хранилища.
    updateModeDots();
    renderStatusBar();
    pendingWriteCount += 1;
    return chrome.storage.local.set(patch)
        .then(() => {
            pendingWriteCount -= 1;
            if (pendingWriteCount === 0) showSaved();
        })
        .catch(error => {
            pendingWriteCount -= 1;
            console.error('[SkyMod builder] Не удалось сохранить', keys, error);
            showSaveError();
        });
}

function saveKey(key, value) {
    return commitKeys({ [key]: value });
}

// Изменения из другого контекста: вторая вкладка конструктора, попап, импорт.
// Раньше currentValues обновлялся только для sitePartsCss, остальное оставалось
// устаревшим до перезагрузки страницы (статус-бар, точки режимов, поля формы).
function handleStorageChange(changes, areaName) {
    if (areaName !== 'local') return;
    const now = Date.now();
    const touched = { form: false, popupCode: false, siteCode: false, theme: false, parts: false, presets: false, size: false };
    Object.keys(changes).forEach(key => {
        if (!SYNCED_KEYS.has(key)) return;
        const nextValue = changes[key].newValue;
        const nextJson = JSON.stringify(nextValue);
        if (isOwnWriteEcho(key, nextJson, now)) return;
        if (nextJson === JSON.stringify(currentValues[key])) return;
        currentValues[key] = nextValue;
        recentWrites.delete(key);
        if (key === 'builderPresets') { presets = Array.isArray(nextValue) ? nextValue : []; currentValues.builderPresets = presets; touched.presets = true; }
        else if (key === 'siteBuilderPresets') { sitePresets = Array.isArray(nextValue) ? nextValue : []; currentValues.siteBuilderPresets = sitePresets; touched.presets = true; }
        else if (key === 'sitePartsCss') touched.parts = true;
        else if (key === 'popupSize') touched.size = true;
        else if (THEME_COLOR_KEYS.has(key)) touched.theme = true;
        else if (BUILDER_KEYS.includes(key) || SITE_BUILDER_KEYS.includes(key)) {
            touched.form = true;
            if (POPUP_CODE_KEYS.has(key)) touched.popupCode = true;
            if (SITE_CODE_KEYS.has(key)) touched.siteCode = true;
        }
    });
    if (!Object.values(touched).some(Boolean)) return;
    if (touched.form) populateForm();
    if (touched.presets) renderPresets();
    if (touched.parts) refreshPartsFromStorage();
    if (touched.size) applyPreviewSize();
    if (touched.popupCode || touched.theme) sendToSandbox();
    if (touched.siteCode) sendToSiteSandbox();
    updateModeDots();
    renderStatusBar();
}

// ---------- Мост к собственной песочнице (debug-инстанс, скрытый iframe) ----------
// Отдельный от того, что рисует живой предпросмотр (#preview-frame — это
// целый popup.html со СВОЕЙ песочницей внутри). Этот, скрытый, нужен
// только чтобы сразу видеть ошибки/console.log по мере правки кода, не
// дожидаясь сохранения в хранилище и перерисовки предпросмотра.
let sandboxReady = false;
let pendingPayload = null;
const BUILDER_STORAGE_PREFIX = 'builderData:';

let siteSandboxReady = false;
let sitePendingPayload = null;
const SITE_BUILDER_STORAGE_PREFIX = 'siteBuilderData:'; // тот же namespace, что в content.js

function getFrame() { return document.getElementById('builder-frame'); }
function getSiteFrame() { return document.getElementById('site-builder-frame'); }

function computeTheme() {
    return {
        accent: colorValueRepresentative(normalizeColorValue(currentValues.popupUiColor, '#8a8f98')),
        mod: colorValueRepresentative(normalizeColorValue(currentValues.modColor, '#8a8f98')),
        pulse: colorValueRepresentative(normalizeColorValue(currentValues.pulseColor, '#8a8f98')),
    };
}
function computeSiteTheme() {
    // Акцент сайта в расширении больше не настраивается: в песочницу уходит фиксированный.
    return { accent: '#8b7cf6' };
}

// Предпросмотр попапа повторяет выбранный в попапе размер (ширина и высота
// окна расширения), иначе проверять фон на 320px, когда реальный попап шире, бессмысленно.
const PREVIEW_SIZES = { compact: [320, 580], large: [400, 640], xl: [480, 654] };
function applyPreviewSize() {
    const [w, h] = PREVIEW_SIZES[currentValues.popupSize] || PREVIEW_SIZES.large;
    document.documentElement.style.setProperty('--preview-w', w + 'px');
    document.documentElement.style.setProperty('--preview-h', h + 'px');
    const frame = document.getElementById('preview-frame');
    // Сам iframe читает размер из localStorage (общий origin), поэтому подталкиваем его.
    try { localStorage.setItem('skymodPopupSize', ['compact', 'large', 'xl'].includes(currentValues.popupSize) ? currentValues.popupSize : 'large'); } catch (e) { /* не критично */ }
    if (frame && frame.contentDocument) {
        try { frame.contentDocument.documentElement.setAttribute('data-size', localStorage.getItem('skymodPopupSize')); } catch (e) { /* другой origin */ }
    }
}

function sendToSandbox() {
    const payload = {
        html: currentValues.builderHtml || '', css: currentValues.builderCss || '', js: currentValues.builderJs || '',
        theme: computeTheme(),
    };
    if (sandboxReady) {
        runInFrame(getFrame(), payload);
    } else {
        pendingPayload = payload;
    }
}

// Расписание уходит ПЕРЕД кодом (к его старту schedule уже заполнен) и затем
// обновляется по таймеру, как на самом сайте.
const latestRunByFrame = new WeakMap();
async function runInFrame(frame, payload) {
    const runNumber = (latestRunByFrame.get(frame) || 0) + 1;
    latestRunByFrame.set(frame, runNumber);
    await skymodPushSchedule(frame, currentValues.scheduleSubjectColors);
    // Пока ждали расписание, мог начаться более новый запуск: устаревший нельзя
    // отправлять, иначе он перекроет свежий код и предпросмотр «залипнет» на старом.
    if (latestRunByFrame.get(frame) !== runNumber || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'skymod-sandbox-run', payload }, '*');
}
setInterval(() => {
    if (sandboxReady) skymodPushSchedule(getFrame(), currentValues.scheduleSubjectColors);
    if (siteSandboxReady) skymodPushSchedule(getSiteFrame(), currentValues.scheduleSubjectColors);
}, 15000);
function sendToSiteSandbox() {
    const payload = {
        html: currentValues.siteBuilderHtml || '', css: currentValues.siteBuilderCss || '', js: currentValues.siteBuilderJs || '',
        theme: computeSiteTheme(),
    };
    if (siteSandboxReady) {
        runInFrame(getSiteFrame(), payload);
    } else {
        sitePendingPayload = payload;
    }
}

// Один слушатель на оба iframe (попаповская песочница и предпросмотр
// фона сайта) — определяем источник по e.source и ведём две независимые
// пары состояний/панелей (иначе ошибка в коде сайта показалась бы в
// отладчике попапа и наоборот).
window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;

    const siteFrame = getSiteFrame();
    const isSite = siteFrame && e.source === siteFrame.contentWindow;
    const frame = isSite ? siteFrame : getFrame();
    const prefix = isSite ? SITE_BUILDER_STORAGE_PREFIX : BUILDER_STORAGE_PREFIX;

    if (data.type === 'skymod-sandbox-ready') {
        if (isSite) {
            siteSandboxReady = true;
            if (sitePendingPayload) {
                runInFrame(frame, sitePendingPayload);
                sitePendingPayload = null;
            }
        } else {
            sandboxReady = true;
            if (pendingPayload) {
                runInFrame(frame, pendingPayload);
                pendingPayload = null;
            }
        }
        return;
    }
    if (data.type === 'skymod-sandbox-ok') { (isSite ? clearSiteErrors : clearErrors)(); return; }
    if (data.type === 'skymod-sandbox-error') { (isSite ? appendSiteError : appendError)(data.message, data.line, data.stack); return; }
    if (data.type === 'skymod-sandbox-log') { (isSite ? appendSiteLog : appendLog)(data.level, data.message); return; }

    // storage.get/set/remove из песочницы — свой namespace на каждый
    // источник (попап и сайт не должны видеть storage друг друга).
    if (data.type === 'skymod-storage-get') {
        const storageKey = prefix + data.key;
        chrome.storage.local.get([storageKey], res => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: res[storageKey] ?? null }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-set') {
        const storageKey = prefix + data.key;
        chrome.storage.local.set({ [storageKey]: data.value }, () => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-remove') {
        const storageKey = prefix + data.key;
        chrome.storage.local.remove([storageKey], () => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
    }
});

// ---------- Отладчик и консоль ----------
// Параметризовано под ID своих панелей — общая функция под попап и под
// сайт, чтобы не дублировать одну и ту же логику дважды под разными
// именами (только storage/namespace различаются, поведение — одинаковое).
function createDebugPanel(errorListId, logPanelId, jsTextareaId, limit) {
    const entries = new Map();

    function appendLogImpl(level, message) {
        const panel = document.getElementById(logPanelId);
        const line = document.createElement('div');
        line.className = `log-line log-${level}`;
        line.textContent = message;
        panel.appendChild(line);
        while (panel.children.length > LOG_LIMIT) panel.removeChild(panel.firstChild);
        panel.scrollTop = panel.scrollHeight;
    }

    function jumpToLineImpl(line) {
        const ta = document.getElementById(jsTextareaId);
        ta.focus();
        const lines = ta.value.split('\n');
        let offset = 0;
        for (let i = 0; i < Math.min(line - 1, lines.length); i++) offset += lines[i].length + 1;
        const lineLength = (lines[line - 1] || '').length;
        ta.setSelectionRange(offset, offset + lineLength);
        const ratio = (line - 1) / Math.max(lines.length - 1, 1);
        ta.scrollTop = ratio * ta.scrollHeight;
    }

    function clearErrorsImpl() {
        entries.clear();
        document.getElementById(errorListId).innerHTML = '';
    }

    function appendErrorImpl(message, line, stack) {
        const list = document.getElementById(errorListId);
        const key = message + '@@' + (line || '');
        const existing = entries.get(key);
        if (existing) {
            existing.count += 1;
            existing.countEl.textContent = `×${existing.count}`;
            existing.countEl.style.display = 'inline';
            return;
        }
        if (entries.size >= limit) {
            const oldestKey = entries.keys().next().value;
            entries.get(oldestKey).el.remove();
            entries.delete(oldestKey);
        }

        const el = document.createElement('div');
        el.className = 'error-entry';
        const head = document.createElement('div');
        head.className = 'error-head';
        const msgEl = document.createElement('span');
        msgEl.className = 'error-msg';
        msgEl.textContent = message;
        const countEl = document.createElement('span');
        countEl.className = 'error-count';
        countEl.style.display = 'none';
        head.appendChild(msgEl);
        head.appendChild(countEl);
        el.appendChild(head);

        if (line) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'error-line-btn';
            btn.textContent = `строка ${line} → перейти`;
            btn.addEventListener('click', () => jumpToLineImpl(line));
            el.appendChild(btn);
        }
        if (stack) {
            const details = document.createElement('details');
            details.className = 'error-stack';
            const summary = document.createElement('summary');
            summary.textContent = 'Стек вызова';
            const pre = document.createElement('pre');
            pre.textContent = stack;
            details.appendChild(summary);
            details.appendChild(pre);
            el.appendChild(details);
        }

        list.appendChild(el);
        entries.set(key, { el, count: 1, countEl });
    }

    return { appendLog: appendLogImpl, appendError: appendErrorImpl, clearErrors: clearErrorsImpl };
}

const ERROR_LIMIT = 20;
const LOG_LIMIT = 150;
const popupDebug = createDebugPanel('error-list', 'log-panel', 'code-js', ERROR_LIMIT);
const siteDebug = createDebugPanel('site-error-list', 'site-log-panel', 'site-code-js', ERROR_LIMIT);

function appendLog(level, message) { popupDebug.appendLog(level, message); }
function appendError(message, line, stack) { popupDebug.appendError(message, line, stack); }
function clearErrors() { popupDebug.clearErrors(); }
function appendSiteLog(level, message) { siteDebug.appendLog(level, message); }
function appendSiteError(message, line, stack) { siteDebug.appendError(message, line, stack); }
function clearSiteErrors() { siteDebug.clearErrors(); }

// ---------- Примеры ----------
const EXAMPLES = [
    {
        name: 'Бегущая линия',
        html: '<canvas id="c"></canvas>',
        css: '#c { width: 100%; height: 100%; display: block; }',
        js:
`const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize();
window.addEventListener('resize', resize);

let raf;
function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hue = (t / 20) % 360;
    ctx.strokeStyle = \`hsl(\${hue}, 90%, 60%)\`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 4) {
        const y = canvas.height / 2 + Math.sin(x / 24 + t / 300) * 20;
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
return () => cancelAnimationFrame(raf);`,
    },
    {
        name: 'Частицы',
        html: '<canvas id="c"></canvas>',
        css: '#c { width: 100%; height: 100%; display: block; }',
        js:
`const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize();
window.addEventListener('resize', resize);

const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 1 + Math.random() * 2,
}));

let raf;
function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.mod || '#8a8f98';
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
return () => cancelAnimationFrame(raf);`,
    },
    {
        name: 'Часы (без canvas)',
        html: '<div id="clock"></div>',
        css:
`#clock {
    position: absolute; top: 6px; right: 12px;
    font: 700 11px 'SFMono-Regular', Consolas, monospace;
    color: rgba(255,255,255,0.55);
    letter-spacing: .05em;
}`,
        js:
`const el = root.querySelector('#clock');
function tick() { el.textContent = new Date().toLocaleTimeString('ru-RU'); }
tick();
const id = setInterval(tick, 1000);
return () => clearInterval(id);`,
    },
    {
        name: 'Счётчик кликов (storage)',
        html: '<button id="counter-btn">Клик: …</button>',
        css:
`#counter-btn {
    position: absolute; bottom: 10px; right: 10px;
    padding: 6px 10px; border: none; border-radius: 10px;
    background: var(--accent-bg, #8a8f98); color: #fff;
    font: 700 11px 'Manrope', sans-serif; cursor: pointer;
}`,
        js:
`// Требует включённых кликов ("Разрешить клики").
const btn = root.querySelector('#counter-btn');
storage.get('clicks').then(v => { btn.textContent = 'Клик: ' + (v || 0); });
btn.addEventListener('click', async () => {
    const next = (await storage.get('clicks') || 0) + 1;
    await storage.set('clicks', next);
    btn.textContent = 'Клик: ' + next;
    console.log('Счётчик:', next);
});`,
    },
];

// Примеры для фона сайта — используют только theme.accent (на сайте нет
// mod/pulse, это чисто попаповские переменные).
const SITE_EXAMPLES = [
    {
        name: 'Звёздное небо',
        html: '<canvas id="c"></canvas>',
        css: '#c { width: 100%; height: 100%; display: block; background: #0a0a0f; }',
        js:
`const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize();
window.addEventListener('resize', resize);

// Координаты хранятся в долях 0..1 и умножаются на размер при отрисовке —
// так звёзды не слипаются в углу, если размер холста на старте был 0.
const stars = Array.from({ length: 120 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.4, phase: Math.random() * Math.PI * 2,
}));

let raf;
function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 1000 + s.phase));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
return () => cancelAnimationFrame(raf);`,
    },
    {
        name: 'Бегущая линия',
        html: '<canvas id="c"></canvas>',
        css: '#c { width: 100%; height: 100%; display: block; }',
        js:
`const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize();
window.addEventListener('resize', resize);

let raf;
function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = theme.accent || '#8a8f98';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 4) {
        const y = canvas.height / 2 + Math.sin(x / 40 + t / 400) * 30;
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
return () => cancelAnimationFrame(raf);`,
    },
    {
        name: 'Фон по расписанию',
        html: '<canvas id="c"></canvas>',
        css: '#c { position: fixed; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }',
        js:
`const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Нет урока (schedule.color === null) - спокойный серо-синий. Цвет плавно
// подтягивается к цвету текущего урока, поэтому смена предмета не дёргается.
const NEUTRAL = [120, 130, 160];
const cur = NEUTRAL.slice();
let raf = 0, last = 0, t = 0;

function loop(ts) {
    if (W === 0 || H === 0) { resize(); raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(2, (ts - last) / 16.67 || 1);
    last = ts;
    t += 0.004 * dt;

    const target = schedule.color ? hexToRgb(schedule.color) : NEUTRAL;
    for (let i = 0; i < 3; i++) cur[i] += (target[i] - cur[i]) * 0.02 * dt;
    const c = cur.map(Math.round).join(',');

    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    const R = Math.max(W, H);
    [
        [0.25 + 0.1 * Math.sin(t * 0.7), 0.3 + 0.08 * Math.cos(t * 0.5), 0.6, 0.32],
        [0.75 + 0.1 * Math.cos(t * 0.6), 0.7 + 0.1 * Math.sin(t * 0.8), 0.5, 0.22],
    ].forEach(([fx, fy, fr, a]) => {
        const x = W * fx, y = H * fy;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * fr);
        g.addColorStop(0, 'rgba(' + c + ',' + a + ')');
        g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';

    // Внизу две тонкие линии: сколько прошло от всего учебного дня и от идущего урока.
    if (schedule.dayProgress !== null) {
        ctx.fillStyle = 'rgba(' + c + ',0.9)';
        ctx.fillRect(0, H - 3, W * schedule.dayProgress, 3);
    }
    if (schedule.current) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(0, H - 7, W * schedule.current.progress, 2);
    }

    raf = requestAnimationFrame(loop);
}
raf = requestAnimationFrame(loop);

return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
};`,
    },
];

function populateExamples() {
    $('#example-select').innerHTML = EXAMPLES.map((ex, i) => `<option value="${i}">${ex.name}</option>`).join('');
}
function populateSiteExamples() {
    $('#site-example-select').innerHTML = SITE_EXAMPLES.map((ex, i) => `<option value="${i}">${ex.name}</option>`).join('');
}

// ---------- Форма: загрузка/сохранение обычных полей ----------
function populateForm() {
    // Поле в фокусе не перезаписываем: человек сейчас в нём печатает, а значение
    // из хранилища может быть старее набранного.
    const setValue = (selector, value) => { const field = $(selector); if (field !== document.activeElement) field.value = value; };
    const setChecked = (selector, value) => { const field = $(selector); if (field !== document.activeElement) field.checked = value; };

    setChecked('#opt-enabled', !!currentValues.builderEnabled);
    setValue('#opt-layer', currentValues.builderLayer === 'over' ? 'over' : 'under');
    setValue('#opt-scope', ['full', 'header', 'panel'].includes(currentValues.builderScope) ? currentValues.builderScope : 'full');
    setChecked('#opt-interactive', !!currentValues.builderInteractive);
    setChecked('#opt-global-enabled', !!currentValues.builderGlobalCssEnabled);
    setValue('#code-html', currentValues.builderHtml || '');
    setValue('#code-css', currentValues.builderCss || '');
    setValue('#code-js', currentValues.builderJs || '');
    setValue('#code-global-css', currentValues.builderGlobalCss || '');

    setChecked('#site-opt-enabled', !!currentValues.siteBuilderEnabled);
    setValue('#site-opt-layer', currentValues.siteBuilderLayer === 'over' ? 'over' : 'under');
    setChecked('#site-opt-interactive', !!currentValues.siteBuilderInteractive);
    setValue('#site-code-html', currentValues.siteBuilderHtml || '');
    setValue('#site-code-css', currentValues.siteBuilderCss || '');
    setValue('#site-code-js', currentValues.siteBuilderJs || '');
}

function saveAndRun() {
    commitKeys({
        builderHtml: $('#code-html').value,
        builderCss: $('#code-css').value,
        builderJs: $('#code-js').value,
    });
    sendToSandbox();
}
function saveAndRunSite() {
    commitKeys({
        siteBuilderHtml: $('#site-code-html').value,
        siteBuilderCss: $('#site-code-css').value,
        siteBuilderJs: $('#site-code-js').value,
    });
    sendToSiteSandbox();
}

// Небольшая задержка после того, как человек перестал печатать — и в
// песочнице, и в живом предпросмотре справа код обновляется сам, без
// необходимости жать "Применить" после каждой правки. Не на каждый
// символ — иначе на середине набора невалидный код зря сыпал бы ошибки
// в отладчик и гонял запись в chrome.storage.local.
// У возвращаемой функции есть flush() (выполнить отложенный вызов сейчас) и cancel().
// Незавершённые вызовы сбрасываются при закрытии или скрытии страницы: раньше правка,
// сделанная меньше чем за задержку до закрытия вкладки, терялась.
const pendingDebounced = new Set();
function debounce(fn, delay) {
    let timer = null;
    let lastArgs = null;
    function runNow() {
        timer = null;
        pendingDebounced.delete(debounced);
        const args = lastArgs;
        lastArgs = null;
        fn(...args);
    }
    function debounced(...args) {
        lastArgs = args;
        clearTimeout(timer);
        timer = setTimeout(runNow, delay);
        pendingDebounced.add(debounced);
    }
    debounced.flush = () => {
        if (timer === null) return;
        clearTimeout(timer);
        runNow();
    };
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = null;
        lastArgs = null;
        pendingDebounced.delete(debounced);
    };
    return debounced;
}
function flushPendingSaves() {
    [...pendingDebounced].forEach(debounced => debounced.flush());
}
window.addEventListener('pagehide', flushPendingSaves);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSaves();
});

const debouncedSaveAndRun = debounce(saveAndRun, AUTOSAVE_DELAY_MS);
const debouncedSaveGlobalCss = debounce(() => saveKey('builderGlobalCss', $('#code-global-css').value), AUTOSAVE_DELAY_MS);
const debouncedSaveAndRunSite = debounce(saveAndRunSite, AUTOSAVE_DELAY_MS);

// ---------- QoL: Tab вставляет отступ, Ctrl/Cmd+Enter — применить сразу ----------
// Обычный <textarea> отдаёт Tab браузеру (фокус прыгает на следующее
// поле) — писать в нём код без этого невозможно. Плюс горячая клавиша
// "применить", привычная по любому онлайн-редактору кода (CodePen,
// JSFiddle и т.п.) — не обязательно тянуться мышкой к кнопке или ждать
// debounce после паузы в наборе.
const CODE_INDENT = '    '; // 4 пробела — совпадает с tab-size в CSS .code-area

function enhanceCodeTextarea(textarea, onApply) {
    textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (onApply) onApply();
            return;
        }
        if (e.key !== 'Tab') return;
        e.preventDefault();

        const { selectionStart, selectionEnd, value } = textarea;

        if (selectionStart === selectionEnd) {
            if (!e.shiftKey) {
                textarea.value = value.slice(0, selectionStart) + CODE_INDENT + value.slice(selectionEnd);
                textarea.selectionStart = textarea.selectionEnd = selectionStart + CODE_INDENT.length;
            } else {
                // Shift+Tab без выделения — снять отступ перед курсором, если он там есть.
                const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
                const beforeCursor = value.slice(lineStart, selectionStart);
                const trimmed = beforeCursor.replace(/^( {1,4}|\t)/, '');
                const removed = beforeCursor.length - trimmed.length;
                if (removed > 0) {
                    textarea.value = value.slice(0, lineStart) + trimmed + value.slice(lineStart + beforeCursor.length);
                    textarea.selectionStart = textarea.selectionEnd = selectionStart - removed;
                }
            }
        } else {
            // Выделение затрагивает несколько строк — отступ/снятие отступа
            // применяется к каждой строке целиком, а не только к выделенному куску.
            const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
            let lineEnd = value.indexOf('\n', selectionEnd);
            if (lineEnd === -1) lineEnd = value.length;
            const lines = value.slice(lineStart, lineEnd).split('\n');

            let startDelta = 0;
            let totalDelta = 0;
            let newLines;
            if (!e.shiftKey) {
                newLines = lines.map(l => CODE_INDENT + l);
                startDelta = CODE_INDENT.length;
                totalDelta = CODE_INDENT.length * lines.length;
            } else {
                newLines = lines.map((l, i) => {
                    const m = l.match(/^( {1,4}|\t)/);
                    if (!m) return l;
                    if (i === 0) startDelta = -m[0].length;
                    totalDelta -= m[0].length;
                    return l.slice(m[0].length);
                });
            }
            textarea.value = value.slice(0, lineStart) + newLines.join('\n') + value.slice(lineEnd);
            textarea.selectionStart = Math.max(lineStart, selectionStart + startDelta);
            textarea.selectionEnd = selectionEnd + totalDelta;
        }

        // Присвоение .value напрямую не порождает событие 'input' — без
        // этого debounce-автосохранение не узнает, что текст поменялся.
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

// ---------- Пресеты ----------
function currentAsPresetData() {
    return {
        html: currentValues.builderHtml || '', css: currentValues.builderCss || '', js: currentValues.builderJs || '',
        layer: currentValues.builderLayer || 'under', scope: currentValues.builderScope || 'full',
        interactive: !!currentValues.builderInteractive,
        globalCss: currentValues.builderGlobalCss || '', globalCssEnabled: !!currentValues.builderGlobalCssEnabled,
    };
}

// Пресеты фона сайта: код фона + слой + курсор + CSS частей интерфейса, то
// есть "внешний вид сайта" целиком.
let sitePresets = [];
function currentAsSitePresetData() {
    return {
        html: currentValues.siteBuilderHtml || '', css: currentValues.siteBuilderCss || '', js: currentValues.siteBuilderJs || '',
        layer: currentValues.siteBuilderLayer === 'over' ? 'over' : 'under',
        interactive: !!currentValues.siteBuilderInteractive,
        parts: getPartsData(),
    };
}

function persistPresets() {
    return commitKeys({ builderPresets: presets });
}
function persistSitePresets() {
    return commitKeys({ siteBuilderPresets: sitePresets });
}

// Общий отрисовщик списка пресетов: popup и сайт отличаются только
// контейнером, массивом, сохранением и применением.
function renderPresetList(listSel, getList, setList, persist, apply) {
    const list = $(listSel);
    list.innerHTML = '';
    const items = getList();
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'side-hint';
        empty.textContent = 'Пока пусто — сохраните текущее как первый пресет.';
        list.appendChild(empty);
        return;
    }
    items.forEach(p => {
        const row = document.createElement('div');
        row.className = 'preset-item';

        const name = document.createElement('span');
        name.className = 'preset-name';
        name.textContent = p.name;
        name.title = 'Загрузить пресет';
        name.addEventListener('click', () => { apply(p); showSaved(); });

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'preset-btn';
        renameBtn.title = 'Переименовать';
        renameBtn.textContent = '✏';
        renameBtn.addEventListener('click', () => {
            const next = prompt('Новое название пресета:', p.name);
            if (!next) return;
            p.name = next.trim().slice(0, 60) || p.name;
            persist();
            renderPresetList(listSel, getList, setList, persist, apply);
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'preset-btn danger';
        delBtn.title = 'Удалить';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
            if (!confirm(`Удалить пресет «${p.name}»?`)) return;
            setList(getList().filter(x => x.id !== p.id));
            persist();
            renderPresetList(listSel, getList, setList, persist, apply);
        });

        row.appendChild(name);
        row.appendChild(renameBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
    });
}

function renderPresets() {
    renderPresetList('#preset-list', () => presets, v => { presets = v; }, persistPresets, applyPresetData);
    renderPresetList('#site-preset-list', () => sitePresets, v => { sitePresets = v; }, persistSitePresets, applySitePresetData);
}

function newPresetId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Применяет пресет фона сайта как текущий рабочий код.
function applySitePresetData(data) {
    if (!data || typeof data !== 'object') return;
    const layer = data.layer === 'over' ? 'over' : 'under';
    const html = typeof data.html === 'string' ? data.html : '';
    const css = typeof data.css === 'string' ? data.css : '';
    const js = typeof data.js === 'string' ? data.js : '';
    const interactive = !!data.interactive;

    $('#site-code-html').value = html;
    $('#site-code-css').value = css;
    $('#site-code-js').value = js;
    $('#site-opt-layer').value = layer;
    $('#site-opt-interactive').checked = interactive;

    // Пресет применяется одной записью: фон сайта на открытых вкладках перезапустится
    // один раз, уже с итоговым кодом.
    const patch = {
        siteBuilderHtml: html, siteBuilderCss: css, siteBuilderJs: js,
        siteBuilderLayer: layer, siteBuilderInteractive: interactive,
    };
    const hasParts = data.parts && typeof data.parts === 'object';
    if (hasParts) patch.sitePartsCss = data.parts;
    commitKeys(patch);
    if (hasParts && typeof populatePartSelect === 'function') { populatePartSelect(); renderPartInfo(); }
    sendToSiteSandbox();
}

// Применяет пресет (или импортированный файл — та же форма данных) как
// текущий рабочий код: заполняет поля, сохраняет в хранилище (чтобы
// подхватил живой предпросмотр) и перезапускает в отладочной песочнице.
function applyPresetData(data) {
    if (!data || typeof data !== 'object') {
        appendError('Файл не похож на пресет конструктора — ожидался JSON-объект с полями html/css/js.', null, null);
        return;
    }
    const layer = data.layer === 'over' ? 'over' : 'under';
    const scope = ['full', 'header', 'panel'].includes(data.scope) ? data.scope : 'full';
    const html = typeof data.html === 'string' ? data.html : '';
    const css = typeof data.css === 'string' ? data.css : '';
    const js = typeof data.js === 'string' ? data.js : '';
    const globalCss = typeof data.globalCss === 'string' ? data.globalCss : '';
    const interactive = !!data.interactive;
    const globalCssEnabled = !!data.globalCssEnabled;

    $('#code-html').value = html;
    $('#code-css').value = css;
    $('#code-js').value = js;
    $('#code-global-css').value = globalCss;
    $('#opt-layer').value = layer;
    $('#opt-scope').value = scope;
    $('#opt-interactive').checked = interactive;
    $('#opt-global-enabled').checked = globalCssEnabled;

    commitKeys({
        builderHtml: html, builderCss: css, builderJs: js, builderGlobalCss: globalCss,
        builderLayer: layer, builderScope: scope, builderInteractive: interactive,
        builderGlobalCssEnabled: globalCssEnabled,
    });
    sendToSandbox();
}

// ---------- Связка событий ----------
function wireEvents() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Tab/Shift+Tab — отступы, Ctrl/Cmd+Enter — применить сразу. На все
    // текстовые поля кода разом, у каждого свой обработчик "применить".
    const CODE_TEXTAREA_APPLY = {
        'code-html': saveAndRun, 'code-css': saveAndRun, 'code-js': saveAndRun,
        'code-global-css': () => saveKey('builderGlobalCss', $('#code-global-css').value),
        'site-code-html': saveAndRunSite, 'site-code-css': saveAndRunSite, 'site-code-js': saveAndRunSite,
    };
    document.querySelectorAll('.code-area').forEach(ta => {
        if (ta.id === 'part-css') return; // свой обработчик в wirePartsEvents
        enhanceCodeTextarea(ta, CODE_TEXTAREA_APPLY[ta.id]);
    });

    $('#opt-enabled').addEventListener('change', e => saveKey('builderEnabled', e.target.checked));
    $('#opt-layer').addEventListener('change', e => saveKey('builderLayer', e.target.value));
    $('#opt-scope').addEventListener('change', e => saveKey('builderScope', e.target.value));
    $('#opt-interactive').addEventListener('change', e => saveKey('builderInteractive', e.target.checked));
    $('#opt-global-enabled').addEventListener('change', e => saveKey('builderGlobalCssEnabled', e.target.checked));
    $('#code-global-css').addEventListener('input', debouncedSaveGlobalCss);

    ['#code-html', '#code-css', '#code-js'].forEach(sel => $(sel).addEventListener('input', debouncedSaveAndRun));
    $('#apply-btn').addEventListener('click', saveAndRun);

    $('#example-btn').addEventListener('click', () => {
        const ex = EXAMPLES[Number($('#example-select').value) || 0];
        $('#code-html').value = ex.html;
        $('#code-css').value = ex.css;
        $('#code-js').value = ex.js;
        saveAndRun();
    });

    // --- Фон сайта: те же принципы, отдельный набор ключей/элементов ---
    $('#site-opt-enabled').addEventListener('change', e => saveKey('siteBuilderEnabled', e.target.checked));
    $('#site-opt-layer').addEventListener('change', e => saveKey('siteBuilderLayer', e.target.value));
    $('#site-opt-interactive').addEventListener('change', e => saveKey('siteBuilderInteractive', e.target.checked));

    ['#site-code-html', '#site-code-css', '#site-code-js'].forEach(sel => $(sel).addEventListener('input', debouncedSaveAndRunSite));
    $('#site-apply-btn').addEventListener('click', saveAndRunSite);

    $('#site-example-btn').addEventListener('click', () => {
        const ex = SITE_EXAMPLES[Number($('#site-example-select').value) || 0];
        $('#site-code-html').value = ex.html;
        $('#site-code-css').value = ex.css;
        $('#site-code-js').value = ex.js;
        saveAndRunSite();
    });

    $('#preset-save').addEventListener('click', async () => {
        const name = prompt('Название пресета:', `Пресет ${presets.length + 1}`);
        if (!name) return;
        presets.push({
            id: newPresetId(),
            name: name.trim().slice(0, 60) || 'Без названия',
            createdAt: Date.now(),
            ...currentAsPresetData(),
        });
        await persistPresets();
        renderPresets();
    });

    $('#site-copy-prompt').addEventListener('click', async e => {
        const btn = e.currentTarget; // после await currentTarget уже null
        await copyText(SKYMOD_SITE_BG_PROMPT);
        flashButton(btn, 'Скопировано');
    });

    $('#site-preset-save').addEventListener('click', async () => {
        const name = prompt('Название пресета:', `Пресет сайта ${sitePresets.length + 1}`);
        if (!name) return;
        sitePresets.push({
            id: newPresetId(),
            name: name.trim().slice(0, 60) || 'Без названия',
            createdAt: Date.now(),
            ...currentAsSitePresetData(),
        });
        await persistSitePresets();
        renderPresets();
    });

    $('#file-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(currentAsPresetData(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'skymod-constructor.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    });

    const importInput = $('#file-import-input');
    $('#file-import').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
        const file = importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                applyPresetData(JSON.parse(reader.result));
            } catch (err) {
                appendError('Не удалось прочитать файл: ' + err.message, null, null);
            }
        };
        reader.readAsText(file);
        importInput.value = '';
    });

    $('#preview-toggle').addEventListener('click', () => {
        const wrap = $('#preview-wrap');
        const hidden = wrap.classList.toggle('hidden');
        $('#preview-toggle').textContent = hidden ? 'Показать' : 'Скрыть';
    });

    $('#all-export').addEventListener('click', exportAllSettings);

    const allImportInput = $('#all-import-input');
    $('#all-import').addEventListener('click', () => allImportInput.click());
    allImportInput.addEventListener('change', () => {
        const file = allImportInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const payload = JSON.parse(reader.result);
                if (!payload || typeof payload !== 'object' || !payload.settings) {
                    throw new Error('это не файл экспорта настроек SkyMod');
                }
                openImportModal(payload);
            } catch (err) {
                appendError('Не удалось прочитать файл всех настроек: ' + err.message, null, null);
            }
        };
        reader.readAsText(file);
        allImportInput.value = '';
    });

    $('#import-cancel').addEventListener('click', closeImportModal);
    $('#import-confirm').addEventListener('click', confirmImportSelected);
}

// ---------- Экспорт/импорт ВСЕХ настроек SkyMod ----------
// Список категорий и сам экспорт — в settings-io.js (общий с попапом).
const exportAllSettings = skymodExportAllToFile;

let pendingImportSettings = null;

function openImportModal(payload) {
    pendingImportSettings = payload.settings || {};
    const list = $('#import-category-list');
    list.innerHTML = '';
    SETTINGS_CATEGORIES.forEach(cat => {
        const hasAny = cat.keys.some(k => Object.prototype.hasOwnProperty.call(pendingImportSettings, k));
        const row = document.createElement('label');
        row.className = 'modal-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.cat = cat.id;
        checkbox.checked = hasAny;
        checkbox.disabled = !hasAny;
        const textWrap = document.createElement('span');
        textWrap.className = 'modal-row-text';
        const title = document.createElement('span');
        title.className = 'modal-row-title';
        title.textContent = cat.title;
        const desc = document.createElement('span');
        desc.className = 'modal-row-desc';
        desc.textContent = hasAny ? cat.desc : 'В файле нет данных этой категории';
        textWrap.appendChild(title);
        textWrap.appendChild(desc);
        row.appendChild(checkbox);
        row.appendChild(textWrap);
        list.appendChild(row);
    });
    $('#import-modal').hidden = false;
}

function closeImportModal() {
    $('#import-modal').hidden = true;
    pendingImportSettings = null;
}

async function confirmImportSelected() {
    if (!pendingImportSettings) return;
    const checkedCats = [...document.querySelectorAll('#import-category-list input[type="checkbox"]:checked')].map(cb => cb.dataset.cat);
    const toWrite = {};
    SETTINGS_CATEGORIES.forEach(cat => {
        if (!checkedCats.includes(cat.id)) return;
        cat.keys.forEach(k => {
            if (Object.prototype.hasOwnProperty.call(pendingImportSettings, k)) toWrite[k] = pendingImportSettings[k];
        });
    });
    // Ниже currentValues перечитывается целиком, поэтому эхо этой записи пропускаем.
    Object.keys(toWrite).forEach(key => rememberWrite(key, toWrite[key]));
    await chrome.storage.local.set(toWrite);
    closeImportModal();

    // Могли поменяться и цвета (попапа и/или сайта — влияют на theme для
    // обеих песочниц), и оба конструктора, и пресеты — перечитываем всё.
    const stored = await chrome.storage.local.get([...BUILDER_KEYS, ...SITE_BUILDER_KEYS, ...THEME_KEYS, 'builderPresets', 'siteBuilderPresets']);
    currentValues = stored;
    presets = Array.isArray(stored.builderPresets) ? stored.builderPresets : [];
    sitePresets = Array.isArray(stored.siteBuilderPresets) ? stored.siteBuilderPresets : [];
    populateForm();
    renderPresets();
    if (typeof SKYMOD_PARTS !== 'undefined' && SKYMOD_PARTS.length) { populatePartSelect(); renderPartInfo(); }
    sendToSandbox();
    sendToSiteSandbox();
}

// ---------- Части интерфейса сайта ----------
// Данные: sitePartsCss = { [partId]: { enabled, css } }. Реестр частей (имена,
// селекторы, скриншоты, промпты) живёт в parts.js — общий для конструктора и
// документации. content.js на сайте просто подклеивает CSS включённых частей.
function getPartsData() {
    const v = currentValues.sitePartsCss;
    return (v && typeof v === 'object') ? v : {};
}
function currentPart() {
    const id = $('#part-select').value;
    return SKYMOD_PARTS.find(p => p.id === id) || SKYMOD_PARTS[0];
}
function populatePartSelect() {
    const data = getPartsData();
    const prev = $('#part-select').value;
    $('#part-select').innerHTML = SKYMOD_PARTS.map(p => {
        const d = data[p.id] || {};
        const filled = hasText(d.css) || hasText(d.html) || hasText(d.js);
        return `<option value="${p.id}">${p.name}${filled ? ' ●' : ''}</option>`;
    }).join('');
    if (prev && SKYMOD_PARTS.some(p => p.id === prev)) $('#part-select').value = prev;
}
function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function renderPartInfo() {
    const part = currentPart();
    const data = getPartsData()[part.id] || { enabled: false, css: '' };
    $('#part-enabled').checked = !!data.enabled;
    $('#part-css').value = data.css || '';
    $('#part-html').value = data.html || '';
    $('#part-js').value = data.js || '';
    const hasBehavior = !!part.behavior;
    $('#part-tabs').hidden = !hasBehavior;
    $('#part-behavior-help').hidden = !hasBehavior;
    $('#part-copy-behavior-prompt').hidden = !hasBehavior;
    showPartTab('css');
    const also = part.alsoApplyTo;
    $('#part-also-row').hidden = !also;
    $('#part-also-hint').hidden = !also;
    if (also) {
        $('#part-also').checked = !!data[also.key];
        $('#part-also-label').textContent = also.label;
        $('#part-also-hint').textContent = also.hint;
    }
    $('#part-info').innerHTML = `
        ${partPreviewSupported(part) ? '<div id="part-preview-host" class="part-preview-host"></div>' : (part.image ? `<img src="${part.image}" alt="${escapeHtml(part.name)}">` : '')}
        <p class="part-desc">${escapeHtml(part.description)}</p>
        <div>
            <p class="part-aliases-title">Как назвать в запросе к ИИ</p>
            <div class="chips">${part.aliases.map(a => `<span class="chip">${escapeHtml(a)}</span>`).join('')}</div>
        </div>
        <details>
            <summary>Элементы и селекторы (${part.elements.length})</summary>
            <ul>${part.elements.map(el => `<li>${escapeHtml(el.name)}: <code>${escapeHtml(el.selector)}</code></li>`).join('')}</ul>
        </details>`;
    previewLog.length = 0;
    if (partPreviewSupported(part)) refreshPartPreview(); else partPreviewDestroy();
    updatePartStateLabel();
}
const previewLog = [];
function previewPartsData() {
    const part = currentPart();
    const data = { ...getPartsData() };
    data[part.id] = { ...(data[part.id] || {}), css: $('#part-css').value, html: $('#part-html').value, js: $('#part-js').value };
    if (part.alsoApplyTo) data[part.id][part.alsoApplyTo.key] = $('#part-also').checked;
    return data;
}
function refreshPartPreview() {
    const part = currentPart();
    const host = $('#part-preview-host');
    if (!partPreviewSupported(part) || !host) return;
    partPreviewUpdate(host, part, previewPartsData(), (level, message) => {
        previewLog.push({ t: Date.now(), level, message, preview: true });
        if (previewLog.length > 40) previewLog.shift();
        renderPartLog();
    });
}
function updatePartStateLabel() {
    const on = $('#part-enabled').checked;
    const hasCss = ['#part-css', '#part-html', '#part-js'].some(sel => $(sel).value.trim().length > 0);
    const label = $('#part-state-label');
    label.classList.toggle('on', on && hasCss);
    label.textContent = !hasCss ? 'Нет кода' : (on ? 'Применяется на сайте' : 'Выключено');

    // Предупреждение прямо над редактором: CSS есть, но часть выключена.
    let warn = $('#part-warn');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'part-warn';
        warn.className = 'part-hint-warn';
        $('#part-css').before(warn);
    }
    warn.hidden = !(hasCss && !on);
    warn.textContent = 'Код написан, но часть выключена, и на сайте он не применяется. Включите переключатель справа вверху.';
}
function showPartTab(tab) {
    document.querySelectorAll('#part-tabs .part-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    $('#part-css').hidden = tab !== 'css';
    $('#part-html').hidden = tab !== 'html';
    $('#part-js').hidden = tab !== 'js';
    $('#part-log').hidden = !(tab === 'js' && currentPart().behavior);
    if (tab === 'js') renderPartLog();
}
function currentPartTab() {
    const active = document.querySelector('#part-tabs .part-tab.active');
    return active && !$('#part-tabs').hidden ? active.dataset.tab : 'css';
}
async function renderPartLog() {
    if ($('#part-log').hidden) return;
    const { behaviorLog } = await chrome.storage.local.get('behaviorLog');
    const id = currentPart().id;
    const site = (Array.isArray(behaviorLog) ? behaviorLog : []).filter(r => !r.partId || r.partId === id).map(r => ({ ...r, src: 'сайт: ' }));
    const rows = site.concat(previewLog.map(r => ({ ...r, src: 'предпросмотр: ' }))).sort((a, b) => a.t - b.t).slice(-60);
    $('#part-log-body').textContent = rows.length
        ? rows.map(r => `${new Date(r.t).toLocaleTimeString('ru-RU')} ${r.src}${r.level === 'log' ? '' : r.level.toUpperCase() + ' '}${r.message}`).join('\n')
        : 'Пока пусто. Сообщения api.log и ошибки появятся здесь: из предпросмотра сразу, с сайта после открытия вкладки.';
}
function refreshPartsFromStorage() {
    if (typeof SKYMOD_PARTS === 'undefined' || !SKYMOD_PARTS.length) return;
    populatePartSelect();
    // Редактор в фокусе не перезаписываем: в нём печатают.
    const editing = ['#part-css', '#part-html', '#part-js'].some(selector => document.activeElement === $(selector));
    if (!editing) renderPartInfo();
}

// Снимок редактора нужен отложенному сохранению: к моменту срабатывания задержки
// человек мог переключить часть, и тогда текст редактора принадлежал бы уже другой.
function capturePartEditorSnapshot() {
    return { partId: currentPart().id, css: $('#part-css').value, html: $('#part-html').value, js: $('#part-js').value };
}

function savePartField(patch, partId = currentPart().id) {
    const all = { ...getPartsData() };
    const next = { css: '', ...(all[partId] || {}), ...patch };
    // Первый вставленный CSS включает часть сам: иначе человек вставляет код
    // и не понимает, почему на сайте ничего не поменялось. Явное выключение
    // (enabled === false) уважается и сам не перебивается.
    if (typeof next.enabled !== 'boolean') next.enabled = hasText(next.css) || hasText(next.html) || hasText(next.js);
    all[partId] = next;
    saveKey('sitePartsCss', all);
    if (partId === currentPart().id) {
        $('#part-enabled').checked = next.enabled;
        updatePartStateLabel();
    }
}
const debouncedSavePartCss = debounce(snapshot => {
    savePartField({ css: snapshot.css, html: snapshot.html, js: snapshot.js }, snapshot.partId);
    // Заполненная часть помечается точкой в списке
    const sel = $('#part-select').value;
    populatePartSelect();
    $('#part-select').value = sel;
}, AUTOSAVE_DELAY_MS);

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) { /* копирование недоступно, пользователь скопирует руками */ }
        document.body.removeChild(ta);
    }
}
function flashButton(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = original; }, 1600);
}

function wirePartsEvents() {
    if (typeof SKYMOD_PARTS === 'undefined' || !SKYMOD_PARTS.length) return;
    populatePartSelect();
    renderPartInfo();

    // Незавершённая правка прежней части сохраняется до переключения: снимок знает её id.
    $('#part-select').addEventListener('change', () => { debouncedSavePartCss.flush(); renderPartInfo(); });
    $('#part-enabled').addEventListener('change', e => { savePartField({ enabled: e.target.checked }); updatePartStateLabel(); });
    ['#part-css', '#part-html', '#part-js'].forEach(sel => {
        $(sel).addEventListener('input', () => { debouncedSavePartCss(capturePartEditorSnapshot()); updatePartStateLabel(); refreshPartPreview(); });
        enhanceCodeTextarea($(sel), () => savePartField({ css: $('#part-css').value, html: $('#part-html').value, js: $('#part-js').value }));
    });
    document.querySelectorAll('#part-tabs .part-tab').forEach(btn => btn.addEventListener('click', () => showPartTab(btn.dataset.tab)));
    $('#part-log-clear').addEventListener('click', async () => { previewLog.length = 0; await chrome.storage.local.remove('behaviorLog'); renderPartLog(); });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.behaviorLog) renderPartLog();
        // sitePartsCss из другой вкладки или импорта подхватывает handleStorageChange:
        // без этого следующее сохранение перезаписало бы весь объект устаревшей копией.
    });
    $('#part-copy-behavior-prompt').addEventListener('click', async e => {
        const btn = e.currentTarget;
        await copyText(skymodBuildBehaviorPrompt(currentPart()));
        flashButton(btn, 'Скопировано');
    });
    $('#part-also').addEventListener('change', e => {
        const also = currentPart().alsoApplyTo;
        if (also) savePartField({ [also.key]: e.target.checked });
        refreshPartPreview();
    });

    $('#part-copy-prompt').addEventListener('click', async e => {
        const btn = e.currentTarget; // после await currentTarget уже null
        await copyText(skymodBuildPartPrompt(currentPart()));
        flashButton(btn, 'Скопировано');
    });
    $('#part-insert-example').addEventListener('click', () => {
        const beh = currentPart().behavior;
        if (beh) {
            $('#part-css').value = beh.example.css;
            $('#part-html').value = beh.example.html;
            $('#part-js').value = beh.example.js;
            savePartField({ css: beh.example.css, html: beh.example.html, js: beh.example.js, enabled: true });
            refreshPartPreview();
        } else {
            $('#part-css').value = currentPart().example;
            savePartField({ css: currentPart().example, enabled: true });
        }
        $('#part-enabled').checked = true;
        updatePartStateLabel();
        populatePartSelect();
        $('#part-select').value = currentPart().id;
    });
}

async function init() {
    const stored = await chrome.storage.local.get([...BUILDER_KEYS, ...SITE_BUILDER_KEYS, ...THEME_KEYS, 'builderPresets', 'siteBuilderPresets', MODE_STORAGE_KEY, 'builderTourDone']);
    currentValues = stored;
    presets = Array.isArray(stored.builderPresets) ? stored.builderPresets : [];
    sitePresets = Array.isArray(stored.siteBuilderPresets) ? stored.siteBuilderPresets : [];

    populateForm();
    populateExamples();
    populateSiteExamples();
    renderPresets();
    wireEvents();
    wirePartsEvents();
    chrome.storage.onChanged.addListener(handleStorageChange);
    updateModeDots();
    applyPreviewSize();
    setMode(stored[MODE_STORAGE_KEY] === 'site' ? 'site' : 'popup');
    $('#tour-btn').addEventListener('click', () => startBuilderTour());
    // Первый вход: показываем обучение один раз (флаг ставится при завершении или пропуске).
    if (!stored.builderTourDone) setTimeout(startBuilderTour, 500);
    sendToSandbox(); // сразу показать текущий код в отладчике, не дожидаясь правок
    sendToSiteSandbox();
}

init();
