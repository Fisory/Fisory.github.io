// Editable draft, not final canon. No personal records or model credentials.
export const PLAYER_ID = 'wanderer';
export const LIMITS = Object.freeze({ actors: 8, memories: 16, events: 80, history: 32, importBytes: 2000000 });
export const LOCATIONS = Object.freeze([
  { id: 'city', name: '中立城', kind: '城邦', x: 510, y: 325, description: '围绕古老魔力核心建立的共同城邦。维修、供能与公共议事在这里进行。', neighbors: ['market', 'academy', 'forest', 'wetland'] },
  { id: 'market', name: '长街集市', kind: '贸易', x: 340, y: 380, description: '魔晶与药材的交换地。交易需要真的支付钱币，不凭一句承诺完成。', neighbors: ['city', 'forest', 'wetland'] },
  { id: 'academy', name: '符文高塔', kind: '研究', x: 675, y: 305, description: '保存旧时代抄本。识读符文需要法力，发现的线索不自动告诉其他人。', neighbors: ['city', 'ruins', 'mine'] },
  { id: 'forest', name: '低语森林', kind: '森林', x: 260, y: 170, description: '采集微光魔晶的林地，树根旁留有古老铭文。', neighbors: ['city', 'market', 'ruins'] },
  { id: 'mine', name: '霜脊矿山', kind: '山脉', x: 810, y: 455, description: '高产的魔晶矿脉。风暴可能暂时阻断道路。', neighbors: ['academy'] },
  { id: 'wetland', name: '余烬湿地', kind: '湿地', x: 180, y: 480, description: '尸族与旅人在雾中居住。这里的居民并不天然属于同一立场。', neighbors: ['city', 'market'] },
  { id: 'ruins', name: '失落遗迹', kind: '遗迹', x: 780, y: 125, description: '残缺的旧回路通向中心。这里能找到线索，不等于已经揭开核心真相。', neighbors: ['forest', 'academy'] },
]);
export const PLACE = Object.freeze(Object.fromEntries(LOCATIONS.map(location => [location.id, location])));
export const FACTIONS = Object.freeze({
  independent: { name: '独立', color: '#7660a9' },
  watch: { name: '守望议会', color: '#607d9a' },
  research: { name: '术法研究院', color: '#8f72bb' },
  trade: { name: '自由商会', color: '#b18b53' },
  embers: { name: '余烬社', color: '#688d82' },
});
export const DIRECTIONS = Object.freeze({ investigate: '追查古老符文', support: '支援城市供能', gather: '采集魔晶', negotiate: '推动共同协商', stealth: '隐匿与观察', rest: '休息恢复' });
export const CLUES = Object.freeze({
  academy: { key: 'clue-academy', text: '旧抄本将核心称为“回流之环”，没有说明它的制造者。' },
  forest: { key: 'clue-forest', text: '树根铭文描绘多条回路汇入中心，似乎并非单向供能。' },
  ruins: { key: 'clue-ruins', text: '遗迹的断裂回路与核心共鸣，但“所有者”的铭文已被擦去。' },
});
export const EVENT_TYPES = Object.freeze({ surge: '核心异动', storm: '矿山风暴', caravan: '商队抵达', rumor: '传播一条传闻' });
export const INITIAL_ACTORS = Object.freeze([
  { id: PLAYER_ID, name: '无名法师', race: '未公开', role: 'mage', faction: 'independent', location: 'city', description: '兜帽下的轮廓模糊。幻术与符文是你的专长；外形、名字与背景仍可修改。', desire: '理解核心的来历，同时保留自己的选择权。（可改草案）', belief: '知识应该经过验证，而不是仅凭传闻。', goalKind: 'investigate', goal: '寻找古老符文的线索', mana: 16, crystals: 2, coins: 8 },
  { id: 'warden', name: '艾岚', race: '人族', role: 'guard', faction: 'watch', location: 'city', description: '负责结界维护的守望者，习惯先检查风险。', desire: '希望议会长期掌握核心，认为失去秩序会毁掉城市。', belief: '集中维护权比无人负责更安全。', goalKind: 'support', goal: '保护城市结界', mana: 15, crystals: 3, coins: 6 },
  { id: 'scholar', name: '瑟琳', race: '人族', role: 'scholar', faction: 'research', location: 'academy', description: '研究旧时代符文的学者，愿意合作，但不轻易交出研究成果。', desire: '想获得核心研究权，确认它是否封存着尚未苏醒的力量。', belief: '现有供能方式可能只使用了核心的一小部分。', goalKind: 'investigate', goal: '研究旧回路', mana: 18, crystals: 1, coins: 5 },
  { id: 'trader', name: '洛珀', race: '狐兽族', role: 'trader', faction: 'trade', location: 'market', description: '熟悉道路与价格的商人，喜欢用交易解决争端。', desire: '希望控制魔晶渠道，让城市逐渐依赖商会。', belief: '稳定的交易网络比善意承诺可靠。', goalKind: 'gather', goal: '补充魔晶库存', mana: 12, crystals: 1, coins: 12 },
  { id: 'healer', name: '余烬', race: '尸族', role: 'healer', faction: 'embers', location: 'wetland', description: '不再呼吸的药师，仍然照顾来往的居民。', desire: '希望取得核心的供能保障，寻找改变自己生命状态的可能。', belief: '核心或许与生命变化有关，但这还没有证据。', goalKind: 'support', goal: '保障居民的生存条件', mana: 14, crystals: 2, coins: 4 },
]);
export const ROLE_NAMES = Object.freeze({ mage: '幻术与符文法师', guard: '结界守望者', scholar: '符文学者', trader: '商人', healer: '药师' });
