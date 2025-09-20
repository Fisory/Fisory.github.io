(function(){
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function addStyleOnce(id, css){ if (document.getElementById(id)) return; var s=document.createElement('style'); s.id=id; s.textContent=css; (document.head||document.body).appendChild(s); }
  function ensureLeft(cb){
    var sel='aside.l_left,ASIDE.l_left,.l_left';
    var el=document.querySelector(sel);
    if (el) return cb(el);
    var t0=Date.now(), max=8000; var timer=setInterval(function(){ var e=document.querySelector(sel); if(e){clearInterval(timer); try{mo&&mo.disconnect();}catch(_e){} cb(e);} else if(Date.now()-t0>max){clearInterval(timer); try{mo&&mo.disconnect();}catch(_e){}} }, 120);
    var mo; try{ mo=new MutationObserver(function(){ var e=document.querySelector(sel); if(e){ try{mo.disconnect();}catch(_e){} clearInterval(timer); cb(e);} }); mo.observe(document.documentElement||document.body,{childList:true,subtree:true}); }catch(_e){}
  }

  addStyleOnce('stellar-left-custom-style', `
     aside.l_left .stellar-signature{font-size:.72em;line-height:1.4;color:#6b7280;margin:2px 0 4px 0;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-weight:normal}
     /* 覆盖移动端字号，防止其他脚本将其放大 */
     @media (max-width: 600px){ aside.l_left .logo-wrap .title .stellar-signature{font-size:.70em} }
     aside.l_left .stellar-left-bottombar{display:flex;gap:12px;align-items:center;justify-content:center;padding:8px 6px;margin-top:14px;border-top:1px dashed rgba(0,0,0,.06);position:sticky;bottom:8px;background:transparent;backdrop-filter:none}
     aside.l_left .stellar-left-bottombar a{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;color:#111;text-decoration:none;user-select:none;transition:transform .2s ease, background-color .2s ease}
     aside.l_left .stellar-left-bottombar a:hover{background:rgba(0,0,0,.06)}
     aside.l_left .stellar-left-bottombar a svg{width:20px;height:20px;display:block}
     html.dark aside.l_left .stellar-left-bottombar a, [data-theme='dark'] aside.l_left .stellar-left-bottombar a{color:#eee}
     html.dark aside.l_left .stellar-left-bottombar a:hover, [data-theme='dark'] aside.l_left .stellar-left-bottombar a:hover{background:rgba(255,255,255,.12)}
     @media (max-width: 960px){ aside.l_left .stellar-left-bottombar{flex-wrap:wrap;gap:10px} }

     /* 动画 */
     aside.l_left .stellar-left-bottombar .jump{animation:jump 1.4s ease-in-out infinite}
     @keyframes jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
     aside.l_left .stellar-left-bottombar .flip{animation:flip 1.6s ease-in-out infinite}
     @keyframes flip{0%,100%{transform:scaleX(1)}50%{transform:scaleX(-1)}}
     aside.l_left .stellar-left-bottombar .shake{animation:shake 1.2s ease-in-out infinite}
     @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
     aside.l_left .stellar-left-bottombar .spin{animation:spin 2.2s linear infinite}
     @keyframes spin{to{transform:rotate(360deg)}}

     /* 提示 */
     .stellar-toast{position:fixed;right:16px;bottom:16px;background:rgba(17,24,39,.92);color:#fff;padding:8px 12px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;z-index:9999}
     .stellar-toast.show{opacity:1;transform:translateY(0)}

     /* 飘落效果 */
     .stellar-snow-flake{position:fixed;top:-24px;left:0;will-change:transform;pointer-events:none;user-select:none}
     @keyframes fall{to{transform:translate3d(var(--dx,0px),110vh,0) rotate(var(--rot,360deg));opacity:.9}}
  `);

  function showToast(msg){
    try {
      var el=document.getElementById('stellar-toast');
      if(!el){ el=document.createElement('div'); el.id='stellar-toast'; el.className='stellar-toast'; document.body.appendChild(el); }
      el.textContent=msg; el.classList.add('show');
      clearTimeout(el.__t); el.__t=setTimeout(function(){ el.classList.remove('show'); }, 1600);
    } catch(e){}
  }

  // 飘落效果
  var snowOn=false, snowTimer=null; var snowChars=['❄','⭐','⛄'];
  function spawnFlake(){
    var flake=document.createElement('span');
    flake.className='stellar-snow-flake';
    flake.textContent=snowChars[Math.floor(Math.random()*snowChars.length)];
    var size=12+Math.random()*14; var left=Math.random()*100; var drift=(Math.random()*2-1)*80; var dur=6+Math.random()*6; var rot=(Math.random()>0.5?360:-360)+'deg';
    flake.style.fontSize=size+'px';
    flake.style.left=left+'vw';
    flake.style.setProperty('--dx', drift+'px');
    flake.style.setProperty('--rot', rot);
    flake.style.animation='fall '+dur+'s linear forwards';
    document.body.appendChild(flake);
    setTimeout(function(){ try{flake.remove();}catch(e){} }, (dur*1000)+200);
  }
  function startSnow(){ if(snowOn) return; snowOn=true; snowTimer=setInterval(spawnFlake, 420); document.body.setAttribute('data-snow','on'); }
  function stopSnow(){ snowOn=false; if(snowTimer) clearInterval(snowTimer); snowTimer=null; document.body.removeAttribute('data-snow'); Array.from(document.querySelectorAll('.stellar-snow-flake')).forEach(function(n){ try{n.remove();}catch(e){} }); }
  function toggleSnow(){ if(snowOn){ stopSnow(); showToast('飘落已关闭'); } else { startSnow(); showToast('飘落已开启'); } }

  // 夜间/黑暗模式
  var darkOn = (localStorage.getItem('stellar_dark') === '1')
    || document.documentElement.classList.contains('dark')
    || (document.documentElement.dataset.theme === 'dark')
    || (document.body && (document.body.classList.contains('dark') || document.body.dataset.theme === 'dark'));
  function applyDark(on){
    try {
      var root = document.documentElement;
      var body = document.body;
      if(on){
        root.classList.add('dark');
        root.dataset.theme = 'dark';
        if (body) { body.classList.add('dark'); body.dataset.theme = 'dark'; }
        localStorage.setItem('stellar_dark','1');
      } else {
        root.classList.remove('dark');
        root.dataset.theme = 'light';
        if (body) { body.classList.remove('dark'); body.dataset.theme = 'light'; }
        localStorage.setItem('stellar_dark','0');
      }
    } catch(e) {}
  }
  function toggleDark(){ darkOn=!darkOn; applyDark(darkOn); showToast(darkOn?'夜间模式已开启':'夜间模式已关闭'); }

  ready(function(){
    ensureLeft(function(left){
      function mountLeft() {
        try {
          // 1) 签名：遵循左栏 header.logo-wrap > a.title 结构，在 .sub 之后插入一行，继承 .sub 样式
          var titleEl = left.querySelector('.logo-wrap .title, a.title');
          // 将左栏昵称改为 Slience（尽量只替换可见文本，不破坏 .sub 等结构）
          if (titleEl) {
            (function(){
              var nameEl = titleEl.querySelector('.name,.main,.nickname,.title-text');
              if (nameEl) {
                nameEl.textContent = 'Slience';
              } else {
                var replaced = false;
                for (var i=0;i<titleEl.childNodes.length;i++){
                  var n = titleEl.childNodes[i];
                  if (n && n.nodeType === 3 && n.textContent.trim()) {
                    n.textContent = 'Slience';
                    replaced = true;
                    break;
                  }
                }
                if (!replaced) {
                  var firstSub = titleEl.querySelector('.sub');
                  var span = document.createElement('span');
                  span.className = 'title-text';
                  span.textContent = 'Slience';
                  if (firstSub) firstSub.insertAdjacentElement('beforebegin', span);
                  else titleEl.insertBefore(span, titleEl.firstChild);
                }
              }
            })();
          }
          if (titleEl && !titleEl.querySelector('.stellar-signature')) {
            var sig = document.createElement('div');
            sig.className = 'sub stellar-signature';
            // 座右铭默认文案
            sig.textContent = '认清了生活的真相';
            var lastSub = titleEl.querySelector('.sub:last-of-type');
            if (lastSub) lastSub.insertAdjacentElement('afterend', sig);
            else titleEl.appendChild(sig);
          }
          // 绑定/更新座右铭的 hover/touch 文案切换（防重复）
          var sigEl = titleEl && titleEl.querySelector('.stellar-signature');
          if (sigEl) {
            var baseText = '认清了生活的真相.';
            var hoverText = '仍然热爱生活.';
            // 仅在首次绑定时设置默认文本，避免重挂载期间打断悬停态
            if (!sigEl.dataset.bound) {
              sigEl.textContent = baseText;
              var enter = function(){ sigEl.textContent = hoverText; };
              var leave = function(){ sigEl.textContent = baseText; };
              sigEl.addEventListener('mouseenter', enter);
              sigEl.addEventListener('mouseleave', leave);
              // 触摸设备支持：触摸时显示 hover 文案，结束后稍后还原
              sigEl.addEventListener('touchstart', function(){ sigEl.textContent = hoverText; }, {passive: true});
              sigEl.addEventListener('touchend', function(){ setTimeout(function(){ sigEl.textContent = baseText; }, 500); }, {passive: true});
              sigEl.dataset.bound = '1';
            }
          }

          // 2) 底部功能图标栏：确保作为左栏最后一个子元素挂载，并避免重复绑定事件
          var bar = left.querySelector('.stellar-left-bottombar');
          if (!bar) {
            bar = document.createElement('div');
            bar.className = 'stellar-left-bottombar';
            bar.innerHTML = `
              <a class="i-github jump" href="https://github.com/Fisory" target="_blank" rel="noopener" title="GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" role="img">
                  <path d="M12 2C6.477 2 2 6.486 2 12.026c0 4.425 2.865 8.18 6.839 9.504.5.092.683-.219.683-.486 0-.24-.009-.876-.014-1.72-2.782.605-3.369-1.343-3.369-1.343-.455-1.164-1.11-1.475-1.11-1.475-.907-.62.069-.608.069-.608 1.003.071 1.531 1.032 1.531 1.032.892 1.538 2.341 1.094 2.91.836.091-.653.35-1.095.636-1.347-2.221-.254-4.555-1.114-4.555-4.956 0-1.094.39-1.989 1.029-2.689-.103-.253-.446-1.273.098-2.654 0 0 .84-.27 2.75 1.027A9.564 9.564 0 0 1 12 6.844c.85.004 1.706.115 2.506.337 1.909-1.297 2.748-1.027 2.748-1.027.546 1.381.203 2.401.1 2.654.64.7 1.027 1.595 1.027 2.689 0 3.852-2.338 4.699-4.566 4.949.359.31.678.92.678 1.853 0 1.337-.012 2.415-.012 2.742 0 .27.18.583.688.484A10.03 10.03 0 0 0 22 12.026C22 6.486 17.523 2 12 2z"></path>
                </svg>
              </a>
              <a class="i-music flip" href="https://music.163.com/#/user/home?id=1688490951" target="_blank" rel="noopener" title="网易云音乐">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="img">
                  <path d="M9 18a3 3 0 1 1 0-6v-6l10-2v7"></path>
                  <circle cx="15" cy="17" r="3"></circle>
                </svg>
              </a>
              <a class="i-play jump" href="https://space.bilibili.com/354135728" target="_blank" rel="noopener" title="Bilibili">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" role="img">
                  <polygon points="6,4 20,12 6,20"></polygon>
                </svg>
              </a>
              <a class="i-chat shake" href="/guestbook/" title="友链与留言区">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="img">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-4 3v-3a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h13a4 4 0 0 1 4 4z" transform="translate(2 1) scale(.9)"></path>
                </svg>
              </a>
              <a class="i-snow spin" href="javascript:void(0)" title="飘落开关">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="img">
                  <path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07L19.07 4.93"></path>
                </svg>
              </a>
              <a class="i-moon" href="javascript:void(0)" title="夜间模式">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" role="img">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path>
                </svg>
              </a>`;
            left.appendChild(bar);
          } else {
            // 已存在则不重复调整位置，避免与主题的动态重排互相“抢位”造成高频变动
          }

          if (bar && !bar.dataset.bound) {
            var snowBtn = bar.querySelector('.i-snow');
            var moonBtn = bar.querySelector('.i-moon');
            if (snowBtn) snowBtn.addEventListener('click', function(e){ e.preventDefault(); toggleSnow(); this.setAttribute('aria-pressed', snowOn?'true':'false'); this.title = snowOn? '飘落开关（已开启）':'飘落开关（已关闭）'; });
            if (moonBtn) moonBtn.addEventListener('click', function(e){ e.preventDefault(); toggleDark(); this.setAttribute('aria-pressed', darkOn?'true':'false'); this.title = darkOn? '夜间模式（已开启）':'夜间模式（已关闭）'; });
            bar.dataset.bound = '1';
          }

          // 初始化夜间模式状态（确保每次挂载都一致）
          applyDark(darkOn);
        } catch(e) {}
      }

      // 首次挂载
      mountLeft();

      // 监听左栏结构变化，若主题后续重排/懒加载导致元素丢失，则自动补挂（加防抖）
      try {
        function scheduleMount(){
          if (left.__mountScheduled) return;
          left.__mountScheduled = true;
          setTimeout(function(){ left.__mountScheduled = false; try{ mountLeft(); }catch(e){} }, 80);
        }
        var mo2 = new MutationObserver(function(){ scheduleMount(); });
        mo2.observe(left, { childList: true, subtree: true });
      } catch(e) {}
    });
  });
})();