# Wrap mode

The 穿墙模式 switch under the score line makes the walls wrap. A snake that leaves one edge re-enters from the opposite edge and keeps playing. Hitting its own body still ends the game. The choice survives a reload, and 最高分 is kept separately for each mode.

## Sub-features

- `toggle` flips the switch with a click or tap, or with the `M` key. Each switch starts a fresh ready game in the new mode.
- `locked-while-running` disables the switch while the game runs, and `M` does nothing then.
- `wrap-through` lets the snake cross an edge alive and appear on the opposite side, shown with a dashed board border.
- `solid-still-kills` keeps the old wall death when the switch is off.
- `persist` keeps the choice in `localStorage["snake.walls"]` across a reload.
- `best-per-mode` shows and stores 最高分 per mode (`snake.best` solid, `snake.best.wrap` wrap).

## How to get to it (user POV)

- Click or tap 穿墙模式 on the ready, paused or game-over screen, or press `M` there.

## Driving it with drive.mjs

Preconditions: baseline. The snake starts at x=10 heading right, one cell per 140ms.

- **Toggle by click.** Run `click-on:#wrap expect-walls:on state shot:wrap-on click-on:#wrap expect-walls:off`. `state` shows `walls:true` and `storedWalls:"wrap"`. With `--mobile` the same steps tap the switch.
- **Toggle by key.** Run `press:m expect-walls:on press:m expect-walls:off`.
- **Locked while running.** Run `press:Space expect-enabled:#wrap:false press:m press:Space expect-walls:off expect-enabled:#wrap`. The `press:m` is ignored while running, and pausing re-enables the switch.
- **Wrap demo.** Run `click-on:#wrap press:Space expect-overlay:hidden wait:700 shot:approaching-edge wait-head-x:<=:3 expect-overlay:hidden board shot:wrapped state`. The `board` line shows the head at a small x on the left, the overlay stays hidden, and `shot:wrapped` shows the dashed border with the snake coming out of the left edge. The head can only reach x<=3 by crossing the right edge.
- **Persistence.** Run `click-on:#wrap reload expect-walls:on state shot:persisted`. The ready screen shows the switch on, the dashed border, and `storedWalls:"wrap"`.
- **Solid still kills.** On a fresh run leave the switch off and run `press:Space wait-overlay:游戏结束:5000 shot:solid-wall`. The head hits the right wall after about 10 ticks.
- **Self collision in wrap.** Run `click-on:#wrap press:Space seek-food seek-food coil wait-overlay:游戏结束:3000 shot:wrap-self`. The snake needs length 5 before `coil`, so rerun the whole line when `seek-food` loses to a trap.
- **Switch starts a new game.** Run `press:Space seek-food press:Space expect-score:>=:1 click-on:#wrap expect-overlay:按空格开始 expect-score:=:0 shot:switched-fresh`. Switching while paused or after game over drops the current run and shows a fresh ready screen in the new mode, so one run never mixes two wall rules.
- **Best per mode.** Run `press:Space seek-food press:Space expect-best:1 click-on:#wrap expect-best:0 press:Space seek-food seek-food press:Space expect-best:2 state click-on:#wrap expect-best:1 state`. The first `state` shows `storedBest:"1"` and `storedBestWrap:"2"`.

## Gotchas

- `click-on:#wrap` on a running game waits for the disabled switch until it times out. Pause with `press:Space` first.
- Pressing `Space` right after `click-on:#wrap` is safe because the page blurs the switch, so the key starts the game and does not toggle the switch again.
- Pause before slow steps (`shot`, `board`, `state`) once the wrap demo has reached its point, because the snake keeps wrapping and can run into its own tail on long runs.
- A food cell on row 10 can be eaten during the demo. That changes the score and the tick length slightly but does not change the result.
