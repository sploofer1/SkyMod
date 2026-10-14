// Общий для конструктора, попапа и страницы резервной копии список ключей
// хранилища SkyMod и экспорт всех настроек в файл. Обычный скрипт (без
// модулей), поэтому всё объявлено в глобальной области.
//
// Список синхронизирован со схемой полей в popup.js (TABS): если там
// появится новое поле, добавьте его ключ сюда, иначе оно не попадёт ни в
// экспорт, ни в список категорий при импорте.

const SKYMOD_KEY_GROUPS = {
    builder: [
        'builderEnabled', 'builderLayer', 'builderScope', 'builderInteractive',
        'builderGlobalCssEnabled', 'builderGlobalCss', 'builderHtml', 'builderCss', 'builderJs',
    ],
    siteBuilder: [
        'siteBuilderEnabled', 'siteBuilderLayer', 'siteBuilderInteractive',
        'siteBuilderHtml', 'siteBuilderCss', 'siteBuilderJs',
    ],
};

const SETTINGS_CATEGORIES = [
    {
        id: 'theme', title: 'Тема',
        desc: 'Фон страницы, шрифты (включая загруженные файлы)',
        keys: [
            'primaryColor', 'fontFamily', 'googleFontUrl', 'activeCustomFontId', 'fontLibrary',
            'backgroundImage', 'backgroundFile', 'backgroundFit', 'backgroundDim',
        ],
    },
    {
        id: 'cards', title: 'Карточки',
        desc: 'Цвет и прозрачность карточек, полоска "сейчас", читаемость, скрытие интерфейса (бездействие, горячая клавиша)',
        keys: [
            'cardColor', 'cardOpacity', 'nowLineHidden', 'nowLineColor', 'cardReadable', 'cardReadableStrength', 'cardReadableBrightText',
            'uiFadeIdleEnabled', 'uiFadeIdleSeconds', 'uiFadeHotkeyEnabled', 'uiFadeHotkey', 'uiFadeVisibility', 'uiFadeScope',
        ],
    },
    {
        id: 'lessons', title: 'Уроки',
        desc: 'Цвета предметов, цвет карточек по предметам, свечение под текущий урок, окно занятия',
        keys: [
            'scheduleCardColors', 'scheduleGlow', 'scheduleGlowStrength', 'scheduleSubjectColors',
            'lessonPopupCustomize', 'lessonPopupBackdropBlur', 'lessonPopupBackdropDim',
            'lessonPopupPanelEnabled', 'lessonPopupPanelColor', 'lessonPopupPanelOpacity',
        ],
    },
    {
        id: 'siteUi', title: 'Элементы сайта',
        desc: 'Скрытие кнопки поддержки, аватарки, заголовка и меню; защита от блокировки при долгом отсутствии',
        keys: ['hideSupportButton', 'hideUserTray', 'hidePageTitle', 'hideNavSections', 'hideBrandMark', 'antiLockEnabled', 'updateCheckEnabled', 'diagEnabled', 'diagBodies'],
    },
    {
        id: 'telegram', title: 'Напоминания в Telegram',
        desc: 'Время напоминания и что присылать. Токен бота и чат в файл не попадают',
        keys: ['tgEnabled', 'tgLeadMinutes', 'tgNotifyLessons', 'tgNotifyTests', 'tgNotifyCustom'],
    },
    {
        id: 'customBlocks', title: 'Свои блоки в расписании',
        desc: 'Блоки, которые вы добавили на сетку расписания (название, время, цвет, повтор)',
        keys: ['customBlocks'],
    },
    { id: 'perf', title: 'Скорость', desc: 'Блокировка трекеров/аналитики, внешние ссылки во вкладках', keys: ['blockTrackers', 'externalLinksNewTab'] },
    { id: 'math', title: 'Задания', desc: 'Кнопка "Следующее задание"', keys: ['mathButtonEnabled', 'mathBtnColor'] },
    {
        id: 'popup', title: 'Попап',
        desc: 'Цвета "Mod"/пульсов/интерфейса, эффект дорожек платы',
        keys: ['modColor', 'pulseColor', 'popupUiColor', 'popupCircuitEnabled', 'popupSize'],
    },
    {
        id: 'builder', title: 'Конструктор попапа',
        desc: 'HTML/CSS/JS песочницы, глобальный CSS, настройки применения и сохранённые пресеты',
        keys: [...SKYMOD_KEY_GROUPS.builder, 'builderPresets'],
    },
    {
        id: 'siteParts', title: 'Части интерфейса сайта',
        desc: 'Свой CSS для отдельных элементов сайта (например, полоски "сейчас")',
        keys: ['sitePartsCss'],
    },
    {
        id: 'siteBg', title: 'Фон сайта',
        desc: 'Свой canvas/JS-фон под интерфейсом сайта Skyeng и сохранённые пресеты фона',
        keys: [...SKYMOD_KEY_GROUPS.siteBuilder, 'siteBuilderPresets'],
    },
];

async function skymodExportAllToFile() {
    const allKeys = SETTINGS_CATEGORIES.flatMap(c => c.keys);
    const stored = await chrome.storage.local.get(allKeys);
    const payload = { skymodExport: 'all-settings', version: 1, exportedAt: new Date().toISOString(), settings: stored };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skymod-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
