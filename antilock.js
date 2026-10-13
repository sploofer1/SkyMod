/*
 * SkyMod, antilock.js. Работает в мире страницы (world: MAIN). Включён по умолчанию;
 * content.js выключает его, ставя на <html> атрибут data-skymod-antilock="0".
 *
 * Как сайт блокирует себя (по коду main-*.js, LaboratoryWaitingPopupService.start):
 * на window слушаются click, pointermove, focus и scroll, и если за час (delayMs,
 * по умолчанию 60 * 60 * 1000) не пришло ни одного, открывается окно «Страница
 * заскучала, пока вас не было» и после его закрытия страница перезагружается.
 * Видимость вкладки сайт для этого не проверяет.
 *
 * Поэтому здесь только одно действие: раз в 3 минуты на window уходит один
 * синтетический pointermove (isTrusted=false, расширение его в своих счётчиках
 * активности игнорирует). Он обнуляет часовой отсчёт, пока вкладка открыта.
 */
(() => {
    if (window.__skymodAntiLock) return;
    window.__skymodAntiLock = true;

    const KEEPALIVE_MS = 3 * 60 * 1000;
    const root = document.documentElement;
    const enabled = () => root.getAttribute('data-skymod-antilock') !== '0';

    setInterval(() => {
        if (!enabled()) return;
        try {
            window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 1, clientY: 1 }));
        } catch (e) {
            window.dispatchEvent(new Event('pointermove'));
        }
    }, KEEPALIVE_MS);
})();
