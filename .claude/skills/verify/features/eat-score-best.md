# Eat, score and best

When the snake's head reaches the red food, the snake grows by one, 得分 rises by one, new food appears on a free cell, and the game speeds up slightly. 最高分 tracks the best score and survives a reload.

## Sub-features

- `eat` increments the score and lengthens the snake.
- `respawn` places new food that is never on the snake.
- `best-live` updates 最高分 as soon as the score passes it.
- `best-persist` keeps 最高分 after a reload.

## How to get to it (user POV)

- Play and steer into the food.

## Driving it with drive.mjs

Preconditions: baseline.

- **Eat twice.** Run `press:Space seek-food press:Space expect-score:>=:1 board state shot:after-eat press:Space seek-food press:Space expect-score:>=:2 board`. The `press:Space` around each check pauses the game so the snake does not run into a wall while you look. The `state` line shows `best` equal to `score`, and `storedBest` is the same number as a string.
- **Best persists.** Continue with `expect-best:2 reload expect-best:2 shot:best-after-reload`. The ready screen shows 最高分 2 and 得分 0.
- **Growth.** The second `board` line has one more body cell than the first.

## Gotchas

- The game keeps running between steps. Pause with `press:Space` before slow steps such as `shot`, `board` or `state`, and resume before the next `seek-food`. Without the pause the snake can hit a wall unsteered.

- `seek-food` steers greedily and can trap itself on long runs. Keep proofs to a few points. If it reports `game stopped while seeking food`, rerun it before you suspect the app.
- `best` is per browser profile. Each `drive.mjs` run starts at 0, so persistence must be proved with `reload` inside one run.
