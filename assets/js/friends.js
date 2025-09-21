/* Friends module: data load + render into .ds-friends */
(function () {
  var $ = window.jQuery || window.$;
  var utils = window.utils || {};

  function renderFriend(item) {
    // item: { name, url, avatar, desc }
    var a = document.createElement('a');
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'friend-card';
    // avatar
    var img = document.createElement('img');
    img.className = 'avatar';
    img.alt = item.name || '';
    if (item.avatar) img.setAttribute('data-src', item.avatar); // lazy
    a.appendChild(img);
    // meta
    var meta = document.createElement('div');
    meta.className = 'meta';
    var name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = item.name || '';
    var desc = document.createElement('div');
    desc.className = 'friend-desc';
    desc.textContent = item.desc || '';
    meta.appendChild(name);
    meta.appendChild(desc);
    a.appendChild(meta);
    return a;
  }

  function mountFriends(list) {
    var box = document.querySelector('.ds-friends .grid-box');
    if (!box) return;
    box.innerHTML = '';
    (list || []).forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'grid-cell';
      li.appendChild(renderFriend(item));
      box.appendChild(li);
    });
    // trigger lazyload init if main.js already ran
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('friends:mounted'));
    }
  }

  function requestFriends() {
    // Prefer utils.request if available
    var fetcher = (utils && utils.request) ? utils.request : function (url) { return fetch(url).then(function (r) { return r.json(); }); };
    // Data source: /assets/friends.json (you can populate via Hexo data files or manual)
    var url = '/assets/friends.json';
    return fetcher(url).then(function (data) {
      if (data && data.friends) return data.friends;
      return data;
    });
  }

  function init() {
    var el = document.querySelector('.ds-friends');
    if (!el) return;
    requestFriends().then(mountFriends).catch(function (e) { console.warn('Friends load failed', e); });
  }

  // Hook DOM ready (prefer utils.jq)
  if (utils && typeof utils.jq === 'function') {
    utils.jq(init);
  } else if ($) {
    $(init);
  } else {
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
  }
})();