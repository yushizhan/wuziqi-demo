# Mobile controls

On touch devices a four-button D-pad appears under the board. Swiping across the board also turns the snake, and a short tap on the board starts, pauses or restarts.

## Sub-features

- `dpad-visible` shows the D-pad only on coarse pointers.
- `dpad-turn` starts and steers with the D-pad.
- `swipe-turn` steers with swipes.
- `tap-toggle` starts, pauses and resumes with a tap.

## How to get to it (user POV)

- Open the page on a phone and use the ▲ ◀ ▼ ▶ buttons, swipes, or taps.

## Driving it with drive.mjs --mobile

Preconditions: baseline, with the `--mobile` flag.

- **D-pad visible.** Run `expect-visible:.dpad`. On desktop without `--mobile`, run `expect-visible:.dpad:false`.
- **D-pad starts and turns.** Run `tap:up expect-overlay:hidden tap:left wait:300 board expect-overlay:hidden`.
- **Swipe turns.** Continue with `swipe:down wait:300 board expect-overlay:hidden`.
- **Tap pauses and resumes.** Continue with `click expect-overlay:已暂停 shot:paused click expect-overlay:hidden`.

## Gotchas

- `swipe` dispatches synthetic `TouchEvent`s on `.board`. It proves the swipe handler, not the browser's gesture recognition.
- Swipes shorter than 24 px count as taps.
