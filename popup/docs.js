// SkyMod docs.html — копирование готового промпта для ИИ в буфер обмена.
// Обычная страница расширения (не sandbox), поэтому CSP требует внешний
// файл — инлайновый <script> или onclick="" здесь были бы заблокированы.

const btn = document.getElementById('copy-prompt-btn');
const block = document.getElementById('ai-prompt-block');

btn.addEventListener('click', async () => {
    const text = block.textContent;
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        // Клипборд недоступен (редкость для расширения) — резервный способ
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) { /* совсем ничего не поделать — пусть выделяет и копирует руками */ }
        document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.textContent = 'Скопировано ✓';
    btn.classList.add('copied');
    setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
    }, 1800);
});


// ---------- Части интерфейса сайта (данные из parts.js) ----------

function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) { /* копирование недоступно */ }
        document.body.removeChild(ta);
    }
}

function flashCopied(button) {
    const original = button.textContent;
    button.textContent = 'Скопировано';
    button.classList.add('copied');
    setTimeout(() => {
        button.textContent = original;
        button.classList.remove('copied');
    }, 1600);
}

if (typeof SKYMOD_PARTS !== 'undefined') {
    // 1. Карточки частей в разделе документации.
    const list = document.getElementById('parts-list');
    if (list) {
        SKYMOD_PARTS.forEach(part => {
            const card = document.createElement('div');
            card.className = 'card part-card';
            card.innerHTML = `
                <h3>${escapeHtml(part.name)}</h3>
                ${part.image ? `<img src="${part.image}" alt="${escapeHtml(part.name)}">` : ''}
                <p class="part-meta">${escapeHtml(part.description)}</p>
                <p class="part-meta"><b>Как назвать в запросе:</b> ${part.aliases.map(escapeHtml).join(', ')}</p>
                <p class="part-meta"><b>Где находится:</b> ${escapeHtml(part.page)}</p>
                <ul>${part.elements.map(el => `<li>${escapeHtml(el.name)}: <code>${escapeHtml(el.selector)}</code></li>`).join('')}</ul>
                <p class="part-meta"><b>Пример запроса:</b> <code>${escapeHtml(part.request)}</code></p>
                <div class="part-actions"><button type="button" class="copy-btn">Скопировать промпт для этой части</button>${part.behavior ? '<button type="button" class="copy-btn copy-behavior-btn">Скопировать промпт: HTML и JS</button>' : ''}</div>`;
            const copyBtn = card.querySelector('.copy-btn');
            copyBtn.addEventListener('click', async () => {
                await copyToClipboard(skymodBuildPartPrompt(part));
                flashCopied(copyBtn);
            });
            const behaviorBtn = card.querySelector('.copy-behavior-btn');
            if (behaviorBtn) {
                behaviorBtn.addEventListener('click', async () => {
                    await copyToClipboard(skymodBuildBehaviorPrompt(part));
                    flashCopied(behaviorBtn);
                });
            }
            list.appendChild(card);
        });
    }

    // 2. Общий промпт: подставляем в него актуальный список частей из реестра,
    // чтобы текст промпта не дублировал данные вручную.
    const listText = SKYMOD_PARTS.map(part => {
        const selectors = part.elements.map(el => el.selector + (el.alt ? ' (запасной: ' + el.alt + ')' : '')).join('; ');
        const fixed = part.scriptControlled ? ' Не переопределять: ' + part.scriptControlled + '.' : '';
        const behavior = part.behavior ? ' Есть вкладки HTML и JS (поведение).' : '';
        return '- ' + part.name + '. Называют: ' + part.aliases.join(', ') + '. Селекторы: ' + selectors + '.' + fixed + behavior;
    }).join('\n');
    if (block.textContent.includes('{{SKYMOD_PARTS_LIST}}')) {
        block.textContent = block.textContent.replace('{{SKYMOD_PARTS_LIST}}', listText);
    }

    // 3. Общий промпт для элемента, которого нет в реестре.
    const genericBtn = document.getElementById('copy-generic-part-prompt');
    if (genericBtn) {
        genericBtn.addEventListener('click', async () => {
            await copyToClipboard(skymodBuildGenericPartPrompt());
            flashCopied(genericBtn);
        });
    }
}


// ---------- База промптов: фон сайта ----------
if (typeof SKYMOD_SITE_BG_PROMPT !== 'undefined') {
    const siteBgBtn = document.getElementById('copy-site-bg-prompt');
    const siteBgPreview = document.querySelector('#site-bg-prompt-preview code');
    if (siteBgPreview) siteBgPreview.textContent = SKYMOD_SITE_BG_PROMPT;
    if (siteBgBtn) {
        siteBgBtn.addEventListener('click', async () => {
            await copyToClipboard(SKYMOD_SITE_BG_PROMPT);
            flashCopied(siteBgBtn);
        });
    }
}
