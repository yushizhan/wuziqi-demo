#!/usr/bin/env node
// Usage: drive.mjs --port <port> --out <dir> [--mobile] <step> [<step> ...]
// Steps run in order in one fresh browser context (empty localStorage). Any failed expectation exits 1.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: opts, positionals: steps } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string' }, out: { type: 'string' }, mobile: { type: 'boolean', default: false } },
});
if (!opts.port || !opts.out || steps.length === 0) {
  console.error('usage: drive.mjs --port <port> --out <dir> [--mobile] <step> [<step> ...]');
  process.exit(2);
}
mkdirSync(opts.out, { recursive: true });
rmSync(join(opts.out, 'failure.png'), { force: true });
const transcript = join(opts.out, 'transcript.log');
const log = (line) => {
  console.log(line);
  appendFileSync(transcript, line + '\n');
};

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (err) {
    const cache = join(homedir(), '.cache/ms-playwright');
    const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
    const exe = dirs.length ? join(cache, dirs.at(-1), 'chrome-linux64/chrome') : null;
    if (!exe || !existsSync(exe)) throw new Error(`no Chromium found; run: npx playwright-core install chromium-headless-shell\n${err.message}`);
    return chromium.launch({ executablePath: exe });
  }
}

const browser = await launchBrowser();
const context = await browser.newContext(
  opts.mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 800, height: 900 } },
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// The overlay ships hidden in index.html and appears on the first animation frame, so wait for the ready screen.
const gotoReady = async () => {
  await page.goto(`http://127.0.0.1:${opts.port}/`);
  await page.waitForFunction(() => !document.getElementById('overlay').hidden, null, { timeout: 5000 });
};
await gotoReady();

const readState = () =>
  page.evaluate(() => {
    const overlay = document.getElementById('overlay');
    return {
      score: Number(document.getElementById('score').textContent),
      best: Number(document.getElementById('best').textContent),
      overlay: overlay.hidden ? null : overlay.textContent,
      storedBest: localStorage.getItem('snake.best'),
    };
  });

// Reads the board the way a player sees it: samples each cell centre and classifies by the rendered colour.
const readBoard = () =>
  page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const n = 20;
    const cell = canvas.width / n;
    const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const near = (i, [r, g, b]) => Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b) < 40;
    let head = null, food = null;
    const body = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (Math.floor((y + 0.5) * cell) * canvas.width + Math.floor((x + 0.5) * cell)) * 4;
        if (near(i, [0x6e, 0xe7, 0xb7])) head = { x, y };
        else if (near(i, [0x34, 0xd3, 0x99])) body.push({ x, y });
        else if (near(i, [0xf8, 0x71, 0x71])) food = { x, y };
      }
    }
    return { head, food, body };
  });

const ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

async function swipe(dir) {
  const box = await page.locator('.board').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const [dx, dy] = DELTA[dir].map((d) => d * 80);
  await page.evaluate(([cx, cy, dx, dy]) => {
    const board = document.querySelector('.board');
    const touch = (x, y) => new Touch({ identifier: 1, target: board, clientX: x, clientY: y });
    board.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(cx, cy)], changedTouches: [touch(cx, cy)], bubbles: true }));
    board.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(cx + dx, cy + dy)], bubbles: true }));
  }, [cx, cy, dx, dy]);
}

const inside = (x, y) => x >= 0 && y >= 0 && x < 20 && y < 20;

// The neck is the body cell adjacent to the head, so the heading is the step from neck to head.
function heading({ head, body }) {
  const neck = body.find((p) => Math.abs(p.x - head.x) + Math.abs(p.y - head.y) === 1);
  if (!neck) return null;
  return Object.keys(DELTA).find((d) => neck.x + DELTA[d][0] === head.x && neck.y + DELTA[d][1] === head.y);
}

async function waitHeadMoves(from) {
  for (let i = 0; i < 100; i++) {
    const b = await readBoard();
    if (b.head && (b.head.x !== from.x || b.head.y !== from.y)) return b;
    await page.waitForTimeout(10);
  }
  throw new Error('snake did not move');
}

// Steers one turn per tick, deciding from the board as it is drawn, so a press is never based on a stale heading.
async function seekFood(timeoutMs) {
  // A key pressed just before this step only hides the overlay on the next animation frame.
  await page.waitForFunction(() => document.getElementById('overlay').hidden, null, { timeout: 1000 });
  const start = await readState();
  const deadline = Date.now() + timeoutMs;
  let board = await readBoard();
  while (Date.now() < deadline) {
    const s = await readState();
    if (s.score > start.score) return s;
    if (s.overlay) throw new Error(`game stopped while seeking food: ${s.overlay}`);
    const { head, food, body } = board;
    if (head && food) {
      const blocked = new Set(body.map((p) => `${p.x},${p.y}`));
      const safe = Object.keys(DELTA).filter((d) => {
        const nx = head.x + DELTA[d][0], ny = head.y + DELTA[d][1];
        return inside(nx, ny) && !blocked.has(`${nx},${ny}`);
      });
      const dist = (d) => Math.abs(head.x + DELTA[d][0] - food.x) + Math.abs(head.y + DELTA[d][1] - food.y);
      const best = safe.sort((a, b) => dist(a) - dist(b))[0];
      // Pressing the current heading is a no-op in the game, so no need to compare first.
      if (best) await page.keyboard.press(ARROW[best]);
      board = await waitHeadMoves(head);
    } else {
      await page.waitForTimeout(10);
      board = await readBoard();
    }
  }
  throw new Error(`score did not rise within ${timeoutMs}ms`);
}

// Turns sideways, back, and sideways again, one cell apart, so the head lands on the cell behind its old position.
async function coil() {
  let board = await readBoard();
  const h = heading(board);
  if (!h) throw new Error('cannot read heading');
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[h];
  const side = Object.keys(DELTA)
    .filter((d) => d !== h && d !== back)
    .find((d) => {
      const taken = new Set(board.body.map((p) => `${p.x},${p.y}`));
      const a = { x: board.head.x + DELTA[d][0], y: board.head.y + DELTA[d][1] };
      const b = { x: a.x + DELTA[back][0], y: a.y + DELTA[back][1] };
      return [a, b].every((p) => inside(p.x, p.y) && !taken.has(`${p.x},${p.y}`));
    });
  if (!side) throw new Error('no free side to coil into; run seek-food again first');
  const other = { up: 'down', down: 'up', left: 'right', right: 'left' }[side];
  await page.keyboard.press(ARROW[side]);
  board = await waitHeadMoves(board.head);
  await page.keyboard.press(ARROW[back]);
  await waitHeadMoves(board.head);
  await page.keyboard.press(ARROW[other]);
}

function expectOverlay(s, want) {
  if (want === 'hidden') return s.overlay === null;
  return s.overlay !== null && new RegExp(want).test(s.overlay);
}

const STEPS = {
  press: (key) => page.keyboard.press(key),
  tap: (dir) => page.locator(`.dpad button[data-dir="${dir}"]`).dispatchEvent('pointerdown'),
  swipe,
  click: () => (opts.mobile ? page.locator('.board').tap() : page.locator('.board').click()),
  wait: (ms) => page.waitForTimeout(Number(ms)),
  'wait-overlay': (want, ms = '15000') =>
    page.waitForFunction(
      (want) => {
        const o = document.getElementById('overlay');
        return want === 'hidden' ? o.hidden : !o.hidden && new RegExp(want).test(o.textContent);
      },
      want,
      { timeout: Number(ms) },
    ),
  // The DOM updates on the next animation frame, so allow a short settle before failing.
  'expect-overlay': async (want) => {
    const deadline = Date.now() + 1000;
    let s = await readState();
    while (!expectOverlay(s, want) && Date.now() < deadline) {
      await page.waitForTimeout(50);
      s = await readState();
    }
    if (!expectOverlay(s, want)) throw new Error(`overlay is ${JSON.stringify(s.overlay)}, wanted ${want}`);
  },
  'expect-score': async (op, n) => {
    const s = await readState();
    const ok = { '=': s.score === +n, '>=': s.score >= +n, '>': s.score > +n }[op];
    if (!ok) throw new Error(`score ${s.score} is not ${op} ${n}`);
  },
  'expect-best': async (n) => {
    const s = await readState();
    if (s.best !== +n) throw new Error(`best ${s.best} != ${n}`);
  },
  'expect-visible': async (selector, want = 'true') => {
    const visible = await page.locator(selector).first().isVisible();
    if (String(visible) !== want) throw new Error(`${selector} visible=${visible}, wanted ${want}`);
  },
  'seek-food': (ms = '20000') => seekFood(Number(ms)),
  coil,
  reload: gotoReady,
  shot: (name) => page.screenshot({ path: join(opts.out, `${name}.png`) }),
  state: async () => log(`  state ${JSON.stringify(await readState())}`),
  board: async () => log(`  board ${JSON.stringify(await readBoard())}`),
};

writeFileSync(transcript, `drive ${new Date().toISOString()} port=${opts.port} mobile=${opts.mobile}\n`);
let failed = false;
for (const step of steps) {
  const [name, ...args] = step.split(':');
  const fn = STEPS[name];
  if (!fn) {
    log(`FAIL ${step}: unknown step (known: ${Object.keys(STEPS).join(', ')})`);
    failed = true;
    break;
  }
  try {
    await fn(...args);
    log(`ok   ${step}`);
  } catch (err) {
    log(`FAIL ${step}: ${err.message.split('\n')[0]}`);
    await page.screenshot({ path: join(opts.out, 'failure.png') });
    log(`  state ${JSON.stringify(await readState())}`);
    failed = true;
    break;
  }
}
if (errors.length) log(`page errors: ${JSON.stringify(errors)}`);
await browser.close();
log(failed || errors.length ? 'RESULT FAIL' : 'RESULT PASS');
process.exit(failed || errors.length ? 1 : 0);
