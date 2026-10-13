import { PLAYER_ID, LIMITS, PLACE, FACTIONS, DIRECTIONS, ROLE_NAMES, CLUES } from './config.js';
import { createWorld, advanceRound, injectEvent, guidePlayer, chatWithPlayer, addResident, presentation, clock, exportExperiment, importExperiment } from './engine.js';
import { mountMap } from './map.js';
import { createGateway } from './gateway.js';

const root = document.getElementById('arcane-world');
if (root) initialise(root);

function initialise(root) {
  const $ = selector => root.querySelector(selector), all = selector => [...root.querySelectorAll(selector)];
  const storageKey = 'arcane-world-prototype-v1', gateway = createGateway();
  let history = [createWorld()], archivedDraft = null, viewIndex = null, mode = 'story', selected = PLAYER_ID, placeId = 'city';
  let meta = null, report = null, connected = false, busy = false, running = false, timer = null, automaticRounds = 0, runEpoch = 0, pendingImport = null;
  try { const saved = sessionStorage.getItem(storageKey); if (saved) { history = importExperiment(saved); archivedDraft = saved; } }
  catch { /* Do not delete a malformed user's draft. */ }
  const latest = () => history.at(-1), displayed = () => viewIndex === null ? latest() : history[viewIndex];
  const write = (selector, value) => { $(selector).textContent = value; };
  const status = message => write('[data-status]', message);
  const source = () => $('[data-source]').value;
  const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; };
  const actionNames = { move: '沿路移动', rest: '休息', gather: '采集', charge: '供能', repair: '维修', inspect: '识读符文', cloak: '幻术隐匿', trade: '购买魔晶', share: '公开线索', propose: '提出托管方案', vote: '投票', say: '与居民交谈', give: '转交魔晶' };

  function saveOffline() { if (connected) return; try { sessionStorage.setItem(storageKey, exportExperiment(history)); } catch { status('标签页保存失败，关闭前请导出实验。'); } }
  function commitOffline(next) { history = [...history, next].slice(-LIMITS.history); viewIndex = null; saveOffline(); render(); }
  function accept(result) { history = result.history; meta = result.meta; report = result.report; connected = true; viewIndex = null; render(); if (result.reply) write('[data-chat-reply]', result.reply); }
  function pause(cancel = false) {
    running = false; runEpoch++; if (timer) clearTimeout(timer); timer = null; write('[data-run]', '开始运行');
    if (cancel && busy && connected) void gateway.cancel();
    render();
  }
  async function connect() {
    if (busy || running) return;
    busy = true; render(); status('正在连接本地世界服务……');
    try {
      const wasConnected = connected, result = await gateway.connect(); accept(result);
      if (!wasConnected) $('[data-source]').value = meta.aiConfigured ? 'deepseek' : 'rules';
      const actor = latest().actors.find(person => person.id === PLAYER_ID), prefix = `${actor.name}回应你：“`;
      const previousReply = latest().events.slice().reverse().find(event => event.actorId === PLAYER_ID && event.text.startsWith(prefix));
      write('[data-chat-reply]', previousReply ? previousReply.text.slice(prefix.length, -1) : '可以与法师自由对话。回复是建议与表达，实际行动留到下一轮，不会凭一句话获得资源。');
      status(meta.aiConfigured ? 'DeepSeek 已准备好，这次连接没有产生新调用。点击推进一轮或告诉法师时才会请求模型。' : '已连接持久化世界；DeepSeek 未配置，可先用规则模式。');
    } catch (error) { status(`${error.message} 当前保留离线草稿，没有调用模型。`); }
    finally { busy = false; render(); }
  }
  async function perform(kind, data, offlineWork, message) {
    if (viewIndex !== null || busy) { status('请先回到最新世界，并等待当前操作完成。'); return false; }
    busy = true; render();
    const ai = source() === 'deepseek' && ['step', 'chat'].includes(kind);
    status(ai ? kind === 'step' ? `居民正在分别思考：本轮最多 ${latest().actors.length} 次请求。整轮检查通过才保存。` : '法师正在回复；不会因对话直接执行行动。' : '正在检查并保存世界操作……');
    try {
      if (connected) accept(await gateway.command(kind, data, latest().version, source()));
      else {
        if (source() !== 'rules') throw new Error('真正的 AI 需要本地服务，不能在网页中配置密钥。');
        const result = offlineWork(latest());
        if (kind === 'chat') { commitOffline(result.state); write('[data-chat-reply]', result.reply); }
        else { commitOffline(result); if (kind === 'step') report = { source: 'rules', tick: latest().tick, decisions: [] }; }
      }
      status(message); return true;
    } catch (error) {
      running = false; runEpoch++; if (timer) clearTimeout(timer); timer = null;
      // Re-read an authoritative state after cancellation/conflict. Never retry a model call automatically.
      if (connected) { try { accept(await gateway.connect()); } catch { /* Keep the last acknowledged snapshot. */ } }
      status(`${error.message} 没有自动重试或偷偷改用规则。`); return false;
    } finally { busy = false; render(); }
  }
  const step = () => perform('step', {}, advanceRound, source() === 'deepseek' ? '真正的 AI 轮次已保存。查看“这一轮的决定”可核对来源与行动。' : '规则轮次已保存，没有调用云端模型。');
  async function runNext(epoch) {
    if (!running || epoch !== runEpoch || document.hidden) return;
    const success = await step(); if (!success || !running || epoch !== runEpoch) return;
    const maximum = source() === 'deepseek' ? 3 : 20;
    if (++automaticRounds >= maximum) { pause(); status(`已完成 ${maximum} 轮，自动暂停。重新开始需要你再次点击。`); return; }
    timer = setTimeout(() => void runNext(epoch), 2200);
  }
  for (const [id, label] of Object.entries(DIRECTIONS)) { $('[data-direction]').append(option(id, label)); $('[data-goal-options]').append(option(id, label)); }
  for (const [id, faction] of Object.entries(FACTIONS)) $('[data-faction-options]').append(option(id, faction.name));
  for (const [id, place] of Object.entries(PLACE)) $('[data-place-select]').append(option(id, `${place.name} · ${place.kind}`));
  const paintMap = mountMap($('[data-map]'), id => { placeId = id; renderPlace(); }, id => { selected = id; render(); });
  function renderPlace() { $('[data-place-select]').value = placeId; write('[data-place-description]', PLACE[placeId].description); }
  function render() {
    const state = displayed(); if (!state.actors.some(actor => actor.id === selected)) selected = PLAYER_ID;
    const { profile, events } = presentation(state, mode, selected), reveal = mode === 'observer' || selected === PLAYER_ID;
    root.dataset.mode = mode; root.dataset.connected = String(connected);
    for (const button of all('[data-mode]')) button.setAttribute('aria-selected', String(button.dataset.mode === mode));
    write('[data-notice]', connected ? source() === 'deepseek' ? `DeepSeek 已接入 · 每轮 ${state.actors.length} 次请求。虚构人设与相关记忆会发往 DeepSeek；点击运行才开始，不读取 Mio 私人资料。` : '服务端规则模式 · 不调用模型。世界仍由本机服务统一保存，可随时切换 AI。' : '离线规则预览 · 不调用模型。真正的 AI 请用 npm.cmd run world:preview 启动本地服务。');
    $('[data-source] option[value="deepseek"]').disabled = !connected || !meta?.aiConfigured;
    $('[data-reconnect]').hidden = false;
    write('[data-reconnect]', connected ? '刷新世界' : '连接本地服务');
    write('[data-budget]', connected ? `今日 ${meta.budget.calls} / ${meta.budget.limit} 次请求 · 剩余 ${meta.budget.remaining} 次 · 已知用量 ${(meta.budget.inputTokens + meta.budget.outputTokens).toLocaleString()} tokens${meta.budget.unknownUsage ? ` · ${meta.budget.unknownUsage} 次用量未返回` : ''} · 保存到本机 SQLite` : '草稿仅保存在当前标签页；关闭前可导出。');
    $('[data-restore-draft]').hidden = !connected || !archivedDraft || archivedDraft === exportExperiment(history);
    write('[data-clock]', clock(state.tick)); write('[data-energy]', `${state.core.energy} / 100`); write('[data-integrity]', `${state.core.integrity}%`); write('[data-stock]', `${state.core.crystals} 枚`); write('[data-custodian]', state.core.custodian === 'fair' ? '共同议会' : FACTIONS[state.core.custodian].name);
    $('[data-energy-meter]').value = state.core.energy; $('[data-integrity-meter]').value = state.core.integrity;
    $('[data-agent]').replaceChildren(...state.actors.map(actor => option(actor.id, `${actor.id === PLAYER_ID ? '你 · ' : ''}${actor.name}`))); $('[data-agent]').value = selected;
    write('[data-agent-name]', profile.name); write('[data-agent-subtitle]', `${profile.race} · ${ROLE_NAMES[profile.role]}`); write('[data-agent-description]', profile.description);
    $('[data-avatar]').textContent = ({ mage: '✧', guard: '◇', scholar: '⌘', trader: '◈', healer: '❋' })[profile.role]; $('[data-avatar]').style.color = FACTIONS[profile.faction].color;
    write('[data-agent-mana]', `法力 ${profile.mana}/20`); write('[data-agent-crystals]', `魔晶 ${profile.crystals}`); write('[data-agent-coins]', `钱币 ${profile.coins}`); write('[data-agent-action]', profile.lastAction);
    $('[data-secret-block]').hidden = !reveal; $('[data-locked]').hidden = reveal; $('[data-memory-block]').hidden = !reveal;
    write('[data-agent-desire]', profile.desire || ''); write('[data-agent-belief]', profile.belief || ''); write('[data-agent-reason]', profile.lastReason || ''); write('[data-memory-count]', profile.memories ? `${profile.memories.length} 条` : '');
    $('[data-memories]').replaceChildren(...(profile.memories || []).slice().reverse().map(memory => {
      const li = document.createElement('li'), tag = document.createElement('small'), text = document.createElement('p');
      tag.textContent = `${({ fact: '事实／经历', message: '有来源的消息／发言', rumor: '未经证实的传闻' })[memory.kind]} · ${memory.source}`; text.textContent = memory.text; li.append(tag, text); return li;
    }));
    write('[data-log-label]', mode === 'observer' ? '完整记录 · 含私人行动' : '公开事件与你的消息');
    $('[data-timeline]').replaceChildren(...events.slice(-9).reverse().map(event => {
      const li = document.createElement('li'), time = document.createElement('small'), text = document.createElement('p');
      const speaker = state.actors.find(actor => actor.id === event.actorId), speech = speaker && (event.text.startsWith(`${speaker.name}：对`) || event.text.startsWith(`${speaker.name}回应你：“`));
      time.textContent = `${clock(event.tick)}${event.visibility === 'private' ? ' · 私人记录' : ''}${speech ? ' · 发言内容未核实' : ''}`; text.textContent = event.text; li.append(time, text);
      if (mode === 'observer' && event.reason) { const reason = document.createElement('span'); reason.className = 'world-event-reason'; reason.textContent = event.reason; li.append(reason); } return li;
    }));
    const visibleReport = report?.tick === state.tick ? report : null;
    write('[data-decision-source]', visibleReport ? visibleReport.source === 'deepseek' ? `真实 AI · ${visibleReport.model}` : '规则决策 · 无模型费用' : '推进一轮后显示');
    $('[data-decisions]').replaceChildren(...(visibleReport?.decisions || []).filter(item => mode === 'observer' || item.actorId === PLAYER_ID).map(item => {
      const li = document.createElement('li'), title = document.createElement('strong'), detail = document.createElement('p'), actor = state.actors.find(person => person.id === item.actorId);
      title.textContent = `${actor?.name || item.actorId} · 意图：${actionNames[item.action.kind] || '行动'}${item.elapsedMs ? ` · ${(item.elapsedMs / 1000).toFixed(1)} 秒` : ''}`; detail.textContent = `自述缘由：${item.reason}`; li.append(title, detail);
      if (item.outcome) { const outcome = document.createElement('p'); outcome.textContent = `${item.action.kind === 'say' ? '确实发言，内容未核实' : '实际结果'}：${item.outcome}`; li.append(outcome); } return li;
    }));
    $('[data-decision-empty]').hidden = Boolean(visibleReport?.decisions.length);
    const own = state.actors.find(actor => actor.id === PLAYER_ID); $('[data-direction]').value = own.goalKind;
    write('[data-quest-progress]', `已公开 ${state.publicClues.length} / 3 条线索`);
    $('[data-clue-list]').replaceChildren(...Object.entries(CLUES).map(([location, clue]) => {
      const p = document.createElement('p'), isPublic = state.publicClues.includes(clue.key), owner = state.actors.find(actor => actor.memories.some(memory => memory.key === clue.key)), ownMemory = own.memories.some(memory => memory.key === clue.key); p.className = 'world-clue';
      p.textContent = isPublic ? `✓ ${clue.text}` : mode === 'observer' && owner ? `◈ ${owner.name}已记录：${clue.text}` : ownMemory ? `◈ 你的法师已记录：${clue.text}` : `○ ${PLACE[location].name} · 等待发现或公开`; return p;
    }));
    $('[data-history]').max = history.length - 1; $('[data-history]').value = viewIndex === null ? history.length - 1 : viewIndex;
    write('[data-history-label]', `${viewIndex === null ? '现在' : '历史快照'} · 第 ${state.tick} 轮 · v${state.version}`);
    $('[data-live]').disabled = viewIndex === null; $('[data-history]').disabled = busy;
    const locked = viewIndex !== null || busy || running || Boolean(meta?.busy && !busy);
    for (const node of all('[data-step],[data-event],[data-guide],[data-create],[data-rumor-form] input,[data-rumor-form] button,[data-chat-form] textarea,[data-chat-form] button,[data-direction],[data-source],[data-reconnect],[data-restore-draft],[data-import]')) node.disabled = locked;
    $('[data-reconnect]').disabled = busy || running;
    $('[data-create]').disabled = locked || state.actors.length >= LIMITS.actors;
    $('[data-run]').disabled = viewIndex !== null || (busy && !running) || Boolean(meta?.busy && !busy);
    write('[data-run]', running ? '暂停运行' : '开始运行');
    $('[data-stop]').hidden = !busy || !connected; $('[data-stop]').disabled = !busy;
    paintMap(state, selected); renderPlace();
  }
  for (const button of all('[data-mode]')) button.addEventListener('click', () => { mode = button.dataset.mode; render(); status(mode === 'observer' ? '全知观察只展示资料，不会让角色知道其他人的秘密。' : '已回到故事视角。'); });
  $('[role="tablist"]').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const next = all('[data-mode]').find(button => button.dataset.mode !== mode); next.click(); next.focus(); });
  $('[data-place-select]').addEventListener('change', event => { placeId = event.target.value; renderPlace(); });
  $('[data-agent]').addEventListener('change', event => { selected = event.target.value; render(); });
  $('[data-source]').addEventListener('change', () => { render(); status(source() === 'deepseek' ? '已选择真正的 AI；下次推进才调用，不会补生成以前的历史。' : '已选择规则模式，之后的规则轮次不调用模型。'); });
  $('[data-reconnect]').addEventListener('click', () => void connect());
  $('[data-step]').addEventListener('click', () => void step());
  $('[data-run]').addEventListener('click', () => { if (running) { pause(true); status('停止后续轮次，并请求取消未提交的实验。已发出的请求可能仍计费。'); return; } running = true; automaticRounds = 0; const epoch = ++runEpoch; render(); void runNext(epoch); });
  $('[data-stop]').addEventListener('click', () => { pause(true); status('正在停止未提交的实验。已完成请求可能仍计费；世界不会自动重试。'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(true); status('页面进入后台，已停止自动运行。'); } });
  for (const button of all('[data-event]')) button.addEventListener('click', () => void perform('event', { type: button.dataset.event, message: '' }, state => injectEvent(state, button.dataset.event), '外部事件已保存，下一轮居民根据各自信息反应。'));
  $('[data-rumor-form]').addEventListener('submit', async event => { event.preventDefault(); const message = $('#world-rumor').value; if (await perform('event', { type: 'rumor', message }, state => injectEvent(state, 'rumor', message), '传闻已保存为未经证实的消息，不改变资源和权限。')) event.target.reset(); });
  $('[data-guide]').addEventListener('click', () => { const direction = $('[data-direction]').value; void perform('guide', { direction }, state => guidePlayer(state, direction), '方向已更新。角色仍需检查资源、道路和实际权限。'); });
  $('[data-chat-form]').addEventListener('submit', async event => { event.preventDefault(); const message = $('#world-chat').value; if (await perform('chat', { message }, state => chatWithPlayer(state, message), source() === 'deepseek' ? 'AI 回复已保存，实际行动将在之后的轮次进行。' : '本地规则回复已保存，没有调用模型。')) $('#world-chat').value = ''; });
  $('[data-history]').addEventListener('input', event => { const value = Number(event.target.value); pause(); viewIndex = value === history.length - 1 ? null : value; render(); status(viewIndex === null ? '已回到最新世界。' : '正在读取历史结果，没有重新请求 AI。'); });
  $('[data-live]').addEventListener('click', () => { viewIndex = null; render(); status('已回到最新世界。'); });
  $('[data-create]').addEventListener('click', () => { pause(); $('[data-create-dialog]').showModal(); });
  $('[data-close-dialog]').addEventListener('click', () => $('[data-create-dialog]').close());
  $('[data-create-form]').addEventListener('submit', async event => {
    event.preventDefault(); const fields = Object.fromEntries(new FormData(event.target)); fields.consent = fields.consent === 'on';
    if (await perform('add', fields, state => addResident(state, fields), '居民已加入；AI 模式会按它的虚构设定独立决定。')) { selected = latest().actors.at(-1).id; $('[data-create-dialog]').close(); event.target.reset(); render(); }
  });
  function download() { try { const url = URL.createObjectURL(new Blob([exportExperiment(history)], { type: 'application/json' })), link = document.createElement('a'); link.href = url; link.download = `magic-world-round-${latest().tick}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('实验已导出，含虚构角色的隐藏目标与对话，分享前检查。'); } catch (error) { status(error.message); } }
  $('[data-export]').addEventListener('click', download); $('[data-backup-before-import]').addEventListener('click', download);
  function askImport(raw) { try { importExperiment(raw); pendingImport = raw; $('[data-import-dialog]').showModal(); } catch (error) { status(`没有替换当前世界：${error.message}`); } }
  $('[data-restore-draft]').addEventListener('click', () => { if (archivedDraft) askImport(archivedDraft); });
  $('[data-import]').addEventListener('change', async event => { pause(); const file = event.target.files[0]; if (!file) return; try { if (file.size > LIMITS.importBytes) throw new Error('文件过大，最多 2 MB。'); askImport(await file.text()); } catch (error) { status(error.message); } event.target.value = ''; });
  $('[data-cancel-import]').addEventListener('click', () => { pendingImport = null; $('[data-import-dialog]').close(); });
  $('[data-confirm-import]').addEventListener('click', async () => {
    if (!pendingImport || busy) return; const raw = pendingImport;
    if (connected) { if (!(await perform('import', { raw, replace: true }, null, '已恢复实验，服务端版本保持递增。没有调用模型。'))) return; }
    else { history = importExperiment(raw); viewIndex = null; report = null; saveOffline(); render(); status('已从文件恢复离线实验。'); }
    pendingImport = null; $('[data-import-dialog]').close();
  });
  render(); void connect();
  window.addEventListener('pagehide', () => pause(true), { once: true });
}
