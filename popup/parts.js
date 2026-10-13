// SkyMod — реестр "частей интерфейса сайта".
// Подключается и в builder.html, и в docs.html (обычный скрипт, без модулей).
//
// Часть интерфейса — это отдельный кусочек реального сайта avatar.skyeng.ru,
// для которого можно написать свой CSS (в конструкторе: режим "Сайт" →
// "Части интерфейса сайта"). Реестр нужен трём вещам сразу:
//   1. выпадающему списку и карточке части в конструкторе;
//   2. разделу документации (скриншот, как называть, какие селекторы);
//   3. генератору промпта: ИИ получает точные селекторы и известные факты о
//      стилях сайта, поэтому человеку достаточно написать "лазер — сделай
//      розовым", а не объяснять, где этот элемент находится в вёрстке.
//
// Как добавить новую часть: скопируйте объект ниже, заполните поля, положите
// скриншот в popup/img/parts/. Поле settings: ключи настроек попапа, которые
// эта часть перекрывает (пока часть включена, они в попапе заблокированы).
// Больше нигде ничего менять не нужно.

const SKYMOD_PARTS = [
    {
        id: 'now-line',
        name: 'Полоска «сейчас» (лазер)',
        aliases: ['лазер', 'сейчас', 'полоска сейчас', 'линия текущего времени'],
        page: 'Расписание ученика (страница со списком занятий на день)',
        image: 'img/parts/now-line.png',
        description:
            'Линия с текущим временем поверх расписания и плашка «Сейчас 16:27» справа. ' +
            'Показывает текущее время: сайт сам двигает элементы вниз по колонке сегодняшнего дня, выставляя top (и height) инлайном. ' +
            'После обновления сайта 08.10.2026 светящуюся линию .now-glow заменил тонкий маркер .now-marker (линия 2px с кружком на левом краю).',
        elements: [
            {
                name: "Маркер текущего времени (линия)",
                selector: "[data-test=\"student schedule now marker\"]",
                alt: ".now-marker",
                note: "div внутри колонки сегодняшнего дня; top ставит скрипт сайта. position: absolute; z-index: 3; left: 0; right: 0; height: 2px; pointer-events: none; фон var(--ds-color-text-positive) (зелёный). Кружок 8x8px на левом краю (border-radius: 50%, тот же фон) рисует псевдоэлемент .now-marker::before, красить его надо отдельно. Старой светящейся линии .now-glow больше нет.",
            },
            {
                name: "Кружок на левом краю маркера",
                selector: "[data-test=\"student schedule now marker\"]::before",
                alt: ".now-marker::before",
                note: "position: absolute; top: 50%; left: 0; width: 8px; height: 8px; transform: translateY(-50%); border-radius: 50%; фон var(--ds-color-text-positive).",
            },
            {
                name: "Плашка «сейчас 16:27»",
                selector: "[data-test=\"student schedule now line\"]",
                alt: ".now-label",
                note: "display: inline-flex; position: absolute; z-index: 4; right: 0; align-items: baseline; gap: 4px; padding: 2px 6px; transform: translateY(-50%) (выравнивание по линии, не менять); border-radius: 4px; фон var(--ds-color-text-positive); цвет текста #0a0616; шрифт caption-xs; white-space: nowrap; pointer-events: none. top ставит скрипт сайта.",
            },
            {
                name: "Слово «сейчас» в плашке",
                selector: ".now-label .now-word",
                alt: "",
                note: "",
            },
            {
                name: "Время в плашке",
                selector: ".now-label .now-time",
                alt: "",
                note: "font-variant-numeric: tabular-nums.",
            },
            {
                name: "Затемнение прошедшей части дня",
                selector: "[data-test=\"student schedule now shade\"]",
                alt: ".now-shade",
                note: "position: absolute; z-index: 3; inset: 0 0 auto (прижато к верху колонки дня); pointer-events: none. height задаёт скрипт сайта. В таблице стилей сайта у .now-shade фона нет (раньше был rgba(0,0,0,.25)): если нужно затемнение, фон надо задать самому.",
            },
            {
                name: "Кнопка «к текущему времени» (если линия вне экрана)",
                selector: ".now-jump",
                alt: ".now-jump.-below",
                note: "Липкий блок (position: sticky; z-index: 5) в колонке сегодняшнего дня: .-above прилипает сверху (top: 16px), .-below снизу (bottom: 16px). Внутри .now-jump-full и .now-jump-compact (компактный вариант для узких экранов 1020-1439px).",
            },
        ],
        // Настройки попапа, которые перекрывает CSS этой части: пока часть включена в конструкторе, они в попапе заблокированы.
        settings: ['nowLineHidden', 'nowLineColor'],
        // Свойства, которые сайт выставляет сам и пересчитывает по времени — их нельзя переопределять.
        scriptControlled: 'top, height и transform у маркера, плашки и затемнения',
        notes: [
            'В попапе на вкладке «Расписание» есть простые настройки: скрыть полоску и сменить цвет. Свой CSS из конструктора применяется ПОВЕРХ них.',
            'Элементы появляются в DOM позже загрузки страницы (их создаёт Angular), это нормально: CSS подхватит их сам.',
        ],
        example:
            '[data-test="student schedule now marker"] {\n' +
            '    background: #ff5aa0 !important;\n' +
            '    box-shadow: 0 0 12px #ff5aa0 !important;\n' +
            '}\n' +
            '[data-test="student schedule now line"] {\n' +
            '    background: #ff5aa0 !important;\n' +
            '    color: #ffffff !important;\n' +
            '    border-radius: 999px 0 0 999px !important;\n' +
            '}',
        request: 'лазер — сделай линию розовой, а плашку «сейчас» полностью скруглённой',
    },
    {
        id: 'schedule-card',
        name: 'Карточка занятия в расписании',
        aliases: ['карточка', 'карточка урока', 'карточка занятия', 'занятие', 'слот расписания'],
        page: 'Расписание ученика (недельная сетка: колонки дней, в них карточки занятий)',
        image: 'img/parts/schedule-card.png',
        description:
            'Карточка одного занятия: название (перед ним цветная точка предмета), время «13:15–14:50» и справа значок типа занятия; у вебинаров ссылка «Запись →», у тестов бейдж «тест». ' +
            'Прошедшие занятия сайт выцвечивает через переменную фона и цвета текста (не opacity). Дизайн обновлён 08.10.2026.',
        elements: [
            {
                name: "Карточка",
                selector: "[data-test=\"student schedule slot\"]",
                alt: ".card[class*=\"subject-\"]",
                note: "display: flex (колонка), gap: 4px, padding: 12px (в низких карточках 8px, а в самых низких 6px), border-radius: 8px, overflow: hidden, cursor: pointer. Фон лежит ДВУМЯ слоями: background: linear-gradient(var(--schedule-card-fill), var(--schedule-card-fill)), var(--ds-color-background-primary). --schedule-card-fill равен --schedule-card-background (var(--ds-color-background-secondary); у -on-track зелёный оттенок). Своё оформление фона надёжнее всего задавать целиком (background и background-image) либо менять --schedule-card-background. Прошедшие (-past) без наведения: fill смешан с прозрачным на 50%, цвет названия и времени бледнее, значок типа opacity .2 (при :hover всё возвращается). Цвет предмета сайт задаёт переменной --schedule-subject-accent через класс -subject-N (в тёмной теме значения светлее). Классы состояния: -past, -future-day, -on-track. Атрибуты: data-test-card-state (all-done, has-actions, not-open-yet, no-context, mobile-app), data-test-card-tint (on-track, none), data-test-activity-type (lesson, practice, trainer, webinar, test, planning), data-test-subject (код предмета, например soft_skills), data-test-day-role (past-day, today, future-day). Их можно использовать в селекторах, например [data-test-card-state=\"all-done\"]. Простые настройки цвета и прозрачности карточек есть на вкладке «Расписание» в попапе.",
            },
            {
                name: "Название занятия",
                selector: "[data-test=\"student schedule slot\"] .titles .subject",
                alt: "",
                note: "Цвет text-primary (у прошедших бледнее), шрифт heading-xxs, обрезается многоточием. Перед названием цветная точка: псевдоэлемент .subject::before (8x8px, border-radius: 50%, цвет предмета).",
            },
            {
                name: "Время занятия",
                selector: "[data-test=\"student schedule slot\"] .titles .time",
                alt: "",
                note: "Цвет text-secondary, цифры одной ширины (tabular-nums), обрезается многоточием.",
            },
            {
                name: "Иконка типа занятия",
                selector: "[data-test=\"student schedule slot\"] .type-icon",
                alt: "",
                note: "Справа в строке: margin-left: auto; padding-top: 2px; цвет text-secondary; opacity .5 (у прошедших .2). Внутри app-schedule-activity-icon > ds-icon-*. У части занятий иконки нет.",
            },
            {
                name: "Строка с названием и иконкой",
                selector: "[data-test=\"student schedule slot\"] .head",
                alt: "",
                note: "display: flex; align-items: flex-start; gap: 8px. Порядок: сначала .titles, затем .type-icon (и .type-badge у тестов).",
            },
            {
                name: "Бейдж «тест»",
                selector: "[data-test=\"student schedule slot test badge\"]",
                alt: ".type-badge",
                note: "Только у контрольных. display: inline-flex; height: 20px; padding: 0 8px; мелкий жирный шрифт. Класс -test.",
            },
            {
                name: "Ссылка «Запись →» / живая кнопка",
                selector: "[data-test=\"student schedule slot live action\"]",
                alt: ".live-action",
                note: "Прямой потомок карточки, у неё pointer-events: auto (остальное содержимое карточки кликабельным не является). Класс -record у ссылки на запись. У карточек с живой кнопкой (не -record) при наведении фон становится брендовым.",
            },
            {
                name: "Кнопка открытия занятия внутри карточки",
                selector: "[data-test=\"student schedule slot open\"]",
                alt: ".open",
                note: "Через неё занятие открывается. Растянута на всю карточку: position: absolute; inset: 0; z-index: 0; background: none; border: none; border-radius: 8px; cursor: pointer. Остальное содержимое карточки лежит над ней с pointer-events: none. Не скрывать и не менять pointer-events: карточка перестанет открываться.",
            },
            {
                name: "Колонка дня (в ней лежат карточки)",
                selector: ".day-col",
                alt: ".day-col.-past",
                note: "Один день недели, атрибут data-test-date=\"YYYY-MM-DD\"; классы -past, -selected. position: relative; overflow: hidden; border-radius: 8px; без рамки и фона (в прежнем дизайне были). Высота задаётся инлайном (1200px при масштабе 2,5px на минуту). Место карточки (top, height) задаёт скрипт сайта у обёртки .slot-box (padding: 2px).",
            },
        ],
        settings: ['cardColor', 'cardOpacity', 'cardReadable', 'cardReadableStrength', 'cardReadableBrightText', 'scheduleCardColors'],
        behavior: {
            itemName: "карточка занятия",
            layout: "Карточка: position: relative; overflow: hidden; display: flex (колонка); gap 4px; padding 12px (в низких 8px и 6px); скругление 8px. Сайт задаёт всем её потомкам, кроме кнопки .open, position: relative; z-index: 1; pointer-events: none, поэтому слот по умолчанию встаёт обычной строкой под строкой .head. Чтобы прижать его к краю карточки, дай слоту position: absolute (карточка позиционирована, слот привяжется к ней). Высота карточки зависит от длительности занятия (45 минут это 112px при 2,5px на минуту), запаса места мало.",
            itemSelector: "[data-test=\"student schedule slot\"]",
            fields: "id, subject (код предмета), title, type (lesson, practice, trainer, webinar, test, planning), kind (подпись типа, например «Контрольная»), state (data-test-card-state), color (hex цвета предмета), date (YYYY-MM-DD), start и end (мс), startLabel и endLabel (\"HH:MM\"), status (\"past\", \"current\", \"future\" или \"unknown\"), progress (0..1), minutesLeft (идёт сейчас), minutesUntil (ещё не началось)",
            example: { css: "[data-test=\"student schedule slot\"] .skymod-card-slot {\n    position: absolute;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    height: 3px;\n    background: rgba(255, 255, 255, 0.12);\n}\n[data-test=\"student schedule slot\"] .skymod-card-slot i {\n    display: block;\n    height: 100%;\n    width: calc(var(--skymod-p, 0) * 100%);\n    background: var(--schedule-subject-accent, #ffffff);\n}\n[data-test=\"student schedule slot\"].skymod-is-current {\n    outline: 1px solid rgba(255, 255, 255, 0.45);\n}\n[data-test=\"student schedule slot\"].skymod-is-hover {\n    opacity: 0.7;\n}", html: "<i></i>", js: "api.onCards(cards => {\n    cards.forEach(c => {\n        api.card(c.id)\n            .toggleClass('current', c.status === 'current')\n            .setVar('p', c.progress);\n    });\n});\napi.onHover(c => api.card(c.id).addClass('hover'));\napi.onLeave(c => api.card(c.id).removeClass('hover'));" },
        },
        alsoApplyTo: {
            key: 'alsoCustomBlocks',
            label: 'Применять этот CSS и к своим блокам расписания',
            hint: 'Блоки, которые вы добавили в попапе (вкладка «Расписание» → «Свои блоки»). Селекторы карточки подменяются на селекторы блока: сама карточка (в том числе .card и .slot-box), название (.titles .subject) и время (.titles .time). Правила про иконку типа, кнопку открытия, состояния занятий (data-test-…) и прошедшие карточки к блокам не переносятся. Отдельный CSS только для блоков: часть «Свой блок в расписании», она применяется позже и перебивает перенесённый.',
        },
        scriptControlled: 'top, left, width и height у внешней обёртки .slot-box (div вокруг <app-schedule-slot-card>: сайт задаёт их инлайном по времени занятия, например top: 0px; height: 90px; left: 0%; width: 100%; сама обёртка position: absolute; z-index: 2; padding: 1px); height и grid-area у колонок дня',
        notes: [
            'Структура: .day-col > .slot-box > app-schedule-slot-card (display: block; height: 100%; container-type: size) > .card.',
            'Расширение SkyMod читает эти карточки, чтобы знать расписание: не переименовывай и не прячь data-атрибуты и кнопку .open.',
            "Наведение курсора (по CSS сайта): у обычных карточек (кроме -live-test и карточек с живой кнопкой) при :hover фон становится брендовым (var(--ds-color-background-brand)), поверх проявляется узор (псевдоэлемент .card::before с маской, opacity 0 → .6), название и его точка получают цвет brand-extralight, значок типа opacity .8; у прошедших при наведении пропадает выцветание. Правило сайта не !important, поэтому любой background из части его перебивает: если задаёшь фон, задай и вид при наведении ([data-test=\"student schedule slot\"]:hover { ... }), иначе наведение пропадёт. Прозрачность фона при наведении: background-color: rgba(var(--skymod-subject-rgb, 139, 124, 246), 0.35) (переменная --skymod-subject-rgb есть, пока включён «Свой цвет для каждого предмета»; без неё задай свой rgba). Прозрачность карточки целиком вместе с текстом: opacity. Чтобы правило перенеслось на свои блоки, не добавляй к селектору [data-test-subject] и другие data-test-…: такие правила на блоки не переносятся.",
            "Текст карточки: название (.subject), время (.time) и бейдж (.type-badge) имеют СВОИ color, font-family, font-size и letter-spacing, поэтому правило на самой карточке или на .head до них не доходит (работают только наследуемые свойства без собственного значения, например text-transform и text-decoration). Расширение само переносит color, font-family, font-size, font-weight, line-height и letter-spacing с карточки и .head на .subject и .time (парные правила inherit перед твоим CSS), так что такие правила работают, но точнее и надёжнее писать прямо на [data-test=\"student schedule slot\"] .titles .subject и .titles .time. Явные правила на .subject и .time всегда сильнее переноса.",
            "Цвет предмета задаёт класс -subject-N (по предмету) или -activity-N (по виду занятия, в тёмной теме светлее) через --schedule-subject-accent. Класс -live-test (живой тест) красит фон карточки брендовым цветом, -behind и -on-track меняют --schedule-card-background (оттенок отставания и «в графике»). У карточек с живой кнопкой (.live-action не -record) и у .meeting (ссылка на встречу) pointer-events: auto, а у карточки с .live-action padding-top и padding-bottom по 10px.",
            'Свои блоки, которые пользователь добавил в расписание (.skymod-custom-block), этим CSS не затрагиваются, пока в конструкторе не включена галочка «Применять этот CSS и к своим блокам расписания». Когда она включена, SkyMod сам подменяет селекторы: карточка ([data-test="student schedule slot"], .card, .slot-box) становится блоком, .titles .subject становится названием блока, .titles .time временем блока. Поэтому для того, что должно перейти на блоки, пиши свойства именно в этих селекторах, а не выдумывай .skymod-custom-block в этом CSS. Правила про .type-icon, .head, кнопку .open, состояния (data-test-card-state, data-test-activity-type и т.п.) и прошедшие карточки (-past) на блоки не переносятся. Отличия только для блоков пользователь пишет в отдельной части «Свой блок в расписании».',
        ],
        example:
            '[data-test="student schedule slot"] {\n' +
            '    border-radius: 18px !important;\n' +
            '    outline: 1px solid rgba(255, 255, 255, 0.12) !important;\n' +
            '    outline-offset: -1px !important;\n' +
            '}',
        request: 'карточка — сделай углы сильнее скруглёнными и добавь тонкую светлую обводку',
    },
    {
        id: 'custom-block',
        name: 'Свой блок в расписании',
        aliases: ['свой блок', 'кастомный блок', 'мой блок', 'блок расписания', 'своё событие'],
        page: 'Расписание ученика (блоки, добавленные в попапе SkyMod: вкладка «Расписание» → «Свои блоки»)',
        image: '',
        description:
            'Блок своего события на сетке расписания: цветная плашка с названием и временем. Рисует расширение SkyMod, на самом сайте такого элемента нет. ' +
            'Если время блока совпадает с занятием, он сжимается в узкую вертикальную полоску у правого края (класс -overlap).',
        elements: [
            {
                name: 'Блок',
                selector: '.skymod-custom-block',
                alt: '.skymod-custom-block.-compact',
                note: 'position: absolute; left: 1px; right: 1px; z-index: 3; display: flex (колонка); padding: 6px 10px; border-radius: 10px; border-left: 4px solid var(--skymod-cb-color); фон смешан из цвета блока (26%) и фона страницы через color-mix. Цвет блока лежит в переменной --skymod-cb-color (инлайном), она же доступна как --schedule-subject-accent. Варианты: -compact (высота меньше 44px: одна строка, padding: 2px 10px), -overlap (блок совпал с занятием: ширина 16px, вертикальный текст, сплошной цвет, у правого края).',
            },
            { name: 'Название', selector: '.skymod-custom-block .t', alt: '', note: 'font-weight: 700, обрезается многоточием (white-space: nowrap).' },
            { name: 'Время', selector: '.skymod-custom-block .m', alt: '', note: 'font-size: 12px, opacity: .7. В варианте -overlap скрыто.' },
            { name: 'Кнопка удаления (крестик)', selector: '.skymod-custom-block .x', alt: '', note: 'Показывается при наведении на блок (display: none → block), 20x20px, в варианте -overlap не показывается.' },
        ],
        behavior: {
            itemName: "свой блок расписания",
            layout: "Блок: position: absolute; display: flex (колонка); overflow: hidden; padding 6px 10px (вариант -compact: одна строка, padding 2px 10px; вариант -overlap: узкая полоска 16px с вертикальным текстом). Слот лежит последним потомком и по умолчанию встаёт строкой под названием и временем; чтобы позиционировать, дай ему position: absolute (блок позиционирован). Высота блока зависит от длительности (2px на минуту), у короткого блока места почти нет.",
            itemSelector: ".skymod-custom-block",
            fields: "id, title, color (hex блока), type (всегда \"custom\"), kind (всегда \"Своё\"), state (пусто), date (YYYY-MM-DD), start и end (мс), startLabel и endLabel (\"HH:MM\"), status (\"past\", \"current\", \"future\" или \"unknown\"), progress (0..1), minutesLeft, minutesUntil",
            example: { css: ".skymod-custom-block .skymod-card-slot {\n    position: absolute;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    height: 3px;\n    background: rgba(255, 255, 255, 0.12);\n}\n.skymod-custom-block .skymod-card-slot i {\n    display: block;\n    height: 100%;\n    width: calc(var(--skymod-p, 0) * 100%);\n    background: var(--skymod-cb-color);\n}\n.skymod-custom-block.skymod-is-current {\n    outline: 1px solid rgba(255, 255, 255, 0.45);\n}", html: "<i></i>", js: "api.onCards(cards => {\n    cards.forEach(c => {\n        api.card(c.id)\n            .toggleClass('current', c.status === 'current')\n            .setVar('p', c.progress);\n    });\n});" },
        },
        settings: [],
        scriptControlled: 'top и height у блока (задаются инлайном по времени блока и масштабу сетки) и --skymod-cb-color (цвет блока). Не меняй position, top, height, left, right без необходимости: блок уедет с нужного времени.',
        notes: [
            'У карточек занятий есть галочка «Применять этот CSS и к своим блокам расписания»: тогда CSS карточки переносится и на блоки. CSS этой части применяется позже и перебивает перенесённый, поэтому здесь можно задать блокам отличия.',
            'Блоки лежат прямо в колонке дня (.day-col > .skymod-custom-block).',
        ],
        example:
            '.skymod-custom-block {\n' +
            '    border-radius: 16px !important;\n' +
            '    border-left-width: 6px !important;\n' +
            '}\n' +
            '.skymod-custom-block .t {\n' +
            '    font-weight: 500 !important;\n' +
            '}',
        request: 'свой блок — сделай углы круглее, левую полоску толще, а название тоньше',
    },
    {
        id: 'schedule-popup',
        name: 'Окно занятия (по клику на карточку)',
        aliases: ['окно занятия', 'окно урока', 'попап урока', 'модалка', 'диалог занятия', 'подложка окна'],
        page: 'Расписание ученика: открывается по клику на карточку занятия, поверх всей страницы',
        image: 'img/parts/schedule-popup.png',
        description:
            'Всплывающее окно занятия: заголовок с типом и временем («Практика · 09:30-11:05»), крестик закрытия, ' +
            'список домашних заданий и долгов с кнопкой «Открыть». Появляется поверх страницы, фон за ним затемнён.',
        elements: [
            {
                name: 'Корень окна занятия',
                selector: '[data-test="student schedule slot popup"]',
                alt: 'app-schedule-slot-popup',
                note: 'Хост компонента app-schedule-slot-popup. Именно на нём компонент объявляет переменные фона диалога: --ds-dialog-default-backgroundColor, --ds-dialog-modal-backgroundColor, --ds-dialog-default-closeButtonColor (чтобы перебить, пиши с !important прямо на app-schedule-slot-popup).',
            },
            { name: 'Диалог (панель окна)', selector: 'app-schedule-slot-popup ds-dialog', alt: '', note: 'Компонент дизайн-системы. Боковой отступ задаёт --ds-dialog-sidePadding: 24px.' },
            { name: 'Оверлей диалога', selector: 'app-schedule-slot-popup ds-dialog-overlay', alt: '', note: 'Обёртка диалога на всю страницу.' },
            {
                name: 'Контейнер содержимого по центру',
                selector: 'app-schedule-slot-popup ds-dialog-overlay .container',
                alt: '',
                note: 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; max-height: 100%. Ширина окна ограничена переменной --ds-dialog-overlay-maxWidth (968px).',
            },
            { name: 'Панель окна (видимая карточка)', selector: '[data-test="student schedule slot popup"] ds-dialog-view > .root', alt: '', note: 'Ширина задана инлайном (640px), поэтому меняй width обычным свойством (SkyMod сам добавит !important). Цвет фона берётся из переменной --ds-dialog-backgroundColor, её надёжнее менять через --ds-dialog-default-backgroundColor на app-schedule-slot-popup.' },
            { name: 'Шапка окна', selector: '[data-test="student schedule slot popup"] header.header', alt: '', note: 'Внутри: плитка с иконкой, затем .header-text.' },
            { name: 'Плитка с иконкой типа занятия', selector: '[data-test="student schedule slot popup"] .tile', alt: '[data-test-activity-type]', note: '44x44, border-radius 13px, цвет иконки из --schedule-subject-accent; в тёмной теме фон плитки смешан из этого цвета с чёрным. Тип занятия лежит в атрибуте data-test-activity-type (например trainer).' },
            { name: 'Название предмета', selector: '[data-test="student schedule slot popup"] .subject', alt: '', note: 'Например «Математика».' },
            { name: 'Ссылка «Страница предмета →»', selector: '[data-test="student schedule slot popup"] [data-test="student schedule slot popup subject link"]', alt: '.subject-link', note: 'Кнопка без рамки; в тёмной теме цвет берётся из --ds-color-background-brand-medium.' },
            { name: 'Заголовок занятия', selector: '[data-test="student schedule slot popup"] .header-text .title', alt: '', note: 'Например «Тест. Элементы теории множеств. 1 часть».' },
            { name: 'Строка «Тип · время»', selector: '[data-test="student schedule slot popup"] .meta', alt: '', note: 'Например «Тренажёр · 11:10–12:45». font-size 13px.' },
            { name: 'Блок «Двигайся по порядку»', selector: '[data-test="student schedule slot catch-up"]', alt: '.catch-up', note: 'Внутри: заголовок [data-test="student schedule slot catch-up title"] и список ol.catch-up-list с шагами li.step.' },
            { name: 'Шаг в списке', selector: '[data-test="student schedule slot popup"] .catch-up-list .step', alt: '.row', note: 'Сетка из двух колонок: номер (.rung, 28px) и строка действия (кнопка .row).' },
            { name: 'Кнопка-строка шага', selector: '[data-test="student schedule slot catch-up row open"]', alt: '.row', note: 'Первый невыполненный шаг получает класс -first (жирный заголовок, жёлтая подпись и жёлтая кнопка). Атрибуты data-test-row-kind и data-test-row-activity задают тип, например test-prep.' },
            { name: 'Название шага', selector: '[data-test="student schedule slot popup"] .row-title', alt: '', note: 'font-size 18px.' },
            { name: 'Подпись шага', selector: '[data-test="student schedule slot popup"] .row-sub', alt: '', note: 'У первого шага (.row.-first) цвет берётся из --ds-color-text-warning.' },
            { name: 'Кнопка «Открыть →»', selector: '[data-test="student schedule slot popup"] .row-open', alt: '', note: 'У первого шага: padding 10px 18px, фон --ds-color-text-warning, чёрный текст в тёмной теме.' },
            { name: 'Кнопка закрытия (крестик)', selector: '[data-test="student schedule slot popup"] .close-button', alt: '', note: '40x40, цвет иконки из --ds-dialog-closeButtonColor.' },
            {
                name: 'Слой, в котором лежат все окна сайта',
                selector: '.cdk-overlay-container',
                alt: '.cdk-overlay-pane',
                note: 'Окно занятия рендерится НЕ внутри приложения, а в .cdk-overlay-container в конце <body> (Angular CDK), поэтому стили колонок, карточек и обёрток расписания на него не действуют. Внутри: .cdk-global-overlay-wrapper > .cdk-overlay-pane (position: static выставлен инлайном) > app-schedule-slot-popup. Правила для .cdk-overlay-container затронут и другие окна сайта, поэтому сужай их через :has([data-test="student schedule slot popup"]).',
            },
        ],
        settings: ['lessonPopupCustomize', 'lessonPopupBackdropBlur', 'lessonPopupBackdropDim', 'lessonPopupPanelEnabled', 'lessonPopupPanelColor', 'lessonPopupPanelOpacity'],
        scriptControlled: 'position у .cdk-overlay-pane (static, задаёт CDK инлайном) и всё, что CDK выставляет инлайном у .cdk-overlay-container, .cdk-global-overlay-wrapper и .cdk-overlay-pane',
        notes: [
            'В попапе SkyMod на вкладке «Расписание» блок «Окно занятия» делает без CSS: размытие и затемнение фона за окном, цвет и непрозрачность панели. Свой CSS из конструктора применяется ПОВЕРХ этих настроек.',
            'Размытие и затемнение фона за окном SkyMod рисует собственным слоем: .cdk-overlay-container:has([data-test="student schedule slot popup"])::before. Пока включена настройка «Размыть фон за окном занятия», родную подложку сайта (blur(16px) и фон #000000b8 на ds-dialog-overlay > .root внутри окна) SkyMod гасит, поэтому нулевое размытие даёт ровно нулевое. Если эта настройка выключена, подложка сайта остаётся как есть. Свой CSS-слой делай по тому же принципу: сначала погаси ds-dialog-overlay > .root, иначе размытия сложатся.',
            'Внутренности окна проверены по дампу страницы: данные в elements выше. Блоки «Двигайся по порядку» (.catch-up) и шаги (.step) показываются только когда у занятия есть невыполненные шаги, в другом состоянии окна их может не быть.',
        ],
        example:
            '/* Окно с размытой стеклянной панелью */\n' +
            'app-schedule-slot-popup {\n' +
            '    --ds-dialog-default-backgroundColor: rgba(20, 20, 26, 0.6) !important;\n' +
            '    --ds-dialog-modal-backgroundColor: rgba(20, 20, 26, 0.6) !important;\n' +
            '}\n' +
            '.cdk-overlay-container:has([data-test="student schedule slot popup"]) ds-dialog-overlay > .root {\n' +
            '    background: transparent !important;\n' +
            '    backdrop-filter: none !important;\n' +
            '}\n' +
            '.cdk-overlay-container:has([data-test="student schedule slot popup"])::before {\n' +
            '    content: "" !important;\n' +
            '    position: fixed !important;\n' +
            '    inset: 0 !important;\n' +
            '    pointer-events: none !important;\n' +
            '    background: rgba(0, 0, 0, 0.45) !important;\n' +
            '    backdrop-filter: blur(12px) !important;\n' +
            '}',
        request: 'окно занятия — сделай подложку сильно размытой и светлее, а панель окна полупрозрачной',
    },
];

// Общие правила для любого CSS по реальному сайту. Отдельно от списка частей,
// чтобы тот же набор попал и в промпт конкретной части, и в общий промпт
// ("часть, которой нет в списке").
const SKYMOD_SETTING_LABELS = {
    cardColor: "Цвет карточек",
    cardOpacity: "Насколько плотный цвет",
    cardReadable: "Читаемость на цветном фоне",
    cardReadableBrightText: "Белый текст на карточках",
    cardReadableStrength: "Сила подложки",
    lessonPopupBackdropBlur: "Размытие",
    lessonPopupBackdropDim: "Затемнение",
    lessonPopupCustomize: "Размыть фон за окном занятия",
    nowLineColor: "Цвет полоски",
    nowLineHidden: "Убрать полоску «сейчас»",
    scheduleCardColors: "Свой цвет для каждого предмета",
};

const SKYMOD_PART_CSS_RULES = [
    'Это CSS для РЕАЛЬНОЙ страницы сайта avatar.skyeng.ru, он применяется прямо к её интерфейсу (не в песочнице, не в iframe).',
    'Только валидный CSS: без JS, без обёртки <style>, без @import и внешних url() (картинки только data: URI).',
    'Используй только селекторы из списка ниже. Не используй атрибуты вида [_ngcontent-...], [_nghost-...], [ng-c...] и случайные хэш-классы: они меняются при каждом обновлении сайта и стили перестанут работать. Предпочитай атрибуты data-test, потом осмысленные классы.',
    'Писать !important вручную не нужно: SkyMod сам ставит его на каждое объявление и усиливает каждый селектор префиксом html:not(#skymod-boost), потому что сайт задаёт стили с высокой специфичностью (Angular добавляет атрибут к каждому селектору). Пиши обычные селекторы и обычные значения, без хаков со специфичностью. Исключения: корневые селекторы html и :root остаются корневыми; @keyframes, @font-face и @property вставляются как есть (в @keyframes !important не пиши: браузер игнорирует такие объявления); CSS-вложенность (&) не используй, она вставляется без усиления. Чтобы отключить усиление, допиши в CSS комментарий /* skymod:raw */: тогда !important нужно писать самому.',
    'Не переопределяй свойства, которые сайт выставляет сам скриптом (позиция, высота, transform): это ломает привязку элемента к данным. Какие именно, сказано в описании части.',
    'Не меняй pointer-events у элементов, где сайт поставил none, и не накрывай интерфейс невидимыми блоками: кнопки под ними перестанут нажиматься.',
    'Не прячь элементы (display: none, visibility: hidden, opacity: 0), если об этом не просили прямо. Если просят убрать кнопку чата поддержки, аватарку с кнопкой выхода, заголовок «Расписание», меню разделов или значок слева в шапке, CSS не нужен: в попапе SkyMod есть переключатели (вкладка «Удобство», раздел «Элементы сайта»). Скажи об этом вместо display: none.',
    'Всплывающие окна и диалоги сайта (например, окно занятия по клику на карточку) живут не внутри приложения, а в .cdk-overlay-container в конце <body> (Angular CDK). Стили колонок, обёрток и карточек расписания на них не действуют, а правила для самого .cdk-overlay-container затрагивают ВСЕ окна сайта: сужай их через :has([data-test="..."]) конкретного окна.',
    'Размытие и затемнение за окном занятия: родное blur(16px) и фон #000000b8 лежат на элементе ds-dialog-overlay > .root внутри самого окна. Если добавить своё размытие или затемнение поверх, они сложатся. Поэтому, когда пишешь своё, сначала погаси родное: .cdk-overlay-container:has([data-test="student schedule slot popup"]) ds-dialog-overlay > .root { background: transparent; backdrop-filter: none; }. Без CSS то же делает настройка в попапе «Размыть фон за окном занятия» (вкладка «Расписание», блок «Окно занятия»): пока она включена, SkyMod сам гасит родное и рисует своё по ползункам.',
    'Фон диалогов дизайн-системы задаётся переменными вида --ds-dialog-default-backgroundColor, которые компонент объявляет на своём хосте. Обычное :root { --ds-dialog-default-backgroundColor: ... } не сработает: переопределяй их на самом хосте компонента (например, app-schedule-slot-popup).',
    'Анимации: @keyframes с уникальным префиксом skymod-, предпочитай transform и opacity, избегай blur/filter на больших площадях: страница работает постоянно.',
    'Акцентный цвет сайта в SkyMod не настраивается. Нужный цвет пиши значением или бери цвет текущего урока (см. ниже).',
    'Цвет текущего урока (по расписанию) доступен как var(--skymod-lesson-color), а как тройка чисел для rgba() как var(--skymod-lesson-rgb), например rgba(var(--skymod-lesson-rgb), 0.4). Когда урока нет (после занятий, в свободный день), переменных нет, поэтому всегда пиши запасное значение: var(--skymod-lesson-color, #8a8f98), rgba(var(--skymod-lesson-rgb, 138, 143, 152), 0.4).',
    'Если задача решается готовой настройкой SkyMod, назови её вместо CSS: цвет, плотность и читаемость карточек, цвета предметов, полоска «сейчас», размытие и затемнение за окном занятия (вкладка «Расписание»); свои блоки в расписании (вкладка «Расписание», раздел «Свои блоки»); скрытие кнопки поддержки, аватарки с выходом, заголовка, меню и значка в шапке, защита от блокировки сайта (вкладка «Удобство»); напоминания в Telegram (вкладка «Telegram»). CSS нужен для того, чего в настройках нет.',
    'Если для задачи не хватает факта о вёрстке (неизвестный селектор, незнакомое свойство), НЕ выдумывай селекторы: прямо скажи, что именно нужно прислать (outerHTML элемента и блок Styles из DevTools).',
];

function skymodBuildPartPrompt(part) {
    const lines = [];
    lines.push('Ты пишешь CSS для расширения SkyMod: стиль ОДНОЙ части интерфейса сайта avatar.skyeng.ru (Skyeng/Skypro). Результат вставляется в поле «Части интерфейса сайта» конструктора SkyMod.');
    lines.push('');
    lines.push('Часть интерфейса: ' + part.name + '.');
    lines.push('Как её называет пользователь: ' + part.aliases.join(', ') + '.');
    lines.push('Где находится: ' + part.page + '.');
    lines.push('Что это: ' + part.description);
    lines.push('');
    lines.push('Элементы (используй именно эти селекторы):');
    part.elements.forEach(el => {
        let line = '- ' + el.name + ': ' + el.selector;
        if (el.alt) line += ' (запасной вариант: ' + el.alt + ')';
        lines.push(line);
        if (el.note) lines.push('    Известно о стилях сайта: ' + el.note);
    });
    lines.push('');
    if (part.scriptControlled) {
        lines.push('Управляется скриптом сайта и НЕ подлежит переопределению: ' + part.scriptControlled + '.');
    }
    (part.notes || []).forEach(n => lines.push('Примечание: ' + n));
    const overridden = (part.settings || []).map(k => SKYMOD_SETTING_LABELS[k]).filter(Boolean);
    if (overridden.length) {
        lines.push('Пока эта часть включена в конструкторе, настройки попапа «' + overridden.join('», «') + '» для неё не действуют: твой CSS их заменяет. Если хватает этих настроек, посоветуй их.');
    }
    if (part.behavior) {
        lines.push('У этой части кроме CSS есть вкладки HTML и JS (поведение): HTML это шаблон, вставляемый в каждый элемент (' + part.behavior.itemName + '), JS управляет им через api и ставит на элемент классы .skymod-is-имя, переменные --skymod-имя, атрибуты data-skymod-имя; слот шаблона это .skymod-card-slot. CSS сам не умеет считать время, показывать прогресс или запоминать состояние. Если задача про такое, скажи, что нужны вкладки HTML и JS, и что для них в конструкторе есть отдельная кнопка промпта «Скопировать промпт для ИИ: HTML и JS». Ничего из этого не выдумывай.');
    }
    if (part.alsoApplyTo) {
        lines.push('Галочка в конструкторе у этой части: «' + part.alsoApplyTo.label + '». ' + part.alsoApplyTo.hint);
    }
    lines.push('');
    lines.push('Правила:');
    SKYMOD_PART_CSS_RULES.forEach(r => lines.push('- ' + r));
    lines.push('');
    lines.push('Пример рабочего результата:');
    lines.push(part.example);
    lines.push('');
    lines.push('Формат ответа: ОДИН css-блок без пояснений внутри (только рабочий код), пояснения отдельным текстом до или после блока. В начале ответа явно напиши, что блок предназначен для поля «Части интерфейса сайта → ' + part.name + '».');
    lines.push('');
    lines.push('Вот что я хочу: <опишите своими словами, что нужно, например: ' + part.request + '>');
    return lines.join('\n');
}

// Промпт для поведения (HTML и JS) части, у которой есть behavior: карточки занятий
// и свои блоки. Опирается на реальные ограничения content.js и песочницы.
function skymodBuildBehaviorPrompt(part) {
    const b = part.behavior;
    const lines = [];
    lines.push('Ты пишешь HTML, CSS и JS для расширения SkyMod: поведение одной части интерфейса сайта avatar.skyeng.ru (Skyeng/Skypro). Результат вставляется в три вкладки (CSS, HTML, JS) у части «' + part.name + '» в конструкторе SkyMod, режим «Сайт» → «Части интерфейса сайта».');
    lines.push('');
    lines.push('Часть: ' + part.name + '. Элемент, к которому привязано поведение: ' + b.itemName + ', селектор ' + b.itemSelector + '.');
    lines.push('');
    lines.push('КАК ЭТО РАБОТАЕТ');
    lines.push('- HTML это шаблон. SkyMod вставляет его в КАЖДЫЙ такой элемент последним потомком: <div class="skymod-card-slot" data-skymod-part="' + part.id + '">...</div>. У слота pointer-events: none (клик по элементу работает как обычно). Подстановки: {{имя}} (экранируются), доступны поля элемента (см. ниже). Шаблон очищается: теги script, style, iframe, link, form, input, button и подобные, атрибуты on*, внешние ссылки и картинки (разрешены только data:image/ и #) вырезаются.');
    lines.push('- Для текста, который меняет JS, в HTML делай слот: <span data-skymod-slot="left"></span>, JS заполняет его через .setText("left", "...").');
    lines.push('- JS это ТЕЛО функции с единственным аргументом api (не оборачивай в function). Он выполняется в изолированной песочнице: у него НЕТ доступа к DOM сайта, к document, window страницы, chrome.*, сети и внешним скриптам. Всё, что JS может, это читать данные элементов и отправлять команды через api. Команды применяет SkyMod, предварительно проверив имена и значения.');
    lines.push('- CSS стилизует слот и реагирует на то, что поставил JS: классы .skymod-is-<имя>, переменные var(--skymod-<имя>), атрибуты [data-skymod-<имя>="значение"] на самом элементе.');
    lines.push('');
    lines.push('ПОЛЯ ЭЛЕМЕНТА (в {{...}} и в объектах api): ' + b.fields + '.');
    lines.push('');
    lines.push('РАСКЛАДКА: ' + b.layout);
    lines.push('');
    lines.push('ПРЕДПРОСМОТР: пользователь видит результат в живом предпросмотре слева в конструкторе: три занятия (прошедшее, идущее, будущее) и, где уместно, три своих блока; наведение и клик там тоже работают. Проверяй код мысленно на всех статусах: past, current, future (если даты нет, status равен "unknown").');
    lines.push('');
    lines.push('ПЕРЕРИСОВКА: подстановки {{...}} пересобирают слот целиком, когда меняется результат (например, каждую минуту при {{minutesLeft}}): вложенные элементы создаются заново, анимации и переходы внутри слота сбрасываются. Для часто меняющихся значений делай в HTML слот-заглушку и обновляй её через .setText(...), а {{...}} используй для редких (название, время начала).');
    lines.push('');
    lines.push('API (весь доступный интерфейс, другого нет)');
    lines.push('- api.onCards(cards => {...}): вызывается при каждом обновлении списка (примерно раз в 15 секунд и при изменениях на странице); cards это массив объектов с полями выше. Читай поля прямо здесь, список всегда актуальный.');
    lines.push('- api.onHover(card => {...}), api.onLeave(card => {...}), api.onClick(card => {...}): курсор вошёл на элемент, вышел, клик. Клик только сообщается, отменить открытие нельзя.');
    lines.push('- api.card(id) возвращает управляющий объект, методы цепочкой: .addClass(имя), .removeClass(имя), .toggleClass(имя, включить), .setVar(имя, значение), .setData(имя, значение), .setText(слот, текст), .reset(). Имена только из строчных латинских букв, цифр и дефиса (начинаются с буквы, до 40 символов). Значения: числа или строки до 120 символов без ; { } < > url( и @import. Текст слота до 200 символов.');
    lines.push('- api.get(id) возвращает данные элемента, api.cards это текущий массив.');
    lines.push('- api.storage.get(ключ), .set(ключ, значение), .remove(ключ): сохранение данных, все три возвращают Promise.');
    lines.push('- api.log(...) и console.log пишут в консоль на вкладке «JS» конструктора и в консоль сайта.');
    lines.push('- Команды применяются через небольшую задержку, и состояние сохраняется между обновлениями списка: класс, поставленный один раз, остаётся, пока его не уберёшь. Поэтому в onCards всегда задавай состояние полностью (toggleClass с условием, setVar с текущим значением), а не только включай.');
    lines.push('');
    lines.push('Элементы части (селекторы для CSS):');
    part.elements.forEach(el => lines.push('- ' + el.name + ': ' + el.selector));
    lines.push('');
    lines.push('Правила для CSS:');
    SKYMOD_PART_CSS_RULES.forEach(r => lines.push('- ' + r));
    lines.push('');
    lines.push('Правила для HTML и JS:');
    lines.push('- Не придумывай методы api, поля элемента и события, которых нет в списке выше. Если для задачи чего-то не хватает, скажи, чего именно.');
    lines.push('- Не используй setInterval и setTimeout для перерисовки: список приходит сам. Таймеры допустимы только для отложенных действий.');
    lines.push('- Не меняй позицию, размеры и pointer-events самого элемента: они зависят от времени занятия и от кликабельности карточки. Слот можно позиционировать (position: absolute внутри элемента).');
    lines.push('- Не используй комментарии-разделители вида // ------ и эмодзи.');
    lines.push('');
    lines.push('Пример рабочего результата.');
    lines.push('CSS:');
    lines.push(b.example.css);
    lines.push('HTML:');
    lines.push(b.example.html);
    lines.push('JS:');
    lines.push(b.example.js);
    lines.push('');
    lines.push('Формат ответа: три отдельных блока кода с подписями CSS, HTML, JS (в этом порядке), каждый готов к вставке в свою вкладку без правок. Если вкладка не нужна, так и напиши. Одной строкой перед блоками: что именно делает результат.');
    lines.push('');
    lines.push('Вот что я хочу: <опишите своими словами, например: на карточке идущего занятия показывать полоску прогресса и сколько минут осталось, а прошедшие занятия делать бледнее>');
    return lines.join('\n');
}

// Общий промпт для элемента, которого пока нет в реестре: человек сам
// приносит outerHTML и блок Styles из DevTools.
function skymodBuildGenericPartPrompt() {
    const lines = [];
    lines.push('Ты пишешь CSS для расширения SkyMod: стиль одного элемента сайта avatar.skyeng.ru (Skyeng/Skypro).');
    lines.push('');
    lines.push('Ниже я пришлю: (1) outerHTML нужного элемента и его ближайших родителей, (2) скриншот или текст блока Styles этого элемента из DevTools, (3) словами, что хочу изменить.');
    lines.push('');
    lines.push('Правила:');
    SKYMOD_PART_CSS_RULES.forEach(r => lines.push('- ' + r));
    lines.push('- Для произвольных элементов доступен только CSS. HTML и JS (поведение) есть лишь у двух частей реестра: карточек занятий и своих блоков расписания; если просят логику для другого элемента, так и скажи.');
    lines.push('- Селектор строй сам по присланному HTML: сначала data-test, затем стабильный класс. Свойства, которые видны инлайном в style="..." (top, height, left, transform и т.п.), считай управляемыми скриптом сайта и не переопределяй.');
    lines.push('');
    lines.push('Формат ответа: ОДИН css-блок без пояснений внутри, пояснения отдельным текстом. В начале ответа напиши, какой селектор ты выбрал и почему он стабильный.');
    lines.push('');
    lines.push('Вот мои данные: <вставьте outerHTML, скриншот Styles и опишите, что нужно>');
    return lines.join('\n');
}


// Самодостаточный промпт для фона сайта (поля HTML/CSS/JS в режиме "Сайт").
// Не ссылается на другие разделы: его можно копировать отдельно. Правила
// собраны из реальных багов (белый фон под холстом, нулевой размер на старте,
// мышь только через "Взаимодействие с курсором").
const SKYMOD_SITE_BG_PROMPT = [
    'Ты помогаешь написать анимированный фон для расширения SkyMod (Chrome-расширение для сайта avatar.skyeng.ru, Skyeng/Skypro). Результат вставляется в три поля конструктора, режим "Сайт", секция "Песочница фона сайта": HTML, CSS и JS.',
    '',
    'ГДЕ ЭТО РАБОТАЕТ',
    '- Код живёт в изолированном iframe, который расширение кладёт на весь экран страницы сайта (position: fixed, 100% x 100%). Слой выбирает пользователь: "Под интерфейсом сайта" (как фон, интерфейс остаётся сверху) или "Поверх всего".',
    '- Фон iframe ПРОЗРАЧНЫЙ. Под ним реальная страница сайта. Сайт в основном тёмный, поэтому фон должен выглядеть хорошо за карточками и не мешать читать текст: умеренная яркость, без резких вспышек и мерцания на весь экран.',
    '- Это отдельный документ: никакой доступ к DOM сайта, к chrome.*, к внешним скриптам, шрифтам и картинкам по ссылкам нет. Только чистые JS, Canvas, SVG, CSS в пределах моего HTML. Картинки только как data: URI или нарисованные в canvas.',
    '',
    'ФОРМАТ КОДА',
    '- HTML: только разметка внутри root (без <html>, <head>, <body>, без <script>). Обычно один <canvas id="bg"></canvas> либо набор div/svg.',
    '- CSS: обычный CSS для моего HTML. html и body уже прозрачные, с нулевыми отступами и overflow: hidden. Для полноэкранного холста: #bg { position: fixed; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; } z-index на холсте не нужен.',
    '- JS: это ТЕЛО функции, а не файл и не готовая функция. Не оборачивай в function(...) { ... }. Доступны аргументы: root (DOM-элемент с моим HTML), canvas (первый <canvas> из HTML или null), storage ({ get, set, remove }, все три возвращают Promise, данные сохраняются), theme ({ accent }: фиксированный запасной акцент #8b7cf6, пользователь его не настраивает; также window.SKYMOD_THEME), schedule (расписание уроков, см. раздел РАСПИСАНИЕ ниже; также window.SKYMOD_SCHEDULE). Если canvas нет, ищи элементы через root.querySelector(...).',
    '- ОБЯЗАТЕЛЬНО верни функцию очистки в конце: return () => { ... }, которая останавливает requestAnimationFrame / setInterval / setTimeout и снимает все addEventListener. Иначе при повторном применении старая анимация продолжит работать параллельно с новой.',
    '- console.log / warn / error попадают в мою панель "Консоль", ошибки показывает "Отладчик" с номером строки: ничего специально ловить не нужно.',
    '',
    'ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА (нарушение любого ломает результат на сайте, хотя в предпросмотре конструктора всё выглядит нормально)',
    '1. ВСЕГДА рисуй собственный непрозрачный фон. Предпросмотр стоит на тёмной подложке, а на сайте под холстом белая страница. Свечения, частицы и линии с низкой альфой, режим globalCompositeOperation = "lighter" на белом почти не видны. Каждый кадр начинай с ctx.fillStyle = "#цвет"; ctx.fillRect(0, 0, W, H) вместо одного clearRect (или задай background у холста/корня в CSS). Не полагайся на фон предпросмотра.',
    '2. Размер на старте может быть НУЛЕВЫМ и может меняться. Размер бери из window.innerWidth / window.innerHeight (не из clientWidth). Никогда не расставляй объекты (частицы, звёзды, капли) в абсолютных пикселях один раз на старте: храни координаты в долях 0..1 и умножай на текущие W/H при отрисовке, либо при каждом resize масштабируй старые позиции (а если прошлый размер был 0, создавай заново). Количество объектов считай с запасным минимумом. В начале кадра, если W или H равны 0, пересчитай размер и пропусти кадр. Подписывайся на window "resize".',
    '3. devicePixelRatio ограничь двумя: dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0). Рисуй в CSS-пикселях (W x H).',
    '4. Мышь. По умолчанию код фона мышь НЕ получает. Если у пользователя включено "Взаимодействие с курсором", на window приходят обычные события mousemove, mousedown, mouseup, click, mouseleave (e.clientX / e.clientY / e.buttons), при любом слое и без блокировки кликов по сайту. Слушай их через window.addEventListener. Кнопки и поля ввода внутри самого фона кликать нельзя: фон только следит за курсором. Если анимация использует мышь, сделай так, чтобы без неё (курсор не двигался) она тоже выглядела нормально, и в ответе напомни мне включить "Взаимодействие с курсором".',
    '5. Производительность. Фон работает постоянно на каждой вкладке сайта. Держи число объектов разумным (десятки-сотни), избегай O(n^2) на больших n, тяжёлых blur/filter на весь экран и shadowBlur в большом количестве. Предпочитай transform и opacity, а в canvas один проход на кадр. Время считай по ts из requestAnimationFrame (dt), а не по числу кадров.',
    '6. Цвета: theme.accent на сайте всегда равен #8b7cf6 и от пользователя не зависит, поэтому не называй его "акцентом пользователя". Если фон должен подстраиваться под занятия, бери schedule.color (цвет текущего или ближайшего урока) и всегда задавай запасной цвет (например, theme.accent) на случай, когда расписания нет.',
    '7. Не используй localStorage, sessionStorage, document.cookie: для сохранения есть storage.get/set.',
    '',
    'РАСПИСАНИЕ (аргумент schedule)',
    '- schedule это ЖИВОЙ объект: ссылка на него не меняется, расширение обновляет поля на месте примерно каждые 15 секунд. Читай поля прямо в кадре анимации (schedule.phase, schedule.current...) и не копируй объект один раз на старте. Для реакции на смену урока есть событие window "skymod-schedule" (e.detail это тот же объект).',
    '- Поля: ready (boolean, есть ли расписание на сегодня), phase ("free" нет занятий, "before" до первого, "lesson" идёт урок, "break" перерыв, "after" после последнего), color (hex цвета, под который подстраивается тема: на уроке цвет урока, до начала и в перерыве цвет ближайшего следующего, иначе null), dayProgress (0..1 или null: сколько прошло от начала первого до конца последнего занятия), remaining (сколько занятий ещё не закончилось), now (мс), date ("YYYY-MM-DD").',
    '- current (идущий урок или null): { subject (код предмета, например "algorithms"), title (название), type, state, start, end (мс), startLabel, endLabel ("HH:MM"), durationMin, color (hex), progress (0..1), minutesLeft }. next (ближайший следующий или null): те же поля плюс minutesUntil. previous (последний закончившийся или null). lessons: массив всех занятий сегодня по времени, у каждого те же поля, кроме progress, minutesLeft и minutesUntil.',
    '- Свои блоки, которые пользователь добавил в расписание через SkyMod, в schedule не входят: там только занятия сайта.',
    '- Расписание берётся со страницы расписания сайта и сохраняется, поэтому работает и на других страницах. Если пользователь ещё ни разу не открывал расписание или сегодня занятий нет, ready === false, phase === "free", current и next равны null: ВСЕГДА предусматривай этот случай и запасной цвет (например, нейтральный или theme.accent), фон не должен ломаться или становиться пустым без расписания.',
    '- Цвет урока плавно подтягивай к целевому (lerp по кадрам), а не переключай рывком: смена предмета не должна дёргать картинку. Поля, которых нет в этом описании, не выдумывай.',
    '',
    'КАРКАС (бери за основу, меняй только отрисовку)',
    'const cvs = canvas;',
    'if (!cvs) { console.error("canvas не найден"); return () => {}; }',
    'const ctx = cvs.getContext("2d");',
    'let W = 0, H = 0, dpr = 1;',
    'const items = [];            // координаты храни в долях 0..1: { x: 0..1, y: 0..1, ... }',
    'function resize() {',
    '  dpr = Math.min(window.devicePixelRatio || 1, 2);',
    '  W = window.innerWidth; H = window.innerHeight;',
    '  cvs.width = Math.floor(W * dpr); cvs.height = Math.floor(H * dpr);',
    '  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);',
    '}',
    'resize();',
    'window.addEventListener("resize", resize);',
    'let raf = 0, last = 0;',
    'function loop(ts) {',
    '  if (W === 0 || H === 0) { resize(); raf = requestAnimationFrame(loop); return; }',
    '  const dt = Math.min(2, (ts - last) / 16.67 || 1); last = ts;',
    '  ctx.fillStyle = "#0c0c14"; ctx.fillRect(0, 0, W, H);   // свой непрозрачный фон',
    '  // ...отрисовка: x = item.x * W, y = item.y * H...',
    '  raf = requestAnimationFrame(loop);',
    '}',
    'raf = requestAnimationFrame(loop);',
    'return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };',
    '',
    'ФОРМАТ ТВОЕГО ОТВЕТА',
    '- Три отдельных блока кода с подписями: HTML, CSS, JS (в этом порядке), каждый готов к вставке в своё поле без правок. В JS нет обёртки function и нет комментариев-разделителей вида // ------.',
    '- Одной строкой перед блоками: какой слой выбрать (под интерфейсом или поверх) и нужно ли включать "Взаимодействие с курсором".',
    '- Если чего-то не хватает для задачи, спроси одним вопросом, а не выдумывай.',
    '',
    'Вот что я хочу: <опишите своими словами, какой фон нужен: цвета, движение, настроение, реакция на мышь>',
].join('\n');
