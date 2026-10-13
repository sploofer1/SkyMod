/*
 * SkyMod, diag-hook.js. Работает в мире страницы (world: MAIN) с document_start и
 * подключён ПЕРЕД antilock.js: так он успевает запомнить настоящие getter'ы
 * visibilityState и hasFocus до того, как antilock их подменит.
 *
 * Ведёт журнал для диагностики сайта и раз в секунду отдаёт его content.js через
 * window.postMessage. Сам ничего не сохраняет и никуда не отправляет. Пишет:
 *   - fetch, XHR, sendBeacon: метод, адрес без секретов, код ответа, время, размер,
 *     структуру JSON (имена полей и короткие значения вроде type или status);
 *   - WebSocket и EventSource: открытие, закрытие, ошибки, размеры и структуру сообщений;
 *   - таймеры от 20 секунд и слушатели visibilitychange, focus, mousemove и подобных на
 *     window и document вместе с местом в коде, откуда они созданы (так находят код,
 *     который решает "страница заскучала");
 *   - настоящую видимость и фокус вкладки, ошибки, отказы промисов, console.error;
 *   - раз в минуту отметку "жива, не активна N секунд".
 * Тела ответов и сообщения (первые символы) пишутся, только если на <html> стоит
 * data-skymod-diag-bodies="1". Адреса, токены, e-mail и телефоны маскируются.
 */
(() => {
    if (window.__skymodDiagHook) return;
    window.__skymodDiagHook = true;

    const root = document.documentElement;
    const stateDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    const realStateGet = stateDesc && stateDesc.get;
    const realHasFocus = Document.prototype.hasFocus;
    const nativeSetTimeout = window.setTimeout;
    const nativeSetInterval = window.setInterval;
    const nativeAdd = EventTarget.prototype.addEventListener;

    const MAX_PENDING = 300;
    const SENSITIVE_KEY = /(auth|token|cookie|pass(word)?|secret|session|jwt|csrf|xsrf|api[-_]?key|credential|signature|bearer|sid)/i;
    const SHAPE_VALUE_KEYS = /^(type|event|action|status|code|reason|op|kind|cmd|command|error|state)$/i;

    const realVis = () => { try { return realStateGet ? realStateGet.call(document) : 'unknown'; } catch (e) { return 'unknown'; } };
    const realFocus = () => { try { return realHasFocus.call(document); } catch (e) { return false; } };
    const on = (target, type, fn, opts) => nativeAdd.call(target, type, fn, opts);
    const bodiesOn = () => root.getAttribute('data-skymod-diag-bodies') === '1';

    const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g;
    const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
    const PHONE = /\+\d[\d\s().-]{9,}\d/g;
    const SECRET_JSON = /("[^"]*(?:token|secret|pass|auth|session|cookie|jwt|key)[^"]*"\s*:\s*)"[^"]*"/gi;

    function redactText(text) {
        return String(text).replace(JWT, '[JWT]').replace(SECRET_JSON, '$1"[hidden]"').replace(EMAIL, '[email]').replace(PHONE, '[phone]');
    }

    function looksSecret(value) {
        return /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(value) || /^[A-Za-z0-9_\-+/=]{32,}$/.test(value);
    }

    function redactUrl(raw) {
        try {
            const u = new URL(String(raw), location.href);
            u.pathname = u.pathname.split('/').map(seg => (looksSecret(decodeURIComponent(seg)) ? ':secret' : seg)).join('/');
            Array.from(u.searchParams.keys()).forEach(k => {
                if (SENSITIVE_KEY.test(k) || looksSecret(u.searchParams.get(k) || '')) u.searchParams.set(k, 'REDACTED');
            });
            return (u.origin === location.origin ? '' : u.origin) + u.pathname + u.search;
        } catch (e) {
            return String(raw).slice(0, 200).replace(/[?#].*$/, '');
        }
    }

    function shortUrl(raw) {
        try {
            const u = new URL(raw);
            return (u.origin === location.origin ? '' : u.host) + u.pathname;
        } catch (e) {
            return String(raw).slice(0, 120);
        }
    }

    // Первые кадры стека вне расширения и вне zone.js / polyfills (через них идут
    // почти все вызовы Angular, а полезен код сайта глубже).
    function stackTop(limit) {
        const lines = String(new Error().stack || '').split('\n').slice(1);
        const out = [];
        for (const line of lines) {
            if (line.includes('chrome-extension://')) continue;
            const m = line.match(/at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/);
            if (!m || /zone|polyfills/i.test(m[2])) continue;
            out.push((m[1] ? m[1] + ' ' : '') + shortUrl(m[2]) + ':' + m[3] + ':' + m[4]);
            if (out.length >= (limit || 4)) break;
        }
        return out.join(' < ');
    }

    function shapeOf(text) {
        if (typeof text !== 'string' || text.length > 300000) return undefined;
        const first = text.trimStart()[0];
        if (first !== '{' && first !== '[') return undefined;
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                const item = data[0];
                return { arr: data.length, first: item && typeof item === 'object' ? Object.keys(item).slice(0, 20) : undefined };
            }
            if (!data || typeof data !== 'object') return undefined;
            const shape = { keys: Object.keys(data).slice(0, 25) };
            Object.keys(data).forEach(k => {
                const v = data[k];
                if (SHAPE_VALUE_KEYS.test(k) && ['string', 'number', 'boolean'].includes(typeof v) && String(v).length <= 60) {
                    (shape.v = shape.v || {})[k] = typeof v === 'string' ? redactText(v) : v;
                }
            });
            return shape;
        } catch (e) {
            return undefined;
        }
    }

    function fillBody(entry, text) {
        text = String(text || '');
        entry.sz = text.length;
        entry.shape = shapeOf(text);
        if (bodiesOn()) entry.body = redactText(text.slice(0, 1200));
    }

    let pending = [];
    let flushTimer = 0;
    let lastActivity = Date.now();
    const timerSeen = new Map();
    let timersDirty = false;

    function flush() {
        flushTimer = 0;
        const msg = {
            __skymodDiag: 1,
            entries: pending,
            state: { lastActivity, now: Date.now(), vis: realVis(), f: realFocus() ? 1 : 0 },
        };
        if (timersDirty) {
            msg.timers = Array.from(timerSeen.values()).sort((a, b) => b.n - a.n).slice(0, 60);
            timersDirty = false;
        }
        pending = [];
        try { window.postMessage(msg, location.origin); } catch (e) { /* страница закрывается */ }
    }

    function push(entry) {
        entry.t = Date.now();
        pending.push(entry);
        if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
        if (!flushTimer) flushTimer = nativeSetTimeout.call(window, flush, 1000);
    }

    function guard(fn) { try { fn(); } catch (e) { /* хук не должен ломать сайт */ } }

    guard(() => {
        window.setTimeout = function setTimeout(fn, delay) { logTimer('timeout', delay); return nativeSetTimeout.apply(this, arguments); };
        window.setInterval = function setInterval(fn, delay) { logTimer('interval', delay); return nativeSetInterval.apply(this, arguments); };
    });

    function logTimer(kind, delay) {
        delay = Number(delay) || 0;
        if (delay < 20000) return;
        const stack = stackTop(4);
        const key = kind + '|' + delay + '|' + stack;
        const seen = timerSeen.get(key);
        if (seen) { seen.n++; timersDirty = true; if (!flushTimer) flushTimer = nativeSetTimeout.call(window, flush, 1000); return; }
        if (timerSeen.size >= 200) return;
        const rec = { k: 'timer', kind, delay, stack, n: 1 };
        timerSeen.set(key, rec);
        timersDirty = true;
        push(Object.assign({}, rec));
    }

    guard(() => {
        const WATCH = new Set(['visibilitychange', 'focus', 'blur', 'freeze', 'resume', 'pagehide', 'pageshow', 'online', 'offline',
            'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel', 'beforeunload', 'unload', 'storage']);
        const listenerSeen = new Set();
        EventTarget.prototype.addEventListener = function addEventListener(type) {
            try {
                if (WATCH.has(type) && (this === window || this === document || this === document.documentElement || this === document.body) && listenerSeen.size < 500) {
                    const stack = stackTop(4);
                    if (stack) {
                        const target = this === window ? 'window' : (this === document ? 'document' : 'element');
                        const key = type + '|' + target + '|' + stack;
                        if (!listenerSeen.has(key)) { listenerSeen.add(key); push({ k: 'listener', ev: type, on: target, stack }); }
                    }
                }
            } catch (e) { /* ничего */ }
            return nativeAdd.apply(this, arguments);
        };
    });

    guard(() => {
        const nativeFetch = window.fetch;
        if (typeof nativeFetch !== 'function') return;
        window.fetch = function fetch(input, init) {
            const started = performance.now();
            const entry = {
                k: 'fetch',
                m: String((init && init.method) || (input && input.method) || 'GET').toUpperCase(),
                u: redactUrl(typeof input === 'string' ? input : (input && input.url) || input),
            };
            const promise = nativeFetch.apply(this, arguments);
            promise.then(res => {
                try {
                    entry.s = res.status;
                    entry.d = Math.round(performance.now() - started);
                    const ct = res.headers.get('content-type') || '';
                    entry.ct = ct.split(';')[0];
                    const len = Number(res.headers.get('content-length'));
                    if (/json|text|xml/.test(ct) && !/event-stream/.test(ct) && (!len || len < 300000)) {
                        res.clone().text().then(text => { fillBody(entry, text); push(entry); }, () => push(entry));
                        return;
                    }
                } catch (e) { /* ответ нельзя клонировать */ }
                push(entry);
            }, err => {
                entry.d = Math.round(performance.now() - started);
                entry.err = redactText(String((err && err.message) || err)).slice(0, 200);
                push(entry);
            });
            return promise;
        };
    });

    guard(() => {
        const meta = new WeakMap();
        const nativeOpen = XMLHttpRequest.prototype.open;
        const nativeSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function open(method, url) {
            try { meta.set(this, { m: String(method).toUpperCase(), u: redactUrl(url) }); } catch (e) { /* ничего */ }
            return nativeOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function send() {
            const info = meta.get(this);
            if (info) {
                const started = performance.now();
                on(this, 'loadend', () => {
                    try {
                        const entry = { k: 'xhr', m: info.m, u: info.u, s: this.status, d: Math.round(performance.now() - started) };
                        const ct = this.getResponseHeader('content-type') || '';
                        entry.ct = ct.split(';')[0];
                        if (/json|text|xml/.test(ct) && (this.responseType === '' || this.responseType === 'text')) fillBody(entry, this.responseText);
                        push(entry);
                    } catch (e) { /* ничего */ }
                });
            }
            return nativeSend.apply(this, arguments);
        };
    });

    guard(() => {
        if (typeof window.WebSocket !== 'function') return;
        const ids = new WeakMap();
        let counter = 0;
        const frame = data => {
            if (typeof data === 'string') {
                const entry = { sz: data.length, shape: shapeOf(data) };
                if (bodiesOn()) entry.body = redactText(data.slice(0, 500));
                return entry;
            }
            return { sz: (data && (data.byteLength || data.size)) || 0, bin: true };
        };
        const nativeSend = window.WebSocket.prototype.send;
        window.WebSocket.prototype.send = function send(data) {
            try { push(Object.assign({ k: 'ws-out', id: ids.get(this) }, frame(data))); } catch (e) { /* ничего */ }
            return nativeSend.apply(this, arguments);
        };
        window.WebSocket = new Proxy(window.WebSocket, {
            construct(target, args, newTarget) {
                const ws = Reflect.construct(target, args, newTarget);
                try {
                    const id = ++counter;
                    ids.set(ws, id);
                    push({ k: 'ws-open', id, u: redactUrl(args[0]) });
                    on(ws, 'open', () => push({ k: 'ws-opened', id }));
                    on(ws, 'close', e => push({ k: 'ws-close', id, code: e.code, reason: redactText(e.reason || '').slice(0, 100), clean: e.wasClean }));
                    on(ws, 'error', () => push({ k: 'ws-error', id }));
                    on(ws, 'message', e => push(Object.assign({ k: 'ws-in', id }, frame(e.data))));
                } catch (e) { /* ничего */ }
                return ws;
            },
        });
    });

    guard(() => {
        if (typeof window.EventSource !== 'function') return;
        let counter = 0;
        window.EventSource = new Proxy(window.EventSource, {
            construct(target, args, newTarget) {
                const es = Reflect.construct(target, args, newTarget);
                try {
                    const id = ++counter;
                    push({ k: 'sse-open', id, u: redactUrl(args[0]) });
                    on(es, 'error', () => push({ k: 'sse-error', id, rs: es.readyState }));
                    on(es, 'message', e => push({ k: 'sse-in', id, sz: String(e.data).length, shape: shapeOf(String(e.data)) }));
                } catch (e) { /* ничего */ }
                return es;
            },
        });
    });

    guard(() => {
        const nativeBeacon = Navigator.prototype.sendBeacon;
        if (typeof nativeBeacon !== 'function') return;
        Navigator.prototype.sendBeacon = function sendBeacon(url, data) {
            try { push({ k: 'beacon', u: redactUrl(url), sz: typeof data === 'string' ? data.length : ((data && data.size) || 0) }); } catch (e) { /* ничего */ }
            return nativeBeacon.apply(this, arguments);
        };
    });

    guard(() => {
        ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(type => {
            on(window, type, ev => { if (ev.isTrusted) lastActivity = Date.now(); }, { capture: true, passive: true });
        });
        const journal = (kind, extra) => push(Object.assign({ k: kind, vis: realVis(), f: realFocus() ? 1 : 0 }, extra));
        on(window, 'visibilitychange', () => { journal('vis'); if (realVis() === 'hidden') flush(); }, true);
        on(window, 'focus', () => journal('focus'), true);
        on(window, 'blur', () => journal('blur'), true);
        on(document, 'freeze', () => journal('freeze'), true);
        on(document, 'resume', () => journal('resume'), true);
        on(window, 'pageshow', e => journal('pageshow', { persisted: !!e.persisted }), true);
        on(window, 'pagehide', e => { journal('pagehide', { persisted: !!e.persisted }); flush(); }, true);
        on(window, 'online', () => journal('online'), true);
        on(window, 'offline', () => journal('offline'), true);
        on(window, 'beforeunload', () => { journal('beforeunload'); flush(); }, true);
        on(window, 'error', e => {
            if (e.target && e.target !== window && e.target.tagName) {
                push({ k: 'res-error', tag: e.target.tagName, src: redactUrl(e.target.src || e.target.href || '') });
            } else {
                push({ k: 'js-error', msg: redactText(String(e.message)).slice(0, 300), src: shortUrl(e.filename || ''), line: e.lineno, col: e.colno });
            }
        }, true);
        on(window, 'unhandledrejection', e => {
            const reason = e.reason;
            push({ k: 'rejection', msg: redactText(String((reason && (reason.stack || reason.message)) || reason)).slice(0, 400) });
        });
        ['error', 'warn'].forEach(level => {
            const native = console[level];
            console[level] = function () {
                try { push({ k: 'console-' + level, msg: redactText(Array.from(arguments).map(a => (typeof a === 'string' ? a : (a && a.message) || '[объект]')).join(' ')).slice(0, 300) }); } catch (e) { /* ничего */ }
                return native.apply(this, arguments);
            };
        });
        nativeSetInterval.call(window, () => {
            push({ k: 'beat', vis: realVis(), f: realFocus() ? 1 : 0, idleSec: Math.round((Date.now() - lastActivity) / 1000) });
        }, 60000);
        push({ k: 'hook-ready', vis: realVis(), f: realFocus() ? 1 : 0 });
    });
})();
