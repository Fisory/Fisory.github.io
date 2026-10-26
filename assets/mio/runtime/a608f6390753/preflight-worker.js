import { preflightScene } from './engine.js';
self.addEventListener('message', event => {
  try { self.postMessage({ ok: true, report: preflightScene(event.data) }); }
  catch (error) { self.postMessage({ ok: false, error: error.message }); }
});
