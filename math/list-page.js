// Работает на странице https://avatar.skyeng.ru/student/test-preparation/{id}
// Задача: найти все ссылки на задания (/code/task/{id}) в порядке их появления
// на странице и сохранить в chrome.storage, чтобы страница задания могла
// потом построить путь "куда дальше".

(function () {
  function extractTestId(pathname) {
    const m = pathname.match(/test-preparation\/([0-9a-f-]+)/i);
    return m ? m[1] : null;
  }

  function collectTaskIds() {
    const links = Array.from(document.querySelectorAll('a[href*="/code/task/"]'));
    const ids = [];
    const seen = new Set();
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/code\/task\/([0-9a-f-]+)/i);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        ids.push(m[1]);
      }
    }
    return ids;
  }

  function saveList() {
    const testId = extractTestId(location.pathname);
    if (!testId) return;

    const taskIds = collectTaskIds();
    if (taskIds.length === 0) return;

    chrome.storage.local.set({
      skyengTaskList: { testId, taskIds, savedAt: Date.now() }
    });
    console.log('[Skyeng Next Task] Сохранён список заданий:', testId, taskIds.length, 'шт.');
  }

  // Список заданий часто подгружается динамически (SPA), поэтому следим
  // за изменениями DOM и пере-сохраняем список при появлении новых ссылок.
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveList, 500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  saveList();
})();
