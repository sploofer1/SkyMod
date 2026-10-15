/*
 * popup.js — модульный попап SkyMod.
 * -------------------------------------------------------------
 * Чтобы добавить НОВУЮ ФИЧУ в существующую группу — допиши один
 * объект в массив `fields` этой группы (см. TABS ниже).
 * Типы полей: color, range (клик по значению — точный ввод), select,
 * text, toggle, file, font-library (библиотека шрифтов), section,
 * palette-button (автоподбор цвета по фону), action-button.
 *
 * Чтобы добавить НОВУЮ ГРУППУ (сворачиваемый блок) — допиши объект
 * в `groups` вкладки: { id, label, open, fields }.
 *
 * Чтобы добавить НОВУЮ ВКЛАДКУ — допиши объект в TABS: с `groups`
 * (сворачиваемые блоки), с `fields` (просто список без сворачивания
 * — годится для короткой вкладки вроде "Карточки"), либо со своей
 * функцией `render(container, values)` для кастомного содержимого.
 * -------------------------------------------------------------
 */

// ---------- Иконки ----------

const ICONS = {
    palette: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3C7 3 3 7 3 12C3 16 6 19 10 19C11 19 11.5 18.3 11.5 17.6C11.5 17.2 11.3 16.9 11.1 16.6C10.9 16.3 10.7 16 10.7 15.6C10.7 14.9 11.3 14.3 12 14.3H14C17 14.3 19 12.3 19 9.5C19 6 15.9 3 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="13" height="4.2" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="6.5" y="11.4" width="13" height="4.2" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="16.8" width="13" height="4.2" rx="1.4" stroke="currentColor" stroke-width="1.6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5.5" width="16" height="14.5" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M4 10H20M8.5 3.5V7M15.5 3.5V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="14.5" r="1.1" fill="currentColor"/><circle cx="13" cy="14.5" r="1.1" fill="currentColor"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 3L5 13.5H11.5L11 21L19 10.5H12.5L13 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 11V16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" class="group-chevron"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    magic: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 19L19 5M9 5L9.7 6.9L11.6 7.6L9.7 8.3L9 10.2L8.3 8.3L6.4 7.6L8.3 6.9L9 5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M18 13L18.6 14.6L20.2 15.2L18.6 15.8L18 17.4L17.4 15.8L15.8 15.2L17.4 14.6L18 13Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 8.5L14 12L10 15.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7H13M17 7H20M4 17H7M11 17H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="17" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none"><path d="M20.5 4L3.5 10.8L9.6 13.4L12.2 20L20.5 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.6 13.4L20.5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 8L4.5 12L9 16M15 8L19.5 12L15 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---------- Цвет-или-градиент: та же модель, что в content.js (дублируется —
// popup и content-script не делят модули) ----------
// { mode: 'solid'|'gradient'|'rgb'|'custom', solid, gradientType, angle, stops, custom }

const RAINBOW_STOPS = [
    { color: '#ff0000', pos: 0 }, { color: '#ff9900', pos: 16 }, { color: '#ffee00', pos: 33 },
    { color: '#33ff00', pos: 50 }, { color: '#00c3ff', pos: 66 }, { color: '#7000ff', pos: 83 },
    { color: '#ff0000', pos: 100 },
];

function defaultColorGradient(hex) {
    return {
        mode: 'solid', solid: hex, gradientType: 'linear', angle: 135,
        stops: [{ color: hex, pos: 0 }, { color: '#38bdf8', pos: 100 }], custom: '',
    };
}

function normalizeColorValue(raw, fallbackHex) {
    if (raw && typeof raw === 'object') {
        return {
            mode: raw.mode || 'solid',
            solid: raw.solid || fallbackHex,
            gradientType: raw.gradientType || 'linear',
            angle: typeof raw.angle === 'number' ? raw.angle : 135,
            // Клонируем каждый стоп — иначе редактирование (push/splice в
            // renderColorGradientField) мутировало бы исходный DEFAULTS-объект,
            // который переиспользуется как значение по умолчанию при сбросе.
            stops: (Array.isArray(raw.stops) && raw.stops.length >= 2) ? raw.stops.map(s => ({ ...s })) : [
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
        const color = (alphaPercent === null || alphaPercent === undefined) ? s.color : hexToRgbaLocal(s.color, alphaPercent);
        return `${color} ${s.pos}%`;
    }).join(', ');
    return type === 'radial' ? `radial-gradient(circle, ${parts})` : `linear-gradient(${angle}deg, ${parts})`;
}

function colorValueToCssBackground(value, alphaPercent) {
    if (value.mode === 'solid') return (alphaPercent === null || alphaPercent === undefined) ? value.solid : hexToRgbaLocal(value.solid, alphaPercent);
    if (value.mode === 'custom') return value.custom || value.solid; // альфу к произвольному CSS не применяем — синтаксис чужой
    const stops = value.mode === 'rgb' ? RAINBOW_STOPS : value.stops;
    const type = value.mode === 'rgb' ? 'linear' : value.gradientType;
    const angle = value.mode === 'rgb' ? 90 : value.angle;
    return stopsToGradientCss(type, angle, stops, alphaPercent);
}

function colorValueRepresentative(value) {
    if (value.mode === 'solid') return value.solid;
    if (value.mode === 'gradient') return (value.stops[0] && value.stops[0].color) || value.solid;
    if (value.mode === 'rgb') return RAINBOW_STOPS[0].color;
    // Только hex — представитель идёт в shadePopupColor/hexToRgbTriplet,
    // которые понимают только hex. rgba(...) в произвольном CSS проигнорируем
    // и откатимся на solid, лишь бы не сломать парсинг.
    const match = (value.custom || '').match(/#[0-9a-fA-F]{3,8}/);
    return match ? match[0] : value.solid;
}

// ---------- Схема настроек: одно место правды для defaults и storage-ключей ----------

const TABS = [
    {
        id: 'theme',
        label: 'Вид',
        icon: ICONS.palette,
        groups: [
            {
                id: 'colors', label: 'Цвета', open: true,
                fields: [
                    {
                        key: 'primaryColor', type: 'color-gradient', label: 'Фон страницы', default: defaultColorGradient('#1f1f1f'),
                        hint: 'Можно сделать градиентом или RGB-переливом. Если ниже выбрана картинка/файл фона — он перекроет этот фон.',
                    },
                ],
            },
            {
                id: 'font', label: 'Шрифт', open: false,
                fields: [
                    {
                        key: 'fontFamily', type: 'select', label: 'Готовый пресет', default: 'inherit',
                        options: [
                            { value: 'inherit', text: 'По умолчанию' },
                            { value: "'Comfortaa', sans-serif", text: 'Comfortaa' },
                            { value: "'Caveat', cursive", text: 'Caveat' },
                            { value: "'Neucha', cursive", text: 'Neucha' },
                        ],
                    },
                    {
                        key: 'googleFontUrl', type: 'text', label: 'Или ссылка на Google Fonts', default: '',
                        placeholder: 'fonts.google.com/specimen/...',
                        hint: 'Вставь ссылку со страницы шрифта или просто его название.',
                    },
                    {
                        key: 'activeCustomFontId', type: 'font-library', label: 'Или свой файл шрифта', default: '',
                        accept: '.woff,.woff2,.ttf,.otf',
                        hint: 'Загруженные файлы остаются в библиотеке расширения навсегда, даже если удалить исходный файл с компьютера. Приоритет выше остальных двух способов.',
                    },
                ],
            },
            {
                id: 'background', label: 'Фон страницы', open: false,
                fields: [
                    { key: 'backgroundImage', type: 'text', label: 'Ссылка на картинку/gif', default: '', placeholder: 'https://...' },
                    {
                        key: 'backgroundFile', type: 'file', label: 'Или свой файл', default: '', accept: 'image/*', transform: prepareBackgroundImage,
                        clearAlso: ['backgroundImage'],
                        hint: 'Кнопка "Убрать" стирает и файл, и ссылку выше — чтобы фон-картинка выключалась полностью.',
                    },
                    {
                        key: 'backgroundFit', type: 'select', label: 'Как заполнять', default: 'cover',
                        options: [
                            { value: 'cover', text: 'Заполнить (обрезать края)' },
                            { value: 'contain', text: 'Вписать целиком' },
                            { value: 'stretch', text: 'Растянуть' },
                            { value: 'tile', text: 'Плиткой' },
                            { value: 'center', text: 'По центру, как есть' },
                        ],
                    },
                    { key: 'backgroundDim', type: 'range', label: 'Затемнение', default: 0, min: 0, max: 100, step: 5, suffix: '%' },
                    {
                        key: '__autoPalette', type: 'palette-button', label: 'Подобрать цвета под фото',
                        hint: 'Разбирает загруженный файл и подбирает цвет карточек под него. Работает только со своим файлом (не со ссылкой).',
                    },
                ],
            },
        ],
    },
    {
        id: 'schedule',
        label: 'Расписание',
        icon: ICONS.calendar,
        fields: [
            { type: 'section', label: 'Свои блоки' },
            { type: 'custom-blocks' },

            { type: 'section', label: 'Карточки занятий' },
            {
                key: 'cardColor', type: 'color-gradient', label: 'Цвет карточек', default: defaultColorGradient('#8b7cf6'),
                hint: 'Одним цветом, градиентом или переливом. Пока не выбрали, карточки остаются родными.',
            },
            {
                key: 'cardOpacity', type: 'range', label: 'Насколько плотный цвет', default: 85, min: 0, max: 100, step: 5, suffix: '%',
                hint: '100% — сплошной цвет, меньше — карточки просвечивают.',
            },
            {
                key: 'scheduleCardColors', type: 'toggle', label: 'Свой цвет для каждого предмета', default: false,
                hint: 'Алгоритмы, математика и другие предметы красятся в разные цвета. Заменяет общий цвет выше.',
            },
            { key: 'scheduleSubjectColors', type: 'subject-colors', default: {}, dependsOn: 'scheduleCardColors' },
            {
                key: 'cardReadable', type: 'toggle', label: 'Читаемость на цветном фоне', default: false,
                hint: 'Если фон пёстрый и карточки с ним сливаются: под карточкой появится тёмная подложка, а текст станет белым.',
            },
            { key: 'cardReadableStrength', type: 'range', label: 'Сила подложки', default: 70, min: 0, max: 100, step: 5, suffix: '%', dependsOn: 'cardReadable' },
            {
                key: 'cardReadableBrightText', type: 'toggle', label: 'Белый текст на карточках', default: true,
                hint: 'Выключите, если хотите оставить родные цвета текста.', dependsOn: 'cardReadable',
            },

            { type: 'section', label: 'Полоска «сейчас»' },
            {
                key: 'nowLineHidden', type: 'toggle', label: 'Убрать полоску «сейчас»', default: false,
                hint: 'Скрывает маркер с текущим временем и плашку «Сейчас» на расписании.',
            },
            { key: 'nowLineColor', type: 'color', label: 'Цвет полоски', default: '#2ecc71', dependsOn: '!nowLineHidden' },

            { type: 'section', label: 'Окно занятия' },
            {
                key: 'lessonPopupCustomize', type: 'toggle', label: 'Размыть фон за окном занятия', default: false,
                hint: 'Окно, которое открывается, если нажать на занятие. Всё, что за ним, станет размытым и затемнённым.',
            },
            { key: 'lessonPopupBackdropBlur', type: 'range', label: 'Размытие', default: 8, min: 0, max: 40, step: 1, suffix: ' px', dependsOn: 'lessonPopupCustomize' },
            { key: 'lessonPopupBackdropDim', type: 'range', label: 'Затемнение', default: 35, min: 0, max: 100, step: 5, suffix: '%', dependsOn: 'lessonPopupCustomize' },
            // Эти три больше не показываются в попапе: подмена цвета панели окна через токены дизайн-системы
            // не подтверждена на реальном сайте. Ключи остаются (экспорт/импорт, CSS-часть в конструкторе).
            { key: 'lessonPopupPanelEnabled', type: 'virtual', default: false },
            { key: 'lessonPopupPanelColor', type: 'virtual', default: '#14141a' },
            { key: 'lessonPopupPanelOpacity', type: 'virtual', default: 90 },

            { type: 'section', label: 'Подсветка под урок' },
            {
                key: 'scheduleGlow', type: 'toggle', label: 'Подсвечивать фон цветом урока', default: false,
                hint: 'Пока идёт урок, по экрану разливается мягкий свет цвета этого предмета. Если урока нет, подсветки нет.',
            },
            { key: 'scheduleGlowStrength', type: 'range', label: 'Яркость', default: 35, min: 0, max: 100, step: 5, suffix: '%', dependsOn: 'scheduleGlow' },

            { type: 'section', label: 'Расписание на сегодня' },
            { type: 'today-schedule' },
        ],
    },
    {
        id: 'comfort',
        label: 'Удобство',
        icon: ICONS.bolt,
        compactHints: true, // длинные подсказки уходят под значок «i» (см. decorateHintInfo)
        fields: [
            { type: 'section', label: 'Основное' },
            {
                key: 'safeModeOnTests', type: 'toggle', label: 'Безопасный режим на тестах', default: true,
                hint: 'На страницах тестов расширение работает в минимальном режиме: тема и фон отключены, диагностика не ведётся. Кнопка «Следующее задание» на страницах обычных заданий работает как обычно. Если выключить, на тестах всё работает как обычно, кроме диагностики при прямом открытии страницы теста.',
            },
            {
                key: 'externalLinksNewTab', type: 'toggle', label: 'Внешние ссылки — в новой вкладке', default: true,
                hint: 'Skyeng не закрывается, когда вы нажимаете на ссылку на другой сайт. Колёсико мыши и Ctrl+клик открывают вкладку в фоне.',
            },
            {
                key: 'blockTrackers', type: 'toggle', label: 'Отключить трекеры и аналитику', default: true,
                hint: 'Убирает Google Analytics и Tag Manager со страниц сайта.',
            },

            { type: 'section', label: 'Задания' },
            {
                key: 'mathButtonEnabled', type: 'toggle', label: 'Кнопка «Следующее задание»', default: true,
                hint: 'На странице решения задачи появляется кнопка, которая переносит к следующему заданию.',
            },
            { key: 'mathBtnColor', type: 'color', label: 'Цвет кнопки', default: '#2f80ed', dependsOn: 'mathButtonEnabled' },

            { type: 'section', label: 'Элементы сайта' },
            { key: 'hideSupportButton', type: 'toggle', label: 'Убрать кнопку поддержки', default: false, hint: 'Круглая кнопка чата с поддержкой в углу экрана.' },
            { key: 'hideUserTray', type: 'toggle', label: 'Убрать аватарку и кнопку выхода', default: false, hint: 'Правый верхний угол. Выйти можно будет через раздел «Профиль».' },
            { key: 'hidePageTitle', type: 'toggle', label: 'Убрать заголовок страницы', default: false, hint: 'Надпись «Расписание» над сеткой занятий (и такие же заголовки других страниц).' },
            { key: 'hideNavSections', type: 'toggle', label: 'Убрать меню разделов', default: false, hint: 'Верхняя панель «Расписание, Предметы, Документы, Профиль». Переходить придётся по ссылкам.' },
            { key: 'hideBrandMark', type: 'toggle', label: 'Убрать значок слева в шапке', default: false },

            { type: 'section', label: 'Защита от блокировки' },
            {
                key: 'antiLockEnabled', type: 'toggle', label: 'Не давать сайту блокироваться', default: true,
                hint: 'Сайт открывает окно «Страница заскучала» и перезагружается, если час нет click, pointermove, focus и scroll. Расширение раз в 3 минуты подаёт сайту один сигнал активности и просит Chrome не выгружать вкладку из памяти.',
            },

            { type: 'section', label: 'Режим «Только фон»' },
            {
                key: 'uiFadeIdleEnabled', type: 'toggle', label: 'Прятать интерфейс, когда я бездействую', default: false,
                hint: 'Расписание становится прозрачным, остаётся только фон. Шевельните мышкой, и всё вернётся.',
            },
            { key: 'uiFadeIdleSeconds', type: 'range', label: 'Через сколько секунд', default: 30, min: 5, max: 300, step: 5, suffix: ' с', dependsOn: 'uiFadeIdleEnabled' },
            {
                key: 'uiFadeHotkeyEnabled', type: 'toggle', label: 'Прятать интерфейс по клавише', default: false,
                hint: 'Нажали сочетание клавиш: интерфейс исчез. Нажали ещё раз: вернулся.',
            },
            { key: 'uiFadeHotkey', type: 'hotkey', label: 'Сочетание клавиш', default: 'Alt+KeyH', dependsOn: 'uiFadeHotkeyEnabled' },
            {
                key: 'uiFadeVisibility', type: 'range', label: 'Насколько виден интерфейс', default: 10, min: 0, max: 100, step: 5, suffix: '%',
                hint: '0% — полностью прозрачный, 100% — как обычно.', dependsOn: ['uiFadeIdleEnabled', 'uiFadeHotkeyEnabled'],
            },
            {
                key: 'uiFadeScope', type: 'select', label: 'Где работает', default: 'schedule',
                options: [
                    { value: 'schedule', text: 'Только на странице расписания' },
                    { value: 'all', text: 'На всех страницах сайта (в том числе на уроках)' },
                ],
                dependsOn: ['uiFadeIdleEnabled', 'uiFadeHotkeyEnabled'],
            },

            { type: 'section', label: 'Диагностика сайта' },
            {
                key: 'diagEnabled', type: 'toggle', label: 'Вести журнал диагностики', default: true,
                hint: 'Расширение записывает в этом браузере запросы сайта, состояние вкладки и момент блокировки. Ничего никуда не отправляется: файл вы скачиваете сами.',
            },
            {
                key: 'diagBodies', type: 'toggle', label: 'Сохранять фрагменты ответов и сообщений', default: false,
                hint: 'Выключено: пишутся только адреса, коды ответов, размеры и имена полей JSON. Включено: ещё первые символы ответов и сообщений веб-сокета (токены, e-mail и телефоны маскируются, имена нет).',
            },
            { type: 'diagnostics' },

            { type: 'section', label: 'Обновления' },
            {
                key: 'updateCheckEnabled', type: 'toggle', label: 'Проверять обновления', default: true,
                hint: 'Раз в сутки расширение запрашивает у GitHub страницу последнего релиза и, если вышла версия новее, показывает значок ↑ на иконке и полоску в попапе. Ничего не скачивается и не устанавливается, кроме самого запроса ничего не отправляется.',
            },
        ],
    },
    {
        id: 'telegram',
        label: 'Telegram',
        icon: ICONS.send,
        fields: [
            { key: 'tgBotToken', type: 'virtual', default: '' },
            { key: 'tgBotName', type: 'virtual', default: '' },
            { key: 'tgChatId', type: 'virtual', default: '' },
            { key: 'tgMuteUntil', type: 'virtual', default: 0 },
            { key: 'tgLastError', type: 'virtual', default: '' },
            { type: 'telegram-link' },
            {
                key: 'tgEnabled', type: 'toggle', label: 'Присылать напоминания', default: false, dependsOn: 'tgChatId',
                hint: 'Бот напишет перед началом занятия или контрольной. Расписание берётся со страницы сайта: открывайте «Расписание» хотя бы раз в неделю, чтобы расширение знало новые занятия.',
            },
            { key: 'tgLeadMinutes', type: 'range', label: 'За сколько минут напомнить', default: 15, min: 0, max: 180, step: 5, suffix: ' мин', dependsOn: 'tgChatId' },
            { key: 'tgNotifyLessons', type: 'toggle', label: 'О занятиях', default: true, dependsOn: 'tgChatId' },
            { key: 'tgNotifyTests', type: 'toggle', label: 'О контрольных и тестах', default: true, dependsOn: 'tgChatId' },
            { key: 'tgNotifyCustom', type: 'toggle', label: 'О своих блоках из расписания', default: true, dependsOn: 'tgChatId' },
            { type: 'telegram-mute', dependsOn: 'tgChatId' },
        ],
    },
    {
        id: 'popup',
        label: 'Попап',
        icon: ICONS.sliders,
        fields: [
            {
                key: 'popupSize', type: 'select', label: 'Размер попапа', default: 'large',
                options: [
                    { value: 'compact', text: 'Компактный (320 x 524)' },
                    { value: 'large', text: 'Крупный (400 x 584)' },
                    { value: 'xl', text: 'Максимальный (480 x 598)' },
                ],
                hint: 'Chrome не даёт окну расширения быть больше 800 x 600, максимальный вариант почти упирается в этот предел.',
            },
            {
                key: 'modColor', type: 'color-gradient', label: 'Цвет "Mod" в шапке', default: defaultColorGradient('#8a8f98'),
                hint: 'Красит только слово "Mod" в заголовке попапа — отдельно от пульсов и остального интерфейса.',
            },
            {
                key: 'pulseColor', type: 'color-gradient', label: 'Цвет пульсов', default: defaultColorGradient('#8a8f98'),
                hint: 'Красит анимированные импульсы на дорожках платы — независимо от цвета "Mod".',
            },
            {
                key: 'popupUiColor', type: 'color-gradient', label: 'Цвет интерфейса попапа', default: defaultColorGradient('#8a8f98'),
                hint: 'Красит всё остальное: вкладки, переключатели, рамку попапа, номер версии и т.д.',
            },
            {
                key: 'popupCircuitEnabled', type: 'toggle', label: 'Эффект дорожек платы', default: false,
                hint: 'Анимированные импульсы, бегущие от слова "Mod". Выключено по умолчанию.',
            },
        ],
    },
    {
        id: 'more',
        label: 'Ещё',
        icon: ICONS.code,
        // Виртуальные поля — только чтобы попасть в DEFAULTS/STORAGE_KEYS
        // (collectFields берёт tab.fields независимо от наличия render).
        // Сам редактор — на отдельной странице builder.html; здесь —
        // только ссылка на неё, см. renderBuilderLinkTab ниже.
        fields: [
            { key: 'builderEnabled', type: 'toggle', default: false },
            { key: 'builderLayer', type: 'select', default: 'under' },
            { key: 'builderScope', type: 'select', default: 'full' },
            { key: 'builderInteractive', type: 'toggle', default: false },
            { key: 'builderGlobalCssEnabled', type: 'toggle', default: false },
            { key: 'builderGlobalCss', type: 'text', default: '' },
            { key: 'builderHtml', type: 'text', default: '' },
            { key: 'builderCss', type: 'text', default: '' },
            { key: 'builderJs', type: 'text', default: '' },
        ],
        render: renderMoreTab,
    },
];

// Вкладки с compactHints: подсказки длиннее порога уходят под значок «i»
// (decorateHintInfo), короткие остаются текстом под настройкой.
const HINT_INLINE_MAX = 60;
TABS.forEach(tab => {
    if (!tab.compactHints) return;
    tab.fields.forEach(f => { if (f.hint && f.hint.length > HINT_INLINE_MAX) f.hintInfo = true; });
});

// Собираем defaults и полный список ключей автоматически из TABS —
// работает и с плоскими `fields`, и со сворачиваемыми `groups`, не
// нужно вручную дублировать список при добавлении нового поля.
function collectFields(tabs) {
    return tabs.flatMap(t => t.groups ? t.groups.flatMap(g => g.fields) : (t.fields || []));
}
const ALL_FIELDS = collectFields(TABS).filter(f => f.key);
// Данные, которых нет как полей в TABS (поэтому collectFields их не видит),
// но которые реально лежат в chrome.storage.local и должны:
// (а) иметь дефолт при первой загрузке, (б) сбрасываться кнопкой "Сбросить
// все настройки". Фон сайта (siteBuilder*) редактируется на отдельной
// странице builder.html — без явной регистрации здесь "Сбросить все
// настройки" эти ключи, включая ВКЛЮЧЁННЫЙ пользовательский JS на сайте,
// просто не трогало бы, оставляя фон сайта работать как ни в чём не бывало.
const EXTRA_DEFAULTS = {
    fontLibrary: [], // библиотека шрифтов — отдельная от полей структура данных
    builderPresets: [], // сохранённые пресеты конструктора
    siteBuilderEnabled: false, siteBuilderLayer: 'under', siteBuilderInteractive: false,
    siteBuilderHtml: '', siteBuilderCss: '', siteBuilderJs: '',
};
const DEFAULTS = { ...Object.fromEntries(ALL_FIELDS.map(f => [f.key, f.default])), ...EXTRA_DEFAULTS };
const STORAGE_KEYS = [...ALL_FIELDS.map(f => f.key), ...Object.keys(EXTRA_DEFAULTS)];

// Поля, у которых def.default — это просто "стартовый цвет для
// color-picker", а НЕ безопасное нейтральное значение (в отличие от,
// скажем, пустой строки или false). content.js применяет их к сайту,
// только если ключ реально есть в chrome.storage.local (см. buildCSS/
// applyRootColors в content.js) — иначе на свежей установке, до того как
// человек вообще открыл попап, сайт менялся бы сам. "Сбросить все
// настройки" обязан вести себя ТАК ЖЕ, как свежая установка — то есть
// не записывать эти дефолты в storage, а удалять ключи целиком.
const RESET_CLEAR_KEYS = ['primaryColor', 'cardColor', 'mathBtnColor', 'nowLineColor'];

// ---------- Storage helpers ----------

// Осветляет/затемняет hex-цвет — нужно для производных оттенков
// акцента попапа (светлее для активной вкладки, чуть темнее для тени).
function shadePopupColor(hex, percent) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function hexToRgbaLocal(hex, alphaPercent) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, alphaPercent)) / 100})`;
}

function hexToRgbTriplet(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

// Применяет акцентный цвет попапа ко всему UI (CSS-переменные) и к
// самому canvas-эффекту (цвета там заданы в JS, не в CSS, поэтому
// отдельная функция ниже — updatePCBColors).
// Применяет ТРИ независимых цвета попапа: Mod, пульсы, остальной интерфейс.
// Раньше был один общий popupAccentColor — теперь каждый красится отдельно
// (см. миграцию в loadSettings ниже, для тех, у кого уже стояло расширение).
function applyPopupTheme(values) {
    const uiValue = normalizeColorValue(values.popupUiColor, '#8a8f98');
    const modValue = normalizeColorValue(values.modColor, '#8a8f98');
    const pulseValue = normalizeColorValue(values.pulseColor, '#8a8f98');
    const root = document.documentElement.style;

    // Остальной интерфейс (вкладки, переключатели, рамка, версия) — набор
    // плоских переменных (для границ/теней/текста, где градиент физически
    // невозможен) ПЛЮС --accent-bg/--accent-bg-soft с полным градиентом —
    // для залитых областей (переключатель, активная вкладка, кнопки режима).
    const uiAccent = colorValueRepresentative(uiValue);
    root.setProperty('--accent', uiAccent);
    root.setProperty('--accent-light', shadePopupColor(uiAccent, 25));
    root.setProperty('--accent-rgb', hexToRgbTriplet(uiAccent));
    root.setProperty('--accent-soft', hexToRgbaLocal(uiAccent, 12));
    root.setProperty('--accent-bg', colorValueToCssBackground(uiValue));
    root.setProperty('--accent-bg-soft', colorValueToCssBackground(uiValue, 10));
    document.documentElement.classList.toggle('ui-animated', uiValue.mode === 'rgb');

    // "Mod" в шапке — свой набор переменных, плюс --mod-bg с полным
    // градиентом/радугой (используется как background-clip:text).
    const modAccent = colorValueRepresentative(modValue);
    root.setProperty('--mod', modAccent);
    root.setProperty('--mod-light', shadePopupColor(modAccent, 25));
    root.setProperty('--mod-rgb', hexToRgbTriplet(modAccent));
    root.setProperty('--mod-bg', colorValueToCssBackground(modValue));
    document.documentElement.classList.toggle('mod-animated', modValue.mode === 'rgb');

    updatePCBColors(pulseValue);
}

function saveSetting(key, value) {
    // Страховка: заблокированную настройку (её занимает конструктор) не пишем
    // даже если какой-то элемент управления остался активным.
    if (computeLocks(currentValues)[key]) return;
    currentValues[key] = value;
    // Настройки самого попапа применяются СРАЗУ, не дожидаясь
    // повторного открытия — остальные (тема сайта и т.д.) применяет
    // content.js на странице через chrome.storage.onChanged.
    if (key === 'popupUiColor' || key === 'modColor' || key === 'pulseColor') applyPopupTheme(currentValues);
    if (key === 'popupCircuitEnabled') applyPopupCircuitSetting(value);
    if (key === 'popupSize') applyPopupSize(currentValues);
    // Тумблер, от которого зависят другие поля, перерисовывает вкладку: нужные
    // настройки появляются (или пропадают) сразу, а позиция прокрутки сохраняется.
    if (DEPENDENCY_KEYS.has(key)) {
        const panelEl = document.getElementById('panel');
        const top = panelEl.scrollTop;
        renderPanel(null, true);
        panelEl.scrollTop = top;
    }
    if (key === 'builderEnabled' || key === 'builderLayer' || key === 'builderInteractive') applyBuilderLayer(currentValues);
    if (key === 'builderGlobalCssEnabled' || key === 'builderGlobalCss') applyBuilderGlobalCss(currentValues);
    return chrome.storage.local.set({ [key]: value }).catch(err => {
        console.error('[SkyMod popup] Не удалось сохранить настройку', key, err);
    });
}

// Свой CSS для ВСЕГО попапа — в отличие от HTML/CSS/JS песочницы, это НЕ
// изолированный iframe: тег <style> добавляется прямо в document попапа,
// поэтому им можно переопределить любые существующие стили, в т.ч.
// анимацию переключения вкладок (.tab-content.slide-from-*, @keyframes
// slide-in-left/slide-in-right/content-in — см. вкладку "Документация").
// CSS не исполняется как код (в отличие от JS), поэтому отдельной
// песочницы не требует — максимум, что может пойти не так, это сломанная
// вёрстка, а не выполнение произвольного кода.
function applyBuilderGlobalCss(values) {
    let tag = document.getElementById('builder-global-style');
    if (!values.builderGlobalCssEnabled || !values.builderGlobalCss) {
        if (tag) tag.remove();
        return;
    }
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'builder-global-style';
        document.head.appendChild(tag);
    }
    tag.textContent = values.builderGlobalCss;
}

function loadSettings() {
    return new Promise(resolve => {
        // Дополнительно читаем legacy-ключ popupAccentColor — его нет в
        // текущей схеме полей (STORAGE_KEYS), но он мог остаться от старой
        // версии, где один цвет красил Mod, пульсы и весь интерфейс разом.
        // sitePartsCss и siteBuilderEnabled нужны для блокировки настроек, которые
        // занимает конструктор (см. computeLocks); полей для них в попапе нет.
        chrome.storage.local.get([...STORAGE_KEYS, 'popupAccentColor', 'sitePartsCss', 'siteBuilderEnabled', 'popupWelcomeDone'], stored => {
            const merged = { ...DEFAULTS, ...stored };
            const hasNewColors = stored.modColor || stored.pulseColor || stored.popupUiColor;
            if (stored.popupAccentColor && !hasNewColors) {
                merged.modColor = stored.popupAccentColor;
                merged.pulseColor = stored.popupAccentColor;
                merged.popupUiColor = stored.popupAccentColor;
            }
            resolve(merged);
        });
    });
}

// ---------- Автоподбор палитры по картинке ----------
// Уменьшаем картинку до маленького канваса, группируем пиксели по
// грубым цветовым "бакетам" (округление каждого канала), находим
// самый частый бакет (доминирующий цвет) и самый насыщенный среди
// частых (он обычно лучше смотрится как акцент, чем просто средний
// цвет фото, который почти всегда получается мутно-серым).

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s, l };
}

function extractPaletteFromImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const size = 48;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;

                const buckets = new Map();
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 128) continue; // прозрачные пиксели не считаем
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const key = `${r >> 4},${g >> 4},${b >> 4}`; // огрубляем до 16 уровней на канал
                    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
                    entry.r += r; entry.g += g; entry.b += b; entry.n += 1;
                    buckets.set(key, entry);
                }
                if (buckets.size === 0) { reject(new Error('empty image')); return; }

                const candidates = [...buckets.values()]
                    .map(e => ({ r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n), n: e.n }))
                    .sort((a, b) => b.n - a.n);

                const dominant = candidates[0];

                // Для акцента берём только кандидатов со "здоровой" светлотой
                // (не почти-белые, не почти-чёрные) — иначе алгоритм тянется
                // к самому яркому/светлому пятну на фото, а оно обычно плохо
                // читается как цвет интерфейса. Из оставшихся — самый
                // насыщенный по HSL.
                const pool = candidates.slice(0, 24);
                const wellLit = pool.filter(c => {
                    const { l } = rgbToHsl(c.r, c.g, c.b);
                    return l > 0.2 && l < 0.72;
                });
                const searchIn = wellLit.length ? wellLit : pool;
                const vivid = searchIn
                    .sort((a, b) => rgbToHsl(b.r, b.g, b.b).s - rgbToHsl(a.r, a.g, a.b).s)[0] || dominant;

                resolve({
                    accent: rgbToHex(vivid.r, vivid.g, vivid.b),
                    dominant: rgbToHex(dominant.r, dominant.g, dominant.b),
                });
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('image load failed'));
        img.src = dataUrl;
    });
}

// ---------- Работа с файлами: чтение + пережатие тяжёлых картинок ----------
// Большое фото (несколько МБ, особенно с телефона) в base64 — это
// огромная строка, которую расширение потом гоняет туда-обратно при
// каждом изменении темы. Именно это вызывало подвисания при загрузке
// нескольких фото подряд. Пережимаем на канвасе до разумного размера
// перед сохранением. gif НЕ трогаем — иначе пережатие через канвас
// убьёт анимацию, останется только первый кадр.

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('file read failed'));
        reader.readAsDataURL(file);
    });
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image decode failed'));
        img.src = src;
    });
}

async function prepareBackgroundImage(file) {
    const rawDataUrl = await readFileAsDataUrl(file);

    if (file.type === 'image/gif') return rawDataUrl; // анимацию не трогаем

    const SIZE_LIMIT = 1.5 * 1024 * 1024; // 1.5 МБ
    const MAX_DIM = 1920;

    if (file.size < SIZE_LIMIT) return rawDataUrl; // и так небольшая

    const img = await loadImageElement(rawDataUrl);
    if (img.width <= MAX_DIM && img.height <= MAX_DIM) return rawDataUrl;

    const scale = MAX_DIM / Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
}

// ---------- Рендер одного поля по описанию ----------

// "Alt+KeyH" -> "Alt+H": в хранилище лежит e.code (не зависит от раскладки),
// пользователю показываем читаемую запись.
function hotkeyDisplay(combo) {
    return String(combo || '').split('+')
        .map(p => p.replace(/^Key/, '').replace(/^Digit/, '').replace('Meta', 'Win'))
        .join('+');
}

// ---------- Поля вкладки «Расписание», которые строятся из данных ----------
const LESSON_PHASE_TEXT = {
    free: () => 'Сегодня занятий нет.',
    before: s => 'Занятия ещё не начались. Первое: ' + s.next.title + ' в ' + s.next.startLabel + '.',
    lesson: s => 'Сейчас идёт: ' + s.current.title + ', осталось ' + s.current.minutesLeft + ' мин.',
    break: s => 'Перерыв. Дальше: ' + s.next.title + ' через ' + s.next.minutesUntil + ' мин.',
    after: () => 'Занятия на сегодня закончились.',
};

function scheduleColorMap() {
    const c = currentValues.scheduleSubjectColors;
    return c && typeof c === 'object' ? c : {};
}

// Расписание читается со страницы расписания на сайте и хранится в storage.
function loadScheduleCache() {
    return chrome.storage.local.get(SKYMOD_SCHEDULE_CACHE_KEY).then(r => r[SKYMOD_SCHEDULE_CACHE_KEY] || null);
}

// Список предметов с выбором цвета. Показывается только при включённом
// «Свой цвет для каждого предмета» (см. dependsOn у поля).
function buildSubjectColorsField() {
    const box = document.createElement('div');
    box.className = 'lessons-box';

    loadScheduleCache().then(cache => {
        const draw = () => {
            box.innerHTML = '';
            const titles = (cache && cache.subjects) || {};
            const codes = [...new Set([...Object.keys(titles), ...Object.keys(scheduleColorMap())])];
            if (!codes.length) {
                const empty = document.createElement('div');
                empty.className = 'lessons-empty';
                empty.textContent = 'Предметов пока нет. Откройте на сайте страницу расписания, и они появятся здесь. Пока цвета подбираются сами.';
                box.appendChild(empty);
                return;
            }
            codes.forEach(code => {
                const row = document.createElement('div');
                row.className = 'subject-row';
                const name = document.createElement('span');
                name.className = 'subject-name';
                name.textContent = titles[code] || code;
                const input = document.createElement('input');
                input.type = 'color';
                input.value = skymodSubjectColor(code, scheduleColorMap());
                input.addEventListener('input', () => saveSetting('scheduleSubjectColors', { ...scheduleColorMap(), [code]: input.value }));
                const reset = document.createElement('button');
                reset.type = 'button';
                reset.className = 'subject-reset';
                reset.title = 'Вернуть цвет, подобранный автоматически';
                reset.textContent = '\u21BA';
                reset.addEventListener('click', () => {
                    const next = { ...scheduleColorMap() };
                    delete next[code];
                    saveSetting('scheduleSubjectColors', next);
                    draw();
                });
                row.append(name, input, reset);
                box.appendChild(row);
            });
        };
        draw();
    });
    return box;
}

// «Расписание на сегодня»: показывает, как расширение поняло ваше расписание.
function buildTodayField() {
    const box = document.createElement('div');
    box.className = 'lessons-box';
    loadScheduleCache().then(cache => {
        const now = Date.now();
        const lessons = cache && cache.date === skymodLocalDateKey(now) ? cache.lessons : [];
        const sched = skymodBuildSchedule(lessons, now, scheduleColorMap());
        const summary = document.createElement('div');
        summary.className = 'lessons-summary';
        summary.textContent = LESSON_PHASE_TEXT[sched.phase](sched);
        box.appendChild(summary);
        if (!sched.ready) {
            const empty = document.createElement('div');
            empty.className = 'lessons-empty';
            empty.textContent = 'Расписание на сегодня не найдено. Один раз откройте страницу расписания на сайте: оно запомнится и будет работать на всех страницах.';
            box.appendChild(empty);
            return;
        }
        sched.lessons.forEach(l => {
            const row = document.createElement('div');
            row.className = 'lesson-row' + (sched.current && sched.current.id === l.id && sched.current.start === l.start ? ' now' : '');
            const dot = document.createElement('span');
            dot.className = 'lesson-dot';
            dot.style.background = l.color;
            const time = document.createElement('span');
            time.className = 'lesson-time';
            time.textContent = l.startLabel + '\u2013' + l.endLabel;
            const title = document.createElement('span');
            title.className = 'lesson-title';
            title.textContent = l.title || l.subject;
            row.append(dot, time, title);
            box.appendChild(row);
        });
    });
    return box;
}

// Поле показывается, только если включено то, от чего оно зависит
// (dependsOn: 'ключ', '!ключ' — «выключено», либо массив — «хотя бы одно»).
// Иначе ползунки лежали бы рядом с выключенным тумблером и ничего не делали.
function fieldVisible(def, values) {
    if (!def.dependsOn) return true;
    const deps = Array.isArray(def.dependsOn) ? def.dependsOn : [def.dependsOn];
    return deps.some(d => (d.startsWith('!') ? !values[d.slice(1)] : !!values[d]));
}

const DEPENDENCY_KEYS = new Set(
    TABS.flatMap(t => t.fields || []).flatMap(f => (f.dependsOn ? [].concat(f.dependsOn) : [])).map(d => d.replace(/^!/, ''))
);

// ---------- Блокировка настроек, занятых конструктором ----------
// Если элемент уже настраивает конструктор (CSS части интерфейса или фон
// сайта), одноимённая настройка в попапе заблокирована: иначе два места
// управляют одним и тем же, и пользователь не понимает, почему «ничего не
// происходит». Значок i рядом с названием объясняет причину.
const SITE_BG_SETTINGS = ['backgroundImage', 'backgroundFile', 'backgroundFit', 'backgroundDim'];

function computeLocks(values) {
    const locks = {};
    const parts = values.sitePartsCss && typeof values.sitePartsCss === 'object' ? values.sitePartsCss : {};
    if (typeof SKYMOD_PARTS !== 'undefined') {
        SKYMOD_PARTS.forEach(part => {
            if (!part.settings || !skymodPartOwnsSettings(parts, part.id)) return;
            part.settings.forEach(key => {
                if (!locks[key]) locks[key] = { what: 'часть интерфейса «' + part.name + '»', where: 'режим «Сайт» → «Части интерфейса сайта»' };
            });
        });
    }
    if (values.siteBuilderEnabled) {
        SITE_BG_SETTINGS.forEach(key => {
            if (!locks[key]) locks[key] = { what: 'свой фон сайта из конструктора', where: 'режим «Сайт» → переключатель «Включить на сайте»' };
        });
    }
    return locks;
}

function decorateLockedField(wrap, lock) {
    wrap.classList.add('locked');
    wrap.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });

    const info = document.createElement('span');
    info.className = 'lock-info';
    info.tabIndex = 0;
    info.setAttribute('role', 'note');
    info.innerHTML = 'i<span class="lock-tip"></span>';
    const tip = info.querySelector('.lock-tip');
    tip.innerHTML = '';
    const title = document.createElement('b');
    title.textContent = 'Эту настройку сейчас занимает конструктор';
    const text = document.createElement('span');
    text.textContent = 'Её уже меняет ' + lock.what + ', поэтому здесь она заблокирована. Чтобы вернуть управление сюда, сначала отключите это в конструкторе: ' + lock.where + '.';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'lock-open';
    open.textContent = 'Открыть конструктор';
    open.addEventListener('click', () => window.open('builder.html', '_blank'));
    tip.append(title, text, open);

    const label = wrap.querySelector('.field-label');
    if (label) label.after(info);
    else wrap.prepend(info);
}

// Подсказка настройки под значком «i». Серый, чтобы не путать с акцентным значком
// блокировки конструктором (lock-info): у заблокированной настройки сначала замок, потом этот.
// Показывается по наведению и по фокусу (тап на сенсорном экране, Tab), закрывается потерей
// фокуса (клик мимо), Esc и повторным кликом по значку.
function placeHintTip(info) {
    const panel = document.getElementById('panel');
    const field = info.closest('.field');
    const tip = info.querySelector('.hint-tip');
    if (!panel || !field || !tip) return;
    info.classList.remove('up');
    const pr = panel.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const below = pr.bottom - (fr.top + 26);
    const above = fr.top - pr.top;
    // Внизу панели места не хватает, а сверху больше: открываем вверх.
    info.classList.toggle('up', tip.offsetHeight + 8 > below && above > below);
}

function decorateHintInfo(wrap) {
    const hint = wrap.querySelector(':scope > .field-hint');
    if (!hint) return;
    const text = hint.textContent;
    hint.remove();

    const info = document.createElement('span');
    info.className = 'hint-info';
    info.tabIndex = 0;
    info.setAttribute('role', 'note');
    const tip = document.createElement('span');
    tip.className = 'hint-tip';
    tip.textContent = text;
    info.append('i', tip);
    info.addEventListener('mouseenter', () => placeHintTip(info));
    info.addEventListener('focus', () => placeHintTip(info));
    info.addEventListener('mousedown', e => {
        if (document.activeElement === info) { e.preventDefault(); info.blur(); }
    });
    info.addEventListener('keydown', e => { if (e.key === 'Escape') info.blur(); });

    const anchor = wrap.querySelector('.lock-info') || wrap.querySelector('.field-label');
    if (anchor) anchor.after(info);
    else wrap.prepend(info);
    wrap.classList.add('has-hint-info');
}

function renderField(def, values) {
    const el = renderFieldBase(def, values);
    if (def.type === 'section' || !def.key) return el;
    const lock = computeLocks(currentValues || values)[def.key];
    if (lock) decorateLockedField(el, lock);
    if (def.hintInfo) decorateHintInfo(el);
    return el;
}

function renderFieldBase(def, values) {
    if (def.type === 'virtual') {
        // Поле только для хранилища (значение по умолчанию, экспорт), в интерфейсе не показывается.
        const hidden = document.createElement('div');
        hidden.hidden = true;
        return hidden;
    }
    if (def.type === 'subject-colors') return buildSubjectColorsField();
    if (def.type === 'today-schedule') return buildTodayField();
    if (def.type === 'custom-blocks') return buildCustomBlocksField();
    if (def.type === 'diagnostics') return buildDiagnosticsField();
    if (def.type === 'telegram-link') return buildTelegramLinkField(values);
    if (def.type === 'telegram-mute') return buildTelegramMuteField(values);
    if (def.type === 'section') {
        const el = document.createElement('div');
        el.className = 'section-title';
        el.textContent = def.label;
        return el;
    }

    const wrap = document.createElement('div');
    wrap.className = 'field';

    if (def.type === 'color') {
        wrap.innerHTML = `
            <div class="field-row">
                <span class="field-label">${def.label}</span>
                <input type="color" value="${values[def.key]}">
            </div>
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;
        wrap.querySelector('input').addEventListener('input', e => saveSetting(def.key, e.target.value));
    }

    if (def.type === 'color-gradient') {
        return renderColorGradientField(def, values);
    }

    if (def.type === 'range') {
        wrap.innerHTML = `
            <div class="field-row">
                <span class="field-label">${def.label}</span>
                <span class="field-value" tabindex="0" title="Нажми, чтобы ввести точное значение">${values[def.key]}${def.suffix || ''}</span>
            </div>
            <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${values[def.key]}">`;
        const valueEl = wrap.querySelector('.field-value');
        const rangeInput = wrap.querySelector('input[type="range"]');
        rangeInput.addEventListener('input', e => {
            valueEl.textContent = `${e.target.value}${def.suffix || ''}`;
            saveSetting(def.key, Number(e.target.value));
        });
        const openValueEditor = () => {
            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.className = 'value-edit-input';
            numInput.min = def.min;
            numInput.max = def.max;
            numInput.step = def.step;
            numInput.value = values[def.key];
            valueEl.replaceWith(numInput);
            numInput.focus();
            numInput.select();
            const commit = () => {
                let v = Number(numInput.value);
                if (Number.isNaN(v)) v = values[def.key];
                v = Math.max(def.min, Math.min(def.max, v));
                saveSetting(def.key, v);
                currentValues[def.key] = v;
                renderPanel();
            };
            numInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') numInput.blur();
                if (e.key === 'Escape') renderPanel();
            });
            numInput.addEventListener('blur', commit);
        };
        valueEl.addEventListener('click', openValueEditor);
        valueEl.addEventListener('keydown', e => { if (e.key === 'Enter') openValueEditor(); });
    }

    if (def.type === 'select') {
        const optionsHtml = def.options.map(o =>
            `<option value="${o.value}" ${o.value === values[def.key] ? 'selected' : ''}>${o.text}</option>`
        ).join('');
        wrap.innerHTML = `
            <span class="field-label">${def.label}</span>
            <select>${optionsHtml}</select>`;
        const selectEl = wrap.querySelector('select');
        selectEl.value = values[def.key]; // не полагаемся только на атрибут selected
        selectEl.addEventListener('change', e => saveSetting(def.key, e.target.value));
    }

    if (def.type === 'hotkey') {
        wrap.innerHTML = `
            <span class="field-label">${def.label}</span>
            <input type="text" class="hotkey-input" readonly value="${hotkeyDisplay(values[def.key] || def.default)}">
            <span class="field-hint">Нажмите на поле и затем сочетание с Ctrl, Alt, Shift или Win (либо F1-F12). Esc отменяет.</span>`;
        const input = wrap.querySelector('input');
        const shown = () => hotkeyDisplay(currentValues[def.key] || def.default);
        input.addEventListener('focus', () => { input.value = 'Нажмите сочетание…'; input.classList.add('recording'); });
        input.addEventListener('blur', () => { input.value = shown(); input.classList.remove('recording'); });
        input.addEventListener('keydown', e => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') { input.blur(); return; }
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; // ждём основную клавишу
            const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
            const isFunctionKey = /^F([1-9]|1[0-2])$/.test(e.code);
            if (!hasModifier && !isFunctionKey) {
                input.value = 'Нужен Ctrl, Alt, Shift или F-клавиша';
                return;
            }
            const combo = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta', e.code]
                .filter(Boolean).join('+');
            saveSetting(def.key, combo);
            currentValues[def.key] = combo;
            input.blur();
        });
    }

    if (def.type === 'text') {
        wrap.innerHTML = `
            <span class="field-label">${def.label}</span>
            <input type="text" data-field-key="${def.key}" value="${values[def.key] || ''}" placeholder="${def.placeholder || ''}">
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;
        wrap.querySelector('input').addEventListener('change', e => saveSetting(def.key, e.target.value.trim()));
    }

    if (def.type === 'toggle') {
        wrap.innerHTML = `
            <div class="field-row">
                <span class="field-label">${def.label}</span>
                <label class="switch">
                    <input type="checkbox" ${values[def.key] ? 'checked' : ''}>
                    <span class="switch-track"></span>
                </label>
            </div>
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;
        wrap.querySelector('input').addEventListener('change', e => saveSetting(def.key, e.target.checked));
    }

    if (def.type === 'file') {
        const hasValue = !!values[def.key];
        wrap.innerHTML = `
            <span class="field-label">${def.label}</span>
            <div class="file-row">
                <label class="file-btn">
                    <input type="file" accept="${def.accept || '*'}" hidden>
                    <span>${hasValue ? 'Заменить файл' : 'Выбрать файл'}</span>
                </label>
                ${hasValue ? '<button type="button" class="file-clear">Убрать</button>' : ''}
            </div>
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;

        const fileLabel = wrap.querySelector('.file-btn span');
        wrap.querySelector('input[type="file"]').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            fileLabel.textContent = 'Обрабатываю…';
            let dataUrl;
            try {
                dataUrl = def.transform ? await def.transform(file) : await readFileAsDataUrl(file);
            } catch (err) {
                console.error('[SkyMod popup] Не удалось обработать файл:', err);
                fileLabel.textContent = 'Не вышло, другой файл?';
                return;
            }
            // Дожидаемся реальной записи в storage перед перерисовкой —
            // иначе если сразу закрыть попап, большой файл мог не успеть
            // сохраниться (запись в фоне обрывается вместе с попапом).
            await saveSetting(def.key, dataUrl);
            currentValues[def.key] = dataUrl;
            renderPanel();
        });

        const clearBtn = wrap.querySelector('.file-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                // "Убрать" должен полностью выключать фон-картинку, а не
                // просто очищать один из двух взаимозаменяемых источников
                // (файл ИЛИ ссылка) — иначе если когда-то была также задана
                // ссылка, картинка "оставалась" из-за неё после очистки файла.
                const keysToClear = [def.key, ...(def.clearAlso || [])];
                await Promise.all(keysToClear.map(k => saveSetting(k, '')));
                keysToClear.forEach(k => { currentValues[k] = ''; });
                renderPanel();
            });
        }
    }

    if (def.type === 'font-library') {
        const library = values.fontLibrary || [];
        const activeId = values.activeCustomFontId;
        const itemsHtml = library.map(f => `
            <div class="lib-item">
                <button type="button" class="lib-select ${f.id === activeId ? 'active' : ''}" data-id="${f.id}">${f.name}</button>
                <button type="button" class="lib-delete" data-id="${f.id}" title="Удалить из библиотеки насовсем">✕</button>
            </div>
        `).join('');
        wrap.innerHTML = `
            <span class="field-label">${def.label}</span>
            <div class="file-row">
                <label class="file-btn">
                    <input type="file" accept="${def.accept || '*'}" hidden>
                    <span>Загрузить новый файл</span>
                </label>
            </div>
            ${library.length ? `<div class="lib-list">${itemsHtml}</div>` : ''}
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;

        const fileLabel = wrap.querySelector('.file-btn span');
        wrap.querySelector('input[type="file"]').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            fileLabel.textContent = 'Загружаю…';
            let dataUrl;
            try {
                dataUrl = await readFileAsDataUrl(file);
            } catch (err) {
                console.error('[SkyMod popup] Не удалось прочитать файл шрифта:', err);
                fileLabel.textContent = 'Не вышло, другой файл?';
                return;
            }
            const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const name = file.name.replace(/\.[^.]+$/, '');
            const newLibrary = [...(currentValues.fontLibrary || []), { id, name, dataUrl }];
            // Дожидаемся ОБЕИХ записей — если закрыть попап раньше, чем
            // storage реально допишет данные, шрифт "потеряется" при
            // следующем открытии (это и была причина бага).
            await saveSetting('fontLibrary', newLibrary);
            await saveSetting(def.key, id);
            currentValues.fontLibrary = newLibrary;
            currentValues[def.key] = id;
            renderPanel();
        });

        wrap.querySelectorAll('.lib-select').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                // Повторный клик по уже выбранному — снять выбор (вернуться
                // к пресету/Google Fonts, но файл остаётся в библиотеке).
                const nextActive = currentValues[def.key] === id ? '' : id;
                saveSetting(def.key, nextActive);
                currentValues[def.key] = nextActive;
                renderPanel();
            });
        });

        wrap.querySelectorAll('.lib-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const newLibrary = (currentValues.fontLibrary || []).filter(f => f.id !== id);
                saveSetting('fontLibrary', newLibrary);
                currentValues.fontLibrary = newLibrary;
                if (currentValues[def.key] === id) {
                    saveSetting(def.key, '');
                    currentValues[def.key] = '';
                }
                renderPanel();
            });
        });
    }

    if (def.type === 'palette-button') {
        const enabled = !!values.backgroundFile;
        wrap.innerHTML = `
            <button type="button" class="palette-btn" ${enabled ? '' : 'disabled'}>
                ${ICONS.magic}<span>${def.label}</span>
            </button>
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;

        const btn = wrap.querySelector('.palette-btn');
        const label = btn.querySelector('span');
        btn.addEventListener('click', async () => {
            if (!currentValues.backgroundFile) return;
            btn.disabled = true;
            label.textContent = 'Анализирую…';
            try {
                const palette = await extractPaletteFromImage(currentValues.backgroundFile);
                const cardValue = { ...normalizeColorValue(currentValues.cardColor, '#8b7cf6'), mode: 'solid', solid: palette.accent };
                saveSetting('cardColor', cardValue);
                currentValues.cardColor = cardValue;
                label.textContent = 'Готово ✓';
                setTimeout(renderPanel, 450);
            } catch (err) {
                label.textContent = 'Не вышло, другое фото?';
                btn.disabled = false;
            }
        });
    }

    if (def.type === 'action-button') {
        wrap.innerHTML = `
            <button type="button" class="action-btn">${def.label}</button>
            ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;
        const btn = wrap.querySelector('.action-btn');
        btn.addEventListener('click', async () => {
            const original = btn.textContent;
            await def.onClick();
            btn.textContent = 'Готово ✓';
            setTimeout(() => { btn.textContent = original; }, 900);
        });
    }

    return wrap;
}

// Свои блоки расписания. Пишем прямо в chrome.storage.local (ключ customBlocks):
// content.js слушает этот ключ и сразу перерисовывает сетку на открытой странице.
const CB_STORAGE_KEY = 'customBlocks';
const CB_MAX = 60;
const CB_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const CB_COLORS = ['#8b7cf6', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#f472b6'];

function cbClock(min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

function cbParseTime(value) {
    const m = /^(\d{2}):(\d{2})$/.exec(value || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function cbTodayIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function cbWhen(block) {
    if (block.date) return block.date.split('-').reverse().join('.');
    return 'каждую неделю: ' + (block.weekdays || []).slice().sort().map(d => CB_WEEKDAYS[d]).join(', ');
}

function cbSortKey(block) {
    return (block.date || '9999-' + String((block.weekdays || [0])[0])) + String(block.startMin).padStart(4, '0');
}

async function cbLoad() {
    const r = await chrome.storage.local.get(CB_STORAGE_KEY);
    return Array.isArray(r[CB_STORAGE_KEY]) ? r[CB_STORAGE_KEY] : [];
}

function buildCustomBlocksField() {
    const wrap = document.createElement('div');
    wrap.className = 'field tg-field cb-field';
    wrap.innerHTML = `
        <span class="field-label">Свои блоки в расписании</span>
        <span class="field-hint">Добавьте на сетку своё событие: репетитор, секция, работа. Блок появится в нужной колонке дня на странице расписания. Если время совпадает с занятием, блок рисуется узкой полоской у правого края. Удалить можно здесь или крестиком на самом блоке. Если включены напоминания Telegram, они приходят и о своих блоках.</span>
        <div class="cb-list"></div>
        <input type="text" class="cb-title" maxlength="60" placeholder="Название, например: Английский с репетитором">
        <div class="tg-row">
            <select class="cb-mode"><option value="once">Один раз</option><option value="weekly">Каждую неделю</option></select>
            <input type="date" class="cb-date">
        </div>
        <div class="tg-row cb-days" hidden></div>
        <div class="tg-row">
            <label class="cb-time">С <input type="time" class="cb-start" value="18:00"></label>
            <label class="cb-time">До <input type="time" class="cb-end" value="19:00"></label>
        </div>
        <div class="cb-colors"></div>
        <div class="tg-row">
            <button type="button" class="action-btn cb-save">Добавить</button>
            <button type="button" class="action-btn cb-cancel" hidden>Отменить изменение</button>
        </div>
        <span class="field-hint cb-status"></span>`;

    const $ = sel => wrap.querySelector(sel);
    const listEl = $('.cb-list');
    const titleEl = $('.cb-title');
    const modeEl = $('.cb-mode');
    const dateEl = $('.cb-date');
    const daysEl = $('.cb-days');
    const startEl = $('.cb-start');
    const endEl = $('.cb-end');
    const colorsEl = $('.cb-colors');
    const saveBtn = $('.cb-save');
    const cancelBtn = $('.cb-cancel');
    const statusEl = $('.cb-status');

    let blocks = [];
    let editingId = '';
    let color = CB_COLORS[0];
    const chosenDays = new Set();
    dateEl.value = cbTodayIso();

    CB_WEEKDAYS.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-btn cb-day';
        btn.textContent = name;
        btn.addEventListener('click', () => {
            if (chosenDays.has(i)) chosenDays.delete(i); else chosenDays.add(i);
            btn.classList.toggle('active', chosenDays.has(i));
        });
        daysEl.appendChild(btn);
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'cb-color-input';
    const paintColors = () => {
        colorsEl.querySelectorAll('.cb-swatch').forEach(el => el.classList.toggle('active', el.dataset.color === color));
        colorInput.value = color;
    };
    CB_COLORS.forEach(c => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'cb-swatch';
        sw.dataset.color = c;
        sw.style.background = c;
        sw.setAttribute('aria-label', c);
        sw.addEventListener('click', () => { color = c; paintColors(); });
        colorsEl.appendChild(sw);
    });
    colorInput.addEventListener('input', () => { color = colorInput.value; paintColors(); });
    colorsEl.appendChild(colorInput);
    paintColors();

    const syncMode = () => {
        const weekly = modeEl.value === 'weekly';
        dateEl.hidden = weekly;
        daysEl.hidden = !weekly;
    };
    modeEl.addEventListener('change', syncMode);

    const resetForm = () => {
        editingId = '';
        titleEl.value = '';
        modeEl.value = 'once';
        dateEl.value = cbTodayIso();
        startEl.value = '18:00';
        endEl.value = '19:00';
        chosenDays.clear();
        daysEl.querySelectorAll('.cb-day').forEach(b => b.classList.remove('active'));
        color = CB_COLORS[0];
        paintColors();
        syncMode();
        saveBtn.textContent = 'Добавить';
        cancelBtn.hidden = true;
    };

    const draw = () => {
        listEl.textContent = '';
        if (!blocks.length) {
            const empty = document.createElement('span');
            empty.className = 'field-hint';
            empty.textContent = 'Пока ни одного блока.';
            listEl.appendChild(empty);
            return;
        }
        blocks.slice().sort((a, b) => cbSortKey(a).localeCompare(cbSortKey(b))).forEach(block => {
            const row = document.createElement('div');
            row.className = 'cb-item';
            const dot = document.createElement('span');
            dot.className = 'cb-dot';
            dot.style.background = block.color;
            const text = document.createElement('span');
            text.className = 'cb-text';
            const name = document.createElement('b');
            name.textContent = block.title || 'Без названия';
            const when = document.createElement('small');
            when.textContent = `${cbWhen(block)}, ${cbClock(block.startMin)}–${cbClock(block.endMin)}`;
            text.append(name, when);
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'action-btn cb-mini';
            edit.textContent = 'Изменить';
            edit.addEventListener('click', () => {
                editingId = block.id;
                titleEl.value = block.title || '';
                modeEl.value = block.date ? 'once' : 'weekly';
                dateEl.value = block.date || cbTodayIso();
                chosenDays.clear();
                (block.weekdays || []).forEach(d => chosenDays.add(d));
                daysEl.querySelectorAll('.cb-day').forEach((b, i) => b.classList.toggle('active', chosenDays.has(i)));
                startEl.value = cbClock(block.startMin);
                endEl.value = cbClock(block.endMin);
                color = block.color;
                paintColors();
                syncMode();
                saveBtn.textContent = 'Сохранить';
                cancelBtn.hidden = false;
                statusEl.textContent = '';
                titleEl.focus();
            });
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'action-btn cb-mini';
            del.textContent = 'Удалить';
            del.addEventListener('click', async () => {
                blocks = blocks.filter(b => b.id !== block.id);
                await chrome.storage.local.set({ [CB_STORAGE_KEY]: blocks });
                if (editingId === block.id) resetForm();
                draw();
            });
            row.append(dot, text, edit, del);
            listEl.appendChild(row);
        });
    };

    cancelBtn.addEventListener('click', () => { resetForm(); statusEl.textContent = ''; });

    saveBtn.addEventListener('click', async () => {
        const title = titleEl.value.trim();
        const startMin = cbParseTime(startEl.value);
        const endMin = cbParseTime(endEl.value);
        const weekly = modeEl.value === 'weekly';
        if (!title) { statusEl.textContent = 'Введите название.'; return; }
        if (startMin === null || endMin === null) { statusEl.textContent = 'Укажите время начала и конца.'; return; }
        if (endMin <= startMin) { statusEl.textContent = 'Конец должен быть позже начала (блок внутри одних суток).'; return; }
        if (weekly && !chosenDays.size) { statusEl.textContent = 'Выберите хотя бы один день недели.'; return; }
        if (!weekly && !/^\d{4}-\d{2}-\d{2}$/.test(dateEl.value)) { statusEl.textContent = 'Укажите дату.'; return; }
        const block = {
            id: editingId || 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title, startMin, endMin, color,
            date: weekly ? null : dateEl.value,
            weekdays: weekly ? Array.from(chosenDays).sort() : [],
        };
        const fresh = await cbLoad();
        const next = editingId ? fresh.map(b => (b.id === editingId ? block : b)) : fresh.concat(block);
        if (!editingId && next.length > CB_MAX) { statusEl.textContent = `Не больше ${CB_MAX} блоков.`; return; }
        await chrome.storage.local.set({ [CB_STORAGE_KEY]: next });
        blocks = next;
        resetForm();
        statusEl.textContent = 'Сохранено. Если расписание уже открыто, блок появился на странице.';
        draw();
    });

    syncMode();
    cbLoad().then(list => { blocks = list; draw(); });
    return wrap;
}

// Диагностика: команды уходят в content.js активной вкладки сайта, он собирает снимок
// и сам скачивает файл (страница живёт независимо от попапа).
async function diagActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    return tab && tab.id != null && /^https:\/\/avatar\.skyeng\.ru\//.test(tab.url || '') ? tab : null;
}

function diagFmtDuration(sec) {
    if (sec == null) return 'нет данных';
    if (sec < 90) return sec + ' с';
    if (sec < 5400) return Math.round(sec / 60) + ' мин';
    return (sec / 3600).toFixed(1) + ' ч';
}

function buildDiagnosticsField() {
    const wrap = document.createElement('div');
    wrap.className = 'field tg-field';
    wrap.innerHTML = `
        <span class="field-label">Снимок сайта</span>
        <span class="field-hint">Откройте вкладку сайта и нажмите кнопку: скачается один файл с разметкой, стилями, журналом запросов и событий, таймерами и слушателями, хранилищем (значения секретов скрыты) и записями о блокировках. Перед отправкой проверьте файл: в разметке могут быть ваше имя и данные профиля.</span>
        <div class="diag-status field-hint"></div>
        <button type="button" class="action-btn diag-snap">Скачать снимок</button>
        <label class="diag-code"><input type="checkbox" class="diag-code-box"> Добавить код сайта (JS, до десятков МБ, файл .json.gz)</label>
        <div class="tg-row">
            <button type="button" class="action-btn diag-refresh">Обновить статус</button>
            <button type="button" class="action-btn diag-clear">Очистить журнал</button>
        </div>
        <span class="field-hint diag-msg"></span>`;
    const $ = sel => wrap.querySelector(sel);
    const statusEl = $('.diag-status');
    const msgEl = $('.diag-msg');
    const snapBtn = $('.diag-snap');

    const send = async payload => {
        const tab = await diagActiveTab();
        if (!tab) return null;
        try { return await chrome.tabs.sendMessage(tab.id, payload); } catch (err) { return { ok: false, error: 'страница не отвечает: обновите вкладку сайта' }; }
    };

    const refresh = async () => {
        const tab = await diagActiveTab();
        if (!tab) {
            statusEl.textContent = 'Активная вкладка не с avatar.skyeng.ru. Откройте сайт во вкладке и откройте попап снова.';
            snapBtn.disabled = true;
            return;
        }
        snapBtn.disabled = false;
        const st = await send({ type: 'skymod-diag-status' });
        if (!st || !st.ok) { statusEl.textContent = (st && st.error) || 'Страница не отвечает: обновите вкладку сайта.'; return; }
        const lines = [
            `Событий в журнале: ${st.entries}, таймеров от 20 с: ${st.timers}.`,
            `Вкладка: ${st.visibility}. Страница открыта ${diagFmtDuration(st.uptimeSec)}.`,
            st.lockPopupNow ? 'Окно блокировки на странице сейчас: ДА.' : 'Окно блокировки на странице сейчас: нет.',
            st.incidents.length
                ? 'Блокировок записано: ' + st.incidents.length + '. Последняя: ' + new Date(st.incidents[st.incidents.length - 1].iso).toLocaleString('ru-RU')
                    + ', неактивность ' + diagFmtDuration(st.incidents[st.incidents.length - 1].idleSec) + ', вкладка: ' + st.incidents[st.incidents.length - 1].visibility + '.'
                : 'Блокировок пока не записано.',
        ];
        statusEl.textContent = lines.join('\n');
        statusEl.style.whiteSpace = 'pre-line';
    };

    $('.diag-refresh').addEventListener('click', refresh);
    $('.diag-clear').addEventListener('click', async () => {
        const res = await send({ type: 'skymod-diag-clear' });
        msgEl.textContent = res && res.ok ? 'Журнал очищен.' : 'Не получилось очистить: ' + ((res && res.error) || 'нет вкладки сайта');
        refresh();
    });
    snapBtn.addEventListener('click', async () => {
        snapBtn.disabled = true;
        msgEl.textContent = 'Собираю снимок… Если выбран код сайта, это может занять до минуты. Попап можно не держать открытым: файл скачается со страницы.';
        const res = await send({ type: 'skymod-diag-snapshot', includeCode: $('.diag-code-box').checked });
        if (res && res.ok) msgEl.textContent = `Готово: ${res.name}, ${(res.bytes / 1048576).toFixed(1)} МБ (в папке загрузок).`;
        else msgEl.textContent = 'Не получилось: ' + ((res && res.error) || 'нет вкладки сайта');
        snapBtn.disabled = false;
    });
    refresh();
    return wrap;
}

// Telegram: свой бот пользователя, без общего сервера. Токен и chat_id лежат
// только в chrome.storage.local этого браузера и в экспорт настроек не попадают.
// Отправку и расписание делает background.js; здесь только привязка.
const TG_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

async function tgApi(token, method, body) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => null);
    if (!data || !data.ok) {
        const err = new Error((data && data.description) || ('HTTP ' + res.status));
        err.code = data && data.error_code;
        throw err;
    }
    return data.result;
}

function tgRerender() {
    const panelEl = document.getElementById('panel');
    const top = panelEl.scrollTop;
    renderPanel(null, true);
    panelEl.scrollTop = top;
}

function buildTelegramLinkField(values) {
    const wrap = document.createElement('div');
    wrap.className = 'field tg-field';
    const token = values.tgBotToken;
    const chatId = values.tgChatId;
    const setStatus = (text) => { const el = wrap.querySelector('.tg-status'); if (el) el.textContent = text; };
    const lastError = values.tgLastError ? `Последняя ошибка отправки: ${values.tgLastError}` : '';

    if (!token) {
        wrap.innerHTML = `
            <span class="field-label">Свой бот для напоминаний</span>
            <span class="field-hint">Без чужих серверов: бот создаётся у вас, токен остаётся только в этом браузере. 1) В Telegram откройте @BotFather и отправьте /newbot. 2) Вставьте токен, который он пришлёт.</span>
            <input type="password" class="tg-token" placeholder="123456789:AA..." autocomplete="off" spellcheck="false">
            <button type="button" class="action-btn tg-connect">Подключить бота</button>
            <span class="field-hint tg-status"></span>`;
        const input = wrap.querySelector('.tg-token');
        const btn = wrap.querySelector('.tg-connect');
        btn.addEventListener('click', async () => {
            const value = input.value.trim();
            if (!TG_TOKEN_RE.test(value)) { setStatus('Токен выглядит неверно: он вида 123456789:AAH... из сообщения BotFather.'); return; }
            btn.disabled = true;
            setStatus('Проверяю…');
            try {
                const me = await tgApi(value, 'getMe');
                await saveSetting('tgBotToken', value);
                await saveSetting('tgBotName', me.username || '');
                tgRerender();
            } catch (err) {
                setStatus('Не получилось: ' + err.message);
                btn.disabled = false;
            }
        });
        return wrap;
    }

    if (!chatId) {
        const name = values.tgBotName || '';
        wrap.innerHTML = `
            <span class="field-label">Бот @${name.replace(/[^\w]/g, '')} подключён</span>
            <span class="field-hint">Теперь привяжите свой чат: откройте бота, нажмите Start (или отправьте /start) и вернитесь сюда. Расширение запомнит только ваш чат и будет писать только туда.</span>
            <div class="tg-row">
                <button type="button" class="action-btn tg-open">Открыть бота</button>
                <button type="button" class="action-btn tg-bind">Привязать чат</button>
            </div>
            <button type="button" class="action-btn tg-reset">Другой бот</button>
            <span class="field-hint tg-status"></span>`;
        wrap.querySelector('.tg-open').addEventListener('click', () => window.open(`https://t.me/${name}`, '_blank'));
        wrap.querySelector('.tg-reset').addEventListener('click', async () => {
            await saveSetting('tgBotToken', '');
            await saveSetting('tgBotName', '');
            tgRerender();
        });
        const bind = wrap.querySelector('.tg-bind');
        bind.addEventListener('click', async () => {
            bind.disabled = true;
            setStatus('Ищу ваш /start…');
            try {
                const updates = await tgApi(token, 'getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'] });
                const starts = updates.filter(u => u.message && u.message.chat && u.message.chat.type === 'private'
                    && typeof u.message.text === 'string' && /^\/start\b/.test(u.message.text));
                if (!starts.length) { setStatus('Не вижу /start. Откройте бота, нажмите Start и повторите.'); bind.disabled = false; return; }
                const id = String(starts[starts.length - 1].message.chat.id);
                await saveSetting('tgChatId', id);
                await chrome.runtime.sendMessage({ type: 'skymod-tg-send', text: 'SkyMod подключён. Сюда будут приходить напоминания о занятиях.' }).catch(() => {});
                tgRerender();
            } catch (err) {
                const hint = err.code === 409 ? ' У бота включён webhook: отключите его или создайте нового бота.' : '';
                setStatus('Не получилось: ' + err.message + hint);
                bind.disabled = false;
            }
        });
        return wrap;
    }

    const maskedId = '…' + String(chatId).slice(-3);
    wrap.innerHTML = `
        <span class="field-label">Привязано: @${(values.tgBotName || '').replace(/[^\w]/g, '')}, чат ${maskedId}</span>
        <div class="tg-row">
            <button type="button" class="action-btn tg-test">Тестовое сообщение</button>
            <button type="button" class="action-btn tg-unlink">Отвязать</button>
        </div>
        <span class="field-hint tg-status"></span>`;
    setStatus(lastError);
    const test = wrap.querySelector('.tg-test');
    test.addEventListener('click', async () => {
        test.disabled = true;
        setStatus('Отправляю…');
        const res = await chrome.runtime.sendMessage({ type: 'skymod-tg-send', text: 'Проверка связи: напоминания SkyMod работают.' }).catch(err => ({ ok: false, error: String(err) }));
        setStatus(res && res.ok ? 'Отправлено.' : 'Не отправилось: ' + ((res && res.error) || 'неизвестная ошибка'));
        test.disabled = false;
    });
    wrap.querySelector('.tg-unlink').addEventListener('click', async () => {
        await saveSetting('tgEnabled', false);
        await saveSetting('tgBotToken', '');
        await saveSetting('tgBotName', '');
        await saveSetting('tgLastError', '');
        await saveSetting('tgChatId', '');
        tgRerender();
    });
    return wrap;
}

const TG_MUTE_OPTIONS = [
    { label: 'На час', ms: 3600e3 },
    { label: 'На день', ms: 86400e3 },
    { label: 'На неделю', ms: 7 * 86400e3 },
    { label: 'На месяц', ms: 30 * 86400e3 },
];

function buildTelegramMuteField(values) {
    const wrap = document.createElement('div');
    wrap.className = 'field tg-field';
    const until = Number(values.tgMuteUntil) || 0;
    const muted = until > Date.now();
    const fmt = new Date(until).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    wrap.innerHTML = `
        <span class="field-label">Отключить на время</span>
        <span class="field-hint tg-status">${muted ? 'Напоминания отключены до ' + fmt + '.' : 'Сейчас напоминания приходят как обычно.'}</span>
        <div class="tg-row tg-mute-row"></div>`;
    const row = wrap.querySelector('.tg-mute-row');
    TG_MUTE_OPTIONS.forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'action-btn';
        b.textContent = opt.label;
        b.addEventListener('click', async () => { await saveSetting('tgMuteUntil', Date.now() + opt.ms); tgRerender(); });
        row.appendChild(b);
    });
    if (muted) {
        const resume = document.createElement('button');
        resume.type = 'button';
        resume.className = 'action-btn';
        resume.textContent = 'Включить сейчас';
        resume.addEventListener('click', async () => { await saveSetting('tgMuteUntil', 0); tgRerender(); });
        wrap.appendChild(resume);
    }
    return wrap;
}

// ---------- Поле "цвет-или-градиент" (color-gradient) ----------
// Режимы: 'solid' (обычный color-picker), 'gradient' (2-4 стопа + угол/тип),
// 'rgb' (готовый анимированный радужный перелив, без настроек), 'custom'
// (сырое значение CSS background-image — полный контроль, "фулл кастом").

const CG_MODE_LABELS = { solid: 'Цвет', gradient: 'Градиент', rgb: 'RGB', custom: 'Свой CSS' };

function renderColorGradientField(def, values) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const value = normalizeColorValue(values[def.key], typeof def.default === 'object' ? def.default.solid : def.default);

    const commit = (patch) => {
        const next = { ...value, ...patch };
        saveSetting(def.key, next);
        currentValues[def.key] = next;
    };

    wrap.innerHTML = `
        <div class="field-row">
            <span class="field-label">${def.label}</span>
            <span class="cg-swatch"></span>
        </div>
        <div class="cg-modes">
            ${Object.keys(CG_MODE_LABELS).map(m => `<button type="button" class="cg-mode-btn${m === value.mode ? ' active' : ''}" data-mode="${m}">${CG_MODE_LABELS[m]}</button>`).join('')}
        </div>
        <div class="cg-body"></div>
        ${def.hint ? `<span class="field-hint">${def.hint}</span>` : ''}`;

    const swatch = wrap.querySelector('.cg-swatch');
    const body = wrap.querySelector('.cg-body');

    function refreshSwatch() {
        swatch.style.background = colorValueToCssBackground(value);
        swatch.classList.toggle('cg-swatch-animated', value.mode === 'rgb');
    }

    function renderBody() {
        body.innerHTML = '';

        if (value.mode === 'solid') {
            const row = document.createElement('div');
            row.className = 'cg-solid-row';
            row.innerHTML = `<input type="color" value="${value.solid}">`;
            row.querySelector('input').addEventListener('input', e => {
                value.solid = e.target.value;
                commit({ solid: value.solid });
                refreshSwatch();
            });
            body.appendChild(row);
        }

        if (value.mode === 'gradient') {
            const typeRow = document.createElement('div');
            typeRow.className = 'cg-type-row';
            typeRow.innerHTML = `
                <select class="cg-type-select">
                    <option value="linear" ${value.gradientType === 'linear' ? 'selected' : ''}>Линейный</option>
                    <option value="radial" ${value.gradientType === 'radial' ? 'selected' : ''}>Радиальный</option>
                </select>
                <span class="cg-angle-value" style="${value.gradientType === 'radial' ? 'display:none' : ''}">${value.angle}°</span>`;
            typeRow.querySelector('select').addEventListener('change', e => {
                value.gradientType = e.target.value;
                commit({ gradientType: value.gradientType });
                renderBody();
                refreshSwatch();
            });
            body.appendChild(typeRow);

            if (value.gradientType === 'linear') {
                const angleInput = document.createElement('input');
                angleInput.type = 'range';
                angleInput.min = 0; angleInput.max = 360; angleInput.step = 5;
                angleInput.value = value.angle;
                angleInput.addEventListener('input', e => {
                    value.angle = Number(e.target.value);
                    typeRow.querySelector('.cg-angle-value').textContent = `${value.angle}°`;
                    commit({ angle: value.angle });
                    refreshSwatch();
                });
                body.appendChild(angleInput);
            }

            const stopsWrap = document.createElement('div');
            stopsWrap.className = 'cg-stops';
            value.stops.forEach((stop, idx) => {
                const row = document.createElement('div');
                row.className = 'cg-stop-row';
                row.innerHTML = `
                    <input type="color" value="${stop.color}">
                    <input type="range" min="0" max="100" step="1" value="${stop.pos}">
                    <span class="cg-stop-pos">${stop.pos}%</span>
                    ${value.stops.length > 2 ? '<button type="button" class="cg-stop-remove">✕</button>' : ''}`;
                row.querySelector('input[type="color"]').addEventListener('input', e => {
                    stop.color = e.target.value;
                    commit({ stops: value.stops });
                    refreshSwatch();
                });
                row.querySelector('input[type="range"]').addEventListener('input', e => {
                    stop.pos = Number(e.target.value);
                    row.querySelector('.cg-stop-pos').textContent = `${stop.pos}%`;
                    commit({ stops: value.stops });
                    refreshSwatch();
                });
                const removeBtn = row.querySelector('.cg-stop-remove');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        value.stops.splice(idx, 1);
                        commit({ stops: value.stops });
                        renderBody();
                        refreshSwatch();
                    });
                }
                stopsWrap.appendChild(row);
            });
            body.appendChild(stopsWrap);

            if (value.stops.length < 5) {
                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'cg-add-stop';
                addBtn.textContent = '+ добавить точку';
                addBtn.addEventListener('click', () => {
                    const lastPos = value.stops[value.stops.length - 1].pos;
                    const prevPos = value.stops.length > 1 ? value.stops[value.stops.length - 2].pos : 0;
                    value.stops.push({ color: value.stops[value.stops.length - 1].color, pos: Math.round((lastPos + prevPos) / 2) });
                    commit({ stops: value.stops });
                    renderBody();
                    refreshSwatch();
                });
                body.appendChild(addBtn);
            }
        }

        if (value.mode === 'rgb') {
            const note = document.createElement('span');
            note.className = 'field-hint';
            note.textContent = 'Автоматический перелив по всему спектру — доп. настроек не требует.';
            body.appendChild(note);
        }

        if (value.mode === 'custom') {
            const textarea = document.createElement('textarea');
            textarea.className = 'cg-custom-textarea';
            textarea.placeholder = 'linear-gradient(45deg, #ff0000, #0000ff)';
            textarea.value = value.custom;
            textarea.addEventListener('change', e => {
                value.custom = e.target.value.trim();
                commit({ custom: value.custom });
                refreshSwatch();
            });
            body.appendChild(textarea);
            const hint = document.createElement('span');
            hint.className = 'field-hint';
            hint.textContent = 'Любое валидное значение CSS background-image: linear-gradient(...), radial-gradient(...), conic-gradient(...) и т.д.';
            body.appendChild(hint);
        }
    }

    wrap.querySelectorAll('.cg-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.mode === value.mode) return;
            value.mode = btn.dataset.mode;
            wrap.querySelectorAll('.cg-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
            commit({ mode: value.mode });
            renderBody();
            refreshSwatch();
        });
    });

    renderBody();
    refreshSwatch();
    return wrap;
}

// Сворачиваемая группа полей — высота анимируется явным пиксельным
// значением через JS (замер scrollHeight), а не CSS-трюком вроде
// grid-template-rows. Это надёжнее и заметно плавнее, особенно в
// маленьком попапе — не завязано на угадывание единиц измерения.
function renderGroup(group, values) {
    const wrap = document.createElement('div');
    wrap.className = 'group' + (group.open ? ' open' : '');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'group-header';
    header.innerHTML = `<span>${group.label}</span>${ICONS.chevron}`;

    const body = document.createElement('div');
    body.className = 'group-body';
    const inner = document.createElement('div');
    inner.className = 'group-body-inner';
    group.fields.forEach(def => inner.appendChild(renderField(def, values)));
    body.appendChild(inner);
    body.style.height = group.open ? 'auto' : '0px';

    // Высоту НЕ анимируем через JS — по той же причине, что и у смены
    // вкладок: окно попапа Chrome ресайзит под размер body не покадрово,
    // а с задержкой относительно плавной анимации, отсюда "лишняя"
    // чёрная область до того, как окно наконец подстроится. Высота
    // меняется мгновенно; плавным остаётся fade содержимого (CSS,
    // .group-body-inner) и поворот шеврона — они не влияют на размер
    // документа и такого рассинхрона не создают.
    header.addEventListener('click', () => {
        const opening = !group.open;
        group.open = opening;
        wrap.classList.toggle('open', opening);
        body.style.height = opening ? inner.scrollHeight + 'px' : '0px';
        // Если конструктор включён и область — "только тело настроек",
        // высота этой самой области только что изменилась (аккордеон
        // открылся/закрылся) — без этого пересчёта оверлей остался бы
        // растянут/обрезан по старой высоте до следующего переключения
        // вкладки.
        if (currentValues.builderEnabled) updateBuilderFrameGeometry(currentValues);
        if (opening) {
            // После первого открытия возвращаем 'auto', чтобы контент
            // (например, только что загруженный шрифт в библиотеке)
            // мог расти дальше без необходимости пересчитывать px вручную.
            setTimeout(() => {
                if (group.open) body.style.height = 'auto';
                if (currentValues.builderEnabled) updateBuilderFrameGeometry(currentValues);
            }, 0);
        }
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
}

// Живое превью цвета темы — обновляется сразу при выборе цвета.
function renderThemeSwatches(values) {
    const row = document.createElement('div');
    row.className = 'swatches';
    ['primaryColor'].forEach(key => {
        const dot = document.createElement('span');
        dot.className = 'swatch';
        const raw = values[key];
        dot.style.background = (raw && typeof raw === 'object')
            ? colorValueToCssBackground(normalizeColorValue(raw, '#1f1f1f'))
            : raw;
        row.appendChild(dot);
    });
    return row;
}

// ---------- Конструктор: рендер оверлея в РЕАЛЬНОМ попапе ----------
// Редактирование (HTML/CSS/JS, примеры, пресеты, отладчик, консоль)
// живёт на отдельной странице builder.html — здесь только применение
// уже сохранённого кода: мост к песочнице (sandbox.html/.js, свой CSP,
// подробности — см. документацию) и наложение iframe поверх/под попапом.

let sandboxReady = false;
let pendingBuilderPayload = null;
const BUILDER_STORAGE_PREFIX = 'builderData:'; // namespace в chrome.storage.local для storage.get/set из песочницы

// ?builderPreview=1 — этот экземпляр popup.html встроен как iframe живого
// предпросмотра внутри builder.html. Показываем оверлей независимо от
// сохранённого builderEnabled (чтобы предпросмотр работал, даже пока
// конструктор ещё выключен для реального использования на сайте).
const previewForce = new URLSearchParams(location.search).has('builderPreview');

function getBuilderFrame() {
    return document.getElementById('builder-frame');
}

window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;

    if (data.type === 'skymod-sandbox-ready') {
        sandboxReady = true;
        if (pendingBuilderPayload) {
            postBuilderRun(pendingBuilderPayload);
            pendingBuilderPayload = null;
        }
        return;
    }

    // Мост storage.get/set/remove из песочницы — сама песочница не видит
    // chrome.storage, поэтому запросы идут через нас, под своим namespace
    // (чтобы пользовательский код не мог случайно/намеренно задеть
    // остальные настройки SkyMod, у которых ключи без этого префикса).
    if (data.type === 'skymod-storage-get') {
        const storageKey = BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.get([storageKey], res => {
            getBuilderFrame().contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: res[storageKey] ?? null }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-set') {
        const storageKey = BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.set({ [storageKey]: data.value }, () => {
            getBuilderFrame().contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
        return;
    }
    if (data.type === 'skymod-storage-remove') {
        const storageKey = BUILDER_STORAGE_PREFIX + data.key;
        chrome.storage.local.remove([storageKey], () => {
            getBuilderFrame().contentWindow.postMessage({ type: 'skymod-storage-result', id: data.id, value: true }, '*');
        });
    }
    // skymod-sandbox-ok/-error/-log сюда тоже прилетают, но здесь их
    // некому показывать (нет UI отладчика) — молча игнорируем. Всё это
    // видно на builder.html, у которого своя собственная песочница.
});

let lastSentBuilderPayloadKey = null;
function sendBuilderCode(values) {
    const uiValue = normalizeColorValue(values.popupUiColor, '#8a8f98');
    const modValue = normalizeColorValue(values.modColor, '#8a8f98');
    const pulseValue = normalizeColorValue(values.pulseColor, '#8a8f98');
    const payload = {
        html: values.builderHtml || '', css: values.builderCss || '', js: values.builderJs || '',
        // Текущая палитра попапа — доступна пользовательскому коду как
        // window.SKYMOD_THEME и 4-й аргумент функции, чтобы конструктор
        // мог не хардкодить цвета отдельно от остального оформления.
        theme: {
            accent: colorValueRepresentative(uiValue),
            mod: colorValueRepresentative(modValue),
            pulse: colorValueRepresentative(pulseValue),
        },
    };
    // Не пересылаем в песочницу, если фактическое содержимое не
    // поменялось — иначе переключение ЛЮБОЙ другой настройки
    // (например, "Разрешить клики" или смена вкладки попапа) заново
    // запускало бы уже работающий скрипт с нуля (сброс requestAnimationFrame,
    // потерянное состояние, видимое мигание) без всякой на то причины.
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastSentBuilderPayloadKey && sandboxReady) return;
    lastSentBuilderPayloadKey = payloadKey;
    if (sandboxReady) {
        postBuilderRun(payload);
    } else {
        pendingBuilderPayload = payload; // отправится сразу после skymod-sandbox-ready
    }
}

// Расписание уходит ПЕРЕД кодом, чтобы к его старту объект schedule уже
// был заполнен; дальше обновляется по таймеру.
async function postBuilderRun(payload) {
    const frame = getBuilderFrame();
    await skymodPushSchedule(frame, currentValues.scheduleSubjectColors);
    frame.contentWindow.postMessage({ type: 'skymod-sandbox-run', payload }, '*');
}
setInterval(() => {
    if (sandboxReady && currentValues && currentValues.builderEnabled) {
        skymodPushSchedule(getBuilderFrame(), currentValues.scheduleSubjectColors);
    }
}, 15000);

// Область показа iframe-песочницы: весь попап, только шапка (там же, где
// дорожки платы) или только тело с вкладками настроек — так "где угодно
// в попапе" не ограничивается фразой, а реально выбирается.
function updateBuilderFrameGeometry(values) {
    const frame = getBuilderFrame();
    const scope = values.builderScope || 'full';
    const target = scope === 'header' ? document.querySelector('.head')
        : scope === 'panel' ? document.getElementById('panel')
        : null;
    if (target) {
        frame.style.top = target.offsetTop + 'px';
        frame.style.height = target.offsetHeight + 'px';
    } else {
        frame.style.top = '0px';
        frame.style.height = '100%';
    }
    frame.style.left = '0px';
    frame.style.width = '100%';
}

// ---------- Пересылка мыши в песочницу ----------
// Те же события, что получает фон сайта (mousemove/mousedown/mouseup/click/
// mouseleave); координаты переводятся в систему iframe, потому что при
// области "шапка"/"тело" он сдвинут относительно попапа.
let popupPointerOn = false;
let popupPendingMove = null;
let popupMoveRaf = 0;

function postPopupPointer(type, e) {
    const frame = getBuilderFrame();
    if (!frame || !frame.contentWindow) return;
    const r = frame.getBoundingClientRect();
    frame.contentWindow.postMessage({
        type: 'skymod-pointer',
        event: type,
        x: e ? e.clientX - r.left : 0,
        y: e ? e.clientY - r.top : 0,
        buttons: e ? e.buttons : 0,
    }, '*');
}
function onPopupPointerMove(e) {
    popupPendingMove = e;
    if (popupMoveRaf) return;
    popupMoveRaf = requestAnimationFrame(() => {
        popupMoveRaf = 0;
        if (popupPendingMove) postPopupPointer('mousemove', popupPendingMove);
        popupPendingMove = null;
    });
}
function onPopupPointerDown(e) { postPopupPointer('mousedown', e); }
function onPopupPointerUp(e) { postPopupPointer('mouseup', e); }
function onPopupPointerClick(e) { postPopupPointer('click', e); }
function onPopupPointerLeave() { postPopupPointer('mouseleave', null); }

function setPopupPointerForwarding(on) {
    if (on === popupPointerOn) return;
    popupPointerOn = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('mousemove', onPopupPointerMove, { capture: true, passive: true });
    window[method]('mousedown', onPopupPointerDown, { capture: true, passive: true });
    window[method]('mouseup', onPopupPointerUp, { capture: true, passive: true });
    window[method]('click', onPopupPointerClick, { capture: true, passive: true });
    document.documentElement[method]('mouseleave', onPopupPointerLeave, { passive: true });
    if (!on && popupMoveRaf) { cancelAnimationFrame(popupMoveRaf); popupMoveRaf = 0; popupPendingMove = null; }
}

// Показывает/прячет iframe-песочницу поверх/под остальным попапом,
// подгоняет её область и применяет текущий код, если конструктор включён
// (или если это принудительный предпросмотр — см. previewForce выше).
function applyBuilderLayer(values) {
    const effective = previewForce ? { ...values, builderEnabled: true } : values;
    const frame = getBuilderFrame();
    frame.classList.toggle('builder-active', !!effective.builderEnabled);
    // "Слой" — прямое соответствие выбору пользователя, без автоматических
    // подмен (см. подробный комментарий в content.js applySiteBuilderFrame —
    // тот же принцип и та же история бага здесь).
    frame.classList.toggle('builder-layer-over', effective.builderLayer === 'over');
    // "Поверх всего" + курсор: песочница получает мышь сама (в ней можно
    // кликать кнопки). "Под интерфейсом" + курсор: настоящий интерфейс попапа
    // перекрывает iframe, поэтому мышь пересылается в песочницу программно.
    const wantsPointer = !!effective.builderEnabled && !!effective.builderInteractive;
    const isOver = effective.builderLayer === 'over';
    frame.classList.toggle('builder-interactive', wantsPointer && isOver);
    setPopupPointerForwarding(wantsPointer && !isOver);
    if (effective.builderEnabled) {
        updateBuilderFrameGeometry(effective);
        sendBuilderCode(effective);
    }
}
window.addEventListener('resize', () => {
    if (currentValues && (currentValues.builderEnabled || previewForce)) updateBuilderFrameGeometry(currentValues);
});

// Вкладка "Конструктор" в самом попапе теперь — просто указатель на
// отдельную страницу: там и редактор, и пресеты, и отладчик с консолью,
// и живой предпросмотр. Держать это всё в тесном 320px попапе, который
// закрывается при потере фокуса, было неудобно для набора кода.
// Блок «О расширении» + резервная копия + сброс (бывшая вкладка «О»).
function renderAboutSection(container) {
            container.innerHTML = `
                <div class="about-list">
                    <div class="about-item"><span>Название</span><span>SkyMod</span></div>
                    <div class="about-item"><span>Версия</span><span>${chrome.runtime.getManifest().version}</span></div>
                    <div class="about-item"><span>Модули</span><span>Вид, Расписание, Удобство, Попап, Конструктор</span></div>
                    <div class="about-item"><span>Сайт</span><span>avatar.skyeng.ru</span></div>
                </div>
                <div class="backup-zone">
                    <div class="backup-title">Резервная копия всех настроек</div>
                    <div class="backup-hint">Тема, карточки, попап, конструктор, фон и части интерфейса сайта, пресеты.</div>
                    <div class="backup-actions">
                        <button type="button" class="action-btn" id="exportAllBtn">Экспорт в файл</button>
                        <button type="button" class="action-btn" id="importAllBtn">Импорт…</button>
                    </div>
                    <div class="backup-hint" id="backupStatus"></div>
                </div>
                <div class="danger-zone">
                    <button type="button" class="reset-btn" id="resetBtn">Сбросить все настройки</button>
                </div>
            `;

            // Экспорт — прямо здесь. Импорт открывает отдельную вкладку:
            // системный выбор файла закрывает попап Chrome при потере фокуса,
            // и обработчик выбора файла просто не успел бы сработать.
            const statusEl = container.querySelector('#backupStatus');
            container.querySelector('#exportAllBtn').addEventListener('click', async () => {
                try {
                    await skymodExportAllToFile();
                    statusEl.textContent = 'Файл skymod-settings.json скачан.';
                } catch (err) {
                    statusEl.textContent = 'Не удалось экспортировать: ' + err.message;
                }
            });
            container.querySelector('#importAllBtn').addEventListener('click', () => {
                window.open('backup.html', '_blank');
            });

            const btn = container.querySelector('#resetBtn');
            const originalLabel = btn.textContent;
            let confirming = false;
            let confirmTimer = null;

            btn.addEventListener('click', async () => {
                if (!confirming) {
                    confirming = true;
                    btn.textContent = 'Точно? Нажми ещё раз';
                    btn.classList.add('danger-confirm');
                    confirmTimer = setTimeout(() => {
                        confirming = false;
                        btn.textContent = originalLabel;
                        btn.classList.remove('danger-confirm');
                    }, 3000);
                    return;
                }
                clearTimeout(confirmTimer);
                // См. комментарий у RESET_CLEAR_KEYS — эти ключи не
                // записываем дефолтом, а удаляем целиком, чтобы сайт
                // после сброса выглядел как на свежей установке, а не
                // перекрашивался в дефолтные цвета расширения.
                const toWrite = { ...DEFAULTS };
                RESET_CLEAR_KEYS.forEach(k => delete toWrite[k]);
                await chrome.storage.local.set(toWrite);
                await chrome.storage.local.remove(RESET_CLEAR_KEYS);
                currentValues = { ...DEFAULTS };
                applyPopupTheme(currentValues);
                applyPopupCircuitSetting(currentValues.popupCircuitEnabled !== false);
                renderPanel();
            });
}

// Вкладка «Ещё»: конструктор, резервная копия, сведения о расширении.
function renderMoreTab(container, values) {
    const builder = document.createElement('div');
    renderBuilderLinkTab(builder, values);
    const about = document.createElement('div');
    about.className = 'more-about';
    renderAboutSection(about);
    container.append(builder, about);
}

function renderBuilderLinkTab(container) {
    container.innerHTML = `
        <p class="builder-intro">
            Полный редактор конструктора — на отдельной странице: свой
            HTML/CSS/JS в песочнице (можно заменить дорожки платы своей
            анимацией или добавить что угодно ещё), свой CSS на весь
            попап (в т.ч. анимацию переключения вкладок), сохранённые
            пресеты, встроенный отладчик с консолью и живой предпросмотр.
            В режиме «Сайт» можно задать свой CSS для отдельных частей
            интерфейса сайта (например, полоски «сейчас») с готовым
            промптом для ИИ.
        </p>
        <div class="builder-actions">
            <button type="button" class="action-btn" id="builder-open">⤢ Открыть конструктор</button>
        </div>
        <a href="docs.html" target="_blank" class="builder-docs-link">Подробная документация ↗</a>`;

    container.querySelector('#builder-open').addEventListener('click', () => {
        window.open('builder.html', '_blank');
    });
}


// Короткое приветствие при первом открытии: что где лежит. Закрывается один раз и навсегда.
function buildWelcomeCard() {
    if (currentValues.popupWelcomeDone) return null;
    const card = document.createElement('div');
    card.className = 'welcome-card';
    card.innerHTML = `
        <b>Привет! SkyMod меняет вид сайта Skyeng.</b>
        <ul>
            <li><b>Вид</b>: цвета, фон и шрифт</li>
            <li><b>Расписание</b>: карточки занятий, полоска «сейчас», окно занятия</li>
            <li><b>Удобство</b>: ссылки, кнопка «Следующее задание», режим «Только фон»</li>
            <li><b>Ещё</b>: конструктор своего фона и резервная копия</li>
        </ul>
        <span>Всё применяется сразу, страницу обновлять не нужно. Если настройка серая и рядом значок <i class="welcome-i">i</i>, она занята конструктором.</span>
        <button type="button" class="welcome-ok">Понятно</button>`;
    card.querySelector('.welcome-ok').addEventListener('click', () => {
        saveSetting('popupWelcomeDone', true);
        card.remove();
    });
    return card;
}

// ---------- Вкладки (внизу, подчёркивание активной — без "таблетки") ----------

let currentValues = {};
let activeTabId = TABS[0].id;

function renderTabBar() {
    const tabsEl = document.getElementById('tabs');
    tabsEl.innerHTML = '';
    TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (tab.id === activeTabId ? ' active' : '');
        btn.type = 'button';
        btn.dataset.tabId = tab.id;
        btn.title = tab.label;
        btn.innerHTML = `${tab.icon}<span>${tab.label}</span>`;
        btn.addEventListener('click', () => switchTab(tab.id));
        tabsEl.appendChild(btn);
    });
}

function renderPanel(direction, instant) {
    const panel = document.getElementById('panel');
    const tab = TABS.find(t => t.id === activeTabId);
    const content = document.createElement('div');
    content.className = 'tab-content ' + (instant ? '' : (
        direction === 'left' ? 'slide-from-left' : direction === 'right' ? 'slide-from-right' : 'fade-in'
    ));

    if (tab.render) {
        tab.render(content, currentValues);
    } else if (tab.groups) {
        if (tab.id === 'theme') content.appendChild(renderThemeSwatches(currentValues));
        tab.groups.forEach(group => content.appendChild(renderGroup(group, currentValues)));
    } else {
        tab.fields.forEach(def => {
            if (!fieldVisible(def, currentValues)) return;
            content.appendChild(renderField(def, currentValues));
        });
    }
    if (tab.id === TABS[0].id) {
        const welcome = buildWelcomeCard();
        if (welcome) content.prepend(welcome);
    }

    // Высоту панели НЕ анимируем через JS — раньше это конфликтовало с
    // тем, как Chrome ресайзит окно попапа: окно подстраивается под
    // размер body не покадрово, а с задержкой относительно плавной
    // CSS-анимации высоты, из-за чего оставалась "лишняя" чёрная область
    // до того момента, пока окно наконец не "доезжало". Меняем высоту
    // мгновенно вместе с содержимым — плавным остаётся только появление
    // самого контента (fade/slide ниже), это чистый transform/opacity,
    // на размер окна не влияет и такого рассинхрона не создаёт.
    panel.innerHTML = '';
    panel.appendChild(content);

    // Область "шапка"/"тело" у конструктора завязана на реальные размеры
    // этих блоков — при смене вкладки (и, значит, содержимого #panel)
    // пересчитываем на всякий случай, даже если сейчас открыта не
    // вкладка "Конструктор" (иначе размер "подтянется" только при
    // следующем изменении builder-полей).
    if (currentValues.builderEnabled) updateBuilderFrameGeometry(currentValues);
}

function switchTab(id) {
    if (id === activeTabId) return;
    const oldIndex = TABS.findIndex(t => t.id === activeTabId);
    const newIndex = TABS.findIndex(t => t.id === id);
    activeTabId = id;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tabId === id));
    renderPanel(newIndex > oldIndex ? 'right' : 'left');
    // Запоминаем, чтобы при следующем открытии попап не сбрасывался на
    // первую вкладку — особенно важно для конструктора: набирать код
    // заново после каждого закрытия попапа никто не станет.
    chrome.storage.local.set({ lastActiveTab: id }).catch(() => {});
}

// ---------- Canvas: "дорожки платы", исходящие от слова Mod ----------
// Адаптация присланного прототипа. Отличие от оригинала: попап — не
// статичная демо-страница, его высота меняется (переключение вкладок,
// раскрытие групп), поэтому canvas и маршруты пересчитываются заново
// при каждом изменении размера контента (через ResizeObserver, с
// небольшим дебаунсом, чтобы не пересчитывать 60 раз за анимацию).

const pcbCanvas = document.getElementById('pcb-canvas');
const pcbCtx = pcbCanvas ? pcbCanvas.getContext('2d') : null;
const modTarget = document.getElementById('mod-target');

let pcbRoutes = [];
let pcbPulses = [];
let pcbAnimating = false;
let pcbEnabled = true; // управляется настройкой "Эффект дорожек платы" на вкладке "Попап"

// Цвета canvas-эффекта — раньше были жёстко зашиты прямо в отрисовку,
// теперь пересчитываются от акцентного цвета попапа (см. applyPopupTheme
// выше), чтобы весь UI, включая сам эффект, перекрашивался согласованно.
let pcbAccentValue = { mode: 'solid', solid: '#8a8f98' };
let pcbTraceStroke = 'rgba(138, 143, 152, 0.45)';
let pcbTraceShadow = '#6b7078';
let pcbNodeFill = '#8a8f98';
let pcbNodeShadow = '#b0b4bb';

// Принимает полный объект цвет-или-градиент попапа (см. блок выше). Для
// solid-режима считаем плоские цвета один раз, как раньше. Для
// gradient/rgb/custom плоский цвет-представитель нужен для узла импульса
// и тени (canvas shadowColor градиент не поддерживает) — а сама дорожка
// красится настоящим CanvasGradient, см. buildPCBTraceGradient ниже.
function updatePCBColors(accentValue) {
    pcbAccentValue = accentValue;
    const flat = colorValueRepresentative(accentValue);
    pcbTraceStroke = hexToRgbaLocal(flat, 45);
    pcbTraceShadow = shadePopupColor(flat, -20);
    pcbNodeFill = flat;
    pcbNodeShadow = shadePopupColor(flat, 25);
}

// Достаёт цвета из произвольной CSS-строки (режим "свой CSS") — на canvas
// нельзя просто подставить CSS-текст, как это делает браузер для DOM.
function extractColorsFromCustomCss(css) {
    const matches = (css || '').match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
    return matches && matches.length ? matches : [pcbNodeFill];
}

// Настоящий градиент/радуга для дорожек платы — пересчитывается каждый
// кадр только для не-solid режимов (дёшево, попап маленький). Для RGB
// фаза сдвигается по времени — получается бегущий перелив вдоль дорожек.
function buildPCBTraceGradient() {
    if (!pcbCtx || !pcbCanvas || pcbAccentValue.mode === 'solid') return null;

    let stops;
    if (pcbAccentValue.mode === 'gradient') {
        stops = pcbAccentValue.stops;
    } else if (pcbAccentValue.mode === 'rgb') {
        stops = RAINBOW_STOPS;
    } else {
        const colors = extractColorsFromCustomCss(pcbAccentValue.custom);
        stops = colors.map((c, i) => ({ color: c, pos: colors.length > 1 ? (i / (colors.length - 1)) * 100 : 0 }));
    }

    const w = pcbCanvas.width || 1, h = pcbCanvas.height || 1;
    let x0 = 0, y0 = h * 0.3, x1 = w, y1 = h * 0.3;
    if (pcbAccentValue.mode === 'rgb') {
        const phase = (performance.now() / 4000) % 1;
        x0 = -w * phase; x1 = w * (2 - phase);
    }

    const grad = pcbCtx.createLinearGradient(x0, y0, x1, y1);
    [...stops].sort((a, b) => a.pos - b.pos).forEach(s => {
        try { grad.addColorStop(Math.max(0, Math.min(1, s.pos / 100)), s.color); } catch (e) { /* некорректный стоп — пропускаем */ }
    });
    return grad;
}

const PCB_DIRECTIONS = [
    { x: 1, y: 0 },   { x: 1, y: 1 },   { x: 0, y: 1 },   { x: -1, y: 1 },
    { x: -1, y: 0 },  { x: -1, y: -1 }, { x: 0, y: -1 },  { x: 1, y: -1 },
];

function resizePCBCanvas() {
    if (!pcbCanvas) return;
    const contentEl = document.querySelector('.popup-content');
    // height:100% у canvas не резолвится, потому что у body нет явной
    // высоты (только ширина 320px, высота — по контенту) — именно
    // из-за этого раньше канвас был фактически нулевой высоты и рисовать
    // было негде. Меряем реальную высоту контента и выставляем явно.
    const h = contentEl ? contentEl.offsetHeight : document.body.scrollHeight;
    const w = pcbCanvas.offsetWidth || document.body.offsetWidth || 400;
    pcbCanvas.style.height = h + 'px';
    pcbCanvas.width = w;
    pcbCanvas.height = h;
}

// Направлениям "вверх" почти некуда лететь — слово Mod и так у самого
// верха попапа, эти маршруты сразу обрезаются краем канваса и визуально
// создают "пустоту" в одной части и "кашу" в другой. Оставляем только
// направления, где реально есть куда лететь: вбок и вниз.
const GOOD_DIRECTION_INDICES = [0, 1, 2, 3, 4]; // право, право-вниз, вниз, лево-вниз, лево
const ROUTE_COUNT = 9;
const MAX_ACTIVE_PULSES = 5;

function buildPCBRoutes() {
    pcbRoutes = [];
    // pcbPulses НЕ трогаем: у каждого импульса своя ссылка на путь
    // (см. spawnPCBPulse), пересборка списка маршрутов их не касается —
    // они спокойно долетают/дотухают на своём старом пути.
    if (!pcbCanvas || !modTarget) return;

    const rect = modTarget.getBoundingClientRect();
    const canvasRect = pcbCanvas.getBoundingClientRect();
    const startX = rect.left - canvasRect.left + rect.width / 2;
    const startY = rect.top - canvasRect.top + rect.height / 2;

    // Длина сегментов подстраивается под реальный размер попапа — иначе
    // на высоком попапе (раскрытые группы) маршруты остаются короткими
    // и жмутся в одном углу, а на низком — вылетают за края.
    const scale = Math.max(0.6, Math.min(2.2, pcbCanvas.height / 380));

    for (let i = 0; i < ROUTE_COUNT; i++) {
        let path = [{ x: startX, y: startY }];
        let currX = startX, currY = startY;
        // Равномерно раздаём маршруты по хорошим направлениям по кругу —
        // а не случайно, чтобы не было перекоса в одну сторону.
        let dirIdx = GOOD_DIRECTION_INDICES[i % GOOD_DIRECTION_INDICES.length];

        for (let s = 0; s < 4; s++) {
            const segLen = (25 + Math.random() * 35) * scale;
            const d = PCB_DIRECTIONS[dirIdx];
            currX += d.x * segLen;
            currY += d.y * segLen;
            path.push({ x: currX, y: currY });

            const turn = (Math.random() < 0.5 ? 1 : -1) * (Math.random() < 0.5 ? 1 : 2);
            const candidate = (dirIdx + turn + 8) % 8;
            // Не даём повороту увести маршрут в направление "вверх" —
            // там всё равно почти нет видимого пути.
            dirIdx = GOOD_DIRECTION_INDICES.includes(candidate) ? candidate : dirIdx;
        }

        const lastD = PCB_DIRECTIONS[dirIdx];
        currX += lastD.x * 250 * scale;
        currY += lastD.y * 250 * scale;
        path.push({ x: currX, y: currY });

        pcbRoutes.push(path);
    }
}

// Единая скорость для всех импульсов — в пикселях за кадр (не в долях
// сегмента, см. комментарий ниже про разную длину сегментов).
const PCB_PULSE_SPEED = 1.3; // px за кадр

// Находит точку на пути на заданном расстоянии (в px) от начала пути,
// проходя по сегментам и накапливая пройденную длину. Нужно для
// "стирающегося хвоста" — чтобы знать, где сейчас проходит граница
// между исчезнувшей и ещё видимой частью линии.
function pointAtDistance(path, dist) {
    let remaining = dist;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i], p2 = path[i + 1];
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 0.0001;
        if (remaining <= segLen) {
            const t = remaining / segLen;
            return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, segIndex: i };
        }
        remaining -= segLen;
    }
    const last = path[path.length - 1];
    return { x: last.x, y: last.y, segIndex: path.length - 2 };
}

function pathLength(path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    }
    return total;
}

function spawnPCBPulse(routeIdx) {
    const path = pcbRoutes[routeIdx];
    if (!path) return;
    if (pcbPulses.length >= MAX_ACTIVE_PULSES) return; // не даём импульсам копиться и наслаиваться
    pcbPulses.push({
        path, // ссылка на сам путь, а не индекс — пересборка pcbRoutes её не затронет
        segmentIdx: 0,
        progress: 0,
        opacity: 1.0,
        fading: false,   // true = голова доехала до конца, теперь "стирается" хвост
        retractDist: 0,  // сколько пути уже стёрлось с начала (px)
        totalLen: 0,     // полная длина пути — известна только когда доехали до конца
    });
}

function triggerPCBBurst() {
    if (modTarget) {
        modTarget.classList.add('pulse-flash');
        setTimeout(() => modTarget.classList.remove('pulse-flash'), 250);
    }
    // Не все маршруты разом (это и создавало ощущение "каши"), а
    // случайная половина, растянутая на более широкое окно времени.
    const shuffled = [...Array(pcbRoutes.length).keys()].sort(() => Math.random() - 0.5);
    const burstCount = Math.max(1, Math.ceil(shuffled.length / 2));
    shuffled.slice(0, burstCount).forEach(idx => {
        setTimeout(() => spawnPCBPulse(idx), Math.random() * 900);
    });
}

function pcbRandomLoop() {
    if (pcbRoutes.length > 0) {
        spawnPCBPulse(Math.floor(Math.random() * pcbRoutes.length));
    }
    pcbLoopTimer = setTimeout(pcbRandomLoop, 900 + Math.random() * 1300);
}

function animatePCB() {
    try {
        if (!pcbCtx) return;
        pcbCtx.clearRect(0, 0, pcbCanvas.width, pcbCanvas.height);
        // Градиент/радуга дорожек — один раз за кадр, переиспользуется всеми
        // текущими импульсами (создание CanvasGradient недёшево, чтобы делать
        // его на каждый импульс отдельно).
        const strokeThisFrame = buildPCBTraceGradient() || pcbTraceStroke;

        for (let i = pcbPulses.length - 1; i >= 0; i--) {
            try {
                const p = pcbPulses[i];
                const path = p.path;
                if (!path || path.length < 2) { pcbPulses.splice(i, 1); continue; }

                const lastSegIdx = path.length - 2; // индекс последнего отрезка пути

                if (p.fading) {
                    // "Стираем" линию с начала (от Mod) в ту же сторону, в
                    // которую двигалась голова — с той же скоростью, так
                    // что выглядит как продолжение того же движения, а не
                    // отдельное потускнение всей линии разом.
                    p.retractDist += PCB_PULSE_SPEED;
                    if (p.retractDist >= p.totalLen) { pcbPulses.splice(i, 1); continue; }

                    const tail = pointAtDistance(path, p.retractDist);
                    pcbCtx.save();
                    pcbCtx.globalAlpha = p.opacity;
                    pcbCtx.lineWidth = 1.8;
                    pcbCtx.strokeStyle = strokeThisFrame;
                    pcbCtx.shadowBlur = 6;
                    pcbCtx.shadowColor = pcbTraceShadow;
                    pcbCtx.beginPath();
                    pcbCtx.moveTo(tail.x, tail.y);
                    for (let k = tail.segIndex + 1; k <= lastSegIdx + 1; k++) {
                        pcbCtx.lineTo(path[k].x, path[k].y);
                    }
                    pcbCtx.stroke();
                    pcbCtx.restore();
                    continue;
                }

                const p1 = path[p.segmentIdx];
                const p2 = path[p.segmentIdx + 1] || p1;
                const segLen = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
                p.progress += PCB_PULSE_SPEED / segLen;

                if (p.progress >= 1) {
                    p.progress = 0;
                    if (p.segmentIdx >= lastSegIdx) {
                        // Доехали до конца — переходим в стадию "стирания хвоста".
                        p.fading = true;
                        p.totalLen = pathLength(path);
                    } else {
                        p.segmentIdx += 1;
                    }
                }

                const curP1 = path[p.segmentIdx];
                const curP2 = path[p.segmentIdx + 1] || curP1;
                const headX = curP1.x + (curP2.x - curP1.x) * p.progress;
                const headY = curP1.y + (curP2.y - curP1.y) * p.progress;

                pcbCtx.save();
                pcbCtx.globalAlpha = p.opacity;
                pcbCtx.lineWidth = 1.8;
                pcbCtx.strokeStyle = strokeThisFrame;
                pcbCtx.shadowBlur = 6;
                pcbCtx.shadowColor = pcbTraceShadow;
                pcbCtx.beginPath();
                pcbCtx.moveTo(path[0].x, path[0].y);
                for (let k = 1; k <= p.segmentIdx; k++) pcbCtx.lineTo(path[k].x, path[k].y);
                pcbCtx.lineTo(headX, headY);
                pcbCtx.stroke();

                pcbCtx.shadowBlur = 8;
                pcbCtx.shadowColor = pcbNodeShadow;
                pcbCtx.fillStyle = pcbNodeFill;
                pcbCtx.beginPath();
                pcbCtx.arc(headX, headY, 2.2, 0, Math.PI * 2);
                pcbCtx.fill();
                pcbCtx.restore();
            } catch (innerErr) {
                // Одна сломанная частица не должна убивать весь эффект —
                // именно так раньше и застревала анимация навсегда: одно
                // исключение внутри rAF-колбэка обрывало всю цепочку.
                pcbPulses.splice(i, 1);
            }
        }
    } catch (err) {
        console.error('[SkyMod popup] Ошибка в animatePCB:', err);
    }

    requestAnimationFrame(animatePCB);
}

let pcbBurstTimer = null;
let pcbLoopTimer = null;
let pcbBurstInterval = null;

function startPCBLoops() {
    clearTimeout(pcbBurstTimer);
    clearTimeout(pcbLoopTimer);
    clearInterval(pcbBurstInterval);
    pcbBurstTimer = setTimeout(triggerPCBBurst, 300);
    pcbBurstInterval = setInterval(triggerPCBBurst, 6000);
    pcbLoopTimer = setTimeout(pcbRandomLoop, 800);
}

function stopPCBLoops() {
    clearTimeout(pcbBurstTimer);
    clearTimeout(pcbLoopTimer);
    clearInterval(pcbBurstInterval);
}

// Живое включение/выключение эффекта с вкладки "Попап" — без
// перезапуска попапа. При выключении текущие импульсы тоже сразу
// убираются (иначе они бы ещё несколько секунд долетали/дотухали).
// Размер попапа: атрибут на <html> (CSS читает его) + копия в localStorage
// для popup-size-early.js. Дорожки платы зависят от ширины, поэтому после
// смены размера пересчитываем канвас и маршруты.
function applyPopupSize(values) {
    const size = ['compact', 'large', 'xl'].includes(values.popupSize) ? values.popupSize : 'large';
    document.documentElement.setAttribute('data-size', size);
    try { localStorage.setItem('skymodPopupSize', size); } catch (e) { /* не критично */ }
    if (typeof resizePCBCanvas === 'function') {
        requestAnimationFrame(() => { resizePCBCanvas(); if (typeof buildPCBRoutes === 'function') buildPCBRoutes(); });
    }
}

function applyPopupCircuitSetting(enabled) {
    pcbEnabled = enabled;
    if (enabled) {
        startPCBLoops();
    } else {
        stopPCBLoops();
        pcbPulses.length = 0;
    }
}

function initPCB() {
    if (!pcbCanvas || !pcbCtx || !modTarget) return;
    resizePCBCanvas();
    buildPCBRoutes();
    pcbLastHeight = pcbCanvas.height;

    if (pcbAnimating) return; // цикл уже запущен, маршруты просто обновились
    pcbAnimating = true;

    if (pcbEnabled) startPCBLoops();
    animatePCB(); // сам цикл отрисовки крутится всегда — если импульсов нет, он просто ничего не рисует (дёшево)
}

// Высота попапа меняется (переключение вкладок, раскрытие групп) —
// пересчитываем canvas и маршруты, но с дебаунсом, чтобы не делать
// это на каждом промежуточном кадре анимации раскрытия группы/смены
// вкладки. Плюс пересобираем маршруты, только если высота реально
// заметно поменялась — на мелкие подвижки канвас просто ресайзится,
// не трогая уже летящие импульсы (у них своя ссылка на путь, см.
// spawnPCBPulse, так что даже полная пересборка их не "телепортирует",
// но лишний раз лучше не пересоздавать пути без необходимости).
let pcbResizeTimer = null;
let pcbLastHeight = 0;
if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
        clearTimeout(pcbResizeTimer);
        // Ждём дольше, чем длится анимация высоты панели/группы (.3s),
        // чтобы пересборка случилась один раз ПОСЛЕ того, как всё
        // устоялось, а не посреди перехода.
        pcbResizeTimer = setTimeout(() => {
            resizePCBCanvas();
            const changed = Math.abs(pcbCanvas.height - pcbLastHeight) > 24;
            if (changed) {
                pcbLastHeight = pcbCanvas.height;
                buildPCBRoutes();
            }
        }, 350);
    }).observe(document.body);
}

// ---------- Подсказка о новой версии ----------
// Данные кладёт background.js (раздел «Проверка новых версий»): здесь только
// чтение storage, в сеть попап не ходит. Разбор версии продублирован из
// background.js, общего подключаемого файла у них нет.

const UPDATE_RELEASES_URL = 'https://github.com/sploofer1/SkyMod/releases';

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

function hideUpdateStrip(strip) {
    document.documentElement.classList.remove('has-update-strip');
    strip.hidden = true;
    strip.replaceChildren();
}

async function renderUpdateStrip() {
    const strip = document.getElementById('update-strip');
    if (!strip) return;
    // В живом предпросмотре конструктора полоска не нужна.
    if (previewForce) { hideUpdateStrip(strip); return; }
    let version = '';
    let url = UPDATE_RELEASES_URL;
    let show = false;
    try {
        const r = await chrome.storage.local.get(['updateCheckEnabled', 'updateInfo', 'dismissedVersion']);
        const info = r.updateInfo && typeof r.updateInfo === 'object' ? r.updateInfo : {};
        version = typeof info.latestVersion === 'string' ? info.latestVersion : '';
        show = r.updateCheckEnabled !== false
            && updateIsNewer(version, chrome.runtime.getManifest().version)
            && version !== r.dismissedVersion;
        if (typeof info.releaseUrl === 'string' && info.releaseUrl.startsWith(UPDATE_RELEASES_URL + '/')) url = info.releaseUrl;
    } catch (e) { show = false; }
    if (!show) { hideUpdateStrip(strip); return; }

    const link = document.createElement('a');
    link.className = 'update-strip-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Доступна версия ' + version + ' — скачать';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'update-strip-close';
    close.title = 'Скрыть для этой версии';
    close.setAttribute('aria-label', 'Скрыть');
    close.textContent = '×';
    close.addEventListener('click', () => {
        hideUpdateStrip(strip);
        try { chrome.storage.local.set({ dismissedVersion: version }); } catch (e) { /* расширение перезагрузили */ }
    });

    strip.replaceChildren(link, close);
    strip.hidden = false;
    document.documentElement.classList.add('has-update-strip');
}

// ---------- Старт ----------

// ?tab=... — на что вкладку открыть при старте (используется, например,
// iframe живого предпросмотра на builder.html, чтобы показать нужную
// область попапа). В обычном использовании расширения этот параметр не
// задан — тогда работает запоминание последней открытой вкладки ниже.
const urlParams = new URLSearchParams(location.search);
const urlTab = urlParams.get('tab');

async function init() {
    const versionEl = document.getElementById('versionLabel');
    if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
    currentValues = await loadSettings();
    applyPopupTheme(currentValues);
    applyPopupSize(currentValues);
    applyBuilderLayer(currentValues);
    applyBuilderGlobalCss(currentValues);
    pcbEnabled = currentValues.popupCircuitEnabled !== false;

    // Приоритет: ?tab=... из ссылки > запомненная вкладка с прошлого
    // закрытия > первая вкладка по умолчанию.
    let initialTab = TABS[0].id;
    if (urlTab && TABS.some(t => t.id === urlTab)) {
        initialTab = urlTab;
    } else {
        try {
            const { lastActiveTab } = await chrome.storage.local.get(['lastActiveTab']);
            if (lastActiveTab && TABS.some(t => t.id === lastActiveTab)) initialTab = lastActiveTab;
        } catch (e) { /* нет доступа к storage — остаёмся на вкладке по умолчанию */ }
    }
    activeTabId = initialTab;

    await renderUpdateStrip();
    renderTabBar();
    renderPanel();
    initPCB();
}

// Живая реакция на изменения из ДРУГОГО контекста — конструктор теперь
// редактируется на отдельной странице builder.html, а не в этом попапе,
// поэтому именно так (а не напрямую через saveSetting) сюда попадают
// новые HTML/CSS/JS: используется и реальным попапом (мало ли, две
// вкладки открыты разом), и обязательно — iframe живого предпросмотра
// внутри builder.html (?builderPreview=1), который иначе не узнал бы,
// что настройки поменялись, до следующей перезагрузки.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !currentValues || Object.keys(currentValues).length === 0) return;
    let touchedBuilder = false;
    let touchedTheme = false;
    let touchedLocks = false;
    let touchedUpdate = false;
    Object.keys(changes).forEach(key => {
        // BUILDER_STORAGE_PREFIX ("builderData:...") — это внутреннее
        // хранилище storage.get/set из ПОЛЬЗОВАТЕЛЬСКОГО JS в песочнице
        // (см. мост выше), не настройка конструктора. Без этого условия
        // key.startsWith('builder') ловил и его тоже — вызов storage.set(...)
        // из своего же скрипта тут же пересылал код обратно в песочницу,
        // и она перезапускала сама себя на каждый storage.set (тот самый
        // пример "Счётчик кликов" рестартовался бы при каждом клике).
        if (key.startsWith(BUILDER_STORAGE_PREFIX)) return;
        // Служебные данные проверки обновлений в currentValues (настройки) не нужны.
        if (key === 'updateInfo' || key === 'dismissedVersion') { touchedUpdate = true; return; }
        if (key === 'updateCheckEnabled') touchedUpdate = true;
        currentValues[key] = changes[key].newValue;
        if (key.startsWith('builder')) touchedBuilder = true;
        if (key === 'popupUiColor' || key === 'modColor' || key === 'pulseColor') touchedTheme = true;
        if (key === 'sitePartsCss' || key === 'siteBuilderEnabled') touchedLocks = true;
    });
    // Конструктор включил или выключил часть (или свой фон): замки на полях попапа должны
    // обновиться сразу, а не при следующем открытии, иначе можно менять настройку, которую
    // уже занимает конструктор.
    if (touchedLocks) {
        const panelEl = document.getElementById('panel');
        if (panelEl) {
            const top = panelEl.scrollTop;
            renderPanel(null, true);
            panelEl.scrollTop = top;
        }
    }
    if (touchedUpdate) renderUpdateStrip();
    if (touchedTheme) applyPopupTheme(currentValues);
    if (touchedBuilder) {
        applyBuilderLayer(currentValues);
        applyBuilderGlobalCss(currentValues);
    }
});

init();
