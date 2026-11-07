---
name: verify
description: Launch and drive the 贪吃蛇 (Snake) browser SPA in headless Chromium to prove gameplay works the way a player sees it (start/pause, turning, eating and scoring, best score persistence, wrap-around walls mode, game over and restart, mobile D-pad and swipe). Use after any change to src/, index.html or styles, or whenever asked to run, screenshot, or verify the game.
---

# Verify the Snake SPA

The only user surface is a single page served by Vite: a 20×20 `<canvas>` board plus a DOM overlay, score line and a touch D-pad. There is no backend. The persisted state is `localStorage` keys `snake.best` and `snake.best.wrap` (best score per wall mode) and `snake.walls` (the 穿墙模式 choice), and every drive gets a fresh browser context, so runs never share state.

All commands run from the repo root. `S=.claude/skills/verify/scripts`.

## Launch

```bash
S=.claude/skills/verify/scripts
PORT=4317            # pick a free port per run; two runs on different ports never interfere
$S/control.sh launch $PORT
```

`launch` runs `npm ci` when `node_modules` is missing, runs `npm run build` (type-check plus Vite build), records the built git revision, and starts `vite preview` on `127.0.0.1:$PORT` in its own process group. Ready means the line `ready: http://127.0.0.1:$PORT/ (pid …, rev …)`, printed only after the page serves `<title>贪吃蛇</title>`. It refuses a port that some other process already holds. Never drive an instance you did not launch, including the user's own `npm run dev`.

The build is a snapshot. After editing `src/`, run `stop` then `launch` again.

## Doctor

```bash
$S/control.sh doctor $PORT
```

Read-only. Prints `OK: … build=<rev> head=<rev> uncommitted_src_files=<n>` when the process launched on this port is alive and serves the snake page. It prints `WARN: build may be stale` when the build revision differs from HEAD or `src/`/`index.html` have uncommitted edits. A stale build cannot prove your change, so relaunch. Run doctor first whenever a drive fails strangely.

## Drive

```bash
node $S/drive.mjs --port $PORT --out .verify-artifacts/<run-id>/<feature> [--mobile] <step> <step> ...
```

Each invocation opens one fresh page (desktop 800×900, or a 390×844 touch phone with `--mobile`), waits for the ready screen, runs the steps in order, and stops at the first failure. Exit code 0 and a final `RESULT PASS` line mean every step passed. Uncaught page errors also fail the run. The game keeps ticking between steps, so pause with `press:Space` before slow steps (`shot`, `board`, `state`) and resume before steering again. Step arguments are separated by `:` so a regex argument must not contain `:`.

| Step | What the player does or sees |
| --- | --- |
| `press:<key>` | Presses a key. Keys the game uses are `Space`, `Enter`, `r`, `ArrowUp/Down/Left/Right`, `w/a/s/d`. |
| `tap:<up\|down\|left\|right>` | Taps the on-screen D-pad button `.dpad button[data-dir=…]`. |
| `swipe:<dir>` | Swipes 80px across the board (touch events). |
| `click-on:<css selector>` | Clicks the element, or taps it with `--mobile`. For example `click-on:#wrap` flips the 穿墙模式 switch. |
| `expect-walls:<on\|off>` | Asserts the 穿墙模式 switch state. |
| `expect-enabled:<selector>[:false]` | Asserts the element is enabled, or disabled with `:false`. |
| `wait-head-x:<op>:<n>[:<ms>]` (op is `<=` or `>=`) | Polls the drawn board (default 5s) until the head column satisfies the comparison. Use `<=:3` to catch a head that wrapped to the left edge. |
| `click` | Clicks or taps the board. This starts or pauses, or restarts after game over. |
| `wait:<ms>` | Lets the game run. |
| `wait-overlay:<regex\|hidden>[:<ms>]` | Waits (default 15s) until the overlay text matches, or the overlay is hidden, which means running. |
| `expect-overlay:<regex\|hidden>` | Asserts the overlay within 1s. |
| `expect-score:<op>:<n>` (op is `=`, `>=` or `>`) | Asserts the visible 得分 number. |
| `expect-best:<n>` | Asserts the visible 最高分 number. |
| `expect-visible:<selector>[:false]` | Asserts visibility, for example of `.dpad`. |
| `seek-food[:<ms>]` | Plays like a person. It reads the rendered canvas colours to find the head and the food, then presses one arrow key per tick toward the food, avoiding walls and body, until 得分 rises. It fails if the game ends or the time runs out. |
| `coil` | Turns sideways, back, and sideways again, one press per tick, so the head runs into the body. The snake must be at least 5 long, which takes two `seek-food`. |
| `reload` | Reloads the page and waits for the ready screen. Use it to prove persistence. |
| `shot:<name>` | Saves `<out>/<name>.png`. |
| `state` / `board` | Logs score, best, overlay text and stored best, or the head, food and body cells read from the canvas. |

Overlay texts are `按空格开始` (ready), `已暂停` (paused), `游戏结束` (lost), and `通关了！` (board filled). The per-feature recipes live in [features/README.md](features/README.md). Drive every entry point the feature file lists, not only the convenient one.

## Evidence

Evidence lives in `.verify-artifacts/<run-id>/<feature>/`, which git ignores. `transcript.log` holds one line per step with `ok`/`FAIL`, logged state and the final `RESULT` line. Next to it are the `shot:` screenshots and `failure.png` on failure. Proof standards:

- Drive through real input (keys, taps, swipes, clicks). Never call game functions or edit state from the page.
- Pair each action with the resulting state, either an overlay assertion or score assertion, or a `state` line, plus a screenshot at the key moments. One final screenshot is not a proof.
- Prove side effects. For best score, assert `storedBest` in `state` and survive a `reload`.
- Quote the transcript lines and screenshot paths in your report.

## Cleanup

```bash
$S/control.sh stop $PORT
```

It kills only the process group this run launched and deletes `/tmp/snake-verify-$PORT`, which holds the logs, pid and build revision. It never touches `.verify-artifacts/`, so the proof survives. Run `stop` after failed attempts too. Delete old `.verify-artifacts/` runs only when the user asks.

## Helpers

- `scripts/control.sh launch|doctor|stop <port>` manages the instance as described above.
- `scripts/drive.mjs` is the step runner. It uses the repo's `playwright-core` devDependency. If Playwright's pinned browser is missing, it falls back to the newest `~/.cache/ms-playwright/chromium-*`. If neither exists, run `npx playwright-core install chromium-headless-shell`.
