/* Twikoo recent comments: fetch and render into .ds-recent-comments */
(function () {
  var $ = window.jQuery || window.$;
  var utils = window.utils || {};

  var CONTAINER_SELECTOR = '.ds-recent-comments';
  var LIST_SELECTOR = '.rc-list';

  function renderItem(item) {
    var li = document.createElement('li');
    li.className = 'rc-item';

    var a = document.createElement('a');
    a.href = item.url;
    a.textContent = item.nick + '：' + (item.comment || '').replace(/<[^>]+>/g, '').slice(0, 60);
    a.setAttribute('data-fancybox', '');

    var time = document.createElement('span');
    time.className = 'rc-time';
    time.textContent = item.time || '';

    li.appendChild(a);
    li.appendChild(time);
    return li;
  }

  function mount(list) {
    var wrap = document.querySelector(CONTAINER_SELECTOR);
    if (!wrap) return;
    var ul = wrap.querySelector(LIST_SELECTOR);
    if (!ul) { ul = document.createElement('ul'); ul.className = 'rc-list'; wrap.appendChild(ul); }

    ul.innerHTML = '';
    if (!list || !list.length) {
      var empty = document.createElement('div');
      empty.className = 'rc-empty';
      empty.textContent = '暂无最新评论';
      wrap.appendChild(empty);
      return;
    }
    list.forEach(function (item) { ul.appendChild(renderItem(item)); });
  }

  function requestRecentComments() {
    // Use utils.request if provided. You may relay to your Twikoo endpoint or cache API.
    var fetcher = (utils && utils.request) ? utils.request : function (url) { return fetch(url).then(function (r) { return r.json(); }); };
    // Expect a JSON: { list: [ { url, nick, comment, time }, ... ] }
    var url = '/assets/recent-comments.json';
    return fetcher(url).then(function (data) { return data && (data.list || data.comments || data) || []; });
  }

  function init() { requestRecentComments().then(mount).catch(function (e) { console.warn('twikoo recent comments failed', e); }); }

  if (utils && typeof utils.jq === 'function') utils.jq(init);
  else if ($) $(init);
  else if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();