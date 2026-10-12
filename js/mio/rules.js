// A small, bounded math language. Model output never becomes JavaScript.
export const FUNCTIONS = Object.freeze({
  sin: [1, Math.sin], cos: [1, Math.cos], abs: [1, Math.abs], tanh: [1, Math.tanh],
  sqrt: [1, x => Math.sqrt(Math.abs(x))], floor: [1, Math.floor],
  min: [2, Math.min], max: [2, Math.max],
  clamp: [3, (x, a, b) => Math.min(Math.max(x, a), b)],
  mix: [3, (a, b, t) => a + (b - a) * t],
  noise: [1, x => { const n = Math.sin(x * 127.1 + 311.7) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; }],
});
const VARIABLES = new Set(['px', 'py', 'vx', 'vy', 't', 'dt', 'i', 'seed', 'mx', 'my', 'touch', 'pi']);
const COLORS = /^#[0-9a-f]{6}$/i;
export const DEFAULT_SCENE = Object.freeze({
  version: 1, title: '会呼吸的星云', kind: 'nebula', seed: 718,
  count: 680, palette: ['#80c7ff', '#c3d7ff', '#aeabf5'], background: '#0b1526',
  size: 1.6, speed: 0.65, spread: 0.82, breath: 0.18, breathPeriod: 8,
  rotation: 0.16, glow: 0.45, trail: 0.2,
  interaction: 'repel', interactionRadius: 0.22, interactionStrength: 0.8,
  forceX: '0', forceY: '0',
});
export const SCENE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: Object.keys(DEFAULT_SCENE),
  properties: {
    version: { type: 'integer', enum: [1] }, title: { type: 'string', maxLength: 60 },
    kind: { type: 'string', enum: ['nebula', 'rain', 'orbit', 'flow'] },
    seed: { type: 'integer', minimum: 0, maximum: 2147483647 },
    count: { type: 'integer', minimum: 40, maximum: 1400 },
    palette: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } },
    background: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    size: { type: 'number', minimum: 0.4, maximum: 4 },
    speed: { type: 'number', minimum: 0.1, maximum: 3 },
    spread: { type: 'number', minimum: 0.2, maximum: 1.2 },
    breath: { type: 'number', minimum: 0, maximum: 0.6 },
    breathPeriod: { type: 'number', minimum: 2, maximum: 20 },
    rotation: { type: 'number', minimum: -1.5, maximum: 1.5 },
    glow: { type: 'number', minimum: 0, maximum: 0.8 },
    trail: { type: 'number', minimum: 0, maximum: 0.9 },
    interaction: { type: 'string', enum: ['repel', 'attract', 'off'] },
    interactionRadius: { type: 'number', minimum: 0.05, maximum: 0.5 },
    interactionStrength: { type: 'number', minimum: 0, maximum: 3 },
    forceX: { type: 'string', maxLength: 220 }, forceY: { type: 'string', maxLength: 220 },
  },
};

export function compileExpression(source) {
  if (typeof source !== 'string' || !source.trim() || source.length > 220) throw new Error('规则必须是 1–220 字符的数学表达式。');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[^\s]/g) || [];
  if (tokens.length > 110) throw new Error('规则过于复杂。');
  let cursor = 0, nodes = 0;
  const node = value => { if (++nodes > 100) throw new Error('规则过于复杂。'); return value; };
  function parse(minimum = 0, depth = 0) {
    if (depth > 18) throw new Error('规则嵌套过深。');
    const token = tokens[cursor++];
    let left;
    if (token === '+' || token === '-') left = node({ unary: token, value: parse(30, depth + 1) });
    else if (token === '(') {
      left = parse(0, depth + 1);
      if (tokens[cursor++] !== ')') throw new Error('规则括号不匹配。');
    } else if (token && /^(?:\d|\.)/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('规则常数超出范围。');
      left = node({ number: value });
    } else if (token && Object.hasOwn(FUNCTIONS, token)) {
      if (tokens[cursor++] !== '(') throw new Error('函数需要括号。');
      const args = [];
      if (tokens[cursor] !== ')') {
        do { args.push(parse(0, depth + 1)); if (tokens[cursor] !== ',') break; cursor++; } while (true);
      }
      if (tokens[cursor++] !== ')' || args.length !== FUNCTIONS[token][0]) throw new Error('函数参数数量不正确。');
      left = node({ fn: token, args });
    } else if (VARIABLES.has(token)) left = node({ variable: token });
    else throw new Error(`规则包含不允许的符号：${token || '空值'}。`);
    while (cursor < tokens.length) {
      const op = tokens[cursor], precedence = ({ '+': 10, '-': 10, '*': 20, '/': 20, '%': 20 })[op];
      if (precedence === undefined || precedence < minimum) break;
      cursor++;
      left = node({ op, left, right: parse(precedence + 1, depth + 1) });
    }
    return left;
  }
  const tree = parse();
  if (cursor !== tokens.length) throw new Error('规则含有不允许的操作；只能使用数学表达式。');
  function evaluate(treeNode, context) {
    if (treeNode.number !== undefined) return treeNode.number;
    if (treeNode.variable) return treeNode.variable === 'pi' ? Math.PI : context[treeNode.variable] ?? 0;
    if (treeNode.fn) return FUNCTIONS[treeNode.fn][1](...treeNode.args.map(arg => evaluate(arg, context)));
    if (treeNode.unary) return (treeNode.unary === '-' ? -1 : 1) * evaluate(treeNode.value, context);
    const a = evaluate(treeNode.left, context), b = evaluate(treeNode.right, context);
    return treeNode.op === '+' ? a + b : treeNode.op === '-' ? a - b : treeNode.op === '*' ? a * b : treeNode.op === '/' ? a / b : a % b;
  }
  return context => {
    const result = evaluate(tree, context);
    if (!Number.isFinite(result) || Math.abs(result) > 10000) throw new Error('规则产生了非有限值或过大数值。');
    return result;
  };
}

export function validateScene(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('作品配置无效。');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULT_SCENE, key)) throw new Error(`不支持的作品字段：${key}。`);
  if (input.palette !== undefined && !Array.isArray(input.palette)) throw new Error('作品调色板必须是颜色数组。');
  const scene = { ...DEFAULT_SCENE, ...input, palette: [...(input.palette || DEFAULT_SCENE.palette)] };
  for (const [key, spec] of Object.entries(SCENE_SCHEMA.properties)) {
    const value = scene[key];
    if (spec.type === 'integer' && !Number.isSafeInteger(value)) throw new Error(`${key} 必须是整数。`);
    if (spec.type === 'number' || spec.type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || (spec.minimum !== undefined && value < spec.minimum) || (spec.maximum !== undefined && value > spec.maximum)) throw new Error(`${key} 超出安全范围。`);
    }
    if (spec.type === 'string' && (typeof value !== 'string' || (spec.maxLength && value.length > spec.maxLength))) throw new Error(`${key} 的文字格式不正确。`);
    if (spec.enum && !spec.enum.includes(value)) throw new Error(`${key} 不在允许的选项中。`);
  }
  if (!scene.title.trim() || /[\u0000-\u001f]/.test(scene.title)) throw new Error('作品名称不正确。');
  if (!COLORS.test(scene.background) || !Array.isArray(scene.palette) || scene.palette.length < 1 || scene.palette.length > 4 || !scene.palette.every(c => typeof c === 'string' && COLORS.test(c))) throw new Error('作品颜色必须是六位十六进制色值。');
  const forceX = compileExpression(scene.forceX), forceY = compileExpression(scene.forceY);
  for (let n = 0; n < 24; n++) {
    const context = { px: Math.sin(n), py: Math.cos(n), vx: .1, vy: -.2, t: n * .7, dt: 1 / 60, i: n / 24, seed: .4, mx: .3, my: -.4, touch: n % 2 };
    forceX(context); forceY(context);
  }
  return scene;
}

export function presetScene(name, base = DEFAULT_SCENE) {
  const scene = { ...base, palette: [...base.palette], forceX: '0', forceY: '0' };
  if (name === 'rain') Object.assign(scene, { title: '不听话的光雨', kind: 'rain', speed: .7, breath: 0, interaction: 'repel', palette: ['#89d7ff', '#c6e7ff'] });
  else if (name === 'orbit') Object.assign(scene, { title: '绕着想法转的光', kind: 'orbit', rotation: .35, breath: .08, interaction: 'attract' });
  else if (name === 'flow') Object.assign(scene, { title: '风的笔迹', kind: 'flow', speed: .8, forceX: '.35*sin(py*4+t*.6)', forceY: '.35*cos(px*4-t*.5)', palette: ['#93e5ce', '#80c7ff'] });
  else return validateScene(DEFAULT_SCENE);
  return validateScene(scene);
}
