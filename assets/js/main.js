/* Main JS: theme bridge, fancybox init, lazyload, helpers */
(function () {
  // jQuery bridge: ensure compatibility if $ not present
  var $ = window.jQuery || window.$;

  // Theme toggle integration
  function applyTheme(theme) {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
  }
  function initThemeToggle() {
    try {
      var KEY = 'theme';
      var saved = localStorage.getItem(KEY);
      if (saved) applyTheme(saved);
      // Observe existing theme switcher if exists
      var switchers = document.querySelectorAll('[data-theme-toggle], .theme-toggle, #theme-toggle');
      switchers.forEach(function (el) {
        el.addEventListener('click', function () {
          var current = document.documentElement.getAttribute('data-theme') || 'light';
          var next = current === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          localStorage.setItem(KEY, next);
        });
      });
    } catch (e) { console.warn('Theme toggle init failed', e); }
  }

  // Fancybox init (if available)
  function initFancybox() {
    if (window.Fancybox) {
      try {
        Fancybox.bind('[data-fancybox]', {
          Thumbs: false,
          Toolbar: {
            display: ['zoom', 'close']
          }
        });
      } catch (e) { console.warn('Fancybox init error', e); }
    }
  }

  // Simple lazyload for images with data-src
  function initLazyImages() {
    var imgs = [].slice.call(document.querySelectorAll('img[data-src]:not(.lazy)'));
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(function (img) { img.src = img.getAttribute('data-src'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          img.src = img.getAttribute('data-src');
          img.addEventListener('load', function () { img.classList.add('loaded'); });
          io.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    imgs.forEach(function (img) { img.classList.add('lazy'); io.observe(img); });
  }

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    initThemeToggle();
    initFancybox();
    initLazyImages();
    // Re-scan lazy images after friends list is mounted
    window.addEventListener('friends:mounted', initLazyImages, { once: false });
  });
})();