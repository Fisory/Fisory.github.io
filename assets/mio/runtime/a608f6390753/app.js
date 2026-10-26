import { DEFAULT_SCENE, validateScene, presetScene } from './rules.js';
import { CanvasPlayer, captureFrames } from './engine.js';

const DRAFT_KEY = 'mio-draft-v1';
const GREETING = '我带来了一小片星云。不过，它好像还没学会平静。你想让它变成什么样？';
const clone = value => JSON.parse(JSON.stringify(value));

function initialise(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  const get = selector => root.querySelector(selector);
  const all = selector => [...root.querySelectorAll(selector)];
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const apiBase = local ? 'http://localhost:8788' : root.dataset.api;
  let versions = [validateScene(DEFAULT_SCENE)], versionIndex = 0, conversation = [], savedWorkId = null;
  let actor = null, csrf = '', capabilities = { ai: false, github: false, email: false }, busy = false;
  let experimentId = null, controller = null, comparePlayer = null, memoryEditId = null, suggestion = null;
  let challengeId = null, speech = null, speechActive = false, lastReply = GREETING;
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (draft?.versions?.length) {
      versions = draft.versions.slice(-24).map(validateScene);
      versionIndex = Math.min(versions.length - 1, Math.max(0, Number(draft.index) || 0));
      conversation = Array.isArray(draft.conversation) ? draft.conversation.slice(-60).filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 1800) })) : [];
      savedWorkId = typeof draft.savedWorkId === 'string' ? draft.savedWorkId : null;
    }
  } catch { /* A corrupt draft must not prevent a fresh canvas. */ }
  const current = () => versions[versionIndex];
  function persist() { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ versions, index: versionIndex, conversation, savedWorkId })); } catch { toast('标签页存储不可用，建议导出作品。'); } }
  function toast(message) { const target = get('[data-toast]'); target.textContent = message; target.hidden = false; clearTimeout(target._timer); target._timer = setTimeout(() => { target.hidden = true; }, 7000); }
  function status(message) { get('[data-status]').textContent = message; }
  function log(message) {
    const item = document.createElement('li'); item.textContent = `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} · ${message}`;
    const list = get('[data-process-log]'); list.appendChild(item); while (list.children.length > 35) list.firstChild.remove();
  }
  function character(emotion, label) {
    get('[data-character]').dataset.emotion = emotion;
    get('[data-character-state]').textContent = label;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function gaze(x, y) {
    if (reducedMotion.matches) return;
    const horizontal = Number.isFinite(x) ? Math.min(1, Math.max(0, x)) - .5 : 0;
    const vertical = Number.isFinite(y) ? Math.min(1, Math.max(0, y)) - .5 : 0;
    const portrait = get('[data-character]');
    portrait.style.setProperty('--mio-look-x', `${horizontal * 5}px`);
    portrait.style.setProperty('--mio-look-y', `${vertical * 3}px`);
    portrait.style.setProperty('--mio-look-angle', `${horizontal * 1.6}deg`);
  }
  const player = new CanvasPlayer(get('[data-canvas]'), current(), { onPointer: gaze, onError: error => { stop(); log(`画布运行异常：${error.message}。已暂停，仍可撤回。`); toast('规则运行异常，画面已暂停；可以撤回到之前的版本。'); renderVersions(); } });
  const characterArt = get('[data-character-art]');
  characterArt.addEventListener('error', () => { get('[data-character]').dataset.imageError = 'true'; });
  if (characterArt.complete && !characterArt.naturalWidth) get('[data-character]').dataset.imageError = 'true';

  async function api(path, { method = 'GET', data, signal } = {}) {
    const response = await fetch(apiBase + path, { method, credentials: 'include', signal, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Mio-CSRF': csrf } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    let result; try { result = await response.json(); } catch { throw new Error('后台暂时没有返回可用结果，原作品已保留。'); }
    if (!response.ok) { const error = new Error(result.error?.message || '请求未能完成。'); error.code = result.error?.code; throw error; }
    return result;
  }
  function message(role, content, save = true) {
    const item = document.createElement('div'); item.className = `mio-message mio-message-${role}`; item.textContent = content;
    const panel = get('[data-conversation]'); panel.appendChild(item); panel.scrollTop = panel.scrollHeight;
    if (role === 'assistant') lastReply = content;
    if (save) { conversation.push({ role, content }); conversation = conversation.slice(-60); persist(); }
  }
  function renderConversation() {
    get('[data-conversation]').replaceChildren();
    if (!conversation.length) message('assistant', GREETING, false);
    else conversation.forEach(entry => message(entry.role, entry.content, false));
  }
  function renderVersions() {
    get('[data-title]').textContent = current().title;
    get('[data-canvas]').setAttribute('aria-label', `${current().title}，可以用鼠标或手指互动的粒子作品`);
    get('[data-version]').textContent = `v${versionIndex + 1} / ${versions.length} · ${actor ? '私人创作' : '访客草稿'}`;
    get('[data-undo]').disabled = versionIndex === 0;
    get('[data-redo]').disabled = versionIndex >= versions.length - 1;
    get('[data-compare]').disabled = versionIndex === 0;
    get('[data-pause]').textContent = player.paused ? '播放' : '暂停';
    get('[data-pause]').setAttribute('aria-pressed', String(player.paused));
    get('[data-rule-x]').textContent = `水平加速度：${current().forceX}`;
    get('[data-rule-y]').textContent = `垂直加速度：${current().forceY}`;
    const select = get('[data-version-select]'); select.replaceChildren();
    versions.forEach((version, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = `v${index + 1} · ${version.title}`; select.appendChild(option); }); select.value = String(versionIndex);
    if (comparePlayer) { if (!versionIndex) toggleCompare(false); else comparePlayer.setScene(versions[versionIndex - 1]); }
  }
  function applyScene(input, reason) {
    const checked = validateScene(input);
    if (JSON.stringify(checked) === JSON.stringify(current())) return;
    versions = versions.slice(0, versionIndex + 1); versions.push(clone(checked));
    if (versions.length > 24) versions.shift(); versionIndex = versions.length - 1;
    player.setScene(checked); renderVersions(); persist(); log(reason || '规则已应用，已保留可撤回的版本。');
  }
  function selectVersion(index) { stop(); versionIndex = Math.max(0, Math.min(versions.length - 1, index)); player.setScene(current()); renderVersions(); persist(); log(`切换到 v${versionIndex + 1}，没有改动已保存的云端作品。`); }
  function toggleCompare(on) {
    comparePlayer?.destroy(); comparePlayer = null;
    const enabled = Boolean(on && versionIndex > 0);
    get('.mio-compare-wrap').hidden = !enabled; get('[data-current-label]').hidden = !enabled;
    get('.mio-canvases').classList.toggle('is-comparing', enabled);
    get('[data-compare]').setAttribute('aria-pressed', String(enabled));
    if (enabled) comparePlayer = new CanvasPlayer(get('[data-compare-canvas]'), versions[versionIndex - 1]);
    player.resize();
  }
  function setBusy(value) {
    busy = value; get('[data-send]').disabled = value || !capabilities.ai;
    all('[data-preset],[data-idea]').forEach(button => { button.disabled = value; });
    get('[data-stop]').hidden = !value; get('[data-send]').textContent = value ? '实验中…' : '一起试试 ↗';
  }
  function stop() {
    if (!busy) return;
    controller?.abort(); const active = experimentId; experimentId = null;
    if (active) api(`/api/experiments/${active}/stop`, { method: 'POST', data: {} }).catch(() => {});
    setBusy(false); character('idle', '你说停，我们就停'); status('实验已停止；保留当前有效版本，可以继续撤回。'); log('你停止了实验；不再应用后续回复。');
  }
  function preflight(input, signal) {
    return new Promise((resolve, reject) => {
      const sandbox = new Worker(new URL('./preflight-worker.js', import.meta.url), { type: 'module' });
      const finish = callback => value => { clearTimeout(timeout); signal.removeEventListener('abort', abort); sandbox.terminate(); callback(value); };
      const abort = () => finish(reject)(new DOMException('实验已停止', 'AbortError'));
      const timeout = setTimeout(() => finish(reject)(new Error('试运行超过安全时限，规则未应用。')), 3000);
      signal.addEventListener('abort', abort, { once: true });
      sandbox.onmessage = event => event.data.ok ? finish(resolve)(event.data.report) : finish(reject)(new Error(event.data.error));
      sandbox.onerror = () => finish(reject)(new Error('试运行程序未能启动；规则未应用。'));
      sandbox.postMessage(input);
    });
  }
  function memorySuggestion(text) {
    if (!text) return;
    suggestion = text; const button = get('[data-memory-suggestion]'); button.textContent = 'Mio 建议记住一件事 · 查看并确认'; button.hidden = false;
  }
  async function experiment(goal) {
    if (busy) return;
    if (!capabilities.ai) { toast('AI 后台还没有连接；本地作品起点仍可使用。'); return; }
    const history = clone(conversation); message('user', goal); setBusy(true);
    const localController = new AbortController(); controller = localController; const signal = localController.signal;
    character('thinking', '正在琢磨你的想法'); status('Mio 正在设计规则；原作品仍然可以触摸。');
    try {
      let result = await api('/api/experiments', { method: 'POST', data: { goal, scene: current(), messages: history }, signal });
      if (signal.aborted) return;
      experimentId = result.experimentId;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (signal.aborted) return;
        if (result.reply) message('assistant', result.reply);
        memorySuggestion(result.memorySuggestion);
        if (!result.scene) break;
        get('[data-round]').textContent = `第 ${result.round} / 3 轮 · 规则检查与试运行`;
        character('curious', '在认真看它会怎样动');
        let stable = false, report, frames = [];
        try {
          const checked = validateScene(result.scene); report = await preflight(checked, signal);
          if (signal.aborted) return;
          applyScene(checked, `第 ${result.round} 轮通过：${report.testedParticles} 个样本粒子，${report.testedFrames} 帧，${report.testMs} ms。`);
          result.changes?.forEach(change => log(`改动：${change}`));
          frames = await captureFrames(checked, signal); stable = true;
          report = { ...report, ...player.metrics() };
        } catch (error) {
          if (signal.aborted) return;
          report = { stable: false, error: error.message }; log(`第 ${result.round} 轮未应用：${error.message}`);
        }
        get('[data-round]').textContent = `第 ${result.round} / 3 轮 · 查看实际画面`;
        status(stable ? '规则已通过试运行。Mio 正在看几个时间点的作品预览。' : '新规则没有通过试运行，保留原作品，Mio 正在调整。');
        character('thinking', '在观察刚才的实验结果');
        result = await api(`/api/experiments/${experimentId}/feedback`, { method: 'POST', data: { round: result.round, stable, report, frames }, signal });
        if (result.action === 'finish') { if (result.reply) message('assistant', result.reply); memorySuggestion(result.memorySuggestion); if (result.limitReached) log('已到3轮上限，不再自动尝试。'); break; }
      }
      if (!signal.aborted) { status('这次实验已结束。保留所有有效版本，你可以比较、撤回或继续提想法。'); character('happy', '等你看看这次的光'); log('本次共创结束。画面评价是 Mio 的建议，最终由你判断。'); }
    } catch (error) {
      if (!signal.aborted) { toast(error.message); status(error.message); log(`实验没有完成：${error.message}`); character('idle', '先保留这件作品'); }
    } finally {
      if (controller === localController) { controller = null; experimentId = null; setBusy(false); get('[data-round]').textContent = '一次最多 3 轮实验'; }
    }
  }
  function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  function closeDialog(dialog) { dialog.close(); }
  function renderAccount() {
    get('[data-account]').textContent = actor ? `${actor.name} · 私人创作空间` : '未登录 · 草稿仅保留在此标签页';
    get('[data-login]').textContent = actor ? '我的作品' : '登录 / 保存';
    get('[data-logout]').hidden = !actor; get('[data-admin-library]').hidden = !actor?.admin;
    get('[data-github]').disabled = !capabilities.github;
    get('[data-github-note]').textContent = capabilities.github ? '只获取身份和邮箱，不读取你的仓库。' : 'GitHub 登录应用尚未完成配置。';
    get('[data-email-send]').disabled = !capabilities.email;
    get('[data-email-note]').textContent = capabilities.email ? '验证码10分钟内有效；发送后也请检查垃圾邮件。' : '邮箱发送服务尚未配置，可以先使用可用的 GitHub 登录或导出作品。';
    setBusy(busy); renderVersions();
  }
  async function connect() {
    try {
      const result = await api('/api/session'); actor = result.user; csrf = result.csrf; capabilities = result.capabilities;
      renderAccount(); status(capabilities.ai ? 'Mio 已连接 · 触摸星云，或告诉它一个想法。' : '画布可以使用；AI 后台尚未配置。');
      if (actor) refreshPrivate();
      if (location.hash.startsWith('#auth_error=')) { toast(decodeURIComponent(location.hash.slice(12))); history.replaceState(null, '', location.pathname + location.search); }
      else if (location.hash === '#signed-in') { toast('登录成功，之前的创作已接续。'); history.replaceState(null, '', location.pathname + location.search); }
      const shared = new URLSearchParams(location.search).get('work');
      if (shared && /^[0-9a-f-]{36}$/.test(shared)) { const work = await api(`/api/public/works/${shared}`); applyScene(work.scene, '载入公开作品的独立副本，原作不会被改动。'); savedWorkId = null; persist(); }
    } catch { status('暂时无法连接后台。星云、本地规则、版本撤回和作品导出仍可使用。'); renderAccount(); }
  }
  function ensureLogin() { if (actor) return true; get('[data-login-status]').textContent = ''; openDialog(get('[data-login-dialog]')); return false; }
  async function save() {
    if (!ensureLogin()) return;
    try {
      const result = await api(savedWorkId ? `/api/works/${savedWorkId}` : '/api/works', { method: savedWorkId ? 'PUT' : 'POST', data: { scene: current(), versions, conversation, thumbnail: player.thumbnail(), tags: [] } });
      savedWorkId = result.id; persist(); toast('已保存到你的私人空间。更新已公开的作品后，需要重新公开。'); log('云端保存成功，默认私密。'); await refreshPrivate();
    } catch (error) { toast(error.message); }
  }
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function action(label, callback) { const button = element('button', 'mio-button', label); button.type = 'button'; button.addEventListener('click', async () => { button.disabled = true; try { await callback(); } catch (error) { toast(error.message); } finally { button.disabled = false; } }); return button; }
  function cards(target, works, type) {
    target.replaceChildren();
    if (!works.length) { target.appendChild(element('p', 'mio-empty', type === 'private' ? '还没有保存的作品。' : type === 'admin' ? '目前没有待审核作品。' : '还没有公开作品。你可以成为第一个创作者。')); return; }
    works.forEach(work => {
      const card = element('article', 'mio-work-card');
      if (/^data:image\/jpeg;base64,/.test(work.thumbnail || '')) { const image = element('img'); image.src = work.thumbnail; image.alt = work.scene?.title || work.title || '粒子作品预览'; image.loading = 'lazy'; card.appendChild(image); }
      card.appendChild(element('h3', '', work.scene?.title || work.title));
      const publication = { private: '私密', pending: '等待审核', public: '已公开', rejected: '未通过审核' }[work.publication];
      card.appendChild(element('div', 'mio-work-meta', type === 'private' ? publication : work.author || '创作者'));
      const tools = element('div');
      if (type === 'private') {
        tools.append(action('继续创作', () => { stop(); versions = (work.versions?.length ? work.versions : [work.scene]).map(validateScene); versionIndex = Number.isInteger(work.versionIndex) ? Math.min(versions.length - 1, Math.max(0, work.versionIndex)) : versions.length - 1; conversation = work.conversation || []; savedWorkId = work.id; player.setScene(current()); renderConversation(); renderVersions(); persist(); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('已载入你的作品与私人对话。'); }));
        tools.append(action(work.publication === 'public' || work.publication === 'pending' ? '转为私密' : '申请公开', async () => {
          const hiding = ['public', 'pending'].includes(work.publication);
          if (!hiding && !confirm('公开画面、规则、标题和你的昵称。私人对话与记忆不会公开。其他人可以复制再创作。确认申请公开吗？')) return;
          const result = await api(`/api/works/${work.id}/${hiding ? 'unpublish' : 'publish'}`, { method: 'POST', data: { confirmed: true } });
          toast(result.publication === 'pending' ? '已申请公开，等待站长审核。' : result.publication === 'public' ? '作品已公开。' : '作品已转为私密。'); await refreshPrivate();
        }));
        if (work.publication === 'public') tools.append(action('复制分享链接', async () => { await navigator.clipboard.writeText(`${location.origin}/lab/mio/?work=${encodeURIComponent(work.id)}`); toast('分享链接已复制。'); }));
        tools.append(action('删除', async () => { if (!confirm('删除这件云端作品？已公开的内容也会撤下。当前画布不会被清空。')) return; await api(`/api/works/${work.id}`, { method: 'DELETE', data: {} }); if (savedWorkId === work.id) { savedWorkId = null; persist(); } await refreshPrivate(); }));
      } else if (type === 'public') tools.append(action('复制并创作', () => { stop(); applyScene(work.scene, '复制公开作品，在你的空间继续创作，原作不会被改动。'); savedWorkId = null; persist(); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
      else { tools.append(action('通过', async () => { await api(`/api/admin/works/${work.id}`, { method: 'POST', data: { approved: true } }); await refreshAdmin(); })); tools.append(action('拒绝', async () => { await api(`/api/admin/works/${work.id}`, { method: 'POST', data: { approved: false } }); await refreshAdmin(); })); }
      card.appendChild(tools); target.appendChild(card);
    });
  }
  async function refreshPrivate() { if (!actor) return; try { cards(get('[data-private-works]'), (await api('/api/works')).works, 'private'); } catch (error) { get('[data-private-works]').textContent = error.message; } }
  async function refreshPublic() { try { cards(get('[data-public-works]'), (await api('/api/public/works')).works, 'public'); } catch (error) { get('[data-public-works]').textContent = error.message; } }
  async function refreshAdmin() { try { cards(get('[data-admin-works]'), (await api('/api/admin/works')).works, 'admin'); } catch (error) { get('[data-admin-works]').textContent = error.message; } }
  async function refreshMemories() {
    const target = get('[data-memory-list]'); target.replaceChildren();
    const result = await api('/api/memories');
    if (!result.memories.length) target.appendChild(element('p', 'mio-empty', '还没有记忆。Mio 不会自动保存你的生活故事。'));
    result.memories.forEach(memory => {
      const card = element('section', 'mio-memory-item'); card.appendChild(element('p', '', memory.content));
      const tools = element('div'); tools.append(action('修改', () => { memoryEditId = memory.id; get('#mio-memory-kind').value = memory.kind; get('#mio-memory-content').value = memory.content; get('[data-memory-confirm]').checked = false; get('[data-memory-reset]').hidden = false; }));
      tools.append(action('删除', async () => { if (!confirm('从 Mio 的长期记忆中删除这段内容？')) return; await api(`/api/memories/${memory.id}`, { method: 'DELETE', data: {} }); await refreshMemories(); })); card.appendChild(tools); target.appendChild(card);
    });
  }
  function resetMemory() { memoryEditId = null; get('[data-memory-form]').reset(); get('[data-memory-reset]').hidden = true; }
  async function openMemories(text) { if (!ensureLogin()) return; resetMemory(); if (text) get('#mio-memory-content').value = text; openDialog(get('[data-memory-dialog]')); try { await refreshMemories(); } catch (error) { get('[data-memory-status]').textContent = error.message; } }
  all('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  get('[data-login]').addEventListener('click', () => { if (!actor) ensureLogin(); else { get('[data-private-library]').open = true; refreshPrivate(); get('[data-private-library]').scrollIntoView({ behavior: 'smooth' }); } });
  get('[data-save]').addEventListener('click', save);
  get('[data-pause]').addEventListener('click', () => { player.paused = !player.paused; if (comparePlayer) comparePlayer.paused = player.paused; renderVersions(); });
  get('[data-undo]').addEventListener('click', () => selectVersion(versionIndex - 1));
  get('[data-redo]').addEventListener('click', () => selectVersion(versionIndex + 1));
  get('[data-version-select]').addEventListener('change', event => selectVersion(Number(event.target.value)));
  get('[data-compare]').addEventListener('click', () => toggleCompare(!comparePlayer));
  get('[data-stop]').addEventListener('click', stop);
  all('[data-preset]').forEach(button => button.addEventListener('click', () => { stop(); applyScene(presetScene(button.dataset.preset), '由你选择了本地规则；没有调用 AI。'); character('curious', '这个起点也很值得探索'); }));
  all('[data-idea]').forEach(button => button.addEventListener('click', () => { get('#mio-prompt').value = button.dataset.idea; get('#mio-prompt').focus(); }));
  get('[data-composer]').addEventListener('submit', event => { event.preventDefault(); const input = get('#mio-prompt'), goal = input.value.trim(); if (!goal) return; input.value = ''; experiment(goal); });
  get('[data-github]').addEventListener('click', () => { persist(); location.assign(apiBase + '/auth/github'); });
  get('[data-email-form]').addEventListener('submit', async event => {
    event.preventDefault(); get('[data-email-send]').disabled = true;
    try { const result = await api('/api/auth/email/start', { method: 'POST', data: { email: get('#mio-email').value } }); challengeId = result.challengeId; get('[data-code-area]').hidden = false; get('[data-login-status]').textContent = '验证码已发送，请检查邮箱。'; get('#mio-code').focus(); }
    catch (error) { get('[data-login-status]').textContent = error.message; }
    finally { setTimeout(() => { get('[data-email-send]').disabled = !capabilities.email; }, 60000); }
  });
  get('[data-email-verify]').addEventListener('click', async () => {
    try { await api('/api/auth/email/verify', { method: 'POST', data: { challengeId, code: get('#mio-code').value.trim() } }); closeDialog(get('[data-login-dialog]')); await connect(); toast('登录成功，当前创作可以保存了。'); }
    catch (error) { get('[data-login-status]').textContent = error.message; }
  });
  get('[data-logout]').addEventListener('click', async () => {
    try { stop(); await api('/api/auth/logout', { method: 'POST', data: {} }); actor = null; csrf = ''; savedWorkId = null; conversation = []; versions = [validateScene(DEFAULT_SCENE)]; versionIndex = 0; sessionStorage.removeItem(DRAFT_KEY); player.setScene(current()); renderConversation(); get('[data-private-works]').replaceChildren(element('p', 'mio-empty', '登录后查看私人作品。')); await connect(); toast('已退出并清除这个标签页的私人草稿。云端作品仍保留。'); }
    catch (error) { toast(error.message); }
  });
  get('[data-memories]').addEventListener('click', () => openMemories());
  get('[data-memory-suggestion]').addEventListener('click', () => openMemories(suggestion));
  get('[data-memory-reset]').addEventListener('click', resetMemory);
  get('[data-memory-form]').addEventListener('submit', async event => {
    event.preventDefault(); if (!get('[data-memory-confirm]').checked) return;
    try { await api(memoryEditId ? `/api/memories/${memoryEditId}` : '/api/memories', { method: memoryEditId ? 'PUT' : 'POST', data: { kind: get('#mio-memory-kind').value, content: get('#mio-memory-content').value, confirmed: true } }); resetMemory(); get('[data-memory-status]').textContent = '已确认保存，只有你的空间能使用这段记忆。'; get('[data-memory-suggestion]').hidden = true; suggestion = null; await refreshMemories(); }
    catch (error) { get('[data-memory-status]').textContent = error.message; }
  });
  for (const [selector, refresh] of [['[data-private-library]', refreshPrivate], ['[data-public-library]', refreshPublic], ['[data-admin-library]', refreshAdmin]]) get(selector).addEventListener('toggle', event => { if (event.target.open) refresh(); });
  get('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ format: 'mio-particle-work', version: 1, scene: current(), versions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `mio-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('导出的作品不包含私人对话和记忆。');
  });
  get('[data-import]').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { if (file.size > 180000) throw new Error('作品文件不能超过180KB。'); const imported = JSON.parse(await file.text()); if (imported.format !== 'mio-particle-work' || imported.version !== 1) throw new Error('这不是支持的 Mio 作品文件。'); const checked = validateScene(imported.scene); stop(); applyScene(checked, '从本地文件导入作品规则。'); savedWorkId = null; persist(); toast('作品已导入为独立草稿。'); }
    catch (error) { toast(error.message); } finally { event.target.value = ''; }
  });
  get('[data-delete-account]').addEventListener('click', async () => {
    if (!ensureLogin()) return; const confirmation = prompt('删除账户会永久删除你的云端作品和记忆，包括已公开的作品。请输入：删除我的账户');
    if (confirmation !== '删除我的账户') return;
    try { await api('/api/account', { method: 'DELETE', data: { confirmation } }); sessionStorage.removeItem(DRAFT_KEY); location.reload(); } catch (error) { toast(error.message); }
  });
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  get('[data-microphone]').disabled = !Recognition;
  if (!Recognition) get('[data-microphone]').textContent = '此浏览器请用文字输入';
  get('[data-microphone]').addEventListener('click', () => {
    if (speechActive) { speech?.stop(); return; }
    if (!sessionStorage.getItem('mio-voice-consent')) { if (!confirm('语音识别会请求麦克风权限，并可能将声音交给浏览器厂商的识别服务。只在你按下按钮时开启。继续吗？')) return; sessionStorage.setItem('mio-voice-consent', '1'); }
    speech = new Recognition(); speech.lang = 'zh-CN'; speech.continuous = false; speech.interimResults = false;
    speech.onstart = () => { speechActive = true; get('[data-microphone]').setAttribute('aria-pressed', 'true'); get('[data-microphone]').textContent = '正在听 · 点击停止'; };
    speech.onresult = event => { get('#mio-prompt').value = event.results[0][0].transcript.slice(0, 1800); toast('已转成文字，检查后再发送。'); };
    speech.onerror = () => toast('语音识别未能完成，请改用文字输入。');
    speech.onend = () => { speechActive = false; get('[data-microphone]').setAttribute('aria-pressed', 'false'); get('[data-microphone]').textContent = '按下说话'; };
    try { speech.start(); } catch { toast('当前无法开启语音识别。'); }
  });
  get('[data-speak]').disabled = !('speechSynthesis' in window);
  get('[data-speak]').addEventListener('click', () => {
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(lastReply); utterance.lang = 'zh-CN'; utterance.rate = .98;
    const voice = speechSynthesis.getVoices().find(v => /^zh[-_]/i.test(v.lang)); if (voice) utterance.voice = voice;
    utterance.onstart = () => character('speaking', '正在把这句话讲给你听');
    utterance.onend = utterance.onerror = () => character('idle', '继续一起看看吧'); speechSynthesis.speak(utterance);
  });
  window.addEventListener('pagehide', () => { stop(); player.destroy(); comparePlayer?.destroy(); speech?.abort(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }, { once: true });
  renderConversation(); renderVersions(); setBusy(false); log('载入呼吸星云。触摸和本地规则不消耗 AI 额度。'); connect();
}

const mount = () => initialise(document.getElementById('mio-lab'));
mount(); document.addEventListener('DOMContentLoaded', mount, { once: true }); document.addEventListener('pjax:complete', mount);
