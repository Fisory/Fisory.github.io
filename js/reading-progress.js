(function () {
  'use strict';

  var bar = document.createElement('div');
  bar.id = 'reading-progress-bar';
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0%',
    height: '3px',
    background: 'var(--theme-link, #448aff)',
    zIndex: '9999',
    transition: 'width 0.1s linear',
    borderRadius: '0 2px 2px 0',
    pointerEvents: 'none',
  });
  document.documentElement.appendChild(bar);

  function update() {
    var el = document.documentElement;
    var scrollTop = el.scrollTop || document.body.scrollTop;
    var scrollHeight = el.scrollHeight - el.clientHeight;
    var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100).toFixed(2) + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();
