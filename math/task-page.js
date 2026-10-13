// Работает на странице https://avatar.skyeng.ru/code/task/{id}
// Добавляет кнопку "Следующее задание →", которая берёт сохранённый список
// задач (см. list-page.js) и сразу переходит на следующую по счёту задачу,
// сохраняя тот же параметр backButtonUrl, что был в текущем адресе.

(function () {
  function getTaskId() {
    const m = location.pathname.match(/\/code\/task\/([0-9a-f-]+)/i);
    return m ? m[1] : null;
  }

  function getBackButtonUrlParam() {
    const params = new URLSearchParams(location.search);
    return params.get('backButtonUrl');
  }

  function extractTestIdFromBackUrl(backButtonUrlParam) {
    if (!backButtonUrlParam) return null;
    let decoded;
    try {
      decoded = decodeURIComponent(backButtonUrlParam);
    } catch (e) {
      decoded = backButtonUrlParam;
    }
    const m = decoded.match(/test-preparation\/([0-9a-f-]+)/i);
    return m ? m[1] : null;
  }

  function buildTaskUrl(taskId, backButtonUrlParam) {
    const base = `${location.origin}/code/task/${taskId}`;
    const qs = new URLSearchParams();
    qs.set('nonext', '1');
    if (backButtonUrlParam) qs.set('backButtonUrl', backButtonUrlParam);
    return `${base}?${qs.toString()}`;
  }

  function createButton() {
    const btn = document.createElement('button');
    btn.id = 'skyeng-next-task-btn';
    btn.type = 'button';
    btn.textContent = 'Следующее задание →';
    document.body.appendChild(btn);
    makeDraggable(btn);
    return btn;
  }

  // Позволяет перетащить кнопку туда, где она не мешает, и запоминает позицию
  function makeDraggable(btn) {
    chrome.storage.local.get('skyengBtnPos', (result) => {
      const pos = result.skyengBtnPos;
      if (pos) {
        btn.style.top = pos.top;
        btn.style.left = pos.left;
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }
    });

    let dragging = false;
    let moved = false;
    let startX, startY, startLeft, startTop;

    btn.addEventListener('mousedown', (e) => {
      dragging = true;
      moved = false;
      const rect = btn.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      const newLeft = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, startLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, startTop + dy));
      btn.style.left = `${newLeft}px`;
      btn.style.top = `${newTop}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        chrome.storage.local.set({
          skyengBtnPos: { top: btn.style.top, left: btn.style.left }
        });
        // не даём клику сработать сразу после перетаскивания
        btn.dataset.justDragged = '1';
        setTimeout(() => delete btn.dataset.justDragged, 0);
      }
    });

    // Блокируем клик-переход, если это было перетаскивание
    btn.addEventListener(
      'click',
      (e) => {
        if (btn.dataset.justDragged) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );
  }

  function init() {
    // Скрипт может быть впрыснут повторно (при SPA-навигации), поэтому
    // удаляем старую кнопку, если она уже есть, и создаём заново.
    const existing = document.getElementById('skyeng-next-task-btn');
    if (existing) existing.remove();

    const currentTaskId = getTaskId();
    const backButtonUrlParam = getBackButtonUrlParam();
    const testId = extractTestIdFromBackUrl(backButtonUrlParam);

    chrome.storage.local.get('skyengTaskList', (result) => {
      const data = result.skyengTaskList;
      console.log('[Skyeng Next Task] Текущий testId:', testId, '| Сохранённый список:', data);
      const btn = createButton();

      // Список не найден или относится к другой теме/тесту
      if (!data || !testId || data.testId !== testId) {
        btn.textContent = 'Список заданий не найден';
        btn.disabled = true;
        btn.title = 'Откройте страницу со списком заданий этой темы хотя бы раз, затем вернитесь на страницу задания.';
        return;
      }

      const idx = data.taskIds.indexOf(currentTaskId);

      if (idx === -1) {
        btn.textContent = 'Задание не найдено в списке';
        btn.disabled = true;
        return;
      }

      if (idx === data.taskIds.length - 1) {
        btn.textContent = 'Это было последнее задание ✓';
        btn.addEventListener('click', () => {
          if (backButtonUrlParam) {
            location.href = decodeURIComponent(backButtonUrlParam);
          }
        });
        return;
      }

      const nextTaskId = data.taskIds[idx + 1];
      const nextUrl = buildTaskUrl(nextTaskId, backButtonUrlParam);

      btn.textContent = `Следующее задание (${idx + 2}/${data.taskIds.length}) →`;
      btn.addEventListener('click', () => {
        location.href = nextUrl;
      });

      // Горячая клавиша: Alt+N
      document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т')) {
          location.href = nextUrl;
        }
      });
    });
  }

  init();
})();
