(function(){
  // 运行时间显示
  try {
    const start = new Date('2024-07-21T04:20:27Z');
    function pad(n){return n.toString().padStart(2,'0');}
    function update() {
      const now = new Date();
      let diff = now - start;
      if (diff < 0) diff = 0;
      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const minutes = Math.floor((sec % 3600) / 60);
      const seconds = sec % 60;
      const el = document.getElementById('runtime_span');
      if (el) el.textContent = `⭐ 已营业：${days} 天 ${pad(hours)} 时 ${pad(minutes)} 分 ${pad(seconds)} 秒 ⭐`;
    }
    update();
    setInterval(update, 1000);
  } catch(e) {}

  // 工具函数
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function loadCSSOnce(href, id){ if(document.getElementById(id)) return; var l=document.createElement('link'); l.rel='stylesheet'; l.href=href; l.id=id; (document.head||document.body).appendChild(l); }
  function loadScriptFromList(list, id, cb){
    var i = 0;
    function tryNext(){
      if (i >= list.length) { cb && cb(false); return; }
      var existing = document.getElementById(id);
      if (existing) { cb && cb(true); return; }
      var s = document.createElement('script');
      s.id = id; s.src = list[i]; s.async = true;
      s.onload = function(){ cb && cb(true); };
      s.onerror = function(){ try { s.remove(); } catch(e){} i++; tryNext(); };
      document.body.appendChild(s);
    }
    tryNext();
  }
  // 仅注入一次样式
  function addStyleOnce(id, css){
    if (document.getElementById(id)) return;
    var style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    (document.head || document.body).appendChild(style);
  }
  // 右侧栏夜间模式适配
  addStyleOnce('right-dark-fix', `
    html.dark aside.l_right, [data-theme='dark'] aside.l_right, body.dark aside.l_right {
      color: var(--stel-fg, #e6e6e6);
      background: var(--stel-bg, rgba(34,34,34,.88));
    }
    html.dark aside.l_right a, [data-theme='dark'] aside.l_right a, body.dark aside.l_right a {
      color: var(--stel-link, #dcdcdc);
    }
    html.dark aside.l_right .tag, [data-theme='dark'] aside.l_right .tag, body.dark aside.l_right .tag {
      background: rgba(255,255,255,.06);
      border-color: rgba(255,255,255,.12);
    }
    /* 覆盖右侧自定义卡片在暗色下的样式（优先级更高，并使用重要标记覆盖浅色背景） */
    html.dark aside.l_right .custom-aside .card, [data-theme='dark'] aside.l_right .custom-aside .card, body.dark aside.l_right .custom-aside .card {
      background: rgba(34,34,34,.88) !important;
      color: #e6e6e6;
    }
    html.dark aside.l_right .custom-aside .notice .title, [data-theme='dark'] aside.l_right .custom-aside .notice .title, body.dark aside.l_right .custom-aside .notice .title {
      color: #e5e7eb;
    }
    html.dark aside.l_right .custom-aside .notice .desc, [data-theme='dark'] aside.l_right .custom-aside .notice .desc, body.dark aside.l_right .custom-aside .notice .desc,
    html.dark aside.l_right .custom-aside .notice li, [data-theme='dark'] aside.l_right .custom-aside .notice li, body.dark aside.l_right .custom-aside .notice li {
      color: #d1d5db;
    }
    html.dark aside.l_right .custom-aside .notice hr, [data-theme='dark'] aside.l_right .custom-aside .notice hr, body.dark aside.l_right .custom-aside .notice hr {
      border-top-color: rgba(255,255,255,.12);
    }
    html.dark aside.l_right .custom-aside .random-link, [data-theme='dark'] aside.l_right .custom-aside .random-link, body.dark aside.l_right .custom-aside .random-link {
      color: #d1d5db;
    }
    html.dark aside.l_right .custom-aside .random-link:hover, [data-theme='dark'] aside.l_right .custom-aside .random-link:hover, body.dark aside.l_right .custom-aside .random-link:hover {
      color: #f3f4f6;
    }
  `);
  function ensureAside(cb){
    var sel = 'aside.l_right,ASIDE.l_right,.l_right';
    var a = document.querySelector(sel);
    if (a) return cb(a);
    var t0 = Date.now();
    var max = 8000;
    var timer = setInterval(function(){
      var el = document.querySelector(sel);
      if (el){ clearInterval(timer); try{ mo && mo.disconnect(); }catch(e){} cb(el); }
      else if (Date.now() - t0 > max){ clearInterval(timer); try{ mo && mo.disconnect(); }catch(e){} }
    }, 120);
    var mo;
    try {
      mo = new MutationObserver(function(){
        var el = document.querySelector(sel);
        if (el){ try{ mo.disconnect(); }catch(e){} clearInterval(timer); cb(el); }
      });
      mo.observe(document.documentElement || document.body, {childList:true, subtree:true});
    } catch(e) {}
  }
  // 已删除失败的左侧自定义模块：ensureLeft（等待左栏）
  ready(function(){
    var isHome = location && (location.pathname === '/' || /^\/page\/\d+\/?$/.test(location.pathname));
    if (!isHome) return;

    // 已移除失败的左侧自定义模块（custom-left） — 恢复 Stellar 默认左栏

    // 样式与脚本：多CDN回退
    loadCSSOnce('https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css','aplayer-css');
    loadCSSOnce('https://unpkg.com/aplayer/dist/APlayer.min.css','aplayer-css-bk');

    loadScriptFromList([
      'https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js',
      'https://unpkg.com/aplayer/dist/APlayer.min.js',
      'https://fastly.jsdelivr.net/npm/aplayer/dist/APlayer.min.js'
    ], 'aplayer-js', function(){
      loadScriptFromList([
        'https://cdn.jsdelivr.net/npm/meting@2/dist/Meting.min.js',
        'https://unpkg.com/meting@2/dist/Meting.min.js',
        'https://fastly.jsdelivr.net/npm/meting@2/dist/Meting.min.js'
      ], 'meting-js', function(){
        ensureAside(function(aside){
          var wrap = document.createElement('div');
          wrap.className = 'custom-aside';

          // 样式注入：小喇叭、段落间距、链接下半涂抹、随机阅读按钮（书1/书2 切换、居中）
          addStyleOnce('custom-aside-notice-style', `
            .custom-aside .card.notice{background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(149,157,165,.2);padding:14px}
            .custom-aside .notice .title{display:flex;align-items:center;justify-content:center;gap:8px;color:#374151;font-weight:700;font-size:16px;margin:2px 0 12px;text-align:center}
            /* CSS 小喇叭（紫底+白色，带声波动画） */
            .custom-aside .notice .title .icon.horn{position:relative;display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;background:#c4b5fd}
            .custom-aside .notice .title .icon.horn i{position:absolute;display:block}
            .custom-aside .notice .title .icon.horn i.body{left:6px;width:4px;height:10px;background:#fff;border-radius:1px}
            .custom-aside .notice .title .icon.horn i.cone{left:10px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:8px solid #fff}
            .custom-aside .notice .title .icon.horn:before,.custom-aside .notice .title .icon.horn:after{content:"";position:absolute;right:3px;border:2px solid #fff;border-left-color:transparent;border-bottom-color:transparent;border-radius:50%;transform:rotate(45deg) scale(.7);opacity:.25}
            .custom-aside .notice .title .icon.horn:before{width:10px;height:10px;animation:hornWave 1.6s ease-in-out infinite}
            .custom-aside .notice .title .icon.horn:after{width:14px;height:14px;animation:hornWave 1.6s ease-in-out infinite .8s}
            @keyframes hornWave{0%{transform:rotate(45deg) scale(.6);opacity:.2}50%{opacity:.85}100%{transform:rotate(45deg) scale(1.06);opacity:.08}}

            .custom-aside .notice .desc{color:#4b5563;line-height:1.8;margin:12px 0 14px}
            .custom-aside .notice .section-title{color:#6b7280;font-weight:700;margin:10px 0 8px}
            .custom-aside .notice hr{border:none;border-top:1px solid #e5e7eb;margin:14px 0}
            .custom-aside .notice ul{list-style:none;padding:0;margin:0}
            .custom-aside .notice li{display:flex;align-items:center;gap:8px;margin:6px 0;color:#4b5563}
            .custom-aside .notice li .dot{width:6px;height:6px;background:#60a5fa;border-radius:50%;display:inline-block}
            .custom-aside .notice li .label{color:#6b7280;flex:0 0 auto}
            /* 链接“下半部分涂抹浅紫”，hover 整块铺满 */
            .custom-aside .notice .link{position:relative;color:#111827;text-decoration:none}
            /* 默认：底层是“随 hover 填充”的整块色（初始不可见，size 为 0）；顶层是固定的下半涂抹渐变 */
            .custom-aside .notice .link.link-fill{display:inline-block;padding:0 2px;border-radius:3px;background-image:linear-gradient(rgba(196,181,253,.45), rgba(196,181,253,.45)), linear-gradient(to top, rgba(196,181,253,.45) 0 50%, rgba(196,181,253,0) 50% 100%);background-size:0% 100%, 100% 100%;background-position:0 0, 0 0;background-repeat:no-repeat;transition:background-size .25s ease,color .25s ease}
            /* 悬停：将整块色层铺满，覆盖下层，形成“整块填充”效果 */
            .custom-aside .notice .link.link-fill:hover{background-size:100% 100%, 100% 100%}
            .custom-aside .notice .havefun{color:#6d28d9;font-weight:700;text-align:center;margin:12px 0 8px}
            .custom-aside .notice .random-row{display:flex;align-items:center;justify-content:center;margin-top:10px}
            .custom-aside .notice .random-link{display:inline-flex;align-items:center;gap:8px;color:#6b7280;text-decoration:none;outline:none;background:transparent;border:none;padding:4px 6px;border-radius:8px;cursor:pointer}
            .custom-aside .notice .random-link:hover{color:#374151;text-decoration:underline}
            .custom-aside .notice .book-icon{width:18px;height:18px;display:inline-block;background:url("/icon/书.svg") center/contain no-repeat}
            .custom-aside .notice .random-link:hover .book-icon{background-image:url("/icon/书 (1).svg")}
            /* 打字机光标样式 */
            .custom-aside .typewriter{position:relative}
            .custom-aside .typewriter::after{content:"▍";display:inline-block;margin-left:2px;color:#6b7280;animation:caret-blink 1s steps(1,end) infinite}
            @keyframes caret-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
          `);

          // 侧边栏卡片
          wrap.innerHTML = `
            <div class="card profile">
              <img class="avatar" src="/img/银河系.SVG.svg" alt="avatar" />
              <div>
                <h3>Welcome to my blog!</h3>
                <p class="motto"></p>
              </div>
            </div>
            <hr>
            <div class="card hitokoto">
              <div class="section-title">一言</div>
              <p id="hitokoto_text">加载中…</p>
            </div>
            <div class="card music">
              <div class="section-title">音乐播放器</div>
              <meting-js
                server="netease"
                type="playlist"
                id="2768580538"
                fixed="false"
                mini="false"
                autoplay="false"
                loop="all"
                order="random"
                preload="none"
                volume="0.7"
                mutex="true"
                list-folded="false"
                theme="#7aa2f7"
              ></meting-js>
            </div>
            <div class="card notice">
              <div class="title">
                <span class="icon horn" aria-hidden="true"><i class="body"></i><i class="cone"></i></span>
                <span>公告</span>
              </div>
              <p class="desc">
                本站依赖 <strong>GitHub</strong> + <strong>CF</strong>，如无法访问或图片加载慢，请尝试代理。
                其他疑问电邮：<a class="link" href="mailto:2799130698@qq.com" target="_blank" rel="noopener" title="给我写邮件">@ 发邮件</a>
              </p>
              <hr>
              <div class="section-title">快捷跳转地址：</div>
              <ul class="quick-links">
                <li><span class="label">域名1：</span><a class="link link-fill" href="https://slienceisabelle.com" target="_blank" rel="noopener">slienceisabelle.com</a></li>
                <li><span class="label">域名2：</span><a class="link link-fill" href="https://fisory.github.io/" target="_blank" rel="noopener">fisory.github.io</a></li>
              </ul>
              <p class="havefun">Have Fun :) ~</p>
              <div class="random-row" role="navigation" aria-label="随机阅读">
                <a id="random-read-link" class="random-link" href="#" title="随机阅读一篇文章">
                  <span class="book-icon" aria-hidden="true"></span>
                  随机阅读
                </a>
              </div>
            </div>
          `;
          aside.appendChild(wrap);

          // 座右铭打字机 + 通用打字机函数
          function typeWriter(el, text, opts){
          opts = opts || {};
          var base = Number(opts.speedBase || 160);
          var puncPause = Number(opts.punctuationPause || 360);
          try { if (el.__twTimer) clearTimeout(el.__twTimer); } catch(err) {}
          el.textContent = '';
          var i = 0;
          function step(){
          el.textContent = text.slice(0, i++);
          if (i <= text.length){
          var ch = text[i-2] || '';
          var delay = base + (/[，。！？、,. :;—…]/.test(ch) ? puncPause : 0);
          el.__twTimer = setTimeout(step, delay);
          }
          }
          setTimeout(step, base);
          }
          try {
          var motto = '本来无一物，何处惹尘埃.';
          var mottoEl = wrap.querySelector('.motto');
          if (mottoEl){
          mottoEl.classList.add('typewriter');
          typeWriter(mottoEl, motto, { speedBase: 160, punctuationPause: 360 });
          }
          } catch(e){}

          // meting 未注册时的回退
          try {
            if (!(window.customElements && customElements.get && customElements.get('meting-js'))){
              var musicCard = wrap.querySelector('.card.music');
              if (musicCard) {
                musicCard.innerHTML = '<div class="section-title">音乐播放器</div>'+
                  '<a class="random-btn" href="https://music.163.com/#/my/m/music/playlist?id=2768580538" target="_blank" rel="noopener">打开网易云歌单</a>'; 
              }
            }
          } catch(e){}

          // 一言（带本地缓存 + 打字机渐显）
          (function(){
            var hitokotoEl = document.getElementById('hitokoto_text');
            try {
              var today = new Date().toISOString().slice(0,10);
              var key = 'hitokoto_' + today;
              var cached = localStorage.getItem(key);
              function writeText(s){
              try{ typeWriter(hitokotoEl, s, { speedBase: 160, punctuationPause: 360 }); }
              catch(err){ hitokotoEl.textContent = s; }
              }
              if (cached) {
                var d = JSON.parse(cached);
                writeText((d.hitokoto || '') + (d.from ? ' — ' + d.from : ''));
              } else {
                fetch('https://v1.hitokoto.cn/?encode=json').then(r=>r.json()).then(function(d){
                  Object.keys(localStorage).forEach(function(k){ if(k.startsWith('hitokoto_')) localStorage.removeItem(k); });
                  localStorage.setItem(key, JSON.stringify(d));
                  writeText((d.hitokoto || '') + (d.from ? ' — ' + d.from : ''));
                }).catch(function(){ hitokotoEl.textContent = '获取失败，请稍后重试'; });
              }
            } catch(e) { if(hitokotoEl) hitokotoEl.textContent = '获取失败'; }
          })();

          // 随机阅读
          var btn = document.getElementById('random-read-link');
          btn && btn.addEventListener('click', function(e){
            e.preventDefault();
            var anchors = Array.from(document.querySelectorAll('a[href]'));
            var candidates = anchors.map(function(a){ return a.getAttribute('href'); })
              .filter(function(h){ return h && h.startsWith('/') && !h.includes('#') && !/\.(jpg|jpeg|png|gif|svg|pdf)$/i.test(h) && !h.includes('categories') && !h.includes('tags') && !h.includes('page/'); })
              .filter(function(h, idx, arr){ return arr.indexOf(h) === idx; });
            if (candidates.length) {
              var target = candidates[Math.floor(Math.random() * candidates.length)];
              location.href = target;
            } else {
              alert('未找到可跳转的文章链接');
            }
          });
        });
      });
    });
  });
})();