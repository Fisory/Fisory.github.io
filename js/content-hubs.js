(function () {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
  }

  function readTags(item) {
    try {
      var value = JSON.parse(item.dataset.tags || '[]');
      return Array.isArray(value) ? value.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function setField(form, name, value) {
    var field = form.elements.namedItem(name);
    if (!field || !value) return;
    var exists = Array.from(field.options || []).some(function (option) {
      return option.value === value;
    });
    if (exists || field.tagName === 'INPUT') field.value = value;
  }

  function initFilters(root) {
    var form = root.querySelector('[data-hub-filters]');
    var list = root.querySelector('[data-hub-list]');
    if (!form || !list) return;

    var items = Array.from(list.querySelectorAll('[data-hub-item]'));
    var result = form.querySelector('[data-filter-result]');
    var empty = root.querySelector('[data-filter-empty]');
    var params = new URLSearchParams(window.location.search);

    ['q', 'tag', 'category', 'year', 'month', 'status'].forEach(function (name) {
      setField(form, name, params.get(name));
    });

    function updateAddress(filters) {
      if (!window.history || !window.history.replaceState) return;
      var next = new URLSearchParams();
      Object.keys(filters).forEach(function (key) {
        if (filters[key]) next.set(key, filters[key]);
      });
      var query = next.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    }

    function applyFilters() {
      var data = new FormData(form);
      var filters = {
        q: normalize(data.get('q')),
        tag: String(data.get('tag') || ''),
        category: String(data.get('category') || ''),
        year: String(data.get('year') || ''),
        month: String(data.get('month') || ''),
        status: String(data.get('status') || ''),
      };
      var visible = 0;

      items.forEach(function (item) {
        var tags = readTags(item);
        var matches = (!filters.q || normalize(item.dataset.search).includes(filters.q))
          && (!filters.tag || tags.includes(filters.tag))
          && (!filters.category || item.dataset.category === filters.category)
          && (!filters.year || item.dataset.year === filters.year)
          && (!filters.month || item.dataset.month === filters.month)
          && (!filters.status || item.dataset.status === filters.status);
        item.hidden = !matches;
        if (matches) visible += 1;
      });

      if (result) result.textContent = '显示 ' + visible + ' / ' + items.length + ' 条';
      if (empty) empty.hidden = visible !== 0;
      updateAddress(filters);
    }

    var searchTimer;
    form.addEventListener('input', function (event) {
      if (event.target && event.target.type === 'search') {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(applyFilters, 120);
      } else {
        applyFilters();
      }
    });
    form.addEventListener('change', applyFilters);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      applyFilters();
    });
    form.addEventListener('reset', function () {
      window.setTimeout(applyFilters, 0);
    });

    applyFilters();
  }

  function getLightbox() {
    var dialog = document.getElementById('content-hub-lightbox');
    if (dialog) return dialog;
    if (!window.HTMLDialogElement) return null;

    dialog = document.createElement('dialog');
    dialog.id = 'content-hub-lightbox';
    dialog.className = 'content-hub-lightbox';
    dialog.innerHTML = '<button type="button" aria-label="关闭图片">×</button><img alt="">';
    dialog.querySelector('button').addEventListener('click', function () {
      dialog.close();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function initGallery(root) {
    root.addEventListener('click', function (event) {
      var link = event.target.closest('[data-hub-image]');
      if (!link) return;
      var dialog = getLightbox();
      if (!dialog) return;
      event.preventDefault();
      var source = link.querySelector('img');
      var image = dialog.querySelector('img');
      image.src = link.href;
      image.alt = source ? source.alt : '';
      dialog.showModal();
    });
  }

  function init() {
    document.querySelectorAll('[data-content-hub]').forEach(function (root) {
      initFilters(root);
      initGallery(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
