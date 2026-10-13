/*
 * SkyMod, песочница поведения частей интерфейса (карточки занятий, свои блоки).
 *
 * Как и sandbox.js, это страница из manifest.json -> sandbox.pages: только здесь
 * допустим new Function. У неё нет ни DOM сайта, ни chrome.*. Код пользователя
 * получает объект api и может только читать данные карточек и отправлять команды
 * (классы, CSS-переменные, data-атрибуты, текст в слотах). Применяет их content.js,
 * проверив имена и значения. Так скрипт не может ни прочитать страницу, ни
 * вставить в неё произвольную разметку или адрес.
 *
 * Протокол (postMessage с родителем):
 *   родитель -> песочница: skymod-behavior-init { parts: [{ partId, js }] }
 *                           skymod-behavior-cards { partId, cards }
 *                           skymod-behavior-event { partId, event: hover|leave|click, id }
 *                           skymod-storage-result { id, value }
 *   песочница -> родитель: skymod-behavior-ready, skymod-behavior-state { partId, states },
 *                           skymod-behavior-log, skymod-behavior-error,
 *                           skymod-storage-get|set|remove { id, key }
 */
(() => {
    const parts = new Map();
    const pendingStorage = new Map();
    let storageSeq = 0;

    const post = msg => parent.postMessage(msg, '*');
    const fmt = v => {
        if (typeof v === 'string') return v;
        try { return JSON.stringify(v); } catch (e) { return String(v); }
    };

    ['log', 'info', 'warn', 'error'].forEach(level => {
        const native = console[level].bind(console);
        console[level] = (...args) => {
            native(...args);
            post({ type: 'skymod-behavior-log', partId: '', level: level === 'info' ? 'log' : level, message: args.map(fmt).join(' ') });
        };
    });

    const reportError = (partId, err) => {
        post({ type: 'skymod-behavior-error', partId, message: String((err && err.message) || err), stack: String((err && err.stack) || '') });
    };
    window.addEventListener('error', e => reportError('', e.error || e.message));
    window.addEventListener('unhandledrejection', e => reportError('', e.reason));

    function storageCall(partId, op, key, value) {
        return new Promise(resolve => {
            const id = ++storageSeq;
            pendingStorage.set(id, resolve);
            post({ type: 'skymod-storage-' + op, id, key: partId + ':' + key, value });
        });
    }

    function createPart(partId) {
        const part = {
            partId,
            cards: [],
            byId: new Map(),
            handlers: { cards: [], hover: [], leave: [], click: [] },
            states: new Map(),
            dirty: new Set(),
            flushTimer: 0,
        };
        const run = (fn, arg) => { try { fn(arg); } catch (err) { reportError(partId, err); } };
        const stateOf = id => {
            let s = part.states.get(id);
            if (!s) { s = { classes: new Set(), vars: {}, data: {}, text: {} }; part.states.set(id, s); }
            return s;
        };
        const flush = () => {
            part.flushTimer = 0;
            const out = {};
            part.dirty.forEach(id => {
                const s = part.states.get(id);
                out[id] = s ? { classes: Array.from(s.classes), vars: s.vars, data: s.data, text: s.text } : null;
            });
            part.dirty.clear();
            post({ type: 'skymod-behavior-state', partId, states: out });
        };
        const touch = id => {
            part.dirty.add(id);
            if (!part.flushTimer) part.flushTimer = setTimeout(flush, 0);
        };
        const handle = rawId => {
            const id = String(rawId);
            const h = {
                addClass(name) { stateOf(id).classes.add(String(name)); touch(id); return h; },
                removeClass(name) { stateOf(id).classes.delete(String(name)); touch(id); return h; },
                toggleClass(name, on) {
                    const set = stateOf(id).classes;
                    const key = String(name);
                    const want = on === undefined ? !set.has(key) : !!on;
                    if (want) set.add(key); else set.delete(key);
                    touch(id);
                    return h;
                },
                setVar(name, value) { stateOf(id).vars[String(name)] = value; touch(id); return h; },
                setData(name, value) { stateOf(id).data[String(name)] = value; touch(id); return h; },
                setText(slot, text) { stateOf(id).text[String(slot)] = String(text); touch(id); return h; },
                reset() { part.states.delete(id); touch(id); return h; },
            };
            return h;
        };
        const api = {
            partId,
            get cards() { return part.cards; },
            get: id => part.byId.get(String(id)) || null,
            card: handle,
            onCards(fn) { part.handlers.cards.push(fn); if (part.cards.length) run(fn, part.cards); },
            onHover(fn) { part.handlers.hover.push(fn); },
            onLeave(fn) { part.handlers.leave.push(fn); },
            onClick(fn) { part.handlers.click.push(fn); },
            now: () => Date.now(),
            log: (...args) => post({ type: 'skymod-behavior-log', partId, level: 'log', message: args.map(fmt).join(' ') }),
            storage: {
                get: key => storageCall(partId, 'get', String(key)),
                set: (key, value) => storageCall(partId, 'set', String(key), value),
                remove: key => storageCall(partId, 'remove', String(key)),
            },
        };
        part.api = api;
        part.run = run;
        return part;
    }

    function initParts(list) {
        (Array.isArray(list) ? list : []).forEach(item => {
            if (!item || typeof item.partId !== 'string' || typeof item.js !== 'string') return;
            const part = createPart(item.partId);
            parts.set(item.partId, part);
            try {
                new Function('api', item.js)(part.api);
            } catch (err) {
                reportError(item.partId, err);
            }
        });
    }

    window.addEventListener('message', e => {
        if (e.source !== parent) return;
        const d = e.data;
        if (!d || typeof d.type !== 'string') return;
        if (d.type === 'skymod-behavior-init') { initParts(d.parts); return; }
        if (d.type === 'skymod-storage-result') {
            const resolve = pendingStorage.get(d.id);
            if (resolve) { pendingStorage.delete(d.id); resolve(d.value); }
            return;
        }
        const part = parts.get(d.partId);
        if (!part) return;
        if (d.type === 'skymod-behavior-cards' && Array.isArray(d.cards)) {
            part.cards = d.cards;
            part.byId = new Map(d.cards.map(c => [String(c.id), c]));
            part.handlers.cards.forEach(fn => part.run(fn, part.cards));
        } else if (d.type === 'skymod-behavior-event' && part.handlers[d.event]) {
            const card = part.byId.get(String(d.id));
            if (card) part.handlers[d.event].forEach(fn => part.run(fn, card));
        }
    });

    post({ type: 'skymod-behavior-ready' });
})();
