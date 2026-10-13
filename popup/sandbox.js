// SkyMod — песочница конструктора.
//
// Это единственный файл во всём расширении, где допустимо выполнять
// динамический код (new Function). Он живёт на странице, объявленной
// в manifest.json → sandbox.pages, поэтому у неё СВОЙ, отдельный от
// остального расширения CSP, который Chrome разрешает делать мягче
// (script-src 'self' 'unsafe-inline' 'unsafe-eval') именно для таких
// изолированных страниц — see https://developer.chrome.com/docs/extensions/mv3/sandboxingEval/
//
// У этой страницы НЕТ доступа к chrome.* API и к DOM попапа — только то,
// что явно передаётся через postMessage. Это код, который пользователь
// САМ написал и сохранил в своих локальных настройках — сюда никогда не
// попадают чужие/внешние данные, так что это обычный, безопасный паттерн
// "пользовательских скриптов" (как в Tampermonkey/Stylus), а не дыра.

let styleTag = null;
let userCleanup = null;

// ---------- console.* → пересылаем в попап, там их видно в панели "Лог" ----------
// Оборачиваем один раз при загрузке страницы, а не при каждом runUserCode —
// иначе console.log внутри пользовательского кода задваивался бы с каждым
// повторным "Применить".
function safeStringify(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.stack || v.message;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
}
['log', 'warn', 'error', 'info'].forEach(level => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        original(...args);
        try {
            parent.postMessage({ type: 'skymod-sandbox-log', level, message: args.map(safeStringify).join(' ') }, '*');
        } catch (e) { /* сообщение не сериализуется — молча пропускаем, в консоли браузера всё равно останется */ }
    };
});

// ---------- Встроенный отладчик: парсим номер строки из стека ----------
// new Function('root','canvas','storage','theme','schedule', js) в V8 разворачивается в:
//   function anonymous(root,canvas,storage,theme,schedule
//   ) {
//   <js>
//   }
// т.е. тело пользователя начинается с 3-й строки сгенерированного
// источника — вычитаем 2, чтобы получить номер строки в ЕГО коде
// (том самом, что лежит в textarea "JS" на вкладке конструктора).
function parseErrorLine(err) {
    if (!err || !err.stack) return null;
    const match = String(err.stack).match(/(?:anonymous|<anonymous>):(\d+):(\d+)/);
    if (!match) return null;
    const line = Number(match[1]) - 2;
    return line > 0 ? line : null;
}

function reportError(err) {
    const message = (err && err.message) ? err.message : String(err);
    parent.postMessage({
        type: 'skymod-sandbox-error',
        message,
        line: parseErrorLine(err),
        stack: (err && err.stack) ? String(err.stack) : null,
    }, '*');
}

// Ловит то, что не попадёт в try/catch вокруг первого вызова — ошибку
// внутри requestAnimationFrame/setTimeout/обработчика события, брошенную
// уже ПОСЛЕ того, как ваш код успешно запустился.
window.addEventListener('error', (e) => {
    reportError(e.error || new Error(e.message));
});
// То же самое для необработанных отказов промисов — например,
// storage.get(...).then(...) без .catch(), в котором что-то упало.
window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    reportError(reason instanceof Error ? reason : new Error(safeStringify(reason)));
});

// ---------- storage: мост к chrome.storage.local родителя ----------
// У самой песочницы нет chrome.* — все get/set идут через postMessage,
// родитель кладёт данные в chrome.storage.local под своим namespace
// (см. popup.js), сюда возвращается просто value.
let storageRequestId = 0;
const pendingStorageRequests = new Map();
const storage = {
    get(key) {
        return new Promise(resolve => {
            const id = ++storageRequestId;
            pendingStorageRequests.set(id, resolve);
            parent.postMessage({ type: 'skymod-storage-get', id, key }, '*');
        });
    },
    set(key, value) {
        return new Promise(resolve => {
            const id = ++storageRequestId;
            pendingStorageRequests.set(id, resolve);
            parent.postMessage({ type: 'skymod-storage-set', id, key, value }, '*');
        });
    },
    remove(key) {
        return new Promise(resolve => {
            const id = ++storageRequestId;
            pendingStorageRequests.set(id, resolve);
            parent.postMessage({ type: 'skymod-storage-remove', id, key }, '*');
        });
    },
};

// ---------- Расписание ----------
// Живой объект: ссылка на него не меняется, родитель присылает свежие данные
// сообщением skymod-schedule, а мы переписываем поля на месте. Поэтому код
// фона может читать schedule.current / schedule.phase прямо в кадре
// анимации, а для реакции на смену урока есть событие window "skymod-schedule".
const schedule = {
    ready: false, now: Date.now(), date: '', phase: 'free', lessons: [],
    current: null, next: null, previous: null, remaining: 0, dayProgress: null, color: null,
};

function applyScheduleData(data) {
    if (!data || typeof data !== 'object') return;
    Object.assign(schedule, data);
    window.dispatchEvent(new CustomEvent('skymod-schedule', { detail: schedule }));
}

function runUserCode(payload) {
    const { html = '', css = '', js = '', theme = {} } = payload || {};

    // Если предыдущий запуск вернул функцию очистки (например, отменял
    // свой requestAnimationFrame) — вызываем её перед тем, как стереть DOM,
    // иначе старый цикл анимации продолжит тикать в пустоту.
    if (typeof userCleanup === 'function') {
        try { userCleanup(); } catch (e) { /* пользовательский код сам виноват, если тут упадёт */ }
    }
    userCleanup = null;

    const root = document.getElementById('skymod-root');
    root.innerHTML = html;

    if (styleTag) styleTag.remove();
    styleTag = document.createElement('style');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);

    // Доступны и как window.SKYMOD_THEME, и как 4-й аргумент функции —
    // текущие цвета Mod/пульсов/интерфейса из вкладки "Попап", чтобы
    // конструктор мог держать тот же акцент, не хардкодя цвета заново.
    window.SKYMOD_THEME = theme;
    window.SKYMOD_SCHEDULE = schedule;

    if (!js.trim()) {
        parent.postMessage({ type: 'skymod-sandbox-ok' }, '*');
        return;
    }

    try {
        // new Function — не eval: не видит область видимости этого файла,
        // получает только то, что мы явно передаём аргументами.
        const canvas = root.querySelector('canvas');
        const runner = new Function('root', 'canvas', 'storage', 'theme', 'schedule', js);
        const maybeCleanup = runner(root, canvas || null, storage, theme, schedule);
        if (typeof maybeCleanup === 'function') userCleanup = maybeCleanup;
        parent.postMessage({ type: 'skymod-sandbox-ok' }, '*');
    } catch (err) {
        // Синтаксическая ошибка (new Function не смогла скомпилировать)
        // или исключение на самом первом, синхронном запуске.
        reportError(err);
    }
}

// Мышь, пересланная родительской страницей (режим "Взаимодействие с
// курсором" у фона сайта). iframe сам событий мыши не получает
// (pointer-events: none), поэтому воссоздаём их как настоящие MouseEvent —
// код пользователя слушает обычные window.addEventListener('mousemove', ...).
function dispatchForwardedPointer(data) {
    if (data.event === 'mouseleave') {
        window.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        return;
    }
    const allowed = ['mousemove', 'mousedown', 'mouseup', 'click'];
    if (!allowed.includes(data.event)) return;
    document.dispatchEvent(new MouseEvent(data.event, {
        bubbles: true, cancelable: false, view: window,
        clientX: Number(data.x) || 0, clientY: Number(data.y) || 0,
        buttons: Number(data.buttons) || 0,
    }));
}

window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;
    if (data.type === 'skymod-schedule') {
        if (e.source === parent) applyScheduleData(data.data);
        return;
    }
    if (data.type === 'skymod-pointer') {
        if (e.source === parent) dispatchForwardedPointer(data);
        return;
    }
    if (data.type === 'skymod-sandbox-run') {
        runUserCode(data.payload);
        return;
    }
    if (data.type === 'skymod-storage-result' && pendingStorageRequests.has(data.id)) {
        pendingStorageRequests.get(data.id)(data.value);
        pendingStorageRequests.delete(data.id);
    }
});

// Сообщаем родителю, что можно присылать код — до этого сообщения
// присланное могло бы потеряться (слушатель уже есть, но лучше явно).
parent.postMessage({ type: 'skymod-sandbox-ready' }, '*');
