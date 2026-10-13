// Выставляет размер попапа ДО первой отрисовки. chrome.storage асинхронный:
// без этого попап открывался бы одного размера и сразу «прыгал» в другой.
// Значение дублируется в localStorage из popup.js при каждом изменении.
try {
    const size = localStorage.getItem('skymodPopupSize');
    if (size) document.documentElement.setAttribute('data-size', size);
} catch (e) { /* localStorage недоступен: останется размер по умолчанию */ }
