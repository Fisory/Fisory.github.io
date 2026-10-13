// Same-origin local gateway only. The browser never knows a provider credential.
import { exportExperiment, importExperiment } from './engine.js';

export class GatewayError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function createGateway() {
  let session = null, active = null;
  async function request(route, value, { signal, keepalive = false } = {}) {
    let response;
    try {
      response = await fetch(`/__world/${route}`, {
        method: value === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal, keepalive,
        headers: value === undefined ? {} : { 'Content-Type': 'application/json', 'X-World-CSRF': session?.csrf || '' },
        body: value === undefined ? undefined : JSON.stringify(value),
      });
    } catch { throw new GatewayError(signal?.aborted ? 'CANCELLED' : 'OFFLINE', signal?.aborted ? '已停止等待；正在确认服务端是否提交。' : '本地服务连接中断。不会自动切成规则或重复调用，请重新连接。'); }
    let result;
    try { result = await response.json(); }
    catch { throw new GatewayError(signal?.aborted ? 'CANCELLED' : 'OFFLINE', signal?.aborted ? '实验已停止；正在读取服务端最后确认的世界。已发出的请求可能仍计费。' : '没有找到世界服务，请使用 npm.cmd run world:preview 启动。'); }
    if (!response.ok) throw new GatewayError(result.error?.code || 'SERVER', result.error?.message || '服务端没有接受这项操作。');
    if (result.history) {
      try { result.history = importExperiment(exportExperiment(result.history)); }
      catch { throw new GatewayError('STATE', '服务端状态无效，没有覆盖当前画面。'); }
      session = result;
    }
    return result;
  }
  return {
    async connect() {
      if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw new GatewayError('LOCAL_ONLY', '这是离线规则预览。真正的 AI 需要本机服务；尚未部署多人世界。');
      return request('session', undefined, { signal: AbortSignal.timeout(6000) });
    },
    async command(kind, data, baseVersion, source) {
      if (active) throw new GatewayError('BUSY', '本页面已有一项操作在进行。');
      const id = crypto.randomUUID(), controller = new AbortController(); active = { id, controller };
      try { return await request('command', { id, baseVersion, kind, source, data }, { signal: controller.signal }); }
      finally { active = null; }
    },
    async cancel() {
      if (!active) return false;
      const job = active;
      try { const result = await request('cancel', { id: job.id }, { signal: AbortSignal.timeout(5000), keepalive: true }); if (result.cancelled) job.controller.abort(); return result.cancelled; }
      catch { job.controller.abort(); return true; }
    },
  };
}
