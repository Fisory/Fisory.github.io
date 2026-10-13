import { validateScene, compileExpression } from './rules.js';

function randomGenerator(seed) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export class ParticleWorld {
  constructor(input, maximum = 1400) {
    this.scene = validateScene(input);
    this.forceX = compileExpression(this.scene.forceX);
    this.forceY = compileExpression(this.scene.forceY);
    this.time = 0;
    const random = randomGenerator(this.scene.seed);
    this.particles = Array.from({ length: Math.min(this.scene.count, maximum) }, (_, index) => {
      const u = random(), v = random(), seed = random(), radius = Math.sqrt(u) * this.scene.spread;
      const angle = index % 3 * Math.PI * 2 / 3 + radius * 5.4 + (v - .5) * .65;
      return { u, v, seed, radius, angle, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .76, vx: 0, vy: 0 };
    });
    if (['rain', 'flow'].includes(this.scene.kind)) this.particles.forEach(p => { p.x = (p.u - .5) * 2.4; p.y = (p.v - .5) * 2.4; });
  }
  step(delta, pointer = null) {
    const dt = clamp(delta, 0, .05), scene = this.scene;
    this.time += dt;
    const t = this.time;
    const breath = 1 + Math.sin(t * Math.PI * 2 / scene.breathPeriod) * scene.breath;
    const context = { px: 0, py: 0, vx: 0, vy: 0, t, dt, i: 0, seed: 0, mx: pointer?.x || 0, my: pointer?.y || 0, touch: pointer ? 1 : 0 };
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      let ax = 0, ay = 0;
      if (scene.kind === 'nebula' || scene.kind === 'orbit') {
        const angle = p.angle + t * scene.rotation * (.3 + (1 - p.u) * .4);
        const radius = p.radius * breath;
        const targetX = Math.cos(angle) * radius * 1.08;
        const targetY = Math.sin(angle) * radius * .76 + Math.sin(t * .3 + p.seed * 8) * .015;
        ax = (targetX - p.x) * 2.5; ay = (targetY - p.y) * 2.5;
      } else if (scene.kind === 'rain') ay = .65 * scene.speed + p.seed * .3;
      else { ax = Math.sin(p.y * 3 + t * .4) * .15; ay = Math.cos(p.x * 3 - t * .3) * .15; }
      Object.assign(context, { px: p.x, py: p.y, vx: p.vx, vy: p.vy, i: i / this.particles.length, seed: p.seed });
      ax += clamp(this.forceX(context), -3, 3); ay += clamp(this.forceY(context), -3, 3);
      if (pointer && scene.interaction !== 'off') {
        const dx = p.x - pointer.x, dy = p.y - pointer.y, distance = Math.hypot(dx, dy);
        if (distance > .004 && distance < scene.interactionRadius) {
          const force = (1 - distance / scene.interactionRadius) * scene.interactionStrength * (scene.interaction === 'attract' ? -1 : 1);
          ax += dx / distance * force * 4; ay += dy / distance * force * 4;
        }
      }
      const damping = Math.exp(-dt * (scene.kind === 'rain' ? 1.4 : 2.2));
      p.vx = clamp((p.vx + ax * dt * scene.speed) * damping, -4, 4);
      p.vy = clamp((p.vy + ay * dt * scene.speed) * damping, -4, 4);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (['rain', 'flow'].includes(scene.kind)) {
        if (p.y > 1.45) p.y = -1.45; if (p.y < -1.45) p.y = 1.45;
        if (p.x > 1.6) p.x = -1.6; if (p.x < -1.6) p.x = 1.6;
      }
      if (![p.x, p.y, p.vx, p.vy].every(Number.isFinite) || Math.abs(p.x) > 8 || Math.abs(p.y) > 8) throw new Error('试运行发现粒子数值异常。');
    }
  }
}

export function preflightScene(scene) {
  const started = performance.now();
  const world = new ParticleWorld(scene, 180);
  for (let frame = 0; frame < 240; frame++) world.step(1 / 60, frame > 80 && frame < 160 ? { x: .25 * Math.sin(frame / 10), y: .2 } : null);
  return { stable: true, testedParticles: world.particles.length, testedFrames: 240, simulatedSeconds: 4, testMs: Math.round((performance.now() - started) * 10) / 10 };
}

export function drawWorld(ctx, world, width, height, clear = false) {
  const scene = world.scene, scale = Math.min(width, height) * .43;
  ctx.save();
  ctx.globalAlpha = clear ? 1 : Math.max(.1, 1 - scene.trail);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  const halo = ctx.createRadialGradient(width * .48, height * .5, 0, width * .48, height * .5, scale * 1.1);
  halo.addColorStop(0, scene.palette[0] + '08'); halo.addColorStop(1, scene.palette[0] + '00');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  world.particles.forEach((p, i) => {
    const x = width * .5 + p.x * scale, y = height * .5 + p.y * scale;
    const radius = scene.size * (.35 + p.seed * .65);
    ctx.fillStyle = scene.palette[i % scene.palette.length];
    ctx.globalAlpha = .28 + p.seed * .62;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    if (scene.glow > 0 && i % 5 === 0) {
      ctx.globalAlpha = scene.glow * .06;
      ctx.beginPath(); ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (scene.kind === 'rain') {
      ctx.globalAlpha = .16;
      ctx.strokeStyle = scene.palette[i % scene.palette.length]; ctx.lineWidth = Math.max(.5, radius * .6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * scale * .035, y - p.vy * scale * .055); ctx.stroke();
    }
  });
  ctx.restore();
}

export class CanvasPlayer {
  constructor(canvas, scene, { onError = () => {}, onPointer = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('当前浏览器不支持画布。');
    this.abort = new AbortController(); this.pointer = null; this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.maximum = matchMedia('(max-width: 700px)').matches ? 420 : 1000;
    this.onError = onError; this.last = 0; this.frameMs = 0; this.destroyed = false;
    this.setScene(scene);
    const signal = this.abort.signal;
    const move = event => {
      const rect = canvas.getBoundingClientRect(), scale = Math.min(rect.width, rect.height) * .43;
      this.pointer = { x: (event.clientX - rect.left - rect.width / 2) / scale, y: (event.clientY - rect.top - rect.height / 2) / scale };
      onPointer((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      if (this.paused) this.draw();
    };
    canvas.addEventListener('pointermove', move, { signal });
    canvas.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') canvas.setPointerCapture(event.pointerId); move(event); }, { signal });
    const leave = () => { this.pointer = null; onPointer(.5, .5); };
    canvas.addEventListener('pointerleave', leave, { signal });
    canvas.addEventListener('pointercancel', leave, { signal });
    canvas.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') leave(); }, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', () => { this.last = 0; }, { signal });
    this.resize(); this.tick = this.tick.bind(this); this.animation = requestAnimationFrame(this.tick);
  }
  setScene(scene) { this.world = new ParticleWorld(scene, this.maximum); this.last = 0; if (this.width) this.draw(true); }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    this.width = rect.width; this.height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * ratio); this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0); this.draw(true);
  }
  draw(clear = false) { if (this.width) drawWorld(this.ctx, this.world, this.width, this.height, clear); }
  tick(now) {
    if (this.destroyed || !this.canvas.isConnected) return;
    if (!document.hidden && !this.paused) {
      try {
        const dt = this.last ? Math.min((now - this.last) / 1000, .05) : 0;
        const started = performance.now(); this.world.step(dt, this.pointer); this.draw();
        this.frameMs = this.frameMs * .95 + (performance.now() - started) * .05;
      } catch (error) { this.paused = true; this.onError(error); }
    }
    this.last = now; this.animation = requestAnimationFrame(this.tick);
  }
  metrics() { return { renderMs: Math.round(this.frameMs * 10) / 10, particles: this.world.particles.length, canvasWidth: Math.round(this.width || 0), canvasHeight: Math.round(this.height || 0) }; }
  thumbnail() {
    const image = document.createElement('canvas'); image.width = 384; image.height = 256;
    const context = image.getContext('2d');
    context.drawImage(this.canvas, 0, 0, image.width, image.height);
    return image.toDataURL('image/jpeg', .65);
  }
  destroy() { this.destroyed = true; cancelAnimationFrame(this.animation); this.abort.abort(); this.resizeObserver.disconnect(); }
}

export async function captureFrames(scene, signal) {
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 256;
  const ctx = canvas.getContext('2d', { alpha: false });
  const world = new ParticleWorld(scene, 420), frames = [];
  for (let step = 0; step <= 180; step++) {
    if (signal?.aborted) throw new DOMException('实验已停止', 'AbortError');
    world.step(1 / 60, step > 85 && step < 110 ? { x: .2, y: .1 } : null);
    if ([36, 108, 180].includes(step)) { drawWorld(ctx, world, 384, 256, true); frames.push({ time: Number(world.time.toFixed(2)), image: canvas.toDataURL('image/jpeg', .5) }); }
    if (step % 30 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return frames;
}
