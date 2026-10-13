import { PLAYER_ID, LIMITS, LOCATIONS, PLACE, FACTIONS, CLUES, DIRECTIONS, EVENT_TYPES, INITIAL_ACTORS } from './config.js';

const copy = value => structuredClone(value);
const bounded = (value, min, max) => Math.max(min, Math.min(max, value));
const known = (actor, key) => actor.memories.some(memory => memory.key === key);
const roles = ['mage', 'guard', 'scholar', 'trader', 'healer'];
const actions = ['move', 'rest', 'gather', 'charge', 'repair', 'inspect', 'cloak', 'trade', 'share', 'propose', 'vote', 'claim', 'say', 'give'];
const policies = ['fair', 'watch', 'research', 'trade', 'embers'];
const policyName = policy => policy === 'fair' ? '共同托管' : FACTIONS[policy]?.name || '未知';
const actorById = (state, id) => state.actors.find(actor => actor.id === id);

function record(state, text, visibility = 'public', actorId = '', reason = '') {
  const event = { id: `event-${++state.serial}`, tick: state.tick, text, visibility, actorId, reason };
  state.events.push(event); state.events = state.events.slice(-LIMITS.events); return event;
}
function remember(actor, key, text, source, kind = 'fact') {
  actor.memories = actor.memories.filter(memory => memory.key !== key);
  actor.memories.push({ key, text, source, kind }); actor.memories = actor.memories.slice(-LIMITS.memories);
}
function witnesses(state, event, location, speaker) {
  for (const actor of state.actors) {
    if (actor.location !== location) continue;
    if (speaker && speaker.hiddenUntil > state.tick && actor.id !== speaker.id && actor.role !== 'guard') continue;
    remember(actor, event.id, event.text, event.id);
  }
}

export function createWorld() {
  const state = { schema: 1, version: 0, tick: 0, serial: 0, core: { energy: 72, integrity: 84, crystals: 12, treasury: 50, custodian: 'fair' }, deposits: { forest: 18, mine: 40 }, actors: INITIAL_ACTORS.map(actor => ({ ...copy(actor), hiddenUntil: 0, lastAction: '刚抵达世界', lastReason: '角色正在观察周围。', memories: [] })), events: [], publicClues: [], proposal: null, blockedUntil: 0, lastEventTick: -1 };
  const event = record(state, '中立城开始新的一天。核心仍由共同议会托管，各方同意暂不独占它。');
  for (const actor of state.actors) remember(actor, 'city-treaty', event.text, event.id);
  return state;
}

function routeFrom(location, destination, blockedUntil, tick) {
  const queue = [[location]], seen = new Set([location]);
  while (queue.length) {
    const route = queue.shift(), last = route.at(-1);
    if (last === destination) return route[1] || location;
    for (const neighbor of PLACE[last].neighbors) {
      if (seen.has(neighbor) || (neighbor === 'mine' && blockedUntil > tick)) continue;
      seen.add(neighbor); queue.push([...route, neighbor]);
    }
  }
  return null;
}

// This is the ONLY input passed to a resident's decision function.
// Omniscient presentation and other residents' secrets never enter it.
export function observationFor(state, actorId) {
  const actor = actorById(state, actorId);
  if (!actor) throw new Error('找不到这个角色。');
  const core = ['city', 'academy', 'market'].includes(actor.location) ? copy(state.core) : null;
  const nearby = state.actors.filter(other => other.id !== actorId && other.location === actor.location && (other.hiddenUntil <= state.tick || actor.role === 'guard')).map(other => ({ id: other.id, name: other.name, race: other.race, role: other.role, faction: other.faction }));
  return { version: state.version, tick: state.tick, self: copy(actor), place: copy(PLACE[actor.location]), core, nearby, deposit: state.deposits[actor.location] ?? null, proposal: copy(state.proposal), publicClues: [...state.publicClues], blockedUntil: state.blockedUntil, locations: copy(LOCATIONS) };
}

export function decideLocally(observation) {
  const { self, core, tick, proposal, publicClues, blockedUntil, deposit } = observation;
  const decide = (kind, details = {}, reason = '') => ({ actorId: self.id, baseVersion: observation.version, action: { kind, ...details }, reason: reason || `按“${self.goal}”选择一个当前可执行的行动。` });
  const travel = destination => {
    const next = routeFrom(self.location, destination, blockedUntil, tick);
    return next && next !== self.location ? decide('move', { target: next }, `先沿道路前往${PLACE[destination].name}，不能直接跳到目的地。`) : decide('rest', {}, '道路暂时无法通行，先恢复法力。');
  };
  const gather = () => {
    if (['forest', 'mine'].includes(self.location) && deposit > 0) return decide('gather');
    return travel(self.location === 'mine' || blockedUntil > tick ? 'forest' : 'mine');
  };
  if (self.mana < 5 || self.goalKind === 'rest') return decide('rest', {}, '当前法力不足，先恢复，不因玩家催促而凭空施法。');
  if (proposal?.status === 'voting' && self.location === 'city' && !Object.hasOwn(proposal.votes, self.id)) {
    const support = proposal.policy === 'fair' ? self.role !== 'trader' : proposal.policy === self.faction;
    return decide('vote', { support }, `${support ? '支持' : '反对'}这项托管方案：${self.belief}`);
  }
  if (self.goalKind === 'negotiate') return self.location !== 'city' ? travel('city') : proposal?.status === 'voting' ? decide('rest', {}, '等待其他居民作出选择。') : decide('propose', { policy: 'fair' }, '提出共同托管方案，让各方用实际投票表达意见。');
  if (self.goalKind === 'stealth' && self.role === 'mage' && self.hiddenUntil <= tick) return decide('cloak', {}, '先用幻术遮蔽行踪；它不会赋予核心控制权限。');
  if (self.goalKind === 'support') {
    if (!self.crystals) return gather();
    if (self.location !== 'city') return travel('city');
    if (core.integrity < 90) return decide('repair', {}, '用一枚魔晶维护损坏的装置。');
    if (core.energy < 76) return decide('charge', {}, '把自己的魔晶交给核心，而不是只声称已补充能源。');
    if (tick % 6 === 4 && proposal?.status !== 'voting') return decide('propose', { policy: self.faction === 'independent' ? 'fair' : self.faction }, `希望${policyName(self.faction === 'independent' ? 'fair' : self.faction)}取得托管权：${self.desire}`);
    return decide('rest', {}, '装置暂时稳定，恢复法力并观察其他势力。');
  }
  if (self.goalKind === 'gather' || self.role === 'trader') {
    if (self.role === 'trader' && tick % 5 === 3 && proposal?.status !== 'voting') return self.location === 'city' ? decide('propose', { policy: 'trade' }, self.desire) : travel('city');
    if (self.role === 'trader' && self.crystals < 3 && self.coins >= 2 && self.location === 'market' && core.crystals > 0) return decide('trade', {}, '按集市价格购买库存，实际支付钱币。');
    if (self.crystals < 3) return gather();
    if (self.location !== 'city') return travel('city');
    return decide('charge', {}, '用采集到的魔晶支援城市供能。');
  }
  const undiscovered = Object.entries(CLUES).find(([, clue]) => !known(self, clue.key) && !publicClues.includes(clue.key));
  if (undiscovered) return self.location === undiscovered[0] ? decide('inspect', {}, '读取现场符文，保存可追溯的线索；不把猜测当成真相。') : travel(undiscovered[0]);
  const unshared = self.memories.find(memory => memory.key.startsWith('clue-') && !publicClues.includes(memory.key));
  if (unshared) return self.location === 'city' ? decide('share', { key: unshared.key }, '公开自己真正发现的线索，让其他居民可以验证。') : travel('city');
  if (self.role === 'scholar' && tick % 5 === 2 && proposal?.status !== 'voting') return self.location === 'city' ? decide('propose', { policy: 'research' }, self.desire) : travel('city');
  return decide('rest', {}, '现有线索仍不能证明核心真相，继续观察。');
}

export function validatePlan(plan, state) {
  if (!plan || typeof plan !== 'object' || !actorById(state, plan.actorId)) throw new Error('行动属于不存在的角色。');
  shape(plan, ['actorId', 'baseVersion', 'action', 'reason'], '行动建议');
  if (plan.baseVersion !== state.version) throw new Error('世界已经变化，这个决定已过期。');
  if (!plan.action || !actions.includes(plan.action.kind)) throw new Error('不允许执行这种行动。');
  const allowed = { move: ['target'], share: ['key'], propose: ['policy'], vote: ['support'], say: ['target', 'text'], give: ['target', 'amount'] }[plan.action.kind] || [];
  if (Object.keys(plan.action).some(key => key !== 'kind' && !allowed.includes(key))) throw new Error('行动包含未允许的参数。');
  if (plan.action.kind === 'move' && !Object.hasOwn(PLACE, plan.action.target)) throw new Error('目的地不存在。');
  if (plan.action.kind === 'share' && (typeof plan.action.key !== 'string' || plan.action.key.length > 60)) throw new Error('线索编号无效。');
  if (plan.action.kind === 'propose' && !policies.includes(plan.action.policy)) throw new Error('托管方案无效。');
  if (plan.action.kind === 'vote' && typeof plan.action.support !== 'boolean') throw new Error('投票必须明确支持或反对。');
  if (['say', 'give'].includes(plan.action.kind) && (typeof plan.action.target !== 'string' || (plan.action.target !== 'nearby' && !actorById(state, plan.action.target)))) throw new Error('交互对象不存在。');
  if (plan.action.kind === 'say' && (typeof plan.action.text !== 'string' || !plan.action.text.trim() || plan.action.text.length > 240)) throw new Error('发言需要 1–240 个字符。');
  if (plan.action.kind === 'give' && (!Number.isInteger(plan.action.amount) || plan.action.amount < 1 || plan.action.amount > 3 || plan.action.target === 'nearby')) throw new Error('每次只能向一位居民转交 1–3 枚魔晶。');
  if (typeof plan.reason !== 'string' || plan.reason.length > 500) throw new Error('行动说明无效。');
}

function resolve(state, plan) {
  const actor = actorById(state, plan.actorId), action = plan.action, previousLocation = actor.location;
  const reject = message => { actor.lastAction = message; actor.lastReason = plan.reason; const event = record(state, `${actor.name}：${message}`, 'private', actor.id, plan.reason); remember(actor, event.id, message, event.id); };
  let text = '', visibility = 'public';
  if (action.kind === 'move') {
    if (!PLACE[actor.location].neighbors.includes(action.target)) return reject('目的地不与当前地点相连，需要沿道路行走。');
    if (action.target === 'mine' && state.blockedUntil > state.tick) return reject('风暴仍在阻断矿山道路。');
    if (actor.mana < 1) return reject('需要先恢复体力。');
    actor.mana--; actor.location = action.target; text = `沿道路抵达${PLACE[actor.location].name}。`;
  } else if (action.kind === 'rest') {
    actor.mana = bounded(actor.mana + 5, 0, 20); text = '休息并恢复了法力。';
  } else if (action.kind === 'gather') {
    if (!['forest', 'mine'].includes(actor.location) || actor.mana < 3 || actor.crystals >= 99) return reject('采集需要在森林或矿山，有足够法力与携带空间。');
    if (actor.location === 'mine' && state.blockedUntil > state.tick) return reject('矿脉暂时无法安全采集。');
    if (!state.deposits[actor.location]) return reject('这里的可采魔晶已用尽，需要寻找新的补给。');
    const amount = Math.min(actor.location === 'mine' ? 2 : 1, state.deposits[actor.location]); state.deposits[actor.location] -= amount; actor.crystals += amount; actor.mana -= 3; text = `采集了 ${amount} 枚魔晶。`;
  } else if (action.kind === 'charge' || action.kind === 'repair') {
    if (actor.location !== 'city' || actor.crystals < 1 || actor.mana < 2) return reject('需要在中立城，持有魔晶并保有法力。');
    const field = action.kind === 'charge' ? 'energy' : 'integrity';
    if (state.core[field] >= 100) return reject('当前装置已满，不消耗你的魔晶。');
    actor.crystals--; actor.mana -= 2; state.core[field] = bounded(state.core[field] + (field === 'energy' ? 18 : 12), 0, 100);
    text = field === 'energy' ? '消耗 1 枚魔晶，为核心补充了能源。' : '消耗 1 枚魔晶，修复了核心装置。';
  } else if (action.kind === 'inspect') {
    const clue = CLUES[actor.location];
    if (!clue || !['mage', 'scholar'].includes(actor.role) || actor.mana < 4) return reject('这里没有可识读的符文，或你的能力、法力不足。');
    if (known(actor, clue.key)) return reject('这段符文已经记录，不重复消耗法力。');
    actor.mana -= 4; text = `在${PLACE[actor.location].name}识读了一段古老符文。`; visibility = 'private';
    const event = record(state, `${actor.name}：${text}`, visibility, actor.id, plan.reason); remember(actor, clue.key, clue.text, event.id); actor.lastAction = text; actor.lastReason = plan.reason; return;
  } else if (action.kind === 'cloak') {
    if (actor.role !== 'mage' || actor.mana < 4) return reject('幻术需要相应专长和至少 4 点法力。');
    actor.mana -= 4; actor.hiddenUntil = state.tick + 3; text = '用幻术遮蔽行踪，效果持续 3 轮；不改变真实位置或权限。'; visibility = 'private';
  } else if (action.kind === 'trade') {
    const price = state.core.custodian === 'trade' ? 3 : 2;
    if (actor.location !== 'market' || actor.coins < price || state.core.crystals < 1 || actor.crystals >= 99) return reject('交易需要在集市，有库存、钱币和携带空间。');
    state.core.crystals--; state.core.treasury += price; actor.coins -= price; actor.crystals++; text = `支付 ${price} 枚钱币，购买了 1 枚魔晶。`;
  } else if (action.kind === 'share') {
    const memory = actor.memories.find(item => item.key === action.key && item.kind === 'fact' && Object.values(CLUES).some(clue => clue.key === item.key));
    if (!memory || actor.location !== 'city' || state.publicClues.includes(memory.key)) return reject('需要回到中立城，分享自己真实发现且尚未公开的线索。');
    state.publicClues.push(memory.key); text = `公开线索：${memory.text}`;
    const event = record(state, `${actor.name}：${text}`, 'public', actor.id, plan.reason);
    for (const other of state.actors) remember(other, memory.key, memory.text, event.id); actor.lastAction = text; actor.lastReason = plan.reason; return;
  } else if (action.kind === 'propose') {
    if (actor.location !== 'city' || actor.mana < 3 || state.proposal?.status === 'voting') return reject('需要在中立城发起议事，且不能覆盖正在表决的方案。');
    actor.mana -= 3; state.proposal = { by: actor.id, policy: action.policy, votes: { [actor.id]: true }, expiresAt: state.tick + 5, status: 'voting' }; text = `提出“${policyName(action.policy)}”托管方案。提议尚不等于取得控制权。`;
  } else if (action.kind === 'vote') {
    if (actor.location !== 'city' || state.proposal?.status !== 'voting' || Object.hasOwn(state.proposal.votes, actor.id)) return reject('需要亲临议事，且每个居民只能投一次票。');
    state.proposal.votes[actor.id] = action.support; text = `${action.support ? '支持' : '反对'}“${policyName(state.proposal.policy)}”方案。`;
  } else if (action.kind === 'claim') {
    return reject('核心不能凭声明占有，托管权必须经过公共议事。');
  } else if (action.kind === 'say' || action.kind === 'give') {
    const target = actorById(state, action.target);
    if (target && (target.id === actor.id || target.location !== actor.location || (target.hiddenUntil > state.tick && actor.role !== 'guard'))) return reject('需要在同一地点找到可见的交互对象。');
    if (action.kind === 'give') {
      if (!target || actor.crystals < action.amount || target.crystals + action.amount > 100) return reject('转交需要实际持有魔晶，且对方有携带空间。');
      actor.crystals -= action.amount; target.crystals += action.amount; text = `向${target.name}实际转交了 ${action.amount} 枚魔晶。`;
      const event = record(state, `${actor.name}：${text}`, 'public', actor.id, plan.reason);
      remember(actor, event.id, event.text, event.id); remember(target, event.id, event.text, event.id); witnesses(state, event, actor.location, actor);
      actor.lastAction = text; actor.lastReason = plan.reason; return;
    }
    // Speech is a sourced claim, not verified truth. Speaking breaks concealment.
    actor.hiddenUntil = state.tick;
    text = `对${target ? target.name : '附近的人'}说：“${action.text.trim()}”`;
    const event = record(state, `${actor.name}：${text}`, 'public', actor.id, plan.reason);
    for (const listener of state.actors.filter(person => person.location === actor.location)) remember(listener, event.id, event.text, event.id, 'message');
    actor.lastAction = text; actor.lastReason = plan.reason; return;
  }
  actor.lastAction = text; actor.lastReason = plan.reason;
  const event = record(state, `${actor.name}：${text}`, visibility, actor.id, plan.reason);
  if (visibility === 'private') remember(actor, event.id, text, event.id);
  else { witnesses(state, event, actor.location, actor); if (previousLocation !== actor.location) witnesses(state, event, previousLocation, actor); }
}

export function advanceRound(state, providedPlans) {
  validateState(state);
  const plans = providedPlans || state.actors.map(actor => decideLocally(observationFor(state, actor.id)));
  if (!Array.isArray(plans) || plans.length > state.actors.length) throw new Error('行动数量无效。');
  const ids = new Set(); for (const plan of plans) { validatePlan(plan, state); if (ids.has(plan.actorId)) throw new Error('同一轮不能重复执行一个角色的行动。'); ids.add(plan.actorId); }
  const next = copy(state); next.tick++;
  // Decisions use the same old snapshot; resolution rotates to avoid permanent first-player advantage.
  const order = next.actors.map(actor => actor.id), offset = state.tick % order.length;
  const rotated = [...order.slice(offset), ...order.slice(0, offset)];
  for (const id of rotated) { const plan = plans.find(item => item.actorId === id); if (plan) resolve(next, plan); }
  next.core.energy = bounded(next.core.energy - (next.core.custodian === 'fair' ? 5 : 6), 0, 100);
  if (next.core.energy < 15) next.core.integrity = bounded(next.core.integrity - 2, 0, 100);
  const proposal = next.proposal;
  if (proposal?.status === 'voting') {
    const quorum = Math.floor(next.actors.length / 2) + 1;
    if (Object.values(proposal.votes).filter(Boolean).length >= quorum) { proposal.status = 'passed'; next.core.custodian = proposal.policy; record(next, `公共议事通过“${policyName(proposal.policy)}”方案。取得的是托管权，不是任意改写世界的权力。`); }
    else if (next.tick >= proposal.expiresAt) { proposal.status = 'expired'; record(next, '托管方案未获得过半支持。共同规则继续有效。'); }
  }
  if (next.publicClues.length === 3 && state.publicClues.length < 3) record(next, '三处符文线索已公开：核心可能属于更大的回路。新的探索篇章开启，制造者仍然未知。');
  next.version++; validateState(next); return next;
}

export function injectEvent(state, type, message = '') {
  validateState(state);
  if (!Object.hasOwn(EVENT_TYPES, type)) throw new Error('事件类型不存在。');
  if (state.lastEventTick === state.tick) throw new Error('这一轮已有外部事件，推进一轮后再加入。');
  if (type === 'rumor' && (typeof message !== 'string' || !message.trim() || message.length > 240)) throw new Error('传闻需要 1–240 个字符。');
  const next = copy(state); next.lastEventTick = state.tick;
  let text;
  if (type === 'surge') { next.core.energy = bounded(next.core.energy - 18, 0, 100); next.core.integrity = bounded(next.core.integrity - 7, 0, 100); text = '核心发生异动：能源减少 18，装置完整度减少 7。城内发布维护请求，原因尚未确认。'; }
  if (type === 'storm') { next.blockedUntil = state.tick + 4; next.core.integrity = bounded(next.core.integrity - 10, 0, 100); text = '霜脊矿山遭遇风暴，道路与采集暂时受阻 4 轮；城市结界受损。'; }
  if (type === 'caravan') { next.core.crystals += 4; text = '外来商队抵达集市，为公共库存送来 4 枚魔晶。'; }
  if (type === 'rumor') text = `一条未经证实的传闻传入城市：“${message.trim()}”`;
  const event = record(next, text);
  for (const actor of next.actors) remember(actor, event.id, text, event.id, type === 'rumor' ? 'rumor' : 'fact');
  next.version++; validateState(next); return next;
}

export function guidePlayer(state, direction, message = '') {
  if (!Object.hasOwn(DIRECTIONS, direction)) throw new Error('行动方向不存在。');
  if (typeof message !== 'string' || message.length > 240) throw new Error('消息过长。');
  const next = copy(state), actor = actorById(next, PLAYER_ID); actor.goalKind = direction; actor.goal = DIRECTIONS[direction];
  const event = record(next, `你给无名法师的方向：${DIRECTIONS[direction]}${message ? `。你的消息：${message}` : ''}`, 'private', PLAYER_ID);
  remember(actor, event.id, message || `玩家建议：${DIRECTIONS[direction]}`, event.id, 'message'); next.version++; validateState(next); return next;
}

export function chatWithPlayer(state, text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 240) throw new Error('消息需要 1–240 个字符。');
  const matches = [[/休息|恢复/, 'rest'], [/隐匿|幻术|隐藏|潜入/, 'stealth'], [/协商|谈判|合作|共同/, 'negotiate'], [/支援|修复|维修|帮助|供能/, 'support'], [/采集|收集|补给|魔晶/, 'gather'], [/调查|探索|研究|符文|秘密|遗迹/, 'investigate']];
  const direction = matches.find(([pattern]) => pattern.test(text))?.[1];
  if (direction) { const next = guidePlayer(state, direction, text); return { state: next, reply: `我会把“${DIRECTIONS[direction]}”作为方向。当前在${PLACE[actorById(next, PLAYER_ID).location].name}，仍要先检查道路、法力和权限。（本地规则回复）` }; }
  const next = copy(state), actor = actorById(next, PLAYER_ID), event = record(next, `你对法师说：“${text.trim()}”`, 'private', PLAYER_ID);
  remember(actor, event.id, text.trim(), event.id, 'message'); next.version++; validateState(next);
  return { state: next, reply: `我记下了这条来自你的消息，但它不是已经证实的世界事实。你可以建议我调查、支援、采集、协商、隐匿或休息。（当前未接入语言模型）` };
}

// Record a model reply as speech, never as a new world fact or a completed action.
export function recordDialogue(state, actorId, message, reply, direction = null) {
  validateState(state);
  if (!actorById(state, actorId)) throw new Error('找不到对话角色。');
  if (typeof message !== 'string' || !message.trim() || message.length > 240) throw new Error('消息需要 1–240 个字符。');
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 500) throw new Error('角色回复无效。');
  if (direction !== null && (actorId !== PLAYER_ID || !Object.hasOwn(DIRECTIONS, direction))) throw new Error('只能调整自己角色的有效行动方向。');
  const next = copy(state), actor = actorById(next, actorId);
  const input = record(next, `你对${actor.name}说：“${message.trim()}”`, 'private', actorId);
  remember(actor, input.id, `来自玩家的消息：${message.trim()}`, input.id, 'message');
  const output = record(next, `${actor.name}回应你：“${reply.trim()}”`, 'private', actorId);
  remember(actor, output.id, `我回复玩家：${reply.trim()}（对话，不代表已完成行动）`, output.id, 'message');
  if (direction !== null) { actor.goalKind = direction; actor.goal = DIRECTIONS[direction]; }
  next.version++; validateState(next); return next;
}

// The model receives concrete executable choices, not a permission to edit state.
export function availableActions(observation) {
  const { self, place, tick, core, deposit, blockedUntil, proposal, publicClues, nearby } = observation;
  const list = [{ kind: 'rest' }], add = (kind, fields = {}) => list.push({ kind, ...fields });
  if (self.mana >= 1) for (const target of place.neighbors) if (!(target === 'mine' && blockedUntil > tick + 1)) add('move', { target });
  if (deposit > 0 && self.mana >= 3 && self.crystals < 99 && !(self.location === 'mine' && blockedUntil > tick + 1)) add('gather');
  if (self.location === 'city' && self.mana >= 2 && self.crystals > 0) { if (core.energy < 100) add('charge'); if (core.integrity < 100) add('repair'); }
  if (CLUES[self.location] && ['mage', 'scholar'].includes(self.role) && self.mana >= 4 && !known(self, CLUES[self.location].key)) add('inspect');
  if (self.role === 'mage' && self.mana >= 4 && self.hiddenUntil <= tick) add('cloak');
  if (self.location === 'market' && core.crystals > 0 && self.coins >= (core.custodian === 'trade' ? 3 : 2) && self.crystals < 99) add('trade');
  if (self.location === 'city') {
    for (const memory of self.memories) if (memory.kind === 'fact' && Object.values(CLUES).some(clue => clue.key === memory.key) && !publicClues.includes(memory.key)) add('share', { key: memory.key });
    if (self.mana >= 3 && proposal?.status !== 'voting') for (const policy of policies) add('propose', { policy });
    if (proposal?.status === 'voting' && !Object.hasOwn(proposal.votes, self.id)) { add('vote', { support: true }); add('vote', { support: false }); }
  }
  if (nearby.length) {
    for (const other of nearby) {
      list.push({ kind: 'say', target: other.id, text: '<填写你想说的话，最多240字>' });
      if (self.crystals > 0) for (let amount = 1; amount <= Math.min(self.crystals, 3); amount++) add('give', { target: other.id, amount });
    }
    list.push({ kind: 'say', target: 'nearby', text: '<填写公开发言，最多240字>' });
  }
  return list;
}

export function addResident(state, fields) {
  validateState(state);
  if (state.actors.length >= LIMITS.actors) throw new Error(`本地原型最多 ${LIMITS.actors} 位居民。`);
  const { name, race, role, faction, desire, goalKind } = fields;
  if (!roles.includes(role) || !Object.hasOwn(FACTIONS, faction) || !Object.hasOwn(DIRECTIONS, goalKind)) throw new Error('角色方向、职业或势力无效。');
  for (const [value, max] of [[name, 24], [race, 24], [desire, 240]]) if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('请填写有效的角色名称、种族和隐藏目标。');
  const next = copy(state), id = `guest-${state.serial + 1}`;
  next.actors.push({ id, name: name.trim(), race: race.trim(), role, faction, location: 'city', description: '你添加到这次本地实验中的虚构居民。', desire: desire.trim(), belief: '仍在观察这个世界，不把传闻直接当成事实。', goalKind, goal: DIRECTIONS[goalKind], mana: 14, crystals: 1, coins: 4, hiddenUntil: 0, lastAction: '刚刚抵达中立城', lastReason: '等待下一轮行动。', memories: [] });
  const event = record(next, `${name.trim()}抵达中立城，加入这次本地实验。`);
  remember(next.actors.at(-1), 'arrival', event.text, event.id); next.version++; validateState(next); return next;
}

export function presentation(state, mode = 'story', selectedId = PLAYER_ID) {
  if (!['story', 'observer'].includes(mode)) throw new Error('观看模式不存在。');
  const actor = actorById(state, selectedId) || state.actors[0], reveal = mode === 'observer' || actor.id === PLAYER_ID;
  const profile = { id: actor.id, name: actor.name, race: actor.race, role: actor.role, faction: actor.faction, location: actor.location, description: actor.description, mana: actor.mana, crystals: actor.crystals, coins: actor.coins, lastAction: actor.lastAction, hiddenUntil: actor.hiddenUntil };
  if (reveal) Object.assign(profile, { desire: actor.desire, belief: actor.belief, goal: actor.goal, goalKind: actor.goalKind, memories: copy(actor.memories), lastReason: actor.lastReason });
  return { profile, events: state.events.filter(event => mode === 'observer' || event.visibility === 'public' || event.actorId === PLAYER_ID).map(event => { const visible = copy(event); if (mode !== 'observer') visible.reason = ''; return visible; }) };
}

export function clock(tick) { const minutes = 8 * 60 + tick * 30; return `第 ${Math.floor(minutes / 1440) + 1} 天 · ${String(Math.floor(minutes % 1440 / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }

function shape(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) throw new Error(`${label}结构无效。`); }
function integer(value, min, max, label) { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}超出范围。`); }
function text(value, max, label) { if (typeof value !== 'string' || value.length > max) throw new Error(`${label}无效。`); }

export function validateState(state) {
  shape(state, ['schema', 'version', 'tick', 'serial', 'core', 'deposits', 'actors', 'events', 'publicClues', 'proposal', 'blockedUntil', 'lastEventTick'], '世界');
  if (state.schema !== 1) throw new Error('不支持的世界版本。');
  for (const field of ['version', 'tick', 'serial', 'blockedUntil']) integer(state[field], 0, 100000, field);
  integer(state.lastEventTick, -1, state.tick, '事件时间');
  shape(state.core, ['energy', 'integrity', 'crystals', 'treasury', 'custodian'], '核心');
  integer(state.core.energy, 0, 100, '能源'); integer(state.core.integrity, 0, 100, '完整度'); integer(state.core.crystals, 0, 100000, '魔晶库存'); integer(state.core.treasury, 0, 100000, '集市钱币');
  if (!policies.includes(state.core.custodian)) throw new Error('托管权无效。');
  shape(state.deposits, ['forest', 'mine'], '矿藏'); integer(state.deposits.forest, 0, 100000, '森林魔晶'); integer(state.deposits.mine, 0, 100000, '矿山魔晶');
  if (!Array.isArray(state.actors) || state.actors.length < 1 || state.actors.length > LIMITS.actors) throw new Error('居民数量无效。');
  const ids = new Set();
  for (const actor of state.actors) {
    shape(actor, ['id', 'name', 'race', 'role', 'faction', 'location', 'description', 'desire', 'belief', 'goalKind', 'goal', 'mana', 'crystals', 'coins', 'hiddenUntil', 'lastAction', 'lastReason', 'memories'], '角色');
    if (typeof actor.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(actor.id) || ids.has(actor.id)) throw new Error('居民编号无效或重复。'); ids.add(actor.id);
    if (!roles.includes(actor.role) || !Object.hasOwn(FACTIONS, actor.faction) || !Object.hasOwn(PLACE, actor.location) || !Object.hasOwn(DIRECTIONS, actor.goalKind)) throw new Error('居民设定无效。');
    text(actor.name, 24, '名称'); text(actor.race, 24, '种族');
    for (const field of ['description', 'desire', 'belief', 'goal', 'lastAction', 'lastReason']) text(actor[field], 500, field);
    integer(actor.mana, 0, 20, '法力'); integer(actor.crystals, 0, 100, '随身魔晶'); integer(actor.coins, 0, 100000, '钱币'); integer(actor.hiddenUntil, 0, 100000, '幻术时间');
    if (!Array.isArray(actor.memories) || actor.memories.length > LIMITS.memories) throw new Error('记忆数量无效。');
    for (const memory of actor.memories) { shape(memory, ['key', 'text', 'source', 'kind'], '记忆'); text(memory.key, 60, '记忆编号'); text(memory.text, 600, '记忆内容'); text(memory.source, 60, '记忆来源'); if (!['fact', 'message', 'rumor'].includes(memory.kind)) throw new Error('记忆类型无效。'); }
  }
  if (!ids.has(PLAYER_ID)) throw new Error('世界必须保留你的法师。');
  if (!Array.isArray(state.events) || state.events.length > LIMITS.events) throw new Error('事件数量无效。');
  for (const event of state.events) { shape(event, ['id', 'tick', 'text', 'visibility', 'actorId', 'reason'], '事件'); text(event.id, 60, '事件编号'); text(event.text, 1000, '事件内容'); text(event.reason, 500, '行动说明'); text(event.actorId, 40, '事件角色'); integer(event.tick, 0, state.tick, '事件时刻'); if (!['public', 'private'].includes(event.visibility)) throw new Error('事件可见性无效。'); }
  if (!Array.isArray(state.publicClues) || state.publicClues.length > 3 || new Set(state.publicClues).size !== state.publicClues.length || state.publicClues.some(key => !Object.values(CLUES).some(clue => clue.key === key))) throw new Error('公开线索无效。');
  if (state.proposal !== null) { shape(state.proposal, ['by', 'policy', 'votes', 'expiresAt', 'status'], '议事'); const p = state.proposal; if (!ids.has(p.by) || !policies.includes(p.policy) || !['voting', 'passed', 'expired'].includes(p.status)) throw new Error('议事无效。'); integer(p.expiresAt, 0, 100000, '议事截止'); if (!p.votes || typeof p.votes !== 'object' || Array.isArray(p.votes) || Object.entries(p.votes).some(([id, support]) => !ids.has(id) || typeof support !== 'boolean')) throw new Error('投票无效。'); }
  return true;
}

export function exportExperiment(history) {
  if (!Array.isArray(history) || !history.length || history.length > LIMITS.history) throw new Error('历史记录无效。'); history.forEach(validateState);
  const data = JSON.stringify({ format: 'arcane-world-prototype', version: 1, history });
  if (new TextEncoder().encode(data).byteLength > LIMITS.importBytes) throw new Error('实验记录过大。'); return data;
}
export function importExperiment(raw) {
  if (typeof raw !== 'string' || raw.length > LIMITS.importBytes || new TextEncoder().encode(raw).byteLength > LIMITS.importBytes) throw new Error('文件过大。');
  const data = JSON.parse(raw); shape(data, ['format', 'version', 'history'], '实验文件');
  if (data.format !== 'arcane-world-prototype' || data.version !== 1 || !Array.isArray(data.history) || !data.history.length || data.history.length > LIMITS.history) throw new Error('这不是受支持的世界实验文件。');
  data.history.forEach(validateState); for (let i = 1; i < data.history.length; i++) if (data.history[i].version <= data.history[i - 1].version) throw new Error('世界历史的版本顺序无效。');
  return copy(data.history);
}
