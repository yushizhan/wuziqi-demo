# Game over and restart

Hitting a wall or the snake's own body ends the game with `游戏结束` and the final score. Filling the whole board shows `通关了！`. The player restarts straight into a new running game.

## Sub-features

- `wall-death` ends the game when the snake leaves the board.
- `self-death` ends the game when the head hits the body.
- `restart` begins a fresh running game with score 0.
- `win` shows `通关了！` when the board is full.

## How to get to it (user POV)

- Let the snake run into a wall.
- Press `Enter` or `r`, or click the board, on the game-over screen.

## Driving it with drive.mjs

Preconditions: baseline.

- **Wall death.** Run `press:Space wait-overlay:游戏结束:10000 expect-score:=:0 shot:over`. The snake runs right into the wall in about 1.4 s.
- **Space is inert.** Continue with `press:Space expect-overlay:游戏结束`.
- **Restart by key.** Continue with `press:r expect-overlay:hidden expect-score:=:0`. Repeat on a fresh page with `press:Enter`.
- **Restart by click.** After a wall death on a fresh page, run `click expect-overlay:hidden`.
- **Self death.** Grow to length 5, then coil into the body. Run `press:Space seek-food seek-food coil expect-overlay:游戏结束 board shot:self-death`. The game ends without the head touching the board edge. In the last `board` line the head sits next to the body, because the canvas still shows the position before the fatal move.

## Gotchas

- `win` needs 400 cells filled and is not reachable in a practical drive. It is covered only by unit tests in `src/game.test.ts`. Report it as not driven.
- A wall death also shows `游戏结束`. Check the `board` line before `coil`. `coil` only picks a side with room for the turns, so a head on the edge after the coil means the recipe went wrong, not that self collision works.
