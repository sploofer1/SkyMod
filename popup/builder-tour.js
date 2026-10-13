// Быстрое обучение по конструктору: затемнённый экран, подсвеченный элемент и
// карточка с пояснением. Запускается один раз при первом входе (флаг
// builderTourDone в chrome.storage) и повторно кнопкой «Обучение» в шапке.
//
// Подключается ДО builder.js. Использует его глобальные setMode() и $().
// Шаги описаны данными: чтобы добавить шаг, добавьте объект в BUILDER_TOUR_STEPS.
//   mode:   'popup' | 'site' | null: в какой режим переключиться перед шагом
//   target: CSS-селектор подсвечиваемого элемента (нет элемента или он скрыт —
//           карточка показывается по центру)

const BUILDER_TOUR_STEPS = [
    {
        mode: null, target: null,
        title: 'Добро пожаловать в конструктор SkyMod',
        text: 'Здесь вы делаете свой фон и стили элементов сайта и попапа. Обучение займёт минуту. Его можно пропустить и открыть снова кнопкой <b>«Обучение»</b> вверху.',
    },
    {
        mode: null, target: '.mode-switch',
        title: 'Два режима',
        text: '<b>«Попап»</b> оформляет окно самого расширения. <b>«Сайт»</b> работает прямо на avatar.skyeng.ru: свой фон и стили отдельных элементов. Всё ниже зависит от выбранного режима.',
    },
    {
        mode: 'site', target: '#status-bar',
        title: 'Главное: включено или нет',
        text: 'Эта строка показывает, что <b>работает</b> (зелёная), что <b>выключено</b> (красная) и что <b>написано, но не применяется</b> (жёлтая). Кнопка справа включает и выключает. Вкладку сайта обновлять не нужно, всё применяется сразу.',
    },
    {
        mode: 'site', target: '#parts-block .steps',
        title: 'Части интерфейса: 4 шага',
        text: 'Так вы меняете отдельные элементы сайта, например полоску «сейчас» или карточки: выбираете часть, копируете готовый промпт, отправляете ИИ вместе с описанием и вставляете CSS из ответа.',
    },
    {
        mode: 'site', target: '#part-select',
        title: 'Выберите часть',
        text: 'Скриншот и название подскажут, что это за элемент. Те же слова (<b>«лазер»</b>, <b>«карточка»</b>) вы пишете ИИ, чтобы он понял, о чём речь.',
    },
    {
        mode: 'site', target: '#part-copy-prompt',
        title: 'Промпт для ИИ',
        text: 'Один клик копирует готовый промпт: в нём уже есть селекторы и правила. Вставьте его в любой ИИ-чат и в конце допишите, что хотите, например <b>«лазер — сделай розовым»</b>.',
    },
    {
        mode: 'site', target: '#part-css',
        title: 'Сюда вставьте CSS из ответа',
        text: 'Как только вы вставите код, часть <b>включится сама</b>. Если такая же настройка есть в попапе, она заблокируется значком <b>i</b>: управлять одним элементом из двух мест нельзя.',
    },
    {
        mode: 'site', target: '#site-example-select',
        title: 'Свой анимированный фон',
        text: 'Ниже песочница фона сайта. Выберите пример и нажмите <b>«Вставить пример»</b> либо возьмите промпт для ИИ. Затем нажмите <b>«Включить»</b> в строке состояния: фон не появится, пока он выключен.',
    },
    {
        mode: 'popup', target: '#preset-save',
        title: 'Пресеты',
        text: 'Сохраняйте удачные варианты и возвращайтесь к ним в один клик. У режима «Сайт» пресеты свои: они сохраняют фон вместе с CSS частей интерфейса.',
    },
    {
        mode: null, target: '#all-export',
        title: 'Резервная копия',
        text: '«Экспорт всех настроек» сохраняет всё одним файлом. То же есть в попапе на вкладке «Ещё», а импорт позволяет выбрать, что именно вернуть.',
    },
    {
        mode: null, target: 'a.topbar-link[href="docs.html"]',
        title: 'Документация и база промптов',
        text: 'Там готовые промпты, описание всех частей интерфейса и расписания. Это всё, дальше вы сами. Обучение всегда можно открыть заново кнопкой <b>«Обучение»</b>.',
    },
];

let tourState = null;

function tourIsVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[hidden]');
}

function tourFinish(markDone) {
    if (!tourState) return;
    const { root, startMode, onKey, onResize } = tourState;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
    root.remove();
    tourState = null;
    if (typeof setMode === 'function' && startMode) setMode(startMode);
    if (markDone) chrome.storage.local.set({ builderTourDone: true }).catch(() => {});
}

function tourPlace() {
    if (!tourState) return;
    const step = BUILDER_TOUR_STEPS[tourState.index];
    const spot = tourState.spot;
    const card = tourState.card;
    const target = step.target ? document.querySelector(step.target) : null;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = card.offsetWidth;
    const cardH = card.offsetHeight;

    if (!tourIsVisible(target)) {
        spot.classList.add('center');
        spot.style.cssText = 'left:50%;top:50%;width:0;height:0;';
        card.style.left = Math.max(margin, (vw - cardW) / 2) + 'px';
        card.style.top = Math.max(margin, (vh - cardH) / 2) + 'px';
        return;
    }

    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.classList.remove('center');
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';

    // Карточка: под элементом, если помещается; иначе над; иначе сбоку; иначе по центру.
    let left = Math.min(Math.max(margin, r.left), vw - cardW - margin);
    let top;
    if (r.bottom + pad + 16 + cardH <= vh - margin) top = r.bottom + pad + 16;
    else if (r.top - pad - 16 - cardH >= margin) top = r.top - pad - 16 - cardH;
    else if (r.right + pad + 16 + cardW <= vw - margin) { left = r.right + pad + 16; top = Math.min(Math.max(margin, r.top), vh - cardH - margin); }
    else if (r.left - pad - 16 - cardW >= margin) { left = r.left - pad - 16 - cardW; top = Math.min(Math.max(margin, r.top), vh - cardH - margin); }
    else { left = Math.max(margin, (vw - cardW) / 2); top = Math.max(margin, (vh - cardH) / 2); }
    card.style.left = left + 'px';
    card.style.top = top + 'px';
}

function tourShow(index) {
    if (!tourState) return;
    tourState.index = index;
    const step = BUILDER_TOUR_STEPS[index];
    if (step.mode && typeof setMode === 'function') setMode(step.mode);

    const last = index === BUILDER_TOUR_STEPS.length - 1;
    const card = tourState.card;
    card.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = step.title;
    const p = document.createElement('p');
    p.innerHTML = step.text; // тексты шагов заданы в этом файле, пользовательских данных тут нет

    const dots = document.createElement('div');
    dots.className = 'tour-dots';
    BUILDER_TOUR_STEPS.forEach((_, i) => {
        const dot = document.createElement('i');
        if (i === index) dot.className = 'on';
        dots.appendChild(dot);
    });

    const foot = document.createElement('div');
    foot.className = 'tour-foot';
    const progress = document.createElement('span');
    progress.className = 'tour-progress';
    progress.textContent = (index + 1) + ' из ' + BUILDER_TOUR_STEPS.length;
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'tour-btn-skip';
    skip.textContent = last ? '' : 'Пропустить';
    skip.hidden = last;
    skip.addEventListener('click', () => tourFinish(true));
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'tour-btn-prev';
    prev.textContent = 'Назад';
    prev.disabled = index === 0;
    prev.addEventListener('click', () => tourShow(index - 1));
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tour-btn-next';
    next.textContent = last ? 'Готово' : (index === 0 ? 'Начать' : 'Далее');
    next.addEventListener('click', () => (last ? tourFinish(true) : tourShow(index + 1)));
    foot.append(progress, skip, prev, next);

    card.append(h, p, dots, foot);

    // Режим только что переключён: даём браузеру отрисовать нужные блоки.
    requestAnimationFrame(() => {
        const target = step.target ? document.querySelector(step.target) : null;
        if (tourIsVisible(target)) target.scrollIntoView({ block: 'center', behavior: 'instant' });
        requestAnimationFrame(tourPlace);
    });
    next.focus();
}

function startBuilderTour() {
    if (tourState) return;
    const active = document.querySelector('.mode-btn.active');
    const root = document.createElement('div');
    root.id = 'tour-root';
    const block = document.createElement('div');
    block.id = 'tour-block';
    const spot = document.createElement('div');
    spot.id = 'tour-spot';
    const card = document.createElement('div');
    card.id = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    root.append(block, spot, card);
    document.body.appendChild(root);

    const onKey = e => {
        if (!tourState) return;
        if (e.key === 'Escape') { e.preventDefault(); tourFinish(true); }
        else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            if (tourState.index >= BUILDER_TOUR_STEPS.length - 1) tourFinish(true);
            else tourShow(tourState.index + 1);
        } else if (e.key === 'ArrowLeft' && tourState.index > 0) {
            e.preventDefault();
            tourShow(tourState.index - 1);
        }
    };
    const onResize = () => tourPlace();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    tourState = { root, spot, card, index: 0, startMode: active ? active.dataset.mode : 'popup', onKey, onResize };
    tourShow(0);
}
