# Snake verification map

This directory is the maintained source for verifying what a player can do in the 贪吃蛇 SPA. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- An instance launched by this run with `$S/control.sh launch $PORT`, and `$S/control.sh doctor $PORT` prints `OK` with no `WARN`.
- Every `drive.mjs` invocation starts from a fresh page on the ready screen (`按空格开始`), score 0, best 0, empty `localStorage`.

## Driving conventions

- Use the `drive.mjs` steps from `SKILL.md`. Prefer `seek-food` over fixed key sequences, because food placement is random per page load.
- Write evidence to `.verify-artifacts/<run-id>/<feature-id>/`.
- Desktop entry points run without `--mobile`. Touch entry points run with `--mobile`.

## Proof and skip reporting

- Pair each action with an overlay, score or `state` assertion, and take a screenshot at the key moment.
- Report a skipped entry point as skipped. Do not count it as verified through a different entry point.

## Features

- [Start and pause](./start-pause.md) covers starting from the ready screen, pausing, resuming and auto-pause on tab hide.
- [Steering](./steering.md) covers arrow keys, WASD, ignored reverse turns and buffered turns.
- [Eat, score and best](./eat-score-best.md) covers growth, the score counter, the speed-up and best-score persistence.
- [Game over and restart](./game-over-restart.md) covers wall and self collision, the game-over screen and restarting.
- [Mobile controls](./mobile-controls.md) covers the D-pad, swipes and tap-to-pause on touch devices.
