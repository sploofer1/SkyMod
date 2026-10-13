/*
 * SkyMod, part-preview.js. Живой предпросмотр частей в конструкторе: вместо скриншота
 * рисуется эмуляция карточек занятий (и своих блоков) на настоящей разметке сайта
 * (классы, data-атрибуты и стили карточки взяты с самой страницы расписания). К ней
 * применяются CSS, HTML и JS, которые вы пишете, теми же функциями, что и на сайте
 * (part-runtime.js): усиление селекторов, перенос CSS карточки на блоки, очистка
 * шаблона, проверка команд. JS работает в той же песочнице, что и на сайте
 * (behavior-sandbox.html). Наведите курсор на карточку: события hover, leave и click
 * уходят в ваш скрипт.
 *
 * Поддерживаются части 'schedule-card' и 'custom-block'. Остальные показывают скриншот.
 * Предпросмотр приблизительный: шрифт сайта и реальные данные подменены примерами.
 */
const PART_PREVIEW_IDS = ['schedule-card', 'custom-block'];
const PART_PREVIEW_ID_ATTR = { 'schedule-card': 'data-test-slot-id', 'custom-block': 'data-skymod-block-id' };

const PART_PREVIEW_SITE_CSS = `
:root { --ds-color-background-secondary: rgba(31, 31, 31, .5); --ds-color-background-light: rgba(31, 31, 31, .8); --ds-color-background-tertiary: #1f1f1f; --ds-color-background-primary: #0a0a0f; --ds-color-text-primary: #ffffff; --ds-color-text-secondary: rgba(255, 255, 255, .8); --ds-color-text-disabled: #6b6b75; --ds-color-text-warning: #ff9e00; --ds-color-background-brand-medium: #a08bff; --ds-color-background-brand: #5a39e0; --ds-color-background-brand-extralight: #e9e4ff; }
html, body { margin: 0; color: var(--ds-color-text-primary); font-family: Arial, sans-serif; }
body { padding: 10px; background: radial-gradient(120% 80% at 20% 0%, #1b1530 0%, #0b0b12 60%); min-height: 100vh; box-sizing: border-box; }
.day-col { position: relative; overflow: hidden; border-radius: 8px; }
.slot-box { box-sizing: border-box; position: absolute; z-index: 2; padding: 2px; }
app-schedule-slot-card { display: block; height: 100%; container-type: size; }
.card { box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 4px; overflow: hidden; width: 100%; height: 100%; padding: 12px; border: 0; border-radius: 8px; --schedule-card-background: var(--ds-color-background-secondary); --schedule-card-fill: var(--schedule-card-background); background: linear-gradient(var(--schedule-card-fill), var(--schedule-card-fill)), var(--ds-color-background-primary); cursor: pointer; text-align: left; transition: background-color .15s ease; }
.card.-subject-0 { --schedule-subject-accent: #4f8fd6; }
.card.-subject-2 { --schedule-subject-accent: #9b7cf4; }
.card.-subject-3 { --schedule-subject-accent: #ef6a9e; }
.card.-subject-4 { --schedule-subject-accent: #2fb7a3; }
.card.-subject-5 { --schedule-subject-accent: #f2705a; }
.card.-subject-6 { --schedule-subject-accent: #8e9db3; }
.card.-subject-7 { --schedule-subject-accent: #8fd16a; }
.card::before { position: absolute; inset: 0; content: ""; background: var(--ds-color-background-brand-extralight); opacity: 0; pointer-events: none; transition: opacity .26s ease; mask: radial-gradient(circle at 50% 50%, #000 1.5px, transparent 2px) 0 0 / 14px 14px; -webkit-mask: radial-gradient(circle at 50% 50%, #000 1.5px, transparent 2px) 0 0 / 14px 14px; }
.card:hover { background: var(--ds-color-background-brand); }
.card:hover::before { opacity: .6; }
.card:hover .subject { color: var(--ds-color-background-brand-extralight); }
.card:hover .subject::before { background: var(--ds-color-background-brand-extralight); }
.card:hover .type-icon { opacity: .8; }
.card.-past:not(:hover) { --schedule-card-fill: color-mix(in srgb, var(--schedule-card-background) 50%, transparent); }
.card > *:not(.open) { position: relative; z-index: 1; pointer-events: none; }
.open { position: absolute; inset: 0; z-index: 0; padding: 0; border: none; border-radius: 8px; background: none; cursor: pointer; }
.head { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.titles { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.subject { overflow: hidden; color: var(--ds-color-text-primary); text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; line-height: 18px; }
.subject::before { display: inline-block; width: 8px; height: 8px; margin-right: 8px; content: ""; vertical-align: 2px; border-radius: 50%; background: var(--schedule-subject-accent); }
.time { min-width: 0; overflow: hidden; color: var(--ds-color-text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.type-icon { display: inline-flex; margin-left: auto; padding-top: 2px; color: var(--ds-color-text-secondary); opacity: .5; }
.type-icon svg { width: 16px; height: 16px; }
.card.-past:not(:hover) .subject { color: var(--ds-color-text-disabled); }
.card.-past:not(:hover) .time { color: color-mix(in srgb, var(--ds-color-text-disabled) 70%, transparent); }
.card.-past:not(:hover) .type-icon { opacity: .2; }
`;

const PART_PREVIEW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';

const partPreview = {
    host: null, frame: null, sandbox: null, sandboxReady: false,
    part: null, data: {}, withBlocks: false, docKey: '', jsKey: '',
    ready: false, states: {}, hover: null, storage: new Map(),
    onLog: () => {}, applyTimer: 0, jsTimer: 0, tickTimer: 0,
};

function partPreviewSupported(part) {
    return !!part && PART_PREVIEW_IDS.includes(part.id) && !!part.behavior;
}

function partPreviewPad(n) { return String(n).padStart(2, '0'); }
function partPreviewClock(ms) { const d = new Date(ms); return partPreviewPad(d.getHours()) + ':' + partPreviewPad(d.getMinutes()); }
function partPreviewDate(ms) { const d = new Date(ms); return d.getFullYear() + '-' + partPreviewPad(d.getMonth() + 1) + '-' + partPreviewPad(d.getDate()); }

// Те же поля, что считает content.js (behaviorTimeFields), но по готовым меткам времени.
function partPreviewTime(base, startMs, endMs, now) {
    const status = now < startMs ? 'future' : (now >= endMs ? 'past' : 'current');
    return Object.assign(base, {
        date: partPreviewDate(startMs),
        start: startMs, end: endMs,
        startLabel: partPreviewClock(startMs), endLabel: partPreviewClock(endMs),
        status,
        progress: status === 'past' ? 1 : (status === 'future' ? 0 : Math.round(((now - startMs) / (endMs - startMs)) * 1000) / 1000),
        minutesLeft: status === 'current' ? Math.ceil((endMs - now) / 60000) : 0,
        minutesUntil: status === 'future' ? Math.ceil((startMs - now) / 60000) : 0,
    });
}

function partPreviewLessons(now) {
    const MIN = 60000;
    return [
        { top: 0, idx: 3, subject: 'math', title: 'Математика', type: 'lesson', kind: 'Занятие', state: 'no-context', color: '#ef6a9e', id: 'pv1', past: true, start: now - 180 * MIN },
        { top: 100, idx: 2, subject: 'programming', title: 'Программирование', type: 'practice', kind: 'Практика', state: 'has-actions', color: '#9b7cf4', id: 'pv2', past: false, start: now - 20 * MIN },
        { top: 200, idx: 4, subject: 'english', title: 'Английский', type: 'trainer', kind: 'Тренажёр', state: 'has-actions', color: '#2fb7a3', id: 'pv3', past: false, start: now + 40 * MIN },
    ].map(c => partPreviewTime(Object.assign({}, c, { height: 90 }), c.start, c.start + 45 * MIN, now));
}

function partPreviewBlocks(now) {
    const MIN = 60000;
    return [
        { id: 'pv-b1', top: 300, height: 60, title: 'Репетитор', color: '#8b7cf6', cls: '', start: now + 180 * MIN, len: 30 },
        { id: 'pv-b2', top: 370, height: 30, title: 'Звонок', color: '#4ade80', cls: ' -compact', start: now - 5 * MIN, len: 15 },
        { id: 'pv-b3', top: 110, height: 40, title: 'Секция', color: '#fbbf24', cls: ' -overlap', start: now + 5 * MIN, len: 20 },
    ].map(b => partPreviewTime(Object.assign({}, b, { type: 'custom', kind: 'Своё', state: '' }), b.start, b.start + b.len * MIN, now));
}

function partPreviewEscape(v) {
    return String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function partPreviewDocHtml(withLessons, withBlocks) {
    const now = Date.now();
    let inner = '';
    if (withLessons) {
        partPreviewLessons(now).forEach(c => {
            inner += `<div class="slot-box" style="top:${c.top}px;height:${c.height}px;left:0%;width:100%"><app-schedule-slot-card><div data-test="student schedule slot" class="-subject-${c.idx} card${c.past ? ' -past' : ''}" data-test-day-role="${c.past ? 'past-day' : 'today'}" data-test-card-state="${c.state}" data-test-card-tint="none" data-test-activity-type="${c.type}" data-test-subject="${c.subject}" data-test-slot-id="${c.id}" data-test-code="${c.subject}"><button type="button" data-test="student schedule slot open" class="open" aria-label="${partPreviewEscape(c.kind + ', ' + c.startLabel + '–' + c.endLabel + ', ' + c.title)}"></button><span class="head"><span class="titles"><span class="subject">${partPreviewEscape(c.title)}</span><span class="time"> ${c.startLabel}–${c.endLabel} </span></span><span class="type-icon">${PART_PREVIEW_ICON}</span></span></div></app-schedule-slot-card></div>\n`;
        });
    }
    if (withBlocks) {
        partPreviewBlocks(now).forEach(b => {
            inner += `<div class="skymod-custom-block${b.cls}" data-skymod-block-id="${b.id}" title="${partPreviewEscape(b.title)}" style="top:${b.top}px;height:${b.height}px;--skymod-cb-color:${b.color}"><span class="t">${partPreviewEscape(b.title)}</span><span class="m">${b.startLabel}–${b.endLabel}</span><button type="button" class="x" aria-label="Удалить блок">×</button></div>\n`;
        });
    }
    const height = withBlocks ? 410 : 300;
    return `<!doctype html><html data-laboratory-theme="dark"><head><meta charset="utf-8"><style>${PART_PREVIEW_SITE_CSS}</style><style>${skymodCustomBlockBaseCss()}</style><style id="skymod-preview-user"></style></head><body><div class="day-col" data-test-date="${partPreviewDate(now)}" style="height:${height}px">${inner}</div></body></html>`;
}

function partPreviewHasText(v) { return typeof v === 'string' && v.trim().length > 0; }

// CSS, который на сайте получила бы эта часть: сначала перенос CSS карточки на блоки
// (если включена галочка), затем CSS частей в порядке показа. Как и в content.js.
function partPreviewCss(part, data, withBlocks) {
    let css = '';
    const card = data['schedule-card'] || {};
    if (withBlocks && card.alsoCustomBlocks && partPreviewHasText(card.css)) {
        const mirrored = mapCardCssForCustomBlocks(card.css);
        if (mirrored) css += (/\/\*\s*skymod:raw\s*\*\//i.test(card.css) ? mirrored : boostPartCss(mirrored)) + '\n';
    }
    const shown = part.id === 'schedule-card' ? (withBlocks ? ['schedule-card', 'custom-block'] : ['schedule-card']) : ['custom-block'];
    shown.forEach(id => {
        const d = data[id];
        if (d && partPreviewHasText(d.css)) {
            if (id === 'schedule-card' && !/\/\*\s*skymod:raw\s*\*\//i.test(d.css)) {
                const bridge = bridgeCardText(d.css);
                if (bridge) css += boostPartCss(bridge) + '\n';
            }
            css += boostPartCss(d.css) + '\n';
        }
    });
    return css;
}

// Применяет CSS, HTML-слоты и состояние поведения к документу предпросмотра.
function partPreviewApplyToDoc(doc, part, data, withBlocks, states) {
    const style = doc.getElementById('skymod-preview-user');
    if (style) style.textContent = partPreviewCss(part, data, withBlocks);
    const own = data[part.id] || {};
    const html = partPreviewHasText(own.html) ? own.html.trim() : '';
    const now = Date.now();
    const list = part.id === 'schedule-card' ? partPreviewLessons(now) : partPreviewBlocks(now);
    const byId = {};
    list.forEach(item => { byId[item.id] = item; });
    const idAttr = PART_PREVIEW_ID_ATTR[part.id];
    doc.querySelectorAll(part.behavior.itemSelector).forEach(el => {
        const item = byId[el.getAttribute(idAttr)];
        if (!item) return;
        const changed = behaviorRenderSlot(el, part.id, html, item);
        behaviorApplyState(el, states[item.id] || null, changed);
    });
    return list;
}

function partPreviewPost(msg) {
    const f = partPreview.sandbox;
    if (f && partPreview.sandboxReady && f.contentWindow) f.contentWindow.postMessage(msg, '*');
}

function partPreviewPostCards() {
    const p = partPreview.part;
    if (!p) return;
    const now = Date.now();
    partPreviewPost({ type: 'skymod-behavior-cards', partId: p.id, cards: p.id === 'schedule-card' ? partPreviewLessons(now) : partPreviewBlocks(now) });
}

function partPreviewApply() {
    partPreview.applyTimer = 0;
    const doc = partPreview.frame && partPreview.frame.contentDocument;
    if (!doc || !partPreview.ready || !partPreview.part) return;
    partPreviewApplyToDoc(doc, partPreview.part, partPreview.data, partPreview.withBlocks, partPreview.states);
}

function partPreviewScheduleApply(delay) {
    clearTimeout(partPreview.applyTimer);
    partPreview.applyTimer = setTimeout(partPreviewApply, delay);
}

function partPreviewDestroySandbox() {
    if (partPreview.sandbox) partPreview.sandbox.remove();
    partPreview.sandbox = null;
    partPreview.sandboxReady = false;
    partPreview.states = {};
    partPreview.hover = null;
}

function partPreviewRestartSandbox() {
    partPreviewDestroySandbox();
    const part = partPreview.part;
    const js = part && partPreview.data[part.id] && partPreview.data[part.id].js;
    partPreviewScheduleApply(0);
    if (!partPreviewHasText(js)) return;
    const f = document.createElement('iframe');
    f.src = 'behavior-sandbox.html';
    f.hidden = true;
    f.setAttribute('aria-hidden', 'true');
    document.body.appendChild(f);
    partPreview.sandbox = f;
}

function partPreviewBindDoc(doc) {
    const sel = () => partPreview.part.behavior.itemSelector;
    const attr = () => PART_PREVIEW_ID_ATTR[partPreview.part.id];
    const send = (event, id) => { if (id) partPreviewPost({ type: 'skymod-behavior-event', partId: partPreview.part.id, event, id }); };
    doc.addEventListener('mouseover', ev => {
        const el = ev.target.closest ? ev.target.closest(sel()) : null;
        const id = el ? el.getAttribute(attr()) : null;
        if (id === partPreview.hover) return;
        send('leave', partPreview.hover);
        send('hover', id);
        partPreview.hover = id;
    });
    doc.documentElement.addEventListener('mouseleave', () => { send('leave', partPreview.hover); partPreview.hover = null; });
    doc.addEventListener('click', ev => {
        const el = ev.target.closest ? ev.target.closest(sel()) : null;
        if (el) send('click', el.getAttribute(attr()));
    });
}

window.addEventListener('message', ev => {
    const f = partPreview.sandbox;
    if (!f || ev.source !== f.contentWindow || !ev.data || typeof ev.data.type !== 'string' || !partPreview.part) return;
    const d = ev.data;
    const partId = partPreview.part.id;
    if (d.type === 'skymod-behavior-ready') {
        partPreview.sandboxReady = true;
        partPreviewPost({ type: 'skymod-behavior-init', parts: [{ partId, js: partPreview.data[partId].js }] });
        partPreviewPostCards();
    } else if (d.type === 'skymod-behavior-state' && d.partId === partId && d.states && typeof d.states === 'object') {
        Object.keys(d.states).slice(0, 300).forEach(id => {
            const clean = behaviorCleanState(d.states[id]);
            if (clean) partPreview.states[String(id).slice(0, 64)] = clean; else delete partPreview.states[id];
        });
        partPreviewScheduleApply(0);
    } else if (d.type === 'skymod-behavior-log') {
        partPreview.onLog(['log', 'warn', 'error'].includes(d.level) ? d.level : 'log', String(d.message));
    } else if (d.type === 'skymod-behavior-error') {
        partPreview.onLog('error', String(d.message) + (d.stack ? '\n' + String(d.stack).split('\n').slice(0, 3).join('\n') : ''));
    } else if (/^skymod-storage-(get|set|remove)$/.test(d.type)) {
        const key = String(d.key).slice(0, 120);
        let value = true;
        if (d.type === 'skymod-storage-get') value = partPreview.storage.has(key) ? partPreview.storage.get(key) : null;
        else if (d.type === 'skymod-storage-set') partPreview.storage.set(key, d.value);
        else partPreview.storage.delete(key);
        partPreviewPost({ type: 'skymod-storage-result', id: d.id, value });
    }
});

function partPreviewMountFrame() {
    const host = partPreview.host;
    host.textContent = '';
    partPreview.ready = false;
    const frame = document.createElement('iframe');
    frame.className = 'part-preview-frame';
    frame.title = 'Предпросмотр части';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.addEventListener('load', () => {
        partPreview.ready = true;
        partPreviewBindDoc(frame.contentDocument);
        partPreviewApply();
    });
    frame.srcdoc = partPreviewDocHtml(partPreview.part.id === 'schedule-card', partPreview.withBlocks);
    host.appendChild(frame);
    const note = document.createElement('div');
    note.className = 'part-preview-note';
    note.textContent = 'Предпросмотр на разметке сайта: наведите курсор или нажмите на карточку. Данные и шрифт примерные.';
    host.appendChild(note);
    partPreview.frame = frame;
}

// data: данные всех частей (для текущей уже с несохранённым содержимым редактора).
function partPreviewUpdate(host, part, data, onLog) {
    partPreview.host = host;
    partPreview.onLog = onLog || (() => {});
    const withBlocks = part.id === 'custom-block' || !!(data['schedule-card'] && data['schedule-card'].alsoCustomBlocks);
    const docKey = part.id + '|' + withBlocks;
    const jsKey = part.id + '|' + ((data[part.id] && data[part.id].js) || '').trim();
    const prevPartId = partPreview.part && partPreview.part.id;
    partPreview.part = part;
    partPreview.data = data;
    partPreview.withBlocks = withBlocks;
    if (docKey !== partPreview.docKey || !partPreview.frame || !host.contains(partPreview.frame)) {
        partPreview.docKey = docKey;
        partPreviewMountFrame();
    } else {
        partPreviewScheduleApply(120);
    }
    if (jsKey !== partPreview.jsKey || prevPartId !== part.id) {
        partPreview.jsKey = jsKey;
        clearTimeout(partPreview.jsTimer);
        partPreview.jsTimer = setTimeout(partPreviewRestartSandbox, prevPartId !== part.id ? 0 : 500);
    }
    if (!partPreview.tickTimer) {
        partPreview.tickTimer = setInterval(() => { partPreviewPostCards(); partPreviewScheduleApply(0); }, 15000);
    }
}

function partPreviewDestroy() {
    clearTimeout(partPreview.applyTimer);
    clearTimeout(partPreview.jsTimer);
    clearInterval(partPreview.tickTimer);
    partPreview.tickTimer = 0;
    partPreviewDestroySandbox();
    partPreview.frame = null;
    partPreview.part = null;
    partPreview.docKey = '';
    partPreview.jsKey = '';
}
