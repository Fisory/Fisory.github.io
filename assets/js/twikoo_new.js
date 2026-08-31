/* Progressive fallback for Stellar's native Twikoo recent-comments service. */
(function () {
  'use strict';

  var CONTAINER_SELECTOR = '.ds-recent-comments';
  var SERVICE_SELECTOR = '.ds-twikoo';
  var TIMEOUT_MS = 12000;

  function init() {
    var section = document.querySelector(CONTAINER_SELECTOR);
    if (!section || section.dataset.recentCommentsObserved === 'true') return;
    section.dataset.recentCommentsObserved = 'true';

    var service = section.querySelector(SERVICE_SELECTOR);
    if (!service || !service.dataset.api) {
      section.hidden = true;
      return;
    }

    section.hidden = true;
    var sawLoading = Boolean(service.querySelector('.loading-wrap'));
    var timer;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches('.loading-wrap') || node.querySelector('.loading-wrap')) sawLoading = true;
        });
      });

      var loading = service.querySelector('.loading-wrap');
      if (loading) sawLoading = true;

      if (service.querySelector('.timenode')) {
        finish(false);
      } else if (service.querySelector('.loading-wrap.error') || (sawLoading && !loading)) {
        // Failed requests and successful empty responses should not leave a blank block.
        finish(true);
      }
    });

    function finish(hide) {
      section.hidden = hide;
      observer.disconnect();
      window.clearTimeout(timer);
    }

    observer.observe(service, { childList: true, subtree: true });
    if (service.querySelector('.timenode')) {
      finish(false);
      return;
    }
    if (service.querySelector('.loading-wrap.error')) {
      finish(true);
      return;
    }
    timer = window.setTimeout(function () { finish(true); }, TIMEOUT_MS);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
