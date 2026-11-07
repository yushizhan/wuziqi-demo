import { createGame, isWon, reduce, tickMs, type Action, type Direction, type GameState, type Walls } from './game';

const WALLS_KEY = 'snake.walls';
const LEGACY_BEST_KEY = 'snake.best';
const BEST_KEYS: Record<Walls, string> = { solid: LEGACY_BEST_KEY, wrap: 'snake.best.wrap' };
const MAX_FRAME_MS = 250;
const SWIPE_MIN_PX = 24;

const KEY_DIRS: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('canvas');
const overlay = $<HTMLDivElement>('overlay');
const scoreEl = $('score');
const bestEl = $('best');
const wrapEl = $<HTMLInputElement>('wrap');
const ctx = canvas.getContext('2d')!;

function loadBest(walls: Walls): number {
  try {
    const n = Number.parseInt(localStorage.getItem(BEST_KEYS[walls]) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function loadWalls(): Walls {
  try {
    return localStorage.getItem(WALLS_KEY) === 'wrap' ? 'wrap' : 'solid';
  } catch {
    return 'solid';
  }
}

function saveWalls(walls: Walls): void {
  try {
    localStorage.setItem(WALLS_KEY, walls);
  } catch {}
}

function saveBest(walls: Walls, n: number): void {
  try {
    localStorage.setItem(BEST_KEYS[walls], String(n));
  } catch {
    // Storage can be blocked (private mode); the best score then lasts for the session only.
  }
}

let state = createGame((Math.random() * 2 ** 32) >>> 0, loadWalls());
const bests: Record<Walls, number> = { solid: loadBest('solid'), wrap: loadBest('wrap') };
let accumulator = 0;
let lastFrame = 0;

function dispatch(action: Action): void {
  const before = state.walls;
  state = reduce(state, action);
  if (state.walls !== before) saveWalls(state.walls);
  if (state.score > bests[state.walls]) {
    bests[state.walls] = state.score;
    saveBest(state.walls, state.score);
  }
}

function press(dir: Direction): void {
  if (state.status === 'ready') dispatch({ type: 'start' });
  dispatch({ type: 'turn', dir });
}

function startOrPause(): void {
  dispatch({ type: state.status === 'ready' ? 'start' : 'toggle-pause' });
}

function restart(): void {
  dispatch({ type: 'restart' });
  dispatch({ type: 'start' });
  accumulator = 0;
}

function toggleWalls(): void {
  dispatch({ type: 'set-walls', walls: state.walls === 'wrap' ? 'solid' : 'wrap' });
}

function onOverlayTap(): void {
  if (state.status === 'over') restart();
  else startOrPause();
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const dir = KEY_DIRS[key];
  if (dir) {
    press(dir);
  } else if (key === ' ') {
    if (state.status !== 'over') startOrPause();
  } else if (key === 'm') {
    toggleWalls();
  } else if (key === 'enter' || key === 'r') {
    restart();
  } else {
    return;
  }
  e.preventDefault();
});

wrapEl.addEventListener('change', () => {
  dispatch({ type: 'set-walls', walls: wrapEl.checked ? 'wrap' : 'solid' });
  // A focused checkbox would also toggle on the Space that starts the game.
  wrapEl.blur();
});

document.querySelectorAll<HTMLButtonElement>('.dpad button').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press(btn.dataset.dir as Direction);
  });
});

let touchStart: { x: number; y: number } | null = null;
const board = canvas.parentElement!;
board.addEventListener('touchstart', (e) => {
  const t = e.touches[0]!;
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
board.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0]!;
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) {
    onOverlayTap();
    return;
  }
  press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
});
board.addEventListener('click', (e) => {
  // Touch taps are handled in touchend; this covers mouse clicks only.
  if ((e as PointerEvent).pointerType === 'mouse') onOverlayTap();
});

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.round(canvas.clientWidth * dpr);
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
}
new ResizeObserver(resize).observe(canvas);

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function draw(s: GameState): void {
  const cell = canvas.width / s.cols;
  const pad = cell * 0.08;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgb(255 255 255 / 0.03)';
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  if (!isWon(s)) {
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc((s.food.x + 0.5) * cell, (s.food.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }

  s.snake.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? '#6ee7b7' : '#34d399';
    roundRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.25);
  });
}

function overlayText(s: GameState): string | null {
  switch (s.status) {
    case 'ready':
      return '按空格开始\n或点击画面 / 按方向键';
    case 'paused':
      return '已暂停\n按空格继续';
    case 'over':
      return `${isWon(s) ? '通关了！' : '游戏结束'}\n得分 ${s.score}\n按 Enter 或 R 重新开始`;
    case 'running':
      return null;
  }
}

function render(): void {
  draw(state);
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(bests[state.walls]);
  wrapEl.checked = state.walls === 'wrap';
  wrapEl.disabled = state.status === 'running';
  board.classList.toggle('wrap', state.walls === 'wrap');
  const text = overlayText(state);
  overlay.hidden = text === null;
  if (text !== null && overlay.textContent !== text) overlay.textContent = text;
}

function frame(now: number): void {
  const dt = Math.min(now - lastFrame, MAX_FRAME_MS);
  lastFrame = now;
  if (state.status === 'running') {
    accumulator += dt;
    for (let ms = tickMs(state.score); accumulator >= ms; ms = tickMs(state.score)) {
      accumulator -= ms;
      dispatch({ type: 'tick' });
      if (state.status !== 'running') break;
    }
  } else {
    accumulator = 0;
  }
  render();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'running') dispatch({ type: 'toggle-pause' });
});

resize();
requestAnimationFrame((t) => {
  lastFrame = t;
  frame(t);
});
