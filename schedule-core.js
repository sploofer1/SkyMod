// SkyMod — общая логика расписания. Подключается как обычный скрипт и в
// content.js (manifest → content_scripts, ПЕРЕД content.js), и в попапе и
// конструкторе (popup.html, builder.html). Всё объявлено глобально и с
// префиксом skymod, чтобы не пересекаться с остальными скриптами.
//
// Откуда берутся данные: content.js читает карточки занятий на странице
// расписания (data-test-атрибуты и aria-label кнопки "student schedule slot
// open", вида "Занятие, 11:10-12:45, Алгоритмы"), складывает их в
// chrome.storage.local под ключом SKYMOD_SCHEDULE_CACHE_KEY и каждые
// несколько секунд пересчитывает объект schedule через skymodBuildSchedule.
// Этот же объект получают код фона (аргумент schedule) и попап.

const SKYMOD_SCHEDULE_CACHE_KEY = 'siteScheduleCache';

// ---------- Цвета предметов ----------

function skymodHslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
    return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

// Цвет по умолчанию для предмета без выбранного пользователем: оттенок
// считается из кода предмета, поэтому он стабилен между запусками и
// страницами, и у разных предметов разный.
function skymodAutoSubjectColor(code) {
    let hash = 0;
    const str = String(code || '');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return skymodHslToHex(hash % 360, 68, 58);
}

function skymodIsHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function skymodSubjectColor(code, colorMap) {
    const own = colorMap && colorMap[code];
    return skymodIsHexColor(own) ? own : skymodAutoSubjectColor(code);
}

function skymodHexToRgbString(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
}

// ---------- Разбор подписи слота ----------

// "Занятие, 11:10-12:45, Алгоритмы" -> { startMin: 670, endMin: 765, title: 'Алгоритмы', kind: 'Занятие' }
// Разделитель времени может быть дефисом, коротким или длинным тире.
// Если конец раньше начала (занятие через полночь), конец сдвигается на сутки.
function skymodParseSlotLabel(label) {
    const text = String(label || '');
    const m = text.match(/(\d{1,2})[:.](\d{2})\s*[-\u2013\u2014]\s*(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const startMin = Number(m[1]) * 60 + Number(m[2]);
    let endMin = Number(m[3]) * 60 + Number(m[4]);
    if (endMin <= startMin) endMin += 24 * 60;
    const trim = s => s.replace(/^[\s,;:\u2013\u2014-]+|[\s,;:\u2013\u2014-]+$/g, '');
    return {
        startMin,
        endMin,
        kind: trim(text.slice(0, m.index)),
        title: trim(text.slice(m.index + m[0].length)),
    };
}

// ---------- Время ----------

function skymodLocalDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function skymodTimeLabel(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// "2026-10-02" + минуты от полуночи -> timestamp в локальном часовом поясе
function skymodDateKeyToTs(dateKey, minutes) {
    const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return NaN;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, minutes, 0, 0).getTime();
}

// ---------- Сборка объекта schedule ----------

// lessons: [{ id, subject, title, type, state, start, end }] (start/end в мс).
// Возвращает ВСЕ поля заново (в том числе null), чтобы Object.assign поверх
// живого объекта гарантированно перезаписывал устаревшие значения.
function skymodBuildSchedule(lessons, now, colorMap) {
    const t = typeof now === 'number' ? now : Date.now();
    const list = (Array.isArray(lessons) ? lessons : [])
        .filter(l => l && Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start)
        .map(l => ({
            id: l.id || '',
            subject: l.subject || '',
            title: l.title || '',
            type: l.type || '',
            kind: l.kind || '',
            state: l.state || '',
            start: l.start,
            end: l.end,
            startLabel: skymodTimeLabel(l.start),
            endLabel: skymodTimeLabel(l.end),
            durationMin: Math.round((l.end - l.start) / 60000),
            color: skymodSubjectColor(l.subject, colorMap),
        }))
        .sort((a, b) => a.start - b.start);

    let current = null;
    let next = null;
    let previous = null;
    list.forEach(l => {
        if (l.start <= t && t < l.end) current = l; // при наложении берётся начавшееся позже
        if (l.start > t && !next) next = l;
        if (l.end <= t) previous = l;
    });

    let phase = 'free';
    if (list.length) {
        if (current) phase = 'lesson';
        else if (t < list[0].start) phase = 'before';
        else if (t >= list[list.length - 1].end) phase = 'after';
        else phase = 'break';
    }

    let dayProgress = null;
    if (list.length) {
        const first = list[0].start;
        const last = list[list.length - 1].end;
        dayProgress = Math.max(0, Math.min(1, (t - first) / (last - first)));
    }

    // Цвет, под который должна подстраиваться тема: на уроке цвет урока, до
    // начала и в перерыве цвет ближайшего следующего, после занятий и в
    // свободный день цвета нет (тема возвращается к обычной).
    let color = null;
    if (phase === 'lesson') color = current.color;
    else if (phase === 'before' || phase === 'break') color = next ? next.color : null;

    return {
        ready: list.length > 0,
        now: t,
        date: skymodLocalDateKey(t),
        phase,
        lessons: list,
        current: current && {
            ...current,
            progress: (t - current.start) / (current.end - current.start),
            minutesLeft: Math.max(0, Math.ceil((current.end - t) / 60000)),
        },
        next: next && {
            ...next,
            minutesUntil: Math.max(0, Math.ceil((next.start - t) / 60000)),
        },
        previous,
        remaining: list.filter(l => l.end > t).length,
        dayProgress,
        color,
    };
}

// ---------- Для попапа и конструктора (там есть chrome.storage) ----------

// Собирает schedule из сохранённого кэша (его пишет content.js на странице
// расписания). Если кэш от другого дня, расписания на сегодня нет.
async function skymodLoadScheduleFromCache(colorMap) {
    const stored = await chrome.storage.local.get(SKYMOD_SCHEDULE_CACHE_KEY);
    const cache = stored[SKYMOD_SCHEDULE_CACHE_KEY];
    const now = Date.now();
    const lessons = cache && cache.date === skymodLocalDateKey(now) ? cache.lessons : [];
    return skymodBuildSchedule(lessons, now, colorMap);
}

// Отправляет свежее расписание в песочницу. Вызывается ПЕРЕД запуском кода
// (чтобы schedule был заполнен к старту) и по таймеру.
async function skymodPushSchedule(frame, colorMap) {
    if (!frame || !frame.contentWindow) return;
    const data = await skymodLoadScheduleFromCache(colorMap);
    frame.contentWindow.postMessage({ type: 'skymod-schedule', data }, '*');
}
