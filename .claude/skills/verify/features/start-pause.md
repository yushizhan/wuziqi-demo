# Start and pause

The game opens on a ready screen. The player starts it, pauses it, and resumes it. While paused the snake does not move.

## Sub-features

- `start` begins play from the ready screen.
- `pause` freezes the snake and shows `已暂停`.
- `resume` continues from the same position.
- `auto-pause` pauses when the tab is hidden.

## How to get to it (user POV)

- Press `Space`.
- Press any direction key on the ready screen. This starts and turns at once.
- Click the board.

## Driving it with drive.mjs

Preconditions: baseline.

- **Start by Space.** Run `press:Space expect-overlay:hidden`. The overlay disappears.
- **Start by arrow.** Run `press:ArrowUp expect-overlay:hidden` on a fresh page.
- **Start by click.** Run `click expect-overlay:hidden` on a fresh page.
- **Pause freezes.** Run `press:Space wait:300 press:Space expect-overlay:已暂停 board wait:600 board shot:paused`. Both `board` lines show the same head cell.
- **Resume.** Then run `press:Space expect-overlay:hidden`.

## Gotchas

- `auto-pause` needs a real tab switch. Headless Chromium does not fire `visibilitychange` on its own, so report it as skipped unless you emulate it with a second page brought to the front.
- Space on the game-over screen does nothing on purpose. Use restart.
