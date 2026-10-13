const $ = sel => document.querySelector(sel);

let pending = null;

function setStatus(text, kind) {
    const el = $('#status');
    el.textContent = text;
    el.className = kind || '';
}

function resetImportUi() {
    pending = null;
    $('#category-list').innerHTML = '';
    $('#confirm-row').hidden = true;
}

function renderCategories(settings) {
    const list = $('#category-list');
    list.innerHTML = '';
    SETTINGS_CATEGORIES.forEach(cat => {
        const hasAny = cat.keys.some(k => Object.prototype.hasOwnProperty.call(settings, k));
        const row = document.createElement('label');
        row.className = 'modal-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.cat = cat.id;
        checkbox.checked = hasAny;
        checkbox.disabled = !hasAny;

        const textWrap = document.createElement('span');
        textWrap.className = 'modal-row-text';
        const title = document.createElement('span');
        title.className = 'modal-row-title';
        title.textContent = cat.title;
        const desc = document.createElement('span');
        desc.className = 'modal-row-desc';
        desc.textContent = hasAny ? cat.desc : 'В файле нет данных этой категории';

        textWrap.appendChild(title);
        textWrap.appendChild(desc);
        row.appendChild(checkbox);
        row.appendChild(textWrap);
        list.appendChild(row);
    });
    $('#confirm-row').hidden = false;
}

$('#export-btn').addEventListener('click', async () => {
    try {
        await skymodExportAllToFile();
        setStatus('Файл скачан.', 'ok');
    } catch (err) {
        setStatus('Не удалось экспортировать: ' + err.message, 'err');
    }
});

$('#import-btn').addEventListener('click', () => $('#import-input').click());

$('#import-input').addEventListener('change', () => {
    const file = $('#import-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const payload = JSON.parse(reader.result);
            if (!payload || typeof payload !== 'object' || !payload.settings) {
                throw new Error('это не файл экспорта настроек SkyMod');
            }
            pending = payload.settings;
            renderCategories(pending);
            setStatus('', '');
        } catch (err) {
            resetImportUi();
            setStatus('Не удалось прочитать файл: ' + err.message, 'err');
        }
    };
    reader.readAsText(file);
    $('#import-input').value = '';
});

$('#cancel-btn').addEventListener('click', () => {
    resetImportUi();
    setStatus('', '');
});

$('#confirm-btn').addEventListener('click', async () => {
    if (!pending) return;
    const checked = [...document.querySelectorAll('#category-list input[type="checkbox"]:checked')].map(cb => cb.dataset.cat);
    if (!checked.length) {
        setStatus('Ничего не выбрано.', 'err');
        return;
    }
    const toWrite = {};
    SETTINGS_CATEGORIES.forEach(cat => {
        if (!checked.includes(cat.id)) return;
        cat.keys.forEach(k => {
            if (Object.prototype.hasOwnProperty.call(pending, k)) toWrite[k] = pending[k];
        });
    });
    try {
        await chrome.storage.local.set(toWrite);
        resetImportUi();
        setStatus('Готово: импортировано ' + Object.keys(toWrite).length + ' параметров. Откройте попап заново, а вкладки сайта обновятся сами.', 'ok');
    } catch (err) {
        setStatus('Не удалось сохранить: ' + err.message, 'err');
    }
});
