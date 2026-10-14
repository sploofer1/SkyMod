/*
 * SkyMod — content.js
 * -------------------------------------------------------------
 * ЦВЕТА (акцент, фон страницы) — через инлайн-стиль с !important
 * на <html>. Это максимальный приоритет в CSS, сильнее любого
 * !important в любом подключаемом файле стилей сайта.
 *
 * .page-scroll / .dashboard-shell / .topbar красят фон НАПРЯМУЮ
 * хардкодом (не через var()), поэтому их бьём отдельным правилом
 * в <style>-теге поверх.
 *
 * ШРИФТ можно задать тремя способами (см. resolveFont):
 *   1. Готовый пресет из списка.
 *   2. Ссылка на Google Fonts (страница шрифта или сам css2-адрес).
 *   3. Свой файл шрифта — грузится в base64 и подключается через
 *      @font-face прямо в <style>-теге.
 * Если задано несколько — приоритет: файл > Google Fonts > пресет.
 *
 * ФОН СТРАНИЦЫ — тоже либо ссылка, либо загруженный файл (картинка
 * или gif), с выбором, как заполнять пространство.
 * -------------------------------------------------------------
 */

const STYLE_TAG_ID = 'skyplus-theme';
const FONT_LINK_ID = 'skyplus-google-font-link';
const CUSTOM_FONT_FAMILY = 'SkyModCustomFont';

// Обёртки, которые рисуют собственный непрозрачный фон поверх body,
// не через переменные, а хардкодом — их нужно бить напрямую.
const OPAQUE_WRAPPERS = ['.dashboard-shell', '.topbar', '.page-scroll'];

// Как заполнять фон-картинку/gif в зависимости от выбранного режима.
const FIT_MAP = {
    cover: { size: 'cover', repeat: 'no-repeat' },
    contain: { size: 'contain', repeat: 'no-repeat' },
    stretch: { size: '100% 100%', repeat: 'no-repeat' },
    tile: { size: 'auto', repeat: 'repeat' },
    center: { size: 'auto', repeat: 'no-repeat' },
};

let lastSettings = {};
let isReapplyingRoot = false; // защита от бесконечного цикла (см. ниже)

// ---------- Цвет-или-градиент: общая модель для primaryColor/cardColor ----------
// Хранится как объект { mode, solid, gradientType, angle, stops, custom }.
// mode: 'solid' | 'gradient' | 'rgb' (анимированная радуга) | 'custom' (сырой
// CSS-градиент, вставленный пользователем). Старые настройки (просто hex-строка)
// нормализуются в 'solid' для обратной совместимости.

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
            gradientType: raw.gradientType || 'linear',
            angle: typeof raw.angle === 'number' ? raw.angle : 135,
            stops: Array.isArray(raw.stops) && raw.stops.length >= 2 ? raw.stops : [
                { color: fallbackHex, pos: 0 }, { color: fallbackHex, pos: 100 },
            ],
            custom: raw.custom || '',
        };
    }
    const solid = (typeof raw === 'string' && raw) ? raw : fallbackHex;
    return {
        mode: 'solid', solid, gradientType: 'linear', angle: 135,
        stops: [{ color: solid, pos: 0 }, { color: solid, pos: 100 }], custom: '',
    };
}

function stopsToGradientCss(type, angle, stops, alphaPercent) {
    const parts = [...stops].sort((a, b) => a.pos - b.pos).map(s => {
        const color = (alphaPercent === null || alphaPercent === undefined) ? s.color : hexToRgba(s.color, alphaPercent);
        return `${color} ${s.pos}%`;
    }).join(', ');
    return type === 'radial' ? `radial-gradient(circle, ${parts})` : `linear-gradient(${angle}deg, ${parts})`;
}

// Значение для мест, где градиент физически невозможен (CSS-переменная,
// которую сайт читает через background-color, а не background-image) —
// берём первый цвет градиента/радуги как разумный плоский fallback.
function colorValueRepresentative(value) {
    if (value.mode === 'solid') return value.solid;
    if (value.mode === 'gradient') return (value.stops[0] && value.stops[0].color) || value.solid;
    if (value.mode === 'rgb') return RAINBOW_STOPS[0].color;
    const match = (value.custom || '').match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
    return match ? match[0] : value.solid;
}

// Строит правило background для набора селекторов. alphaPercent (0-100 или
// null) применяется к каждой стороне градиента отдельно — так карточки
// остаются прозрачными по фону, но текст внутри не тускнеет (в отличие от
// CSS opacity, см. комментарий у hexToRgba ниже).
function buildBackgroundRule(selector, value, alphaPercent, animate) {
    if (value.mode === 'solid') {
        const color = (alphaPercent === null || alphaPercent === undefined) ? value.solid : hexToRgba(value.solid, alphaPercent);
        return `${selector} { background: ${color} !important; background-image: none !important; }`;
    }
    if (value.mode === 'custom') {
        // Прозрачность к произвольному CSS-градиенту не применяем — это
        // чужой синтаксис, безопасно повышать/понижать альфу мы не можем.
        return `${selector} { background-image: ${value.custom || value.solid} !important; background-color: transparent !important; }`;
    }
    const stops = value.mode === 'rgb' ? RAINBOW_STOPS : value.stops;
    const type = value.mode === 'rgb' ? 'linear' : value.gradientType;
    const angle = value.mode === 'rgb' ? 90 : value.angle;
    const bg = stopsToGradientCss(type, angle, stops, alphaPercent);
    const anim = (value.mode === 'rgb' && animate)
        ? 'background-size: 300% 300% !important; animation: skymod-rainbow-shift 9s linear infinite !important;'
        : '';
    return `${selector} { background-image: ${bg} !important; background-color: transparent !important; ${anim} }`;
}

const RAINBOW_KEYFRAMES = `
@keyframes skymod-rainbow-shift {
    0% { background-position: 0% 50%; }
    100% { background-position: 300% 50%; }
}
`;

// ---------- Цвета: инлайн-стиль на <html> с максимальным приоритетом ----------

// У сайта ДВА слоя цветовых переменных: --ds-color-* и --ds-color2-color-*;
// фон страницы переопределяем в обоих.
const COLOR_LAYERS = ['--ds-color', '--ds-color2-color'];

function applyRootColors(settings) {
    const root = document.documentElement.style;
    const { backgroundImage, backgroundFile } = settings;
    const primaryColorValue = normalizeColorValue(settings.primaryColor, '#1f1f1f');

    // Когда активен фон-картинка, компоненты, которые ЧЕСТНО читают
    // var(--ds-color-background-primary) (например app-dashboard-page на
    // страницах "Предметы"/"Профиль"), всё равно рисуют сплошной цвет
    // ПОВЕРХ body и перекрывают картинку. Раньше мы красили переменную
    // самим primaryColor даже в режиме картинки — теперь в этом режиме
    // сама переменная становится прозрачной, а не просто её потребители
    // из списка OPAQUE_WRAPPERS (тот список остаётся нужен отдельно —
    // для элементов с хардкодом, которые var() вообще не читают).
    // Переменная используется сайтом через background-color, который не
    // понимает градиенты/анимации — туда всегда идёт плоский цвет-представитель.
    // Настоящий градиент/радуга рисуется отдельно, через buildBackgroundRule
    // в buildCSS ниже (background-image поверх этой переменной).
    //
    // primaryColor всегда нормализуется в валидный объект с дефолтным hex
    // ВНУТРИ normalizeColorValue (нужно только чтобы color-picker в
    // popup.js показывал что-то при первом открытии) — но переменную
    // сайта красить этим дефолтом НЕЛЬЗЯ, если пользователь его не
    // выбирал: иначе фон страницы менялся бы сам, ещё до того, как
    // человек вообще открыл попап.
    const primaryColorSet = !!settings.primaryColor;
    const imageActive = !!(backgroundFile || backgroundImage || settings.siteBuilderEnabled);
    if (imageActive) {
        COLOR_LAYERS.forEach(layer => root.setProperty(`${layer}-background-primary`, 'transparent', 'important'));
    } else if (primaryColorSet) {
        const effectivePrimary = colorValueRepresentative(primaryColorValue);
        COLOR_LAYERS.forEach(layer => root.setProperty(`${layer}-background-primary`, effectivePrimary, 'important'));
    }
    // Иначе (ничего не задано) — переменную вообще не трогаем, у сайта
    // остаётся его родное значение.
}

// Если сайт (или его тема) перезапишет style-атрибут на <html> —
// применяем свои значения заново. Флаг isReapplyingRoot нужен, чтобы
// наш собственный вызов setProperty не спровоцировал бесконечный цикл.
const rootStyleObserver = new MutationObserver(() => {
    if (isReapplyingRoot) return;
    isReapplyingRoot = true;
    try {
        applyRootColors(lastSettings);
    } catch (e) {
        console.error('[SkyMod] Ошибка в applyRootColors (re-apply):', e);
    }
    Promise.resolve().then(() => { isReapplyingRoot = false; });
});
rootStyleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

// ---------- Шрифт ----------

// Принимает ссылку со страницы fonts.google.com, прямую css2-ссылку
// или просто название шрифта — возвращает "чистое" имя семейства.
function parseGoogleFontFamily(input) {
    if (!input) return null;
    const trimmed = input.trim();
    try {
        const url = new URL(trimmed);
        if (url.hostname.includes('fonts.googleapis.com')) {
            const familyParam = url.searchParams.get('family');
            if (familyParam) return decodeURIComponent(familyParam.split(':')[0]).replace(/\+/g, ' ');
        }
        if (url.hostname.includes('fonts.google.com')) {
            const parts = url.pathname.split('/').filter(Boolean);
            const last = parts[parts.length - 1];
            if (last) return decodeURIComponent(last).replace(/\+/g, ' ');
        }
        return null;
    } catch (e) {
        // Не похоже на URL — считаем, что это просто название шрифта.
        return trimmed;
    }
}

function ensureGoogleFontLink(family) {
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    let link = document.getElementById(FONT_LINK_ID);
    if (link) {
        if (link.href !== href) link.href = href;
        return;
    }
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

// Приоритет: активный шрифт из библиотеки > ссылка на Google Fonts >
// готовый пресет. Библиотека (fontLibrary) хранит ВСЕ когда-либо
// загруженные файлы шрифтов в base64 — они остаются в расширении
// навсегда, даже если исходный файл потом удалить с компьютера.
function resolveFont(settings) {
    const { fontLibrary, activeCustomFontId, googleFontUrl, fontFamily } = settings;

    if (activeCustomFontId && Array.isArray(fontLibrary)) {
        const entry = fontLibrary.find(f => f.id === activeCustomFontId);
        if (entry) {
            const family = `${CUSTOM_FONT_FAMILY}_${entry.id}`;
            return {
                cssValue: `'${family}', sans-serif`,
                extraCss: `@font-face { font-family: '${family}'; src: url("${entry.dataUrl}"); font-display: swap; }`,
            };
        }
    }

    const family = parseGoogleFontFamily(googleFontUrl);
    if (family) {
        ensureGoogleFontLink(family);
        return { cssValue: `'${family}', sans-serif`, extraCss: '' };
    }

    if (fontFamily && fontFamily !== 'inherit') {
        return { cssValue: fontFamily, extraCss: '' };
    }

    return null;
}

// ---------- Сборка общего <style>-тега ----------

// Переводит hex-цвет + процент непрозрачности в rgba() — фон
// карточки становится прозрачным/цветным, а текст внутри остаётся
// чётким (в отличие от CSS opacity, который притушил бы всё сразу).
function hexToRgba(hex, alphaPercent) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const a = Math.max(0, Math.min(100, alphaPercent)) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// На странице часто стоят сторонние темы (Dark Reader и т.п.): они красят те же
// элементы правилами с !important и высокой специфичностью (атрибуты Angular
// вида [_ngcontent-...] плюс классы). Наше правило с !important и меньшей
// специфичностью проигрывает, и настройка "не работает". :not(#id) добавляет
// к селектору специфичность идентификатора, поэтому такое правило выигрывает у
// любых селекторов из классов и атрибутов. Это нужно для ВСЕХ правил, которые
// перекрашивают элементы сайта.
function boost(selectors) {
    return selectors.split(',').map(sel => BOOST_PREFIX + ' ' + sel.trim()).join(', ');
}

function buildCSS(settings) {
    const {
        backgroundImage, backgroundFile, backgroundFit, backgroundDim,
        cardOpacity, mathButtonEnabled, mathBtnColor, nowLineHidden, nowLineColor, sitePartsCss,
        cardReadable, cardReadableStrength, cardReadableBrightText, scheduleCardColors, scheduleGlow, lessonPopupCustomize, lessonPopupBackdropBlur, lessonPopupBackdropDim,
        lessonPopupPanelEnabled, lessonPopupPanelColor, lessonPopupPanelOpacity, uiFadeIdleEnabled, uiFadeHotkeyEnabled, uiFadeVisibility,
    } = settings;
    const primaryColorValue = normalizeColorValue(settings.primaryColor, '#1f1f1f');
    const cardColorValue = normalizeColorValue(settings.cardColor, '#8b7cf6');
    let css = RAINBOW_KEYFRAMES;

    // ВАЖНО: primaryColor/cardColor всегда нормализуются в валидный
    // объект с дефолтным hex ВНУТРИ normalizeColorValue (это нужно
    // только для popup.js — чтобы цвет-пикер при первом открытии
    // показывал что-то, а не пустоту) — но здесь, на самой странице,
    // этот дефолт НЕЛЬЗЯ применять как будто пользователь его выбрал.
    // Раньше строчки ниже применялись безусловно, поэтому на свежей
    // установке, до того как пользователь вообще открыл попап, фон
    // страницы и карточки перекрашивались хардкодом расширения —
    // хотя пользователь ничего не менял. Теперь применяем, только
    // если ключ реально есть в settings (т.е. был сохранён явным
    // действием пользователя, см. saveSetting в popup.js).
    const primaryColorSet = !!settings.primaryColor;
    const cardColorSet = !!settings.cardColor;

    // .page-scroll и другие обёртки красят фон НАПРЯМУЮ, хардкодом,
    // а не через var(--ds-color-...) — переопределения переменной
    // им не хватает, нужен прямой !important поверх хардкода. Body сюда же —
    // градиент/радуга должны быть видны и на нём, не только на переменной.
    // siteBuilderEnabled (свой canvas/JS-фон сайта, см. applySiteBuilderFrame
    // ниже) имеет приоритет над картинкой и обычным цветом — раз человек
    // включил свой холст, он и должен быть виден, а не перекрыт чем-то ещё.
    const bgSource = backgroundFile || backgroundImage;
    const siteBuilderOn = !!settings.siteBuilderEnabled;
    if (siteBuilderOn || bgSource) {
        css += `${boost(OPAQUE_WRAPPERS.join(', '))} { background: transparent !important; }\n`;
    } else if (primaryColorSet) {
        css += buildBackgroundRule([...OPAQUE_WRAPPERS, 'body'].join(', '), primaryColorValue, null, true) + '\n';
    }
    // Ни siteBuilder, ни картинка, ни primaryColor не заданы — вообще
    // не трогаем фон страницы, у сайта остаётся его родной фон.

    if (siteBuilderOn) {
        css += `html, body { background: transparent !important; background-image: none !important; }\n`;
    } else if (bgSource) {
        const fit = FIT_MAP[backgroundFit] || FIT_MAP.cover;
        const dim = Math.max(0, Math.min(100, backgroundDim || 0)) / 100;
        // Затемнение — это просто ещё один слой фона: полупрозрачный
        // чёрный градиент ПОВЕРХ картинки, в том же свойстве
        // background-image (несколько фонов через запятую, первый —
        // самый верхний). Так не нужен лишний DOM-элемент-подложка.
        const overlay = dim > 0 ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ` : '';
        const layerCount = dim > 0 ? 2 : 1;
        const sizes = Array(layerCount).fill(fit.size).join(', ');
        const repeats = Array(layerCount).fill(fit.repeat).join(', ');
        const positions = Array(layerCount).fill('center').join(', ');
        css += `
body {
    background-image: ${overlay}url("${bgSource}") !important;
    background-size: ${sizes} !important;
    background-repeat: ${repeats} !important;
    background-position: ${positions} !important;
    background-attachment: fixed !important;
    transition: background-image .3s ease;
}
`;
    }
    // Иначе body уже покрашен (или сознательно НЕ покрашен) правилом
    // на обёртки+body выше — отдельно красить его тут ещё раз не нужно.

    const font = resolveFont(settings);
    if (font) {
        css += font.extraCss + '\n';
        // Раньше шрифт применялся только к перечисленному списку тегов
        // (body, p, span...) — кастомные элементы Angular (app-*, lab-*)
        // и текст внутри них могли остаться без переопределения. Теперь
        // бьём универсальным селектором "всё, кроме иконок" — это
        // покрывает буквально любой тег, включая кастомные компоненты.
        css += `
:not(.material-symbols-outlined):not([class*="icon"]):not(svg):not(svg *) {
    font-family: ${font.cssValue} !important;
}
`;
    }

    // Карточки в расписании (class="subject-6 card" и т.п.) — цвет
    // зашит хардкодом отдельно под каждый предмет, возможно ещё и
    // градиентом, поэтому бьём полным background (не только цветом),
    // явно гасим/заменяем background-image и применяем прозрачность
    // (cardOpacity) к каждой стороне градиента отдельно — не через CSS
    // opacity, чтобы текст внутри карточки не тускнел вместе с фоном.
    // Только если пользователь реально задал свой цвет — иначе карточки
    // остаются родными, дефолт '#8b7cf6' внутри normalizeColorValue тут
    // не применяем (см. комментарий про primaryColorSet/cardColorSet выше).
    // Пока в конструкторе включена часть «Карточка занятия в расписании», эти простые
    // настройки для карточек не применяются (так сказано и в попапе: «часть их заменяет»).
    // Раньше они применялись всё равно и по специфичности перебивали background из части.
    const cardPart = sitePartsCss && sitePartsCss['schedule-card'];
    const cardPartActive = skymodPartOwnsSettings(sitePartsCss, 'schedule-card');
    if (cardColorSet && !cardPartActive) {
        const cardSelector = boost('[class*="subject-"].card, .card[class*="subject-"]');
        css += buildBackgroundRule(cardSelector, cardColorValue, cardOpacity ?? 85, true) + '\n';
        css += `${cardSelector} { transition: background-color .2s ease; }\n`;
    }

    // Читаемость карточек. Что на самом деле делает сайт (из его CSS):
    //   .card.-past { opacity: .55 }  — прошедшие занятия выцветают целиком,
    //   .card:hover { background: var(--ds-color-background-light) }  и
    //   .card.-past:hover { opacity: 1 } — при наведении карточка "подсвечивается".
    // Читаемость = этот hover-вид ВСЕГДА + подложка под карточкой:
    //   1. opacity: 1 у прошедших (на цветастом фоне именно .55 делает их нечитаемыми);
    //   2. фон карточки как при наведении;
    //   3. подложка у внешней обёртки .slot-box (тёмный фон и размытие того,
    //      что за ней): карточка полупрозрачная и стоит на ней;
    //   4. тонкая светлая обводка (outline, собственный box-shadow не трогаем);
    //   5. яркий текст с тенью (отключается отдельной настройкой).
    if (cardReadable && !cardPartActive) {
        const k = Math.max(0, Math.min(100, cardReadableStrength ?? 70)) / 100;
        const backdropAlpha = (k * 0.9).toFixed(2);
        const blur = Math.round(k * 18);
        const outlineAlpha = (0.1 + k * 0.3).toFixed(2);
        const textShadow = (0.35 + 0.5 * k).toFixed(2);
        // Специфичность поднята тремя атрибутами и html: у сайта и у сторонних тем/расширений
        // (на странице видны чужие правила вида [data-test="student schedule slot"][class*="-past"]
        // { background-color: ... !important }) тот же уровень, и без этого выигрывал бы порядок в файле.
        const CARD_SEL = boost('[data-test="student schedule slot"], [class*="subject-"].card');
        const BOX_SEL = boost('.slot-box:has([data-test="student schedule slot"])');
        css += `${BOX_SEL} { background: rgba(8, 8, 14, ${backdropAlpha}) !important; backdrop-filter: blur(${blur}px) !important; -webkit-backdrop-filter: blur(${blur}px) !important; border-radius: 10px !important; }\n`;
        css += `${CARD_SEL} { opacity: 1 !important; background: var(--ds-color-background-light, var(--ds-color2-color-background-light, rgba(40, 40, 48, 0.9))) !important; background-image: none !important; outline: 1px solid rgba(255, 255, 255, ${outlineAlpha}) !important; outline-offset: -1px !important; }\n`;
        css += `${CARD_SEL}, ${boost('[data-test="student schedule slot"] *, [class*="subject-"].card *')} { text-shadow: 0 1px 3px rgba(0, 0, 0, ${textShadow}) !important; }\n`;
        if (cardReadableBrightText !== false) {
            css += `${boost('[data-test="student schedule slot"] .subject, [data-test="student schedule slot"] .time')} { color: #fff !important; }\n`;
        }
    }

    // Расписание → тема. Цвета предметов приходят как переменная
    // --skymod-subject-rgb, которую для каждого предмета задаёт отдельный
    // тег (scheduleStyleTag, см. refreshSchedule): так цвет берётся из
    // data-test-subject самой карточки, а Angular не может его перетереть.
    // Правило специфичнее обычного cardColor, поэтому выигрывает у него.
    if (scheduleCardColors && !cardPartActive) {
        const a = Math.max(0, Math.min(100, cardOpacity ?? 85)) / 100;
        css += `${boost('[data-test="student schedule slot"][data-test-subject]')} { background: rgba(var(--skymod-subject-rgb, 139, 124, 246), ${a}) !important; background-image: none !important; }\n`;
    }
    // Новый сайт выцвечивает прошедшие занятия через свою переменную фона, а наш цвет
    // карточки её заменяет: возвращаем выцветание (как было у сайта раньше). При
    // «читаемости» прошедшие, наоборот, должны быть чёткими.
    if ((cardColorSet || scheduleCardColors) && !cardReadable && !cardPartActive) {
        css += `${boost('[data-test="student schedule slot"].-past:not(:hover)')} { opacity: .6 !important; }\n`;
    }
    // Свечение цвета текущего урока на фоне. @property нужен, чтобы цвет
    // плавно перетекал при смене предмета (обычный градиент не анимируется).
    // Элемент лежит позади интерфейса, поэтому виден, только когда обёртки
    // сайта прозрачны, то есть при своём фоне (картинка или конструктор).
    if (scheduleGlow) {
        // Позади интерфейса свечение видно только при своём фоне (иначе его
        // закрывают непрозрачные обёртки сайта). Без своего фона слой лежит
        // ПОВЕРХ страницы с режимом смешивания screen и слабой яркостью:
        // цвет подмешивается к странице и не мешает читать и нажимать.
        css += `#skymod-schedule-glow[data-mode="overlay"] { z-index: 900; mix-blend-mode: screen; }\n`;
        css += `@property --skymod-c { syntax: '<color>'; inherits: false; initial-value: transparent; }\n`;
        css += `#skymod-schedule-glow { position: fixed; inset: 0; z-index: -1; pointer-events: none; transition: --skymod-c 1.4s ease; `
            + `background: radial-gradient(ellipse 70% 60% at 18% 12%, var(--skymod-c), transparent 70%), `
            + `radial-gradient(ellipse 60% 55% at 86% 92%, var(--skymod-c), transparent 70%); }\n`;
    }

    // Окно занятия (открывается по клику на карточку). Оно лежит НЕ в
    // приложении, а в .cdk-overlay-container в конце <body> (Angular CDK), поэтому
    // обёртки и стили страницы на него не действуют.
    //   - Подложка (затемнение и размытие всего, что за окном) — собственный
    //     псевдоэлемент контейнера: не зависит от того, какой именно элемент рисует
    //     родное затемнение сайта, и лежит под самим окном (оно идёт позже в
    //     дереве). Показывается только пока окно занятия открыто (:has).
    //   - Фон самой панели окна задаётся токенами дизайн-системы
    //     --ds-dialog-*-backgroundColor: компонент объявляет их на своём хосте,
    //     поэтому перебиваем на хосте и с !important.
    if (lessonPopupCustomize && !skymodPartOwnsSettings(sitePartsCss, 'schedule-popup')) {
        const blur = Math.max(0, Math.min(40, lessonPopupBackdropBlur ?? 8));
        const dim = Math.max(0, Math.min(100, lessonPopupBackdropDim ?? 35)) / 100;
        const OPEN = '.cdk-overlay-container:has([data-test="student schedule slot popup"])';
        // Родное размытие и затемнение сайта сидит на ds-dialog-overlay > .root
        // (blur(16px) и фон #000000b8), то есть внутри самого окна занятия. Гасим его
        // здесь, а размытие и затемнение рисует только слой SkyMod ниже. Классы с
        // суффиксами Angular (_ngcontent-...) не используем: они меняются при сборках.
        css += `${boost(`${OPEN} ds-dialog-overlay > .root`)} { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background: transparent !important; background-color: transparent !important; }\n`;
        css += `${boost(`${OPEN} .cdk-overlay-backdrop, ${OPEN} [class*="backdrop"], ${OPEN} [class*="Backdrop"]`)} { background: transparent !important; background-color: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; opacity: 1 !important; }\n`;
        css += `@keyframes skymod-popup-backdrop-in { from { opacity: 0; } to { opacity: 1; } }\n`;
        const filter = blur > 0 ? `backdrop-filter: blur(${blur}px); -webkit-backdrop-filter: blur(${blur}px); ` : '';
        css += `${OPEN}::before { content: ''; position: fixed; inset: 0; pointer-events: none; `
            + `background: rgba(0, 0, 0, ${dim.toFixed(2)}); ${filter}`
            + `animation: skymod-popup-backdrop-in .25s ease; }\n`;
        if (lessonPopupPanelEnabled) {
            const alpha = Math.max(0, Math.min(100, lessonPopupPanelOpacity ?? 90)) / 100;
            const panelBg = hexToRgba(lessonPopupPanelColor || '#14141a', Math.round(alpha * 100));
            css += `${boost('app-schedule-slot-popup, app-schedule-slot-popup ds-dialog')} { --ds-dialog-default-backgroundColor: ${panelBg} !important; --ds-dialog-modal-backgroundColor: ${panelBg} !important; }\n`;
        }
    }

    // Скрытие частей интерфейса сайта (попап → Удобство → «Элементы сайта»).
    // Только display: none, ничего не удаляем из DOM: Angular продолжает с ними работать.
    const HIDE_RULES = [
        ['hideSupportButton', 'app-student-page-bug-report-entry, [data-test="report entry button"]'],
        ['hideUserTray', '.user-tray'],
        ['hidePageTitle', '.page-header .title'],
        ['hideNavSections', '.desktop-navigation-bar'],
        ['hideBrandMark', '.desktop-brand-mark'],
    ];
    // Окно «The page got bored while you were away»: сайт блокирует себя после долгого
    // отсутствия и просит обновить страницу. Пока включена защита от блокировки,
    // окно не показываем; страницу при необходимости обновляет watchWaitingPopup().
    if (settings.antiLockEnabled !== false) {
        const WAIT = '.cdk-overlay-container:has(laboratory-waiting-popup)';
        css += `${boost(`${WAIT} .cdk-global-overlay-wrapper, ${WAIT} laboratory-waiting-popup`)} { display: none !important; }\n`;
    }

    HIDE_RULES.forEach(([key, selector]) => {
        if (settings[key]) css += `${boost(selector)} { display: none !important; }\n`;
    });

    // "Фокус на фон": класс skymod-ui-faded на <html> ставит setUiFade() (по
    // бездействию или по горячей клавише). Прячем прямых потомков body, но не
    // сам body и не наши элементы: фон (iframe лежит в <html>, а не в body, или
    // картинка на body) остаётся виден. -locked добавляется только при скрытии
    // по клавише: невидимый интерфейс не должен принимать случайные клики.
    if (uiFadeIdleEnabled || uiFadeHotkeyEnabled) {
        const vis = Math.max(0, Math.min(100, uiFadeVisibility ?? 10)) / 100;
        const UI_SEL = `body > *:not(#${SITE_BUILDER_FRAME_ID}):not(#skymod-toast)`;
        css += `${UI_SEL} { transition: opacity .45s ease; }\n`;
        css += `html.skymod-ui-faded ${UI_SEL} { opacity: ${vis} !important; }\n`;
        css += `html.skymod-ui-faded-locked ${UI_SEL} { pointer-events: none !important; }\n`;
    }

    // Кнопку "Следующее задание" рисует отдельный модуль (math/task-page.js
    // + math/style.css), никак с остальной темой не связанный — красим и
    // включаем/выключаем его СВЕРХУ, не трогая сами файлы модуля.
    if (mathButtonEnabled === false) {
        css += '#skyeng-next-task-btn { display: none !important; }\n';
    } else if (mathBtnColor) {
        css += `#skyeng-next-task-btn:not(:disabled) { background: ${mathBtnColor} !important; }\n`;
    }

    // Полоска «сейчас» в расписании. Сайт позиционирует элементы инлайном (top, height)
    // и пересчитывает их по времени. Устройство (по CSS сайта от 10.10.2026):
    //   .now-marker: линия height: 2px от левого до правого края, фон
    //     var(--ds-color-text-positive); кружок 8px слева рисует его псевдоэлемент :before;
    //   .now-label: плашка «сейчас 16:27» справа (border-radius: 4px, тот же фон);
    //   .now-shade: затемнение прошедшей части (в таблице стилей фона нет).
    // Опираемся на data-test (стабильнее классов Angular) и дублируем классом. Старые
    // now-glow оставлены в селекторах на случай возврата прежней вёрстки.
    const NOW_MARKER = boost('.now-marker, [data-test="student schedule now marker"], .now-glow, [data-test="student schedule now glow"]');
    const NOW_MARKER_DOT = boost('.now-marker::before, [data-test="student schedule now marker"]::before');
    const NOW_LABEL = boost('.now-label, [data-test="student schedule now line"]');
    if (skymodPartOwnsSettings(sitePartsCss, 'now-line')) {
        // Часть «Полоска сейчас» включена: настройки попапа «Убрать» и «Цвет полоски» не применяются.
    } else if (nowLineHidden) {
        css += `${NOW_MARKER}, ${NOW_LABEL} { display: none !important; }\n`;
    } else if (nowLineColor) {
        css += `${NOW_MARKER}, ${NOW_MARKER_DOT}, ${NOW_LABEL} { background: ${nowLineColor} !important; }\n`;
        css += `${NOW_LABEL}, ${boost('.now-label *, [data-test="student schedule now line"] *')} { color: ${readableTextColor(nowLineColor)} !important; }\n`;
    }

    // Свой CSS для частей интерфейса сайта (конструктор → Сайт → "Части
    // интерфейса сайта"). Идёт В САМОМ КОНЦЕ, поэтому перебивает и простые
    // настройки выше (скрыть/цвет полоски "сейчас"), и всё остальное.
    // Формат: { [partId]: { enabled: boolean, css: string } }.
    if (sitePartsCss && typeof sitePartsCss === 'object') {
        // CSS карточки, перенесённый на свои блоки, идёт ДО остальных частей: так
        // отдельный CSS части «Свой блок в расписании» всегда его перебивает.
        if (cardPart && cardPart.enabled && cardPart.alsoCustomBlocks && typeof cardPart.css === 'string' && cardPart.css.trim()) {
            const mirrored = mapCardCssForCustomBlocks(cardPart.css);
            if (mirrored) {
                const raw = /\/\*\s*skymod:raw\s*\*\//i.test(cardPart.css);
                css += `\n/* skymod part: schedule-card (для своих блоков) */\n${raw ? mirrored : boostPartCss(mirrored)}\n`;
            }
        }
        Object.keys(sitePartsCss).forEach(partId => {
            const part = sitePartsCss[partId];
            if (part && part.enabled && typeof part.css === 'string' && part.css.trim()) {
                if (partId === 'schedule-card' && !/\/\*\s*skymod:raw\s*\*\//i.test(part.css)) {
                    // см. bridgeCardText в part-runtime.js: цвет и шрифт с карточки и .head доходят до названия и времени
                    const bridge = bridgeCardText(part.css);
                    if (bridge) css += `\n/* skymod part: schedule-card (наследование текста) */\n${boostPartCss(bridge)}\n`;
                }
                css += `\n/* skymod part: ${partId.replace(/[^a-z0-9_-]/gi, '')} */\n${boostPartCss(part.css)}\n`;
            }
        });
    }

    return css;
}

// Чёрный или белый текст — в зависимости от яркости фона (плашка "сейчас"
// должна читаться на любом выбранном цвете).
function readableTextColor(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b0b0b' : '#ffffff';
}

function applyStyleTag(settings) {
    let tag = document.getElementById(STYLE_TAG_ID);
    if (!tag) {
        tag = document.createElement('style');
        tag.id = STYLE_TAG_ID;
    }
    tag.textContent = buildCSS(settings);
    ensureTagIsLast(tag);
}

// appendChild на уже существующем узле не клонирует его, а просто
// переносит в конец — так наш тег всегда остаётся последним, даже
// если сайт позже дозагрузил свой собственный <style>.
function ensureTagIsLast(tag) {
    const head = document.head || document.documentElement;
    if (head.lastElementChild !== tag) {
        head.appendChild(tag);
    }
}

// Следим ТОЛЬКО за прямыми детьми <head> — дёшево, в отличие от
// слежки за всем документом.
const headObserver = new MutationObserver(() => {
    const tag = document.getElementById(STYLE_TAG_ID);
    if (tag) ensureTagIsLast(tag);
});
function watchHead() {
    headObserver.observe(document.head || document.documentElement, { childList: true });
}
if (document.head) watchHead();
else document.addEventListener('DOMContentLoaded', watchHead, { once: true });

// ---------- Свой canvas/JS-фон сайта (конструктор → "Фон сайта") ----------
// То же самое, что overlay в попапе (см. popup.js/builder.js), только
// встроено не в попап, а в саму страницу через content script — код
// живёт, пока открыта вкладка сайта, а не только пока открыт попап.
// Выполняется в той же песочнице (sandbox.html/.js), но сюда её грузим
// как web-accessible resource (см. manifest.json), а не как sandbox-
// страницу расширения — с точки зрения самой песочницы разницы нет,
// протокол postMessage тот же.

const SITE_BUILDER_FRAME_ID = 'skymod-site-builder-frame';
const SITE_BUILDER_STORAGE_PREFIX = 'siteBuilderData:'; // свой namespace — не пересекается с конструктором попапа
let siteSandboxReady = false;
let sitePendingPayload = null;

// Запускаем пользовательский код только когда iframe реально получил размер.
// Если стартовать на нулевом размере, innerWidth/innerHeight внутри песочницы
// равны 0, и код, который один раз считает размеры (позиции частиц, звёзд),
// собирает всё в углу экрана.
function postRunWhenSized(frame, payload, tries) {
    tries = tries || 0;
    if ((frame.clientWidth === 0 || frame.clientHeight === 0) && tries < 120) {
        requestAnimationFrame(() => postRunWhenSized(frame, payload, tries + 1));
        return;
    }
    // Расписание уходит ПЕРЕД кодом: к моменту запуска пользовательского JS
    // объект schedule в песочнице уже заполнен, а не пустой.
    pushScheduleToFrame();
    if (frame.contentWindow) frame.contentWindow.postMessage({ type: 'skymod-sandbox-run', payload }, '*');
}

function getSiteBuilderFrame() {
    return document.getElementById(SITE_BUILDER_FRAME_ID);
}

window.addEventListener('message', (e) => {
    const frame = getSiteBuilderFrame();
    if (!frame || e.source !== frame.contentWindow) return; // не наш iframe — сайт мог создать свои
    const data = e.data;
    if (!data) return;

    if (data.type === 'skymod-sandbox-ready') {
        siteSandboxReady = true;
        siteCardResend();
        if (sitePendingPayload) {
            postRunWhenSized(frame, sitePendingPayload);
            sitePendingPayload = null;
        }
        return;
    }
    // Ошибки/console.log из фона сайта отдельного UI не имеют (в отличие
    // от builder.html) — дублируем в обычную консоль страницы, чтобы
    // хотя бы через F12 на самом сайте было видно, что пошло не так.
    if (data.type === 'skymod-sandbox-error') {
        console.error('[SkyMod: фон сайта]', data.message, data.stack || '');
        return;
    }
    if (data.type === 'skymod-sandbox-log') {
        (console[data.level] || console.log)('[SkyMod: фон сайта]', data.message);
        return;
    }
    if (data.type === 'skymod-storage-get') {
        const storageKey = SITE_BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.get([storageKey], res => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: res[storageKey] ?? null }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-set') {
        const storageKey = SITE_BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.set({ [storageKey]: data.value }, () => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-remove') {
        const storageKey = SITE_BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.remove([storageKey], () => {
            frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
    }
});

let lastSentSiteBuilderPayloadKey = null;
function sendSiteBuilderCode(settings) {
    const frame = getSiteBuilderFrame();
    if (!frame) return;
    const payload = {
        html: settings.siteBuilderHtml || '', css: settings.siteBuilderCss || '', js: settings.siteBuilderJs || '',
        theme: { accent: '#8b7cf6' },
    };
    // Та же дедупликация, что у попаповской песочницы (sendBuilderCode в
    // popup.js) — иначе смена ЛЮБОЙ другой настройки (applyAll вызывается
    // на любое изменение storage) заново запускала бы уже работающий фон
    // сайта с нуля.
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastSentSiteBuilderPayloadKey && siteSandboxReady) return;
    lastSentSiteBuilderPayloadKey = payloadKey;
    if (siteSandboxReady) {
        postRunWhenSized(frame, payload);
    } else {
        sitePendingPayload = payload;
    }
}

// ---------- Прозрачность обёрток сайта под фоном-холстом ----------
// Слой "под интерфейсом" (z-index:-1) виден только если ВСЕ предки контента
// прозрачны. У сайта помимо .dashboard-shell/.topbar/.page-scroll есть и
// другие непрозрачные обёртки (app-root, layout-контейнеры и т.д.) — они
// закрашивают холст белым, а сквозь полупрозрачные места видны лишь слабые
// узоры. Находим такие крупные обёртки и гасим им фон инлайном.
const SHELL_MARK_ATTR = 'data-skymod-shell';
let shellScanTimer = null;
let shellObserver = null;

function isOpaqueBg(el) {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(',').map(parseFloat);
    return (parts.length > 3 ? parts[3] : 1) > 0.05;
}

function clearOpaqueShells() {
    document.querySelectorAll('[' + SHELL_MARK_ATTR + ']').forEach(el => {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
        el.removeAttribute(SHELL_MARK_ATTR);
    });
}

function scanOpaqueShells() {
    if (!document.body) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    (function walk(el, depth) {
        if (depth > 6) return;
        Array.from(el.children).forEach(child => {
            if (child.id === SITE_BUILDER_FRAME_ID || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return;
            const r = child.getBoundingClientRect();
            if (r.width < 40 || r.height < 40) return;
            const bigShell = r.width >= vw * 0.9 && r.height >= vh * 0.5;
            if (bigShell && (isOpaqueBg(child) || getComputedStyle(child).backgroundImage !== 'none')) {
                child.style.setProperty('background-color', 'transparent', 'important');
                child.style.setProperty('background-image', 'none', 'important');
                child.setAttribute(SHELL_MARK_ATTR, '1');
            }
            // Идём глубже только через большие обёртки — карточки и мелкие блоки не трогаем.
            if (bigShell) walk(child, depth + 1);
        });
    })(document.body, 0);
}

function scheduleShellScan() {
    if (shellScanTimer) return;
    shellScanTimer = setTimeout(() => {
        shellScanTimer = null;
        try { scanOpaqueShells(); } catch (e) { console.error('[SkyMod] scanOpaqueShells:', e); }
    }, 150);
}

function setOpaqueShellHandling(on) {
    if (!on) {
        if (shellObserver) { shellObserver.disconnect(); shellObserver = null; }
        clearOpaqueShells();
        return;
    }
    if (shellObserver) return;
    const start = () => {
        scheduleShellScan();
        // Angular дорисовывает интерфейс уже после загрузки, и при SPA-переходах
        // появляются новые обёртки — следим за DOM с троттлингом.
        shellObserver = new MutationObserver(scheduleShellScan);
        shellObserver.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
}

// ---------- Взаимодействие с курсором: пересылка мыши в песочницу ----------
let pointerForwardingOn = false;
let pendingMove = null;
let moveRaf = 0;

function postPointer(type, e) {
    const frame = getSiteBuilderFrame();
    if (!frame || !frame.contentWindow || !siteSandboxReady) return;
    frame.contentWindow.postMessage({
        type: 'skymod-pointer',
        event: type,
        x: e ? e.clientX : 0,
        y: e ? e.clientY : 0,
        buttons: e ? e.buttons : 0,
    }, '*');
}

function onPagePointerMove(e) {
    if (e && e.isTrusted === false) return;
    pendingMove = e;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (pendingMove) postPointer('mousemove', pendingMove);
        pendingMove = null;
    });
}
function onPagePointerDown(e) { postPointer('mousedown', e); }
function onPagePointerUp(e) { postPointer('mouseup', e); }
function onPagePointerClick(e) { postPointer('click', e); }
function onPageLeave() { postPointer('mouseleave', null); }

function setPointerForwarding(on) {
    if (on === pointerForwardingOn) return;
    pointerForwardingOn = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    // capture + passive: ловим раньше обработчиков сайта и никому не мешаем
    // (stopPropagation на сайте не обрежет нам события, preventDefault мы не вызываем).
    window[method]('mousemove', onPagePointerMove, { capture: true, passive: true });
    window[method]('mousedown', onPagePointerDown, { capture: true, passive: true });
    window[method]('mouseup', onPagePointerUp, { capture: true, passive: true });
    window[method]('click', onPagePointerClick, { capture: true, passive: true });
    document.documentElement[method]('mouseleave', onPageLeave, { passive: true });
    if (!on && moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; pendingMove = null; }
}

// Карточки занятий и свои блоки: координаты для фона сайта.
// Работает независимо от behaviorPointer (тот молчит без пользовательского JS
// поведения) и от «Взаимодействия с курсором». Слушатели на документе общие
// с поведением (см. initBehavior), здесь только логика. Состояние держим даже
// пока песочница не готова: после skymod-sandbox-ready hovered-карточка
// пересылается заново (siteCardResend).
const SITE_CARD_THROTTLE_MS = 100;
const SITE_CARD_SETTLE_MS = 300; // один пересчёт rect после hover: карточка могла сдвинуться CSS-анимацией
let siteCardTrackingOn = false;
let siteCardEl = null;
let siteCardLast = null; // { id, color, rect } — то, что песочница видела в последний раз
let siteCardTimer = 0;
let siteCardSettleTimer = 0;
let siteCardLastRun = 0;
let siteCardScrollOn = false;

function siteCardTarget(ev) {
    const t = ev && ev.target;
    if (!t || !t.closest) return null;
    const parts = Object.keys(BEHAVIOR_PARTS);
    for (let i = 0; i < parts.length; i++) {
        const def = BEHAVIOR_PARTS[parts[i]];
        const el = t.closest(def.itemSelector);
        const id = el ? el.getAttribute(def.idAttr) : '';
        if (el && id) return { el, partId: parts[i], id: String(id).slice(0, 64) };
    }
    return null;
}

function siteCardColor(el, partId, id) {
    let color = null;
    if (partId === 'custom-block') {
        const block = customBlocksCache.find(b => b.id === id);
        color = block ? block.color : null;
    } else {
        const subject = el.getAttribute('data-test-subject') || '';
        color = subject ? skymodSubjectColor(subject, scheduleColors) : null;
    }
    return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

function siteCardRect(el) {
    const r = el.getBoundingClientRect();
    const round = v => Math.round(v * 10) / 10;
    return { x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height) };
}

function siteCardSameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function siteCardPost(event, info) {
    const frame = getSiteBuilderFrame();
    if (!frame || !frame.contentWindow || !siteSandboxReady) return;
    frame.contentWindow.postMessage({
        type: 'skymod-card-rect', event, id: info.id, color: info.color, rect: info.rect,
    }, '*');
}

function siteCardListen(on) {
    if (on === siteCardScrollOn) return;
    siteCardScrollOn = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    // capture: scroll не всплывает, а сетка расписания может прокручиваться
    // во внутреннем контейнере, а не на window.
    window[method]('scroll', siteCardSchedule, { capture: true, passive: true });
    window[method]('resize', siteCardSchedule, { passive: true });
    if (!on && siteCardTimer) { clearTimeout(siteCardTimer); siteCardTimer = 0; }
}

function siteCardSchedule() {
    if (siteCardTimer) return;
    const wait = Math.max(0, SITE_CARD_THROTTLE_MS - (Date.now() - siteCardLastRun));
    siteCardTimer = setTimeout(siteCardTick, wait);
}

function siteCardCheckRect() {
    if (!siteCardEl || !siteCardLast) return;
    if (!siteCardEl.isConnected) { siteCardLeave(); return; }
    const rect = siteCardRect(siteCardEl);
    if (siteCardSameRect(rect, siteCardLast.rect)) return;
    siteCardLast.rect = rect;
    siteCardPost('move', siteCardLast);
}

function siteCardTick() {
    siteCardTimer = 0;
    siteCardLastRun = Date.now();
    siteCardCheckRect();
}

function siteCardEnter(target) {
    siteCardEl = target.el;
    siteCardLast = { id: target.id, color: siteCardColor(target.el, target.partId, target.id), rect: siteCardRect(target.el) };
    siteCardPost('hover', siteCardLast);
    siteCardListen(true);
    // Если за 300 мс rect изменился (hover-анимация карточки), шлём move.
    // Привязка к элементу: на другой карточке этот пересчёт уже не нужен.
    const el = target.el;
    siteCardSettleTimer = setTimeout(() => {
        siteCardSettleTimer = 0;
        if (siteCardEl === el) siteCardCheckRect();
    }, SITE_CARD_SETTLE_MS);
}

function siteCardLeave() {
    if (!siteCardEl || !siteCardLast) return;
    // Карточку могли убрать из DOM — тогда отдаём последний известный rect.
    if (siteCardEl.isConnected) siteCardLast.rect = siteCardRect(siteCardEl);
    const info = siteCardLast;
    siteCardEl = null;
    siteCardLast = null;
    if (siteCardSettleTimer) { clearTimeout(siteCardSettleTimer); siteCardSettleTimer = 0; }
    siteCardListen(false);
    siteCardPost('leave', info);
}

function siteCardResend() {
    if (!siteCardEl || !siteCardLast) return;
    if (!siteCardEl.isConnected) { siteCardLeave(); return; }
    siteCardLast.rect = siteCardRect(siteCardEl);
    siteCardPost('hover', siteCardLast);
}

function siteCardPointer(kind, ev) {
    if (!siteCardTrackingOn) return;
    if (kind === 'click') {
        const target = siteCardTarget(ev);
        if (!target) return;
        const info = { id: target.id, color: siteCardColor(target.el, target.partId, target.id), rect: siteCardRect(target.el) };
        siteCardPost('click', info);
        return;
    }
    const target = kind === 'leave-window' ? null : siteCardTarget(ev);
    if ((target ? target.el : null) === siteCardEl) return;
    siteCardLeave();
    if (target) siteCardEnter(target);
}

function setSiteCardTracking(on) {
    if (on === siteCardTrackingOn) return;
    siteCardTrackingOn = on;
    if (!on) siteCardLeave();
}

function applySiteBuilderFrame(settings) {
    let frame = getSiteBuilderFrame();

    if (!settings.siteBuilderEnabled) {
        if (frame) frame.remove();
        siteSandboxReady = false;
        sitePendingPayload = null;
        setOpaqueShellHandling(false);
        setPointerForwarding(false);
        setSiteCardTracking(false);
        return;
    }

    // Нужно только для слоя "под интерфейсом"; поверх интерфейса холст
    // и так виден целиком.
    setOpaqueShellHandling(settings.siteBuilderLayer !== 'over');

    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = SITE_BUILDER_FRAME_ID;
        frame.title = 'SkyMod — фон сайта';
        frame.src = chrome.runtime.getURL('popup/sandbox.html');
        // color-scheme: normal — если у сайта задан тёмный/светлый color-scheme,
        // не совпадающий со схемой документа внутри iframe, браузер рисует
        // под iframe сплошную непрозрачную подложку (белую) вместо прозрачности.
        frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border:0;background:transparent;color-scheme:normal;';
        // В самое начало <html>, а не в body — так фикс-позиционирование
        // не зависит от собственного стекинг-контекста body/Angular-обёрток.
        document.documentElement.insertBefore(frame, document.documentElement.firstChild);
    }
    // "Слой" — то, что реально выбрал пользователь, без автоматических
    // подмен. Раньше здесь была "умная" логика, поднимающая слой поверх
    // интерфейса всегда, когда включены клики, — казалось бы, разумно
    // (иначе мышь не долетает до элемента глубоко под интерфейсом), но
    // на деле это означало, что выбор "под интерфейсом" в принципе
    // игнорировался, стоило включить клики. Возвращаем прямое
    // соответствие выбору; про ограничение с мышью — в подсказке к
    // полю "Разрешить клики" в конструкторе, а не тихой подменой того,
    // что выбрал пользователь.
    frame.style.zIndex = settings.siteBuilderLayer === 'over' ? '2147483647' : '-1';
    // iframe НИКОГДА не перехватывает мышь сам: иначе при слое "поверх"
    // он закрывал бы собой весь сайт и клики до интерфейса не доходили.
    // Вместо этого движения/нажатия мыши ловит сама страница и пересылает
    // в песочницу (см. setPointerForwarding) — код фона получает обычные
    // mousemove/mousedown/mouseup/click/mouseleave, а сайт работает как обычно.
    frame.style.pointerEvents = 'none';
    setPointerForwarding(!!settings.siteBuilderInteractive);
    // Координаты карточек нужны только если у фона есть пользовательский JS.
    setSiteCardTracking(!!String(settings.siteBuilderJs || '').trim());

    sendSiteBuilderCode(settings);
}

// ---------- Точка входа ----------

const SETTINGS_KEYS = [
    'primaryColor',
    'fontFamily', 'googleFontUrl', 'fontLibrary', 'activeCustomFontId',
    'backgroundImage', 'backgroundFile', 'backgroundFit', 'backgroundDim',
    'siteBuilderEnabled', 'siteBuilderLayer', 'siteBuilderInteractive', 'siteBuilderHtml', 'siteBuilderCss', 'siteBuilderJs',
    'cardColor', 'cardOpacity',
    'mathButtonEnabled', 'mathBtnColor',
    'nowLineHidden', 'nowLineColor', 'sitePartsCss', 'externalLinksNewTab',
    'cardReadable', 'cardReadableStrength', 'cardReadableBrightText',
    'scheduleCardColors', 'scheduleGlow', 'scheduleGlowStrength', 'scheduleSubjectColors',
    'lessonPopupCustomize', 'lessonPopupBackdropBlur', 'lessonPopupBackdropDim',
    'lessonPopupPanelEnabled', 'lessonPopupPanelColor', 'lessonPopupPanelOpacity',
    'hideSupportButton', 'hideUserTray', 'hidePageTitle', 'hideNavSections', 'hideBrandMark', 'antiLockEnabled',
    'uiFadeIdleEnabled', 'uiFadeIdleSeconds', 'uiFadeHotkeyEnabled', 'uiFadeHotkey', 'uiFadeVisibility', 'uiFadeScope',
];

// ---------- Внешние ссылки: во вкладках, колесо и Ctrl+клик ----------
// "Внешняя" — http(s)-ссылка на другой хост. Сам skyeng.ru и его поддомены
// (авторизация, уроки и т.д.) считаем частью платформы и не трогаем.
// Обработка трёх случаев:
//   1. Обычный клик — ставим target=_blank (rel=noopener), браузер сам откроет вкладку.
//   2. Ctrl/Cmd+клик — открываем фоновую вкладку сами и глушим обработчики сайта
//      (если сайт перехватывал клик и игнорировал модификатор).
//   3. Колесо (auxclick, кнопка 1) — то же, что Ctrl+клик.
// Работает только для настоящих <a href>. Ссылки, сделанные кнопкой или div
// с window.open внутри сайта, отсюда не видны.
let externalLinksOn = false;

function isPlatformHost(host) {
    return host === 'skyeng.ru' || host.endsWith('.skyeng.ru');
}

function findExternalAnchor(e) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    let anchor = null;
    for (const node of path) {
        if (node && node.tagName === 'A' && node.hasAttribute('href')) { anchor = node; break; }
    }
    if (!anchor) return null;
    let url;
    try { url = new URL(anchor.getAttribute('href'), location.href); } catch (err) { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname === location.hostname || isPlatformHost(url.hostname)) return null;
    if (anchor.hasAttribute('download')) return null;
    return { anchor, url };
}

function openInBackgroundTab(url) {
    try {
        chrome.runtime.sendMessage({ type: 'skymod-open-tab', url: url.href, active: false });
    } catch (err) {
        // Расширение перезагрузили, пока вкладка была открыта — тихо игнорируем.
    }
}

function onExternalClick(e) {
    if (e.button !== 0) return;
    const found = findExternalAnchor(e);
    if (!found) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openInBackgroundTab(found.url);
        return;
    }
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return; // остальные сочетания — на усмотрение браузера
    found.anchor.target = '_blank';
    const rel = (found.anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
    if (!rel.includes('noopener')) rel.push('noopener');
    found.anchor.setAttribute('rel', rel.join(' '));
}

function onExternalAuxClick(e) {
    if (e.button !== 1) return;
    const found = findExternalAnchor(e);
    if (!found) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openInBackgroundTab(found.url);
}

function setExternalLinkHandling(on) {
    if (on === externalLinksOn) return;
    externalLinksOn = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    // capture на window — раньше любых обработчиков сайта
    window[method]('click', onExternalClick, true);
    window[method]('auxclick', onExternalAuxClick, true);
}

// ---------- Фокус на фон: скрытие интерфейса ----------
// Два независимых триггера:
//   1. бездействие (нет мыши/клавиатуры/прокрутки N секунд) — интерфейс
//      возвращается при любой активности;
//   2. горячая клавиша — переключатель, активность его НЕ сбрасывает, а
//      интерфейс при этом не принимает клики (pointer-events: none).
// Работает через классы на <html>; сами правила CSS — в buildCSS.
const UI_FADE_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
let uiFadeCfg = { idle: false, idleSeconds: 30, hotkey: false, combo: 'Alt+KeyH', scope: 'schedule' };
let uiFadeIdleFaded = false;
let uiFadeHotkeyFaded = false;
let uiFadeLastActivity = Date.now();
let uiFadeInterval = 0;
let uiFadeActivityBound = false;
let uiFadeKeyBound = false;
let uiFadeToastTimer = 0;

function uiFadeApplicable() {
    return uiFadeCfg.scope === 'all' || /schedule/i.test(location.pathname);
}

function refreshUiFadeClasses() {
    const root = document.documentElement;
    const applicable = uiFadeApplicable();
    root.classList.toggle('skymod-ui-faded', applicable && (uiFadeIdleFaded || uiFadeHotkeyFaded));
    root.classList.toggle('skymod-ui-faded-locked', applicable && uiFadeHotkeyFaded);
}

function onUiFadeActivity(e) {
    if (e && e.isTrusted === false) return; // синтетические события antilock.js не считаются активностью
    uiFadeLastActivity = Date.now();
    if (uiFadeIdleFaded) {
        uiFadeIdleFaded = false;
        refreshUiFadeClasses();
    }
}

function uiFadeTick() {
    if (!uiFadeCfg.idle || uiFadeIdleFaded) return;
    if (!uiFadeApplicable()) return;
    if (Date.now() - uiFadeLastActivity >= uiFadeCfg.idleSeconds * 1000) {
        uiFadeIdleFaded = true;
        refreshUiFadeClasses();
    }
}

// Сочетание хранится как "Alt+KeyH" / "Ctrl+Shift+F8": модификаторы, затем
// e.code (не зависит от раскладки клавиатуры).
function matchesHotkey(e, combo) {
    const parts = String(combo || '').split('+');
    const code = parts.pop();
    if (!code || e.code !== code) return false;
    return e.ctrlKey === parts.includes('Ctrl')
        && e.altKey === parts.includes('Alt')
        && e.shiftKey === parts.includes('Shift')
        && e.metaKey === parts.includes('Meta');
}

function hotkeyLabel(combo) {
    return String(combo || '').split('+').map(p => p.replace(/^Key/, '').replace(/^Digit/, '')).join('+');
}

function showUiFadeToast(text) {
    let el = document.getElementById('skymod-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'skymod-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;'
            + 'background:rgba(0,0,0,.78);color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:9px 16px;'
            + 'border-radius:999px;pointer-events:none;transition:opacity .3s ease;opacity:0;';
        (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(uiFadeToastTimer);
    uiFadeToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

function onUiFadeKeydown(e) {
    if (!uiFadeCfg.hotkey || e.repeat) return;
    if (!matchesHotkey(e, uiFadeCfg.combo)) return;
    if (!uiFadeApplicable()) return;
    e.preventDefault();
    uiFadeHotkeyFaded = !uiFadeHotkeyFaded;
    uiFadeIdleFaded = false;
    refreshUiFadeClasses();
    showUiFadeToast(uiFadeHotkeyFaded
        ? 'Интерфейс скрыт. ' + hotkeyLabel(uiFadeCfg.combo) + ', чтобы вернуть'
        : 'Интерфейс показан');
}

function setUiFade(settings) {
    uiFadeCfg = {
        idle: !!settings.uiFadeIdleEnabled,
        idleSeconds: Math.max(5, Number(settings.uiFadeIdleSeconds) || 30),
        hotkey: !!settings.uiFadeHotkeyEnabled,
        combo: settings.uiFadeHotkey || 'Alt+KeyH',
        scope: settings.uiFadeScope === 'all' ? 'all' : 'schedule',
    };

    // Реакция на активность нужна только пока включено скрытие по бездействию.
    if (uiFadeCfg.idle && !uiFadeActivityBound) {
        UI_FADE_ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onUiFadeActivity, { capture: true, passive: true }));
        uiFadeActivityBound = true;
        uiFadeLastActivity = Date.now();
    } else if (!uiFadeCfg.idle && uiFadeActivityBound) {
        UI_FADE_ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onUiFadeActivity, { capture: true }));
        uiFadeActivityBound = false;
        uiFadeIdleFaded = false;
    }
    if (uiFadeCfg.idle && !uiFadeInterval) uiFadeInterval = setInterval(uiFadeTick, 1000);
    if (!uiFadeCfg.idle && uiFadeInterval) { clearInterval(uiFadeInterval); uiFadeInterval = 0; }

    if (uiFadeCfg.hotkey && !uiFadeKeyBound) {
        window.addEventListener('keydown', onUiFadeKeydown, true);
        uiFadeKeyBound = true;
    } else if (!uiFadeCfg.hotkey && uiFadeKeyBound) {
        window.removeEventListener('keydown', onUiFadeKeydown, true);
        uiFadeKeyBound = false;
        uiFadeHotkeyFaded = false;
    }
    refreshUiFadeClasses();
}

// ---------- Расписание: чтение карточек, кэш, тема ----------
// Читаем карточки занятий со страницы расписания, держим расписание на
// сегодня в chrome.storage.local (чтобы тема работала и на других страницах
// сайта, и в попапе), раз в 15 секунд пересчитываем "сейчас" и отдаём
// результат: в переменные --skymod-lesson-color/-rgb на <html>, в стили
// карточек по предметам, в свечение и в песочницу фона (аргумент schedule).
const SCHEDULE_REFRESH_MS = 15000;
const SCHEDULE_STYLE_TAG_ID = 'skymod-schedule-style';
const SCHEDULE_CARD_SELECTOR = '[data-test="student schedule slot"]';

// Живой объект: ссылка на него не меняется, обновляется Object.assign.
const liveSchedule = {};
Object.assign(liveSchedule, skymodBuildSchedule([], Date.now(), {}));

let scheduleCache = null;           // { date, lessons, subjects, updatedAt }
let scheduleCacheLoaded = false;
let scheduleColors = {};
let schedulePersistedJson = '';
let schedulePersistTimer = 0;
let scheduleDomThrottle = 0;

function onSchedulePage() {
    return /schedule/i.test(location.pathname);
}

function readScheduleDom() {
    const cards = document.querySelectorAll(SCHEDULE_CARD_SELECTOR);
    const lessons = [];
    const subjects = {};
    let hasDates = false;
    cards.forEach(card => {
        const subject = card.getAttribute('data-test-subject') || '';
        const open = card.querySelector('[data-test="student schedule slot open"]');
        const parsed = skymodParseSlotLabel(open ? open.getAttribute('aria-label') : '');
        const subjectEl = card.querySelector('.titles .subject');
        const title = (parsed && parsed.title) || (subjectEl ? subjectEl.textContent.trim() : '');
        if (subject && title) subjects[subject] = title;
        if (!parsed) return;
        const dayEl = card.closest('[data-test-date]');
        const date = dayEl ? dayEl.getAttribute('data-test-date') : null;
        if (date) hasDates = true;
        lessons.push({
            id: card.getAttribute('data-test-slot-id') || '',
            subject,
            title,
            type: card.getAttribute('data-test-activity-type') || '',
            kind: parsed.kind || '',
            state: card.getAttribute('data-test-card-state') || '',
            date,
            startMin: parsed.startMin,
            endMin: parsed.endMin,
        });
    });
    const dates = Array.from(new Set(Array.from(document.querySelectorAll('.day-col[data-test-date]')).map(el => el.getAttribute('data-test-date')).filter(Boolean)));
    return { cardCount: cards.length, lessons, subjects, hasDates, dates };
}

function applyScheduleStyleTag() {
    let tag = document.getElementById(SCHEDULE_STYLE_TAG_ID);
    const codes = new Set(Object.keys(scheduleColors));
    if (scheduleCache && scheduleCache.subjects) Object.keys(scheduleCache.subjects).forEach(c => codes.add(c));
    let css = '';
    codes.forEach(code => {
        const safe = code.replace(/[^\w-]/g, '');
        if (!safe) return;
        css += `[data-test-subject="${safe}"] { --skymod-subject-rgb: ${skymodHexToRgbString(skymodSubjectColor(code, scheduleColors))}; }\n`;
    });
    if (!tag) {
        tag = document.createElement('style');
        tag.id = SCHEDULE_STYLE_TAG_ID;
        (document.head || document.documentElement).appendChild(tag);
    }
    if (tag.textContent !== css) tag.textContent = css;
}

function applyScheduleTheme() {
    const root = document.documentElement;
    const color = liveSchedule.color;
    if (color) {
        root.style.setProperty('--skymod-lesson-color', color);
        root.style.setProperty('--skymod-lesson-rgb', skymodHexToRgbString(color));
    } else {
        root.style.removeProperty('--skymod-lesson-color');
        root.style.removeProperty('--skymod-lesson-rgb');
    }

    const s = lastSettings || {};
    let glow = document.getElementById('skymod-schedule-glow');
    if (!s.scheduleGlow) {
        if (glow) glow.remove();
        return;
    }
    if (!glow) {
        glow = document.createElement('div');
        glow.id = 'skymod-schedule-glow';
        document.documentElement.appendChild(glow);
    }
    const strength = Math.max(0, Math.min(100, s.scheduleGlowStrength ?? 35)) / 100;
    const behind = !!(s.siteBuilderEnabled || s.backgroundFile || s.backgroundImage);
    glow.setAttribute('data-mode', behind ? 'behind' : 'overlay');
    // Поверх страницы яркость вдвое меньше, чтобы цвет не "выжигал" текст.
    const maxAlpha = behind ? 0.6 : 0.3;
    glow.style.setProperty('--skymod-c', color
        ? `rgba(${skymodHexToRgbString(color)}, ${(strength * maxAlpha).toFixed(2)})`
        : 'transparent');
}

function pushScheduleToFrame() {
    const frame = getSiteBuilderFrame();
    if (!frame || !frame.contentWindow || !siteSandboxReady) return;
    frame.contentWindow.postMessage({ type: 'skymod-schedule', data: liveSchedule }, '*');
}

function persistScheduleCache() {
    if (!scheduleCache) return;
    const json = JSON.stringify({ d: scheduleCache.date, l: scheduleCache.lessons, s: scheduleCache.subjects });
    if (json === schedulePersistedJson) return;
    schedulePersistedJson = json;
    clearTimeout(schedulePersistTimer);
    schedulePersistTimer = setTimeout(() => {
        try {
            chrome.storage.local.set({ [SKYMOD_SCHEDULE_CACHE_KEY]: { ...scheduleCache, updatedAt: Date.now() } });
        } catch (err) { /* расширение перезагрузили, пока вкладка была открыта */ }
    }, 400);
}

// Расписание на всю открытую неделю для напоминаний в Telegram (читает background.js).
// Хранится по датам и дополняется: открыли другую неделю, и её дни добавились, а
// остальные остались. Прошедшие дни выбрасываются.
const WEEK_LESSONS_KEY = 'siteWeekLessons';
let weekLessonsCache = {};
let weekPersistedJson = '';
let weekPersistTimer = 0;

function updateWeekCache(dom, today) {
    if (!dom.hasDates || !dom.dates.length) return;
    const next = {};
    Object.keys(weekLessonsCache).forEach(date => { if (date >= today) next[date] = weekLessonsCache[date]; });
    dom.dates.forEach(date => { if (date >= today) next[date] = []; });
    dom.lessons.forEach(l => {
        if (!l.date || l.date < today || !next[l.date]) return;
        next[l.date].push({ id: l.id, title: l.title, kind: l.kind, type: l.type, startMin: l.startMin, endMin: l.endMin });
    });
    weekLessonsCache = next;
    const json = JSON.stringify(next);
    if (json === weekPersistedJson) return;
    weekPersistedJson = json;
    clearTimeout(weekPersistTimer);
    weekPersistTimer = setTimeout(() => {
        try {
            chrome.storage.local.set({ [WEEK_LESSONS_KEY]: next });
        } catch (err) { /* расширение перезагрузили, пока вкладка была открыта */ }
    }, 600);
}

// fromDom=false: только пересчитать "сейчас" по тому, что уже известно.
function refreshSchedule(fromDom) {
    const now = Date.now();
    const today = skymodLocalDateKey(now);

    if (fromDom && scheduleCacheLoaded) {
        const dom = readScheduleDom();
        if (dom.cardCount > 0) {
            updateWeekCache(dom, today);
            const base = scheduleCache && scheduleCache.date === today ? scheduleCache : { date: today, lessons: [], subjects: {} };
            const subjects = { ...(scheduleCache ? scheduleCache.subjects : {}), ...dom.subjects };
            // Если на странице нет колонок с датами, считаем все карточки сегодняшними.
            const todays = dom.lessons
                .filter(l => l.date === today || (!dom.hasDates && l.date === null))
                .map(l => ({
                    id: l.id, subject: l.subject, title: l.title, type: l.type, kind: l.kind, state: l.state,
                    start: skymodDateKeyToTs(today, l.startMin),
                    end: skymodDateKeyToTs(today, l.endMin),
                }));
            // Открыта другая неделя (сегодняшних карточек нет): старый кэш на сегодня не затираем.
            scheduleCache = { date: today, lessons: todays.length ? todays : base.lessons, subjects };
            persistScheduleCache();
        }
    }

    const lessons = scheduleCache && scheduleCache.date === today ? scheduleCache.lessons : [];
    Object.assign(liveSchedule, skymodBuildSchedule(lessons, now, scheduleColors));
    applyScheduleStyleTag();
    applyScheduleTheme();
    pushScheduleToFrame();
}

function scheduleDomChanged() {
    if (scheduleDomThrottle) return;
    scheduleDomThrottle = setTimeout(() => {
        scheduleDomThrottle = 0;
        if (onSchedulePage()) refreshSchedule(true);
    }, 1000);
}

// Свои блоки в расписании. Хранятся в chrome.storage.local под ключом customBlocks:
// { id, title, startMin, endMin, color, date: 'YYYY-MM-DD' | null, weekdays: [0..6] },
// где 0 это понедельник. Блок либо на одну дату, либо повторяется по дням недели.
// Рисуются элементом внутри .day-col нужного дня: у колонки position: relative,
// карточки лежат в ней абсолютно (top и height в px). Масштаб и начало шкалы берутся
// с самой страницы (по карточке или полосе обеда), а не зашиты в код.
const CUSTOM_BLOCKS_KEY = 'customBlocks';
const CUSTOM_BLOCK_CLASS = 'skymod-custom-block';
const CUSTOM_BLOCKS_STYLE_ID = 'skymod-custom-blocks-style';
const DEFAULT_GRID = { pxPerMin: 2.5, originMin: 570 };
let customBlocksCache = [];

function normalizeCustomBlocks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(b => {
        if (!b || typeof b !== 'object' || !b.id) return null;
        const startMin = Number(b.startMin);
        const endMin = Number(b.endMin);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin < 0 || endMin > 1440 || endMin <= startMin) return null;
        const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
        const weekdays = Array.isArray(b.weekdays) ? b.weekdays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [];
        if (!date && !weekdays.length) return null;
        const color = typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#8b7cf6';
        return { id: String(b.id), title: String(b.title || '').slice(0, 60), startMin, endMin, color, date, weekdays };
    }).filter(Boolean);
}

function customBlockAppliesOn(block, date) {
    if (block.date) return block.date === date;
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const weekday = (new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay() + 6) % 7;
    return block.weekdays.includes(weekday);
}

function customClock(min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

function readGridCalibration() {
    const boxes = document.querySelectorAll('.day-col .slot-box');
    for (const box of boxes) {
        const top = parseFloat(box.style.top);
        const height = parseFloat(box.style.height);
        const open = box.querySelector('[data-test="student schedule slot open"]');
        const parsed = open ? skymodParseSlotLabel(open.getAttribute('aria-label')) : null;
        if (!parsed || !Number.isFinite(top) || !(height > 0) || parsed.endMin <= parsed.startMin) continue;
        const pxPerMin = height / (parsed.endMin - parsed.startMin);
        if (pxPerMin < 0.5 || pxPerMin > 6) continue;
        return { pxPerMin, originMin: parsed.startMin - top / pxPerMin };
    }
    const lunch = document.querySelector('[data-test="student schedule lunch"]');
    if (lunch) {
        const m = lunch.textContent.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
        const top = parseFloat(lunch.style.top);
        const height = parseFloat(lunch.style.height);
        if (m && Number.isFinite(top) && height > 0) {
            const start = Number(m[1]) * 60 + Number(m[2]);
            const end = Number(m[3]) * 60 + Number(m[4]);
            if (end > start) {
                const pxPerMin = height / (end - start);
                if (pxPerMin >= 0.5 && pxPerMin <= 6) return { pxPerMin, originMin: start - top / pxPerMin };
            }
        }
    }
    return DEFAULT_GRID;
}

function ensureCustomBlocksStyle() {
    if (document.getElementById(CUSTOM_BLOCKS_STYLE_ID)) return;
    const tag = document.createElement('style');
    tag.id = CUSTOM_BLOCKS_STYLE_ID;
    tag.textContent = skymodCustomBlockBaseCss();
    (document.head || document.documentElement).appendChild(tag);
}

function deleteCustomBlock(block) {
    if (!block.date && !confirm('Блок повторяется каждую неделю. Удалить его везде?')) return;
    try {
        chrome.storage.local.get(CUSTOM_BLOCKS_KEY, r => {
            const list = Array.isArray(r[CUSTOM_BLOCKS_KEY]) ? r[CUSTOM_BLOCKS_KEY] : [];
            chrome.storage.local.set({ [CUSTOM_BLOCKS_KEY]: list.filter(b => b && b.id !== block.id) });
        });
    } catch (err) { /* расширение перезагрузили, пока вкладка была открыта */ }
}

function buildCustomBlockEl(block, col, grid) {
    const colHeight = col.clientHeight || parseFloat(col.style.height) || 0;
    let top = (block.startMin - grid.originMin) * grid.pxPerMin;
    let bottom = (block.endMin - grid.originMin) * grid.pxPerMin;
    if (colHeight && (bottom <= 0 || top >= colHeight)) return null;
    top = Math.max(0, top);
    if (colHeight) bottom = Math.min(colHeight, bottom);
    const height = bottom - top;
    if (height < 8) return null;

    let overlaps = false;
    col.querySelectorAll('.slot-box').forEach(box => {
        const boxTop = parseFloat(box.style.top);
        const boxHeight = parseFloat(box.style.height);
        if (Number.isFinite(boxTop) && boxHeight > 0 && boxTop < bottom - 2 && boxTop + boxHeight > top + 2) overlaps = true;
    });

    const label = `${block.title || 'Без названия'}\n${customClock(block.startMin)}–${customClock(block.endMin)}`;
    const el = document.createElement('div');
    el.className = CUSTOM_BLOCK_CLASS + (overlaps ? ' -overlap' : '') + (height < 44 ? ' -compact' : '');
    el.setAttribute('data-skymod-block-id', block.id);
    el.title = label;
    el.style.top = top + 'px';
    el.style.height = height + 'px';
    el.style.setProperty('--skymod-cb-color', block.color);

    const title = document.createElement('span');
    title.className = 't';
    title.textContent = block.title || 'Без названия';
    const meta = document.createElement('span');
    meta.className = 'm';
    meta.textContent = `${customClock(block.startMin)}–${customClock(block.endMin)}`;
    el.append(title, meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'x';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Удалить блок');
    del.addEventListener('click', ev => { ev.stopPropagation(); deleteCustomBlock(block); });
    el.appendChild(del);
    return el;
}

// Идемпотентно: у каждой колонки хранится подпись того, что в неё вставлено,
// поэтому повторный вызов без изменений ничего не трогает (и не будит наблюдатель).
function renderCustomBlocks() {
    const cols = document.querySelectorAll('.day-col[data-test-date]');
    if (!cols.length) return;
    ensureCustomBlocksStyle();
    const grid = readGridCalibration();
    const gridSig = grid.pxPerMin.toFixed(3) + ':' + grid.originMin.toFixed(2);
    cols.forEach(col => {
        const date = col.getAttribute('data-test-date');
        const wanted = customBlocksCache.filter(b => customBlockAppliesOn(b, date)).sort((a, b) => a.startMin - b.startMin);
        const sig = gridSig + '|' + col.querySelectorAll('.slot-box').length + '|'
            + wanted.map(b => [b.id, b.title, b.startMin, b.endMin, b.color].join('~')).join('|');
        const existing = col.querySelectorAll(':scope > .' + CUSTOM_BLOCK_CLASS);
        if (col.getAttribute('data-skymod-cb-sig') === sig && existing.length === wanted.length) return;
        existing.forEach(el => el.remove());
        wanted.forEach(b => {
            const el = buildCustomBlockEl(b, col, grid);
            if (el) col.appendChild(el);
        });
        col.setAttribute('data-skymod-cb-sig', sig);
    });
}

function initCustomBlocks() {
    chrome.storage.local.get(CUSTOM_BLOCKS_KEY, r => {
        customBlocksCache = normalizeCustomBlocks(r[CUSTOM_BLOCKS_KEY]);
        renderCustomBlocks();
    });
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { renderCustomBlocks(); scheduleBehaviorTick(0); }, 150); };
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
}

// Диагностика сайта. diag-hook.js (мир страницы) присылает журнал сообщениями
// window.postMessage; здесь он копится в памяти, при включённой диагностике
// сохраняется в chrome.storage.local (переживает перезагрузку страницы) и по команде
// из попапа собирается в один файл вместе со снимком страницы. Ничего не отправляется
// в сеть: файл скачивает пользователь и сам решает, кому его показать.
const DIAG_LOG_KEY = 'diagLog';
const DIAG_INCIDENTS_KEY = 'diagIncidents';
const DIAG_MAX_ENTRIES = 800;
const DIAG_PERSIST_ENTRIES = 400;
const DIAG_PERSIST_MAX_BYTES = 700000;
let diagEnabled = true;
let diagEntries = [];
let diagTimers = [];
let diagState = null;
let diagIncidents = [];
let diagPersistTimer = 0;
let diagIncidentOpen = false;

const DIAG_SENSITIVE_KEY = /(auth|token|cookie|pass(word)?|secret|session|jwt|csrf|xsrf|api[-_]?key|credential|signature|bearer|sid)/i;

function diagLooksSecret(value) {
    return /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(value) || /^[A-Za-z0-9_\-+/=]{32,}$/.test(value);
}

function diagRedactText(text) {
    return String(text)
        .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '[JWT]')
        .replace(/("[^"]*(?:token|secret|pass|auth|session|cookie|jwt|key)[^"]*"\s*:\s*)"[^"]*"/gi, '$1"[hidden]"')
        .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
        .replace(/\+\d[\d\s().-]{9,}\d/g, '[phone]');
}

function diagRedactUrl(raw) {
    try {
        const u = new URL(String(raw), location.href);
        u.pathname = u.pathname.split('/').map(seg => (diagLooksSecret(decodeURIComponent(seg)) ? ':secret' : seg)).join('/');
        Array.from(u.searchParams.keys()).forEach(k => {
            if (DIAG_SENSITIVE_KEY.test(k) || diagLooksSecret(u.searchParams.get(k) || '')) u.searchParams.set(k, 'REDACTED');
        });
        return (u.origin === location.origin ? '' : u.origin) + u.pathname + u.search;
    } catch (err) {
        return String(raw).slice(0, 200).replace(/[?#].*$/, '');
    }
}

function scheduleDiagPersist() {
    if (!diagEnabled || diagPersistTimer) return;
    diagPersistTimer = setTimeout(() => { diagPersistTimer = 0; persistDiag(); }, 3000);
}

function persistDiag() {
    if (!diagEnabled) return;
    try {
        let entries = diagEntries.slice(-DIAG_PERSIST_ENTRIES);
        let json = JSON.stringify(entries);
        while (json.length > DIAG_PERSIST_MAX_BYTES && entries.length > 20) {
            entries = entries.slice(Math.ceil(entries.length / 4));
            json = JSON.stringify(entries);
        }
        chrome.storage.local.set({ [DIAG_LOG_KEY]: { entries, timers: diagTimers, savedAt: Date.now() } });
    } catch (err) { /* расширение перезагрузили, пока вкладка была открыта */ }
}

window.addEventListener('message', ev => {
    if (ev.source !== window || !ev.data || ev.data.__skymodDiag !== 1) return;
    const d = ev.data;
    if (Array.isArray(d.entries) && d.entries.length) {
        const clean = d.entries.filter(e => e && typeof e === 'object' && typeof e.k === 'string').slice(-200);
        diagEntries = diagEntries.concat(clean);
        if (diagEntries.length > DIAG_MAX_ENTRIES) diagEntries.splice(0, diagEntries.length - DIAG_MAX_ENTRIES);
    }
    if (Array.isArray(d.timers)) diagTimers = d.timers.slice(0, 60);
    if (d.state && typeof d.state === 'object') {
        diagState = { lastActivity: Number(d.state.lastActivity) || 0, now: Number(d.state.now) || 0, vis: String(d.state.vis || ''), f: d.state.f ? 1 : 0 };
    }
    scheduleDiagPersist();
});

function initDiag() {
    chrome.storage.local.get(['diagEnabled', 'diagBodies', DIAG_LOG_KEY, DIAG_INCIDENTS_KEY], r => {
        diagEnabled = r.diagEnabled !== false;
        document.documentElement.setAttribute('data-skymod-diag-bodies', r.diagBodies ? '1' : '0');
        const saved = r[DIAG_LOG_KEY];
        const old = saved && Array.isArray(saved.entries) ? saved.entries : [];
        diagEntries.unshift({ k: 'pageload', t: Math.round(performance.timeOrigin), url: location.pathname });
        diagEntries = old.concat(diagEntries).slice(-DIAG_MAX_ENTRIES);
        diagIncidents = Array.isArray(r[DIAG_INCIDENTS_KEY]) ? r[DIAG_INCIDENTS_KEY] : [];
        scheduleDiagPersist();
    });
}

function diagRealVisibility() {
    return document.visibilityState + (document.hasFocus() ? ', в фокусе' : ', без фокуса');
}

// Вызывается, когда на странице появилось окно «The page got bored while you were away».
function recordLockIncident(popup) {
    const now = Date.now();
    const incident = {
        t: now,
        iso: new Date(now).toISOString(),
        url: location.pathname,
        visibility: diagRealVisibility(),
        idleSec: diagState && diagState.lastActivity ? Math.round((now - diagState.lastActivity) / 1000) : null,
        sinceLoadSec: Math.round(performance.now() / 1000),
        antiLock: lastSettings.antiLockEnabled !== false,
        text: popup.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
        entries: diagEntries.slice(-80),
        timers: diagTimers.slice(0, 30),
        state: diagState,
    };
    diagIncidents = diagIncidents.concat(incident).slice(-5);
    if (diagEnabled) {
        try { chrome.storage.local.set({ [DIAG_INCIDENTS_KEY]: diagIncidents }); } catch (err) { /* ничего */ }
        persistDiag();
    }
}

function diagStatus() {
    return {
        ok: true,
        enabled: diagEnabled,
        entries: diagEntries.length,
        timers: diagTimers.length,
        incidents: diagIncidents.map(i => ({ iso: i.iso, visibility: i.visibility, idleSec: i.idleSec, sinceLoadSec: i.sinceLoadSec })),
        visibility: diagRealVisibility(),
        uptimeSec: Math.round(performance.now() / 1000),
        lockPopupNow: !!document.querySelector('laboratory-waiting-popup'),
    };
}

function diagSerializeDom() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script').forEach(el => {
        if (!el.src && el.textContent.length > 200000) el.textContent = `[inline script, ${el.textContent.length} символов, пропущен]`;
    });
    clone.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.value.length > 4000) el.setAttribute(attr.name, `[${attr.name}: ${attr.value.length} символов, пропущено]`);
        });
    });
    return diagRedactText('<!DOCTYPE html>\n' + clone.outerHTML);
}

function diagDescribeStorage(store) {
    const out = {};
    try {
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            const value = store.getItem(key) || '';
            out[key] = DIAG_SENSITIVE_KEY.test(key) || diagLooksSecret(value)
                ? `[скрыто, ${value.length} симв.]`
                : diagRedactText(value.slice(0, 200)) + (value.length > 200 ? `… (${value.length} симв.)` : '');
        }
    } catch (err) { out.__error = String(err); }
    return out;
}

function diagCodeUrls() {
    const urls = new Set();
    Array.from(document.scripts).forEach(el => { if (el.src) urls.add(el.src); });
    if (performance.getEntriesByType) {
        performance.getEntriesByType('resource').forEach(e => { if (/\.m?js(\?|#|$)/i.test(e.name)) urls.add(e.name); });
    }
    return Array.from(urls);
}

async function diagFetchCode(urls) {
    const files = [];
    let total = 0;
    const queue = urls.slice();
    const worker = async () => {
        while (queue.length) {
            const url = queue.shift();
            const entry = { url: diagRedactUrl(url) };
            try {
                if (new URL(url).origin !== location.origin) throw new Error('другой домен');
                if (total > 40e6) throw new Error('лимит размера');
                const res = await fetch(url, { credentials: 'omit' });
                const text = await res.text();
                entry.status = res.status;
                entry.size = text.length;
                if (text.length <= 12e6) { entry.code = text; total += text.length; } else entry.note = 'файл больше 12 МБ, пропущен';
            } catch (err) {
                entry.error = String(err && err.message || err);
            }
            files.push(entry);
        }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return files;
}

// Вычисленные стили первых карточек (карточка, .head, .subject, .time): по ним видно, какое
// правило реально победило на странице (свои, сайта или других расширений).
function diagProbe() {
    const props = ['background-color', 'background-image', 'border-top-width', 'border-top-color', 'border-radius', 'box-shadow', 'opacity', 'color', 'font-family', 'font-size', 'letter-spacing', 'text-transform', 'display'];
    const pick = el => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out = {};
        props.forEach(p => { out[p] = String(cs.getPropertyValue(p)).slice(0, 160); });
        return out;
    };
    const cards = [];
    document.querySelectorAll('[data-test="student schedule slot"]').forEach((el, i) => {
        if (i >= 3) return;
        cards.push({
            className: el.className,
            state: el.getAttribute('data-test-card-state'),
            tint: el.getAttribute('data-test-card-tint'),
            type: el.getAttribute('data-test-activity-type'),
            card: pick(el), head: pick(el.querySelector('.head')), subject: pick(el.querySelector('.subject')), time: pick(el.querySelector('.time')),
        });
    });
    const marker = document.querySelector('[data-test="student schedule now marker"]');
    return { cards, nowMarker: pick(marker), styleTagLength: (document.getElementById(STYLE_TAG_ID) || { textContent: '' }).textContent.length };
}

async function buildDiagSnapshot(opts) {
    const root = document.documentElement;
    const ngEl = document.querySelector('[ng-version]');
    const all = await chrome.storage.local.get(null);
    const settings = {};
    Object.keys(all).forEach(k => {
        if (/^tg|token|secret|^builder|^siteBuilder|^sitePartsCss|fontFile|backgroundFile|Presets$|Cache$|^siteWeekLessons|^customBlocks|^diagLog|^diagIncidents/i.test(k)) return;
        const v = JSON.stringify(all[k]);
        if (v && v.length <= 300) settings[k] = all[k];
    });

    const snap = {
        format: 'skymod-diagnostics-1',
        meta: {
            createdAt: new Date().toISOString(),
            tzOffsetMin: new Date().getTimezoneOffset(),
            url: diagRedactUrl(location.href),
            referrer: document.referrer ? diagRedactUrl(document.referrer) : '',
            userAgent: navigator.userAgent,
            extensionVersion: chrome.runtime.getManifest().version,
            viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
            language: navigator.language,
            visibility: diagRealVisibility(),
            theme: root.getAttribute('data-laboratory-theme'),
            angularVersion: ngEl ? ngEl.getAttribute('ng-version') : null,
            pageLoadedAt: new Date(performance.timeOrigin).toISOString(),
            uptimeSec: Math.round(performance.now() / 1000),
            online: navigator.onLine,
            antiLock: lastSettings.antiLockEnabled !== false,
            lockPopupNow: !!document.querySelector('laboratory-waiting-popup'),
        },
        settings,
        html: diagSerializeDom(),
        stylesheets: [],
        scripts: Array.from(document.scripts).map(el => ({
            src: el.src ? diagRedactUrl(el.src) : null,
            type: el.type || null,
            async: el.async,
            defer: el.defer,
            inlineChars: el.src ? 0 : el.textContent.length,
        })),
        resources: performance.getEntriesByType ? performance.getEntriesByType('resource').slice(-600).map(e => ({
            url: diagRedactUrl(e.name), type: e.initiatorType, startMs: Math.round(e.startTime), durMs: Math.round(e.duration), bytes: e.transferSize,
        })) : [],
        storage: {
            local: diagDescribeStorage(window.localStorage),
            session: diagDescribeStorage(window.sessionStorage),
            cookieNames: document.cookie ? document.cookie.split(';').map(c => { const [n, ...v] = c.trim().split('='); return { name: n, length: v.join('=').length }; }) : [],
        },
        journal: { entries: diagEntries, timers: diagTimers, state: diagState },
        probe: diagProbe(),
        incidents: diagIncidents,
    };

    try { snap.storage.indexedDb = indexedDB.databases ? (await indexedDB.databases()).map(d => ({ name: d.name, version: d.version })) : []; } catch (err) { snap.storage.indexedDb = String(err); }
    try { snap.storage.caches = window.caches ? await caches.keys() : []; } catch (err) { snap.storage.caches = String(err); }
    try { snap.serviceWorkers = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, script: r.active && diagRedactUrl(r.active.scriptURL) })) : []; } catch (err) { snap.serviceWorkers = String(err); }

    Array.from(document.styleSheets).forEach(sheet => {
        if (!sheet.href) return;
        const item = { href: diagRedactUrl(sheet.href) };
        try { item.css = Array.from(sheet.cssRules).map(r => r.cssText).join('\n').slice(0, 1500000); } catch (err) { item.error = 'нет доступа к правилам (другой домен)'; }
        snap.stylesheets.push(item);
    });

    if (opts.includeCode) snap.code = await diagFetchCode(diagCodeUrls());
    return snap;
}

async function downloadDiagFile(text, baseName, gzip) {
    let blob;
    let name = baseName;
    if (gzip && typeof CompressionStream === 'function') {
        blob = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
        name += '.gz';
    } else {
        blob = new Blob([text], { type: 'application/json' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true, name, bytes: blob.size };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('skymod-diag-') || sender.id !== chrome.runtime.id) return;
    if (msg.type === 'skymod-diag-status') { sendResponse(diagStatus()); return; }
    if (msg.type === 'skymod-diag-clear') {
        diagEntries = [];
        diagTimers = [];
        diagIncidents = [];
        chrome.storage.local.remove([DIAG_LOG_KEY, DIAG_INCIDENTS_KEY]);
        sendResponse({ ok: true });
        return;
    }
    if (msg.type === 'skymod-diag-snapshot') {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
        buildDiagSnapshot({ includeCode: !!msg.includeCode })
            .then(snap => downloadDiagFile(JSON.stringify(snap), `skymod-diag-${stamp}.json`, !!msg.includeCode))
            .then(sendResponse)
            .catch(err => sendResponse({ ok: false, error: String((err && err.message) || err) }));
        return true;
    }
});

// Поведение частей интерфейса: свой HTML и JS у карточек занятий и своих блоков
// (конструктор -> «Части интерфейса сайта», вкладки HTML и JS у части).
//  - HTML это шаблон, который вставляется в КАЖДУЮ карточку (div.skymod-card-slot).
//    Подстановки {{title}}, {{start}} и подобные экранируются, сама разметка
//    очищается (без скриптов, обработчиков on*, внешних адресов).
//  - JS выполняется в песочнице (popup/behavior-sandbox.js) и может только читать
//    данные карточек и слать команды: классы, CSS-переменные, data-атрибуты, текст
//    в слотах. Здесь команды проверяются и применяются к элементам.
// Данные в хранилище: sitePartsCss[partId] = { enabled, css, html, js, ... }.
const BEHAVIOR_PARTS = {
    'schedule-card': { itemSelector: '[data-test="student schedule slot"]', idAttr: 'data-test-slot-id' },
    'custom-block': { itemSelector: '.skymod-custom-block', idAttr: 'data-skymod-block-id' },
};
const BEHAVIOR_FRAME_ID = 'skymod-behavior-frame';
const BEHAVIOR_STYLE_ID = 'skymod-behavior-style';
const BEHAVIOR_STORAGE_PREFIX = 'behaviorData:';
const BEHAVIOR_LOG_KEY = 'behaviorLog';
let behaviorActive = {};
let behaviorJsKey = '';
let behaviorFrameReady = false;
let behaviorStates = {};
let behaviorSentJson = {};
let behaviorHoverId = {};
let behaviorTimer = 0;
let behaviorLogBuf = [];
let behaviorLogTimer = 0;

function behaviorLog(partId, level, message) {
    (console[level] || console.log)('[SkyMod: поведение' + (partId ? ' ' + partId : '') + ']', message);
    behaviorLogBuf.push({ t: Date.now(), partId: partId || '', level, message: String(message).slice(0, 400) });
    behaviorLogBuf = behaviorLogBuf.slice(-40);
    if (behaviorLogTimer) return;
    behaviorLogTimer = setTimeout(() => {
        behaviorLogTimer = 0;
        try { chrome.storage.local.set({ [BEHAVIOR_LOG_KEY]: behaviorLogBuf }); } catch (err) { /* расширение перезагрузили */ }
    }, 1000);
}

function behaviorTimeFields(base, date, startMin, endMin, now) {
    const out = Object.assign({ date: date || null }, base);
    const valid = date && Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin;
    if (!valid) {
        return Object.assign(out, { start: null, end: null, startLabel: '', endLabel: '', status: 'unknown', progress: 0, minutesLeft: 0, minutesUntil: 0 });
    }
    const start = skymodDateKeyToTs(date, startMin);
    const end = skymodDateKeyToTs(date, endMin);
    const status = now < start ? 'future' : (now >= end ? 'past' : 'current');
    return Object.assign(out, {
        start, end,
        startLabel: customClock(startMin),
        endLabel: customClock(endMin),
        status,
        progress: status === 'past' ? 1 : (status === 'future' ? 0 : Math.round(((now - start) / (end - start)) * 1000) / 1000),
        minutesLeft: status === 'current' ? Math.ceil((end - now) / 60000) : 0,
        minutesUntil: status === 'future' ? Math.ceil((start - now) / 60000) : 0,
    });
}

function behaviorLessonData(el, now) {
    const open = el.querySelector('[data-test="student schedule slot open"]');
    const parsed = skymodParseSlotLabel(open ? open.getAttribute('aria-label') : '');
    const dayEl = el.closest('[data-test-date]');
    const subjectEl = el.querySelector('.titles .subject');
    const subject = el.getAttribute('data-test-subject') || '';
    return behaviorTimeFields({
        id: el.getAttribute('data-test-slot-id') || '',
        subject,
        title: (parsed && parsed.title) || (subjectEl ? subjectEl.textContent.trim() : ''),
        type: el.getAttribute('data-test-activity-type') || '',
        kind: (parsed && parsed.kind) || '',
        state: el.getAttribute('data-test-card-state') || '',
        color: subject ? skymodSubjectColor(subject, scheduleColors) : '',
    }, dayEl ? dayEl.getAttribute('data-test-date') : null, parsed ? parsed.startMin : null, parsed ? parsed.endMin : null, now);
}

function behaviorBlockData(el, now) {
    const id = el.getAttribute('data-skymod-block-id') || '';
    const block = customBlocksCache.find(b => b.id === id);
    if (!block) return null;
    const dayEl = el.closest('[data-test-date]');
    return behaviorTimeFields({
        id, title: block.title, color: block.color, type: 'custom', kind: 'Своё', state: '',
    }, dayEl ? dayEl.getAttribute('data-test-date') : null, block.startMin, block.endMin, now);
}

function behaviorItems(partId) {
    const def = BEHAVIOR_PARTS[partId];
    const now = Date.now();
    const out = [];
    document.querySelectorAll(def.itemSelector).forEach(el => {
        const data = partId === 'custom-block' ? behaviorBlockData(el, now) : behaviorLessonData(el, now);
        if (data && data.id) out.push({ el, data });
    });
    return out;
}

function behaviorMergeStates(partId, states) {
    if (!behaviorActive[partId] || !states || typeof states !== 'object') return;
    const bucket = behaviorStates[partId] || (behaviorStates[partId] = {});
    Object.keys(states).slice(0, 300).forEach(rawId => {
        const id = String(rawId).slice(0, 64);
        const clean = behaviorCleanState(states[rawId]);
        if (clean) bucket[id] = clean; else delete bucket[id];
    });
    const ids = Object.keys(bucket);
    if (ids.length > 400) ids.slice(0, ids.length - 400).forEach(k => delete bucket[k]);
    scheduleBehaviorTick(0);
}

function behaviorClearPart(partId) {
    const def = BEHAVIOR_PARTS[partId];
    if (!def) return;
    delete behaviorStates[partId];
    document.querySelectorAll(def.itemSelector).forEach(el => {
        behaviorApplyState(el, null, true);
        const slot = el.querySelector(':scope > .skymod-card-slot');
        if (slot) slot.remove();
    });
}

function ensureBehaviorStyle() {
    if (document.getElementById(BEHAVIOR_STYLE_ID)) return;
    const tag = document.createElement('style');
    tag.id = BEHAVIOR_STYLE_ID;
    tag.textContent = '.skymod-card-slot { pointer-events: none; }';
    (document.head || document.documentElement).appendChild(tag);
}

function behaviorPost(msg) {
    const frame = document.getElementById(BEHAVIOR_FRAME_ID);
    if (!frame || !behaviorFrameReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage(msg, '*');
}

function behaviorTick() {
    behaviorTimer = 0;
    const partIds = Object.keys(behaviorActive);
    if (!partIds.length) return;
    ensureBehaviorStyle();
    partIds.forEach(partId => {
        const cfg = behaviorActive[partId];
        const cards = [];
        behaviorItems(partId).forEach(({ el, data }) => {
            cards.push(data);
            const changed = cfg.html ? behaviorRenderSlot(el, partId, cfg.html, data) : false;
            behaviorApplyState(el, (behaviorStates[partId] || {})[data.id] || null, changed);
        });
        if (cfg.js) {
            const json = JSON.stringify(cards);
            if (behaviorSentJson[partId] !== json) {
                behaviorSentJson[partId] = json;
                behaviorPost({ type: 'skymod-behavior-cards', partId, cards });
            }
        }
    });
}

function scheduleBehaviorTick(delay) {
    if (behaviorTimer || !Object.keys(behaviorActive).length) return;
    behaviorTimer = setTimeout(behaviorTick, delay === undefined ? 150 : delay);
}

function restartBehaviorFrame() {
    const old = document.getElementById(BEHAVIOR_FRAME_ID);
    if (old) old.remove();
    behaviorFrameReady = false;
    behaviorSentJson = {};
    behaviorHoverId = {};
    Object.keys(behaviorStates).forEach(partId => { behaviorStates[partId] = {}; });
    if (!Object.keys(behaviorActive).some(k => behaviorActive[k].js) || !document.documentElement) return;
    const frame = document.createElement('iframe');
    frame.id = BEHAVIOR_FRAME_ID;
    frame.src = chrome.runtime.getURL('popup/behavior-sandbox.html');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 1px; height: 1px; border: 0; opacity: 0; pointer-events: none;';
    document.documentElement.appendChild(frame);
}

function syncBehaviorParts(partsData) {
    const next = {};
    if (partsData && typeof partsData === 'object') {
        Object.keys(BEHAVIOR_PARTS).forEach(partId => {
            const p = partsData[partId];
            if (!p || !p.enabled) return;
            const html = typeof p.html === 'string' ? p.html.trim() : '';
            const js = typeof p.js === 'string' ? p.js.trim() : '';
            if (html || js) next[partId] = { html, js };
        });
    }
    const removed = Object.keys(behaviorActive).filter(k => !next[k]);
    behaviorActive = next;
    removed.forEach(behaviorClearPart);
    Object.keys(next).forEach(partId => { if (!next[partId].js) { delete behaviorStates[partId]; delete behaviorSentJson[partId]; } });
    const jsKey = JSON.stringify(Object.keys(next).filter(k => next[k].js).map(k => [k, next[k].js]));
    if (jsKey !== behaviorJsKey) { behaviorJsKey = jsKey; restartBehaviorFrame(); }
    scheduleBehaviorTick(0);
}

function behaviorPointer(kind, ev) {
    if (!behaviorFrameReady) return;
    Object.keys(behaviorActive).forEach(partId => {
        if (!behaviorActive[partId].js) return;
        const def = BEHAVIOR_PARTS[partId];
        const item = ev.target && ev.target.closest ? ev.target.closest(def.itemSelector) : null;
        const id = item ? item.getAttribute(def.idAttr) : null;
        if (kind === 'click') {
            if (id) behaviorPost({ type: 'skymod-behavior-event', partId, event: 'click', id });
            return;
        }
        const last = behaviorHoverId[partId] || null;
        const now = kind === 'leave-window' ? null : id;
        if (now === last) return;
        if (last) behaviorPost({ type: 'skymod-behavior-event', partId, event: 'leave', id: last });
        if (now) behaviorPost({ type: 'skymod-behavior-event', partId, event: 'hover', id: now });
        behaviorHoverId[partId] = now;
    });
}

window.addEventListener('message', ev => {
    const frame = document.getElementById(BEHAVIOR_FRAME_ID);
    if (!frame || ev.source !== frame.contentWindow || !ev.data || typeof ev.data.type !== 'string') return;
    const d = ev.data;
    if (d.type === 'skymod-behavior-ready') {
        behaviorFrameReady = true;
        behaviorSentJson = {};
        const list = Object.keys(behaviorActive).filter(k => behaviorActive[k].js).map(k => ({ partId: k, js: behaviorActive[k].js }));
        behaviorPost({ type: 'skymod-behavior-init', parts: list });
        scheduleBehaviorTick(0);
    } else if (d.type === 'skymod-behavior-state') {
        behaviorMergeStates(String(d.partId), d.states);
    } else if (d.type === 'skymod-behavior-log') {
        behaviorLog(String(d.partId || ''), ['log', 'warn', 'error'].includes(d.level) ? d.level : 'log', d.message);
    } else if (d.type === 'skymod-behavior-error') {
        behaviorLog(String(d.partId || ''), 'error', d.message + (d.stack ? '\n' + String(d.stack).split('\n').slice(0, 3).join('\n') : ''));
    } else if (/^skymod-storage-(get|set|remove)$/.test(d.type)) {
        const key = BEHAVIOR_STORAGE_PREFIX + String(d.key).slice(0, 120);
        const reply = value => frame.contentWindow && frame.contentWindow.postMessage({ type: 'skymod-storage-result', id: d.id, value }, '*');
        try {
            if (d.type === 'skymod-storage-get') chrome.storage.local.get([key], res => reply(res[key] === undefined ? null : res[key]));
            else if (d.type === 'skymod-storage-set') chrome.storage.local.set({ [key]: d.value }, () => reply(true));
            else chrome.storage.local.remove([key], () => reply(true));
        } catch (err) { reply(null); }
    }
});

function initBehavior() {
    document.addEventListener('mouseover', ev => { behaviorPointer('hover', ev); siteCardPointer('hover', ev); }, true);
    document.addEventListener('click', ev => { behaviorPointer('click', ev); siteCardPointer('click', ev); }, true);
    document.documentElement.addEventListener('mouseleave', ev => { behaviorPointer('leave-window', ev); siteCardPointer('leave-window', ev); });
    setInterval(() => scheduleBehaviorTick(0), 15000);
}

// Сайт при долгом отсутствии показывает laboratory-waiting-popup и ждёт нажатия
// «Update». Окно скрыто через CSS. Если вкладка при этом действительно в фоне,
// кнопку нажимаем сами: страница обновится, пока вы не смотрите, и вернётесь вы
// уже к свежей. Если вкладка на виду, ничего не нажимаем (скрытого окна достаточно).
// Не чаще одного нажатия в 10 минут, чтобы не уйти в цикл перезагрузок.
const WAIT_POPUP_COOLDOWN_MS = 10 * 60 * 1000;
const WAIT_POPUP_STAMP_KEY = 'skymod-wait-popup-click';

function handleWaitingPopup() {
    const popup = document.querySelector('laboratory-waiting-popup');
    if (popup && !diagIncidentOpen) { diagIncidentOpen = true; recordLockIncident(popup); }
    else if (!popup) diagIncidentOpen = false;
    if (lastSettings.antiLockEnabled === false) return;
    if (!popup || !document.hidden) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(WAIT_POPUP_STAMP_KEY)) || 0; } catch (e) { /* хранилище недоступно */ }
    if (Date.now() - last < WAIT_POPUP_COOLDOWN_MS) return;
    const button = popup.querySelector('footer button');
    if (!button) return;
    try { sessionStorage.setItem(WAIT_POPUP_STAMP_KEY, String(Date.now())); } catch (e) { /* ничего */ }
    // Пауза, чтобы запись об инциденте успела сохраниться до перезагрузки страницы.
    setTimeout(() => { if (document.querySelector('laboratory-waiting-popup')) button.click(); }, 1500);
}

function watchWaitingPopup() {
    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        setTimeout(() => { queued = false; handleWaitingPopup(); }, 300);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', handleWaitingPopup);
}

if (document.documentElement) watchWaitingPopup();

function initScheduleTracking() {
    chrome.storage.local.get([SKYMOD_SCHEDULE_CACHE_KEY, WEEK_LESSONS_KEY], r => {
        scheduleCache = r[SKYMOD_SCHEDULE_CACHE_KEY] || null;
        weekLessonsCache = r[WEEK_LESSONS_KEY] && typeof r[WEEK_LESSONS_KEY] === 'object' ? r[WEEK_LESSONS_KEY] : {};
        weekPersistedJson = JSON.stringify(weekLessonsCache);
        scheduleCacheLoaded = true;
        refreshSchedule(onSchedulePage());
    });
    setInterval(() => refreshSchedule(onSchedulePage()), SCHEDULE_REFRESH_MS);
    // Angular дорисовывает карточки уже после загрузки, а при переходах по
    // сайту страница расписания появляется без перезагрузки: следим за
    // DOM, но каждое изменение только взводит таймер (дёшево).
    new MutationObserver(scheduleDomChanged).observe(document.documentElement, { childList: true, subtree: true });
}

function applyAll(settings) {
    lastSettings = settings || {};
    syncBehaviorParts(lastSettings.sitePartsCss);
    document.documentElement.setAttribute('data-skymod-antilock', lastSettings.antiLockEnabled === false ? '0' : '1');
    // Разделено на независимые try/catch специально: если что-то одно
    // сломается (например, из-за старого/повреждённого значения в
    // хранилище), остальное всё равно должно отработать — вместо того
    // чтобы одна ошибка рубила ВСЮ тему разом.
    try {
        applyRootColors(lastSettings);
    } catch (e) {
        console.error('[SkyMod] Ошибка в applyRootColors:', e);
    }
    try {
        applyStyleTag(lastSettings);
    } catch (e) {
        console.error('[SkyMod] Ошибка в applyStyleTag:', e);
    }
    try {
        applySiteBuilderFrame(lastSettings);
    } catch (e) {
        console.error('[SkyMod] Ошибка в applySiteBuilderFrame:', e);
    }
    try {
        const colors = lastSettings.scheduleSubjectColors;
        scheduleColors = colors && typeof colors === 'object' ? colors : {};
        refreshSchedule(false);
    } catch (e) {
        console.error('[SkyMod] Ошибка в refreshSchedule:', e);
    }
    try {
        setUiFade(lastSettings);
    } catch (e) {
        console.error('[SkyMod] Ошибка в setUiFade:', e);
    }
    try {
        // По умолчанию ВКЛЮЧЕНО: ключа нет в storage (undefined) — значит включено,
        // выключено только если явно false.
        setExternalLinkHandling(lastSettings.externalLinksNewTab !== false);
    } catch (e) {
        console.error('[SkyMod] Ошибка во внешних ссылках:', e);
    }
}

chrome.storage.local.get(SETTINGS_KEYS, applyAll);
initScheduleTracking();
initCustomBlocks();
initDiag();
initBehavior();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // builderData:/siteBuilderData: — внутреннее хранилище storage.get/set
    // для ПОЛЬЗОВАТЕЛЬСКОГО JS в песочницах (попапа и фона сайта), не
    // настройки SkyMod. Без фильтра любой storage.set(...) из своего же
    // скрипта фона сайта тут же перезапускал бы applySiteBuilderFrame,
    // а тот заново слал код в песочницу — она перезапускала сама себя
    // на каждый storage.set (например, "Счётчик кликов" сбрасывался бы
    // визуально при каждом клике вместо простого обновления текста).
    // Расписание обновляет другая вкладка сайта: подхватываем и пересчитываем
    // только его, без повторного применения всей темы.
    if (changes.diagEnabled) diagEnabled = changes.diagEnabled.newValue !== false;
    if (changes.diagBodies) document.documentElement.setAttribute('data-skymod-diag-bodies', changes.diagBodies.newValue ? '1' : '0');
    if (changes[CUSTOM_BLOCKS_KEY]) {
        customBlocksCache = normalizeCustomBlocks(changes[CUSTOM_BLOCKS_KEY].newValue);
        renderCustomBlocks();
        scheduleBehaviorTick(0);
    }
    if (changes[WEEK_LESSONS_KEY]) {
        weekLessonsCache = changes[WEEK_LESSONS_KEY].newValue || {};
        weekPersistedJson = JSON.stringify(weekLessonsCache);
    }
    if (changes[SKYMOD_SCHEDULE_CACHE_KEY]) {
        scheduleCache = changes[SKYMOD_SCHEDULE_CACHE_KEY].newValue || null;
        refreshSchedule(false);
    }
    const relevantKeys = Object.keys(changes).filter(k => !k.startsWith(SITE_BUILDER_STORAGE_PREFIX) && !k.startsWith('builderData:') && k !== SKYMOD_SCHEDULE_CACHE_KEY && k !== WEEK_LESSONS_KEY && k !== CUSTOM_BLOCKS_KEY && !k.startsWith('tg') && !k.startsWith('diag') && k !== BEHAVIOR_LOG_KEY && !k.startsWith(BEHAVIOR_STORAGE_PREFIX));
    if (relevantKeys.length === 0) return;
    chrome.storage.local.get(SETTINGS_KEYS, applyAll);
});
