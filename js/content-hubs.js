(function () {
  'use strict';

  var twikooClientPromise;

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

  function parseCount(value, fallback) {
    var count = Number(value);
    return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
  }

  function formatCount(value) {
    try {
      return Number(value).toLocaleString('zh-CN');
    } catch (_) {
      return String(value);
    }
  }

  function requestJson(url, options) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, 10000) : null;
    var requestOptions = Object.assign({
      headers: { Accept: 'application/json' },
    }, options || {});
    if (controller) requestOptions.signal = controller.signal;

    return window.fetch(url, requestOptions).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function reactionButtons(root, id) {
    return Array.from(root.querySelectorAll('[data-reaction-like]')).filter(function (button) {
      var item = button.closest('[data-content-id]');
      return item && item.dataset.contentId === id;
    });
  }

  function announceReaction(button, message) {
    var status = button.querySelector('[data-reaction-status]');
    if (!status) return;
    status.textContent = '';
    window.setTimeout(function () { status.textContent = message; }, 20);
  }

  function paintReaction(button, state) {
    var count = parseCount(state.count, 0);
    var liked = Boolean(state.liked);
    var countNode = button.querySelector('[data-reaction-count]');
    button.dataset.count = String(count);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    button.setAttribute('aria-label', (liked ? '取消点赞' : '点赞') + '，当前 ' + count + ' 个赞');
    button.title = liked ? '取消点赞' : '点赞';
    button.classList.toggle('is-active', liked);
    button.classList.remove('is-error');
    if (countNode) countNode.textContent = formatCount(count);
  }

  function setReactionBusy(button, busy) {
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function paintReactionGroup(root, id, state) {
    reactionButtons(root, id).forEach(function (button) {
      paintReaction(button, state);
      setReactionBusy(button, false);
    });
  }

  function setReactionGroupBusy(root, id, busy) {
    reactionButtons(root, id).forEach(function (button) {
      setReactionBusy(button, busy);
    });
  }

  function reactionItems(payload) {
    if (!payload || typeof payload !== 'object') return {};
    if (payload.items && typeof payload.items === 'object' && !Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.items)) {
      return payload.items.reduce(function (items, entry) {
        if (entry && entry.id) items[String(entry.id)] = entry;
        return items;
      }, {});
    }
    return {};
  }

  function initReactions(root) {
    var buttons = Array.from(root.querySelectorAll('[data-reaction-like]'));
    if (!buttons.length) return;

    var apiBase = String(root.dataset.reactionsApi || '').replace(/\/+$/, '');
    if (!apiBase) {
      buttons.forEach(function (button) {
        button.hidden = true;
        button.setAttribute('aria-busy', 'false');
      });
      return;
    }

    var ids = Array.from(new Set(buttons.map(function (button) {
      var item = button.closest('[data-content-id]');
      return item ? item.dataset.contentId : '';
    }).filter(Boolean)));
    if (!ids.length) return;

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('[data-content-id]');
        var id = item ? item.dataset.contentId : '';
        if (!id || button.dataset.pending === 'true') return;

        var previous = {
          count: parseCount(button.dataset.count, 0),
          liked: button.getAttribute('aria-pressed') === 'true',
        };
        var desired = !previous.liked;
        var optimistic = {
          count: Math.max(0, previous.count + (desired ? 1 : -1)),
          liked: desired,
        };

        reactionButtons(root, id).forEach(function (relatedButton) {
          relatedButton.dataset.pending = 'true';
        });
        paintReactionGroup(root, id, optimistic);
        setReactionGroupBusy(root, id, true);

        requestJson(apiBase + '/v1/reactions/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ liked: desired }),
        }).then(function (payload) {
          var state = payload && typeof payload === 'object' ? payload : optimistic;
          paintReactionGroup(root, id, {
            count: parseCount(state.count, optimistic.count),
            liked: typeof state.liked === 'boolean' ? state.liked : desired,
          });
          announceReaction(button, desired ? '点赞成功' : '已取消点赞');
        }).catch(function () {
          paintReactionGroup(root, id, previous);
          reactionButtons(root, id).forEach(function (relatedButton) {
            relatedButton.classList.add('is-error');
            relatedButton.title = '操作失败，请稍后重试';
          });
          announceReaction(button, '操作失败，请稍后重试');
        }).finally(function () {
          reactionButtons(root, id).forEach(function (relatedButton) {
            delete relatedButton.dataset.pending;
          });
          setReactionGroupBusy(root, id, false);
        });
      });
    });

    for (var offset = 0; offset < ids.length; offset += 50) {
      (function (batch) {
        var query = batch.map(encodeURIComponent).join(',');
        requestJson(apiBase + '/v1/reactions?ids=' + query).then(function (payload) {
          var items = reactionItems(payload);
          batch.forEach(function (id) {
            var state = items[id] || { count: 0, liked: false };
            paintReactionGroup(root, id, state);
          });
        }).catch(function () {
          batch.forEach(function (id) {
            reactionButtons(root, id).forEach(function (button) {
              setReactionBusy(button, false);
              button.hidden = true;
            });
          });
        });
      })(ids.slice(offset, offset + 50));
    }
  }

  function twikooReady() {
    return window.twikoo && typeof window.twikoo.getCommentsCount === 'function';
  }

  function waitForTwikoo() {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      function check() {
        if (twikooReady()) {
          resolve(window.twikoo);
          return;
        }
        attempts += 1;
        if (attempts >= 80) {
          reject(new Error('Twikoo 加载超时'));
          return;
        }
        window.setTimeout(check, 125);
      }
      check();
    });
  }

  function sameScriptUrl(first, second) {
    try {
      return new URL(first, window.location.href).href === new URL(second, window.location.href).href;
    } catch (_) {
      return first === second;
    }
  }

  function loadTwikooClient(scriptUrl) {
    if (twikooReady()) return Promise.resolve(window.twikoo);
    if (twikooClientPromise) return twikooClientPromise;

    var existing = Array.from(document.scripts).some(function (script) {
      return script.src && sameScriptUrl(script.src, scriptUrl);
    });
    if (existing) {
      twikooClientPromise = waitForTwikoo();
      return twikooClientPromise;
    }

    if (window.utils && typeof window.utils.js === 'function') {
      twikooClientPromise = window.utils.js(scriptUrl, { defer: true }).then(waitForTwikoo);
      return twikooClientPromise;
    }

    twikooClientPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = scriptUrl;
      script.defer = true;
      script.addEventListener('load', function () { waitForTwikoo().then(resolve, reject); }, { once: true });
      script.addEventListener('error', function () { reject(new Error('Twikoo 加载失败')); }, { once: true });
      document.head.appendChild(script);
    });
    return twikooClientPromise;
  }

  function commentPath(value) {
    try {
      return decodeURI(new URL(value, window.location.origin).pathname);
    } catch (_) {
      return String(value || '').split(/[?#]/)[0];
    }
  }

  function initCommentCounts(root) {
    var links = Array.from(root.querySelectorAll('[data-comment-link]'));
    var envId = String(root.dataset.twikooEnvId || '');
    var scriptUrl = String(root.dataset.twikooJs || '');
    if (!links.length || root.dataset.commentsEnabled !== 'true' || !envId || !scriptUrl) return;

    var paths = Array.from(new Set(links.map(function (link) {
      var item = link.closest('[data-content-path]');
      return item ? commentPath(item.dataset.contentPath) : '';
    }).filter(Boolean)));
    if (!paths.length) return;

    loadTwikooClient(scriptUrl).then(function (twikoo) {
      var options = { envId: envId, urls: paths, includeReply: false };
      if (root.dataset.twikooRegion) options.region = root.dataset.twikooRegion;
      return twikoo.getCommentsCount(options);
    }).then(function (results) {
      var counts = new Map();
      (Array.isArray(results) ? results : []).forEach(function (entry) {
        if (!entry || !entry.url) return;
        counts.set(commentPath(entry.url), parseCount(entry.count, 0));
      });
      links.forEach(function (link) {
        var item = link.closest('[data-content-path]');
        var path = item ? commentPath(item.dataset.contentPath) : '';
        var count = counts.has(path) ? counts.get(path) : 0;
        var countNode = link.querySelector('[data-comment-count]');
        if (countNode) countNode.textContent = formatCount(count);
        link.setAttribute('aria-label', '查看评论，共 ' + count + ' 条');
        link.title = count + ' 条评论';
      });
    }).catch(function () {
      links.forEach(function (link) {
        link.classList.add('is-error');
        link.title = '评论数量暂时无法加载';
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-content-hub]').forEach(function (root) {
      initFilters(root);
      initGallery(root);
      initReactions(root);
      initCommentCounts(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
