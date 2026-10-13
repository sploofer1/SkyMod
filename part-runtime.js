/*
 * SkyMod, part-runtime.js. Общий код для страницы сайта (content.js) и конструктора
 * (предпросмотр частей): так то, что вы видите в предпросмотре, считается теми же
 * функциями, что и на сайте. Подключается в manifest.json перед content.js и в
 * builder.html. Здесь только функции и константы, побочных эффектов при загрузке нет.
 *
 *  - усиление CSS частей (boostPartCss) и перенос CSS карточки на свои блоки;
 *  - очистка и подстановки HTML-шаблона, проверка и применение команд поведения;
 *  - базовые стили блока расписания.
 */
const BOOST_PREFIX = 'html:not(#skymod-boost)';

// Единое правило «часть конструктора владеет настройками попапа»: часть включена и в ней
// есть CSS. Его используют попап (замок на полях, computeLocks) и content.js (какие правила
// из простых настроек вообще строить): раньше попап блокировал поле, а content.js всё равно
// применял сохранённое значение, и настройка с частью работали одновременно и мешали друг другу.
function skymodPartOwnsSettings(partsData, partId) {
    const p = partsData && typeof partsData === 'object' ? partsData[partId] : null;
    return !!(p && p.enabled && typeof p.css === 'string' && p.css.trim());
}

// Свой CSS из конструктора («Части интерфейса сайта») проигрывал стилям сайта:
// у Angular каждый селектор получает атрибут компонента, плюс сторонние темы красят
// те же элементы с !important. Поэтому перед вставкой каждый селектор усиливается
// префиксом html:not(#skymod-boost), а к каждому объявлению добавляется !important.
// Отключить для конкретной части: дописать в её CSS комментарий /* skymod:raw */.
function splitTopLevel(text, sep) {
    const out = [];
    let depth = 0, quote = '', cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            cur += ch;
            if (ch === '\\') { cur += text[++i] || ''; } else if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
}

function boostSelectorList(selectorText) {
    return splitTopLevel(selectorText, ',').map(sel => {
        const t = sel.trim();
        if (!t) return '';
        const root = t.match(/^(html|:root)(?![\w-])/i);
        if (root) return BOOST_PREFIX + t.slice(root[0].length);
        return BOOST_PREFIX + ' ' + t;
    }).filter(Boolean).join(', ');
}

function importantDeclarations(styleText) {
    return splitTopLevel(styleText, ';').map(d => d.trim()).filter(Boolean)
        .map(d => /!\s*important\s*$/i.test(d) ? d : d + ' !important').join('; ');
}

function boostRules(ruleList) {
    let out = '';
    Array.from(ruleList).forEach(rule => {
        if (rule.type === CSSRule.STYLE_RULE) {
            if (rule.cssRules && rule.cssRules.length) { out += rule.cssText + '\n'; return; }
            out += `${boostSelectorList(rule.selectorText)} { ${importantDeclarations(rule.style.cssText)}; }\n`;
        } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE
            || (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule)) {
            const head = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
            out += `${head} {\n${boostRules(rule.cssRules)}}\n`;
        } else {
            out += rule.cssText + '\n';
        }
    });
    return out;
}

function boostPartCss(cssText) {
    if (/\/\*\s*skymod:raw\s*\*\//i.test(cssText)) return cssText;
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        return boostRules(sheet.cssRules);
    } catch (e) {
        console.warn('[SkyMod] Не удалось усилить CSS части, вставляю как есть:', e);
        return cssText;
    }
}

// Перенос CSS карточки занятия на свои блоки (галочка «Применять этот CSS и к своим
// блокам» у части schedule-card). Селекторы карточки подменяются на селекторы блока;
// всё, чему у блока нет аналога (иконка типа, кнопка открытия, состояния занятий),
// не переносится. Блок: .skymod-custom-block, название .t, время .m.
const CUSTOM_BLOCK_SELECTOR = '.skymod-custom-block';
const CARD_UNMAPPED = /\.-(?:past|on-track)|\[data-test-|student schedule|\.type-icon|\.head(?![\w-])|\.open(?![\w-])|\.titles|\.subject(?![\w-])|\.time(?![\w-])|\.day-col\.-/;

function mapCardSelector(selector) {
    let s = String(selector).trim();
    if (!s) return '';
    s = s
        .replace(/\[data-test=["']student schedule slot["']\]\s+\.titles\s+\.subject/g, '@T')
        .replace(/\[data-test=["']student schedule slot["']\]\s+\.titles\s+\.time/g, '@M')
        .replace(/(?<![\w-])\.titles\s+\.subject(?![\w-])/g, '@T')
        .replace(/(?<![\w-])\.titles\s+\.time(?![\w-])/g, '@M')
        .replace(/\[data-test=["']student schedule slot["']\]/g, '@C')
        .replace(/app-schedule-slot-card\s*>?\s*/g, '')
        .replace(/(?<![\w-])\.card(?:\[class\*=["']subject-["']\])?(?![\w-])/g, '@C')
        .replace(/(?<![\w-])\.slot-box(?![\w-])/g, '@C')
        .replace(/@C(?:\s*>?\s*@C)+/g, '@C')
        .replace(/@C\s*>?\s*(@[TM])/g, '$1');
    if (!/@[CTM]/.test(s)) return '';
    s = s.replace(/@T/g, CUSTOM_BLOCK_SELECTOR + ' .t').replace(/@M/g, CUSTOM_BLOCK_SELECTOR + ' .m').replace(/@C/g, CUSTOM_BLOCK_SELECTOR);
    return CARD_UNMAPPED.test(s) ? '' : s;
}

function mirrorCardRules(ruleList) {
    let out = '';
    Array.from(ruleList).forEach(rule => {
        if (rule.type === CSSRule.STYLE_RULE) {
            if (rule.cssRules && rule.cssRules.length) return;
            const selectors = splitTopLevel(rule.selectorText, ',').map(mapCardSelector).filter(Boolean);
            if (selectors.length) out += `${selectors.join(', ')} { ${rule.style.cssText} }\n`;
        } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE
            || (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule)) {
            const inner = mirrorCardRules(rule.cssRules);
            if (inner) out += `${rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()} {\n${inner}}\n`;
        }
    });
    return out;
}

function mapCardCssForCustomBlocks(cssText) {
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        return mirrorCardRules(sheet.cssRules);
    } catch (e) {
        console.warn('[SkyMod] Не удалось перенести CSS карточки на свои блоки:', e);
        return '';
    }
}


const BEHAVIOR_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const BEHAVIOR_RESERVED_DATA = /^(block-id|part|slot|cb-sig|antilock|diag-bodies)$/;
const BEHAVIOR_BAD_VALUE = /[;{}<>]|url\(|expression|@import/i;
const BEHAVIOR_FORBIDDEN_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'FOREIGNOBJECT', 'NOSCRIPT', 'TEMPLATE']);
const behaviorApplied = new WeakMap();
const behaviorRendered = new WeakMap();

function behaviorEscape(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function behaviorRenderTemplate(template, data) {
    return template.replace(/\{\{\s*([a-zA-Z]\w*)\s*\}\}/g, (m, key) => (data[key] === undefined || data[key] === null ? '' : behaviorEscape(data[key])));
}

function behaviorSanitize(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    doc.body.querySelectorAll('*').forEach(el => {
        if (BEHAVIOR_FORBIDDEN_TAGS.has(el.tagName.toUpperCase())) { el.remove(); return; }
        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim();
            if (name.startsWith('on')) el.removeAttribute(attr.name);
            else if (['href', 'src', 'xlink:href', 'srcset', 'action', 'formaction', 'poster', 'data'].includes(name) && !/^(data:image\/|#)/i.test(value)) el.removeAttribute(attr.name);
            else if (name === 'style' && (/url\(\s*(?!["']?data:image\/)/i.test(value) || /expression|@import/i.test(value))) el.removeAttribute(attr.name);
        });
    });
    return doc.body;
}

// Возвращает true, если содержимое слота поменялось (тогда состояние надо применить заново).
function behaviorRenderSlot(el, partId, html, data) {
    let slot = el.querySelector(':scope > .skymod-card-slot');
    if (!html) { if (slot) slot.remove(); return false; }
    if (!slot) {
        slot = document.createElement('div');
        slot.className = 'skymod-card-slot';
        slot.setAttribute('data-skymod-part', partId);
        el.appendChild(slot);
    }
    const rendered = behaviorRenderTemplate(html, data);
    if (behaviorRendered.get(slot) === rendered) return false;
    behaviorRendered.set(slot, rendered);
    slot.replaceChildren(...Array.from(behaviorSanitize(rendered).childNodes));
    return true;
}

function behaviorCleanValue(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v !== 'string') return null;
    const s = v.slice(0, 120);
    return BEHAVIOR_BAD_VALUE.test(s) ? null : s;
}

function behaviorCleanState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const clean = { classes: [], vars: {}, data: {}, text: {} };
    if (Array.isArray(raw.classes)) clean.classes = raw.classes.filter(c => typeof c === 'string' && BEHAVIOR_NAME.test(c)).slice(0, 20);
    ['vars', 'data'].forEach(group => {
        const src = raw[group];
        if (!src || typeof src !== 'object') return;
        Object.keys(src).slice(0, 20).forEach(name => {
            if (!BEHAVIOR_NAME.test(name) || (group === 'data' && BEHAVIOR_RESERVED_DATA.test(name))) return;
            const value = behaviorCleanValue(src[name]);
            if (value !== null) clean[group][name] = value;
        });
    });
    if (raw.text && typeof raw.text === 'object') {
        Object.keys(raw.text).slice(0, 20).forEach(slot => {
            if (BEHAVIOR_NAME.test(slot) && typeof raw.text[slot] === 'string') clean.text[slot] = raw.text[slot].slice(0, 200);
        });
    }
    return clean;
}

function behaviorApplyState(el, state, force) {
    let rec = behaviorApplied.get(el);
    if (!rec) { rec = { state: null, classes: new Set(), vars: new Set(), data: new Set() }; behaviorApplied.set(el, rec); }
    if (!force && rec.state === state) return;
    const classes = new Set(state ? state.classes.map(c => 'skymod-is-' + c) : []);
    rec.classes.forEach(c => { if (!classes.has(c)) el.classList.remove(c); });
    classes.forEach(c => el.classList.add(c));
    rec.classes = classes;
    const vars = state ? state.vars : {};
    rec.vars.forEach(n => { if (!(n in vars)) el.style.removeProperty('--skymod-' + n); });
    Object.keys(vars).forEach(n => el.style.setProperty('--skymod-' + n, vars[n]));
    rec.vars = new Set(Object.keys(vars));
    const data = state ? state.data : {};
    rec.data.forEach(n => { if (!(n in data)) el.removeAttribute('data-skymod-' + n); });
    Object.keys(data).forEach(n => el.setAttribute('data-skymod-' + n, data[n]));
    rec.data = new Set(Object.keys(data));
    if (state) {
        Object.keys(state.text).forEach(slotName => {
            el.querySelectorAll(':scope > .skymod-card-slot [data-skymod-slot="' + slotName + '"]').forEach(node => {
                if (node.textContent !== state.text[slotName]) node.textContent = state.text[slotName];
            });
        });
    }
    rec.state = state;
}


// У названия (.subject) и времени (.time) карточки сайт задаёт СВОИ color, font-family,
// font-size, font-weight, line-height и letter-spacing, поэтому правило на самой карточке
// или на .head (например, "color: #fff", "font-family: monospace") до них не доходит:
// срабатывают только наследуемые свойства без собственного значения. Чтобы такой CSS работал
// так, как задумано, для каждого правила, которое стоит на карточке (с любыми состояниями)
// или на .head и задаёт эти свойства, строится парное правило: те же свойства со значением
// inherit у .subject и .time внутри. Парные правила идут ПЕРЕД CSS части, поэтому
// явные правила на .subject и .time выигрывают.
const CARD_TEXT_PROPS = ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'];
const CARD_LEVEL_TAIL = /(?:\[data-test=["']student schedule slot["']\]|(?<![\w-])\.card|(?<![\w-])\.head)$/;

function isCardLevelSelector(selector) {
    let s = selector.trim();
    if (!s || /\.(?:subject|time|titles|type-icon|type-badge|live-action|meeting)(?![\w-])/.test(s)) return false;
    let prev;
    do {
        prev = s;
        s = s.replace(/\[[^\]]*\]$/, (m) => (/^\[data-test=["']student schedule slot["']\]$/.test(m) ? m : ''))
            .replace(/:[\w-]+(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?$/, '')
            .replace(/\.-[\w-]+$/, '');
    } while (s !== prev);
    return CARD_LEVEL_TAIL.test(s);
}

function bridgeCardTextRules(ruleList) {
    let out = '';
    Array.from(ruleList).forEach(rule => {
        if (rule.type === CSSRule.STYLE_RULE) {
            if (rule.cssRules && rule.cssRules.length) return;
            const props = CARD_TEXT_PROPS.filter(p => rule.style.getPropertyValue(p));
            if (!props.length) return;
            const targets = splitTopLevel(rule.selectorText, ',').map(s => s.trim()).filter(isCardLevelSelector);
            if (!targets.length) return;
            const selectors = [];
            targets.forEach(t => { selectors.push(t + ' .subject', t + ' .time'); });
            out += `${selectors.join(', ')} { ${props.map(p => p + ': inherit').join('; ')}; }\n`;
        } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE
            || (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule)) {
            const inner = bridgeCardTextRules(rule.cssRules);
            if (inner) out += `${rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()} {\n${inner}}\n`;
        }
    });
    return out;
}

function bridgeCardText(cssText) {
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        return bridgeCardTextRules(sheet.cssRules);
    } catch (e) {
        return '';
    }
}

function skymodCustomBlockBaseCss() {
    return `
.skymod-custom-block { position: absolute; left: 2px; right: 2px; z-index: 3; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; overflow: hidden; border-radius: 8px; border-left: 4px solid var(--skymod-cb-color); background: color-mix(in srgb, var(--skymod-cb-color) 26%, var(--ds-color-background-primary, var(--ds-color2-color-background-primary, #14141a))); color: var(--ds-color-text-primary, var(--ds-color2-color-text-primary, #ffffff)); font-size: 13px; line-height: 16px; font-family: inherit; --schedule-subject-accent: var(--skymod-cb-color); }
.skymod-custom-block .t { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skymod-custom-block .m { opacity: .7; font-size: 12px; white-space: nowrap; }
.skymod-custom-block.-compact { flex-direction: row; align-items: center; gap: 8px; padding: 2px 10px; }
.skymod-custom-block.-overlap { left: auto; right: 0; width: 16px; padding: 6px 0; border-left: none; border-radius: 8px 0 0 8px; background: var(--skymod-cb-color); color: #000000; writing-mode: vertical-rl; align-items: flex-start; }
.skymod-custom-block.-overlap .m { display: none; }
.skymod-custom-block .x { position: absolute; top: 3px; right: 3px; display: none; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 6px; background: rgba(0, 0, 0, .4); color: inherit; font-size: 14px; line-height: 1; cursor: pointer; }
.skymod-custom-block:hover .x { display: block; }
.skymod-custom-block.-overlap .x { display: none !important; }
`;
}
