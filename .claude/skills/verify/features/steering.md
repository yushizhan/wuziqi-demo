# Steering

The player turns the snake with the arrow keys or WASD. A turn into the exact opposite direction is ignored. Two quick turns inside one tick are both applied in order.

## Sub-features

- `turn-arrows` turns with the arrow keys.
- `turn-wasd` turns with WASD.
- `no-reverse` ignores a 180° turn.
- `buffered` keeps up to two turns pressed within one tick.

## How to get to it (user POV)

- Arrow keys or `w`, `a`, `s`, `d` while running.

## Driving it with drive.mjs

Preconditions: baseline. The snake starts in the middle heading right, with its head at (10,10).

- **Arrow turn.** Run `press:Space press:ArrowUp wait:300 board`. The head has a smaller `y` than 10.
- **WASD turn.** On a fresh page run `press:Space press:s wait:300 board`. The head has a larger `y` than 10.
- **No reverse.** On a fresh page run `press:Space press:ArrowLeft wait:400 board expect-overlay:hidden`. The head `x` keeps growing and the game is still running.
- **Buffered turns.** On a fresh page run `press:Space wait:200 press:ArrowUp press:ArrowLeft wait:400 board expect-overlay:hidden`. The head moves up one cell and then left, and the snake does not die.

## Gotchas

- At the start speed one tick is 140 ms. Fixed `wait` values are approximate, so assert direction (a coordinate trend), not exact cells.
- A lone `Left` while heading right is ignored. Do not misread it as a broken key handler.
