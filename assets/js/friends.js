/* Friends directory: load local JSON without colliding with Stellar's ds-friends service. */
(function () {
  'use strict';

  var DATA_URL = '/assets/friends.json';
  var CONTAINER_SELECTOR = '.friends-directory';

  function responseToJson(value) {
    if (value && typeof value.json === 'function') return value.json();
    if (typeof value === 'string') return Promise.resolve(JSON.parse(value));
    return Promise.resolve(value);
  }

  function requestJson(url) {
    var stellarUtils = window.utils;

    if (stellarUtils && typeof stellarUtils.request === 'function') {
      return new Promise(function (resolve, reject) {
        var settled = false;

        function succeed(response) {
          responseToJson(response).then(function (data) {
            if (settled) return;
            settled = true;
            resolve(data);
          }, fail);
        }

        function fail(error) {
          if (settled) return;
          settled = true;
          reject(error instanceof Error ? error : new Error(String(error || 'request failed')));
        }

        try {
          // Stellar 1.44 uses a callback-based request API. Passing no element avoids
          // its data-service loaded marker, because this module owns its own lifecycle.
          var pending = stellarUtils.request(null, url, succeed, fail, { service: 'friends' });
          if (pending && typeof pending.catch === 'function') pending.catch(fail);
        } catch (error) {
          fail(error);
        }
      });
    }

    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function safeUrl(value, fallback) {
    if (!value) return fallback || '';
    try {
      var parsed = new URL(String(value), document.baseURI);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (error) {
      // Invalid URLs fall back to a harmless local value below.
    }
    return fallback || '';
  }

  function renderFriend(item) {
    // item: { name, url, avatar, desc }
    var a = document.createElement('a');
    a.href = safeUrl(item.url, '#');
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'friend-card';
    // avatar
    var img = document.createElement('img');
    img.className = 'avatar';
    img.alt = item.name || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    var avatar = safeUrl(item.avatar, '');
    if (avatar) img.src = avatar;
    img.addEventListener('error', function () { img.hidden = true; }, { once: true });
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
    var box = document.querySelector(CONTAINER_SELECTOR + ' .grid-box');
    if (!box) return;
    box.innerHTML = '';
    var friends = Array.isArray(list) ? list : [];
    friends.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'grid-cell';
      li.appendChild(renderFriend(item));
      box.appendChild(li);
    });

    if (!friends.length) {
      var empty = document.createElement('li');
      empty.className = 'friend-empty';
      empty.textContent = '暂无友链';
      box.appendChild(empty);
    }
  }

  function requestFriends() {
    return requestJson(DATA_URL).then(function (data) {
      if (data && data.friends) return data.friends;
      return data;
    });
  }

  function init() {
    var el = document.querySelector(CONTAINER_SELECTOR);
    if (!el || el.dataset.friendsInitialized === 'true') return;
    el.dataset.friendsInitialized = 'true';
    requestFriends().then(mountFriends).catch(function (error) {
      console.warn('Friends load failed', error);
      mountFriends([]);
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
