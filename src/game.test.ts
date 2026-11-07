import { describe, expect, it } from 'vitest';
import { createGame, reduce, tickMs, type Action, type GameState, type Point } from './game';

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reduce, s);
const tick: Action = { type: 'tick' };
const turn = (dir: 'up' | 'down' | 'left' | 'right'): Action => ({ type: 'turn', dir });

function running(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(1), status: 'running', ...overrides };
}

const line = (head: Point, dx: number, dy: number, n: number): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: head.x + dx * i, y: head.y + dy * i }));

describe('snake game', () => {
  it('starts as a length-3 snake heading right in the middle of a 20x20 grid', () => {
    const s = createGame(1);
    expect(s.cols).toBe(20);
    expect(s.rows).toBe(20);
    expect(s.snake).toHaveLength(3);
    expect(s.snake[0]).toEqual({ x: 10, y: 10 });
    expect(s.dir).toBe('right');
    expect(s.status).toBe('ready');
  });

  it('ignores ticks until started', () => {
    const s = createGame(1);
    expect(reduce(s, tick)).toBe(s);
    expect(run(s, { type: 'start' }).status).toBe('running');
  });

  it('moves forward one cell per tick keeping its length', () => {
    const s = running({ food: { x: 0, y: 0 } });
    const after = run(s, tick);
    expect(after.snake[0]).toEqual({ x: 11, y: 10 });
    expect(after.snake).toHaveLength(3);
    expect(after.snake.at(-1)).toEqual({ x: 9, y: 10 });
  });

  it('ignores a turn straight back into the snake', () => {
    const s = running({ food: { x: 0, y: 0 } });
    const after = run(s, turn('left'), tick);
    expect(after.snake[0]).toEqual({ x: 11, y: 10 });
  });

  it('buffers two quick turns so up-then-left works from right', () => {
    const s = running({ food: { x: 0, y: 0 } });
    const after = run(s, turn('up'), turn('left'), tick, tick);
    expect(after.snake[0]).toEqual({ x: 9, y: 9 });
    expect(after.dir).toBe('left');
  });

  it('buffers at most two turns', () => {
    const s = running({ food: { x: 0, y: 0 } });
    const after = run(s, turn('up'), turn('left'), turn('down'));
    expect(after.queued).toEqual(['up', 'left']);
  });

  it('eats food, grows by one and scores', () => {
    const s = running({ food: { x: 11, y: 10 } });
    const after = run(s, tick);
    expect(after.snake).toHaveLength(4);
    expect(after.score).toBe(1);
    expect(after.status).toBe('running');
    expect(after.food).not.toEqual({ x: 11, y: 10 });
  });

  it('ends the game on hitting a wall', () => {
    const s = running({ snake: line({ x: 19, y: 5 }, -1, 0, 3), food: { x: 0, y: 0 } });
    expect(run(s, tick).status).toBe('over');
  });

  it('ends the game on hitting itself', () => {
    const snake: Point[] = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
    ];
    const s = running({ snake, dir: 'right', food: { x: 0, y: 0 } });
    expect(run(s, turn('up'), tick).status).toBe('over');
  });

  it('lets the head move into the cell the tail vacates', () => {
    const snake: Point[] = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ];
    const s = running({ snake, dir: 'up', food: { x: 0, y: 0 } });
    const after = run(s, turn('right'), tick);
    expect(after.status).toBe('running');
    expect(after.snake[0]).toEqual({ x: 6, y: 5 });
  });

  it('blocks ticks while paused and resumes afterwards', () => {
    const s = running({ food: { x: 0, y: 0 } });
    const paused = run(s, { type: 'toggle-pause' });
    expect(paused.status).toBe('paused');
    expect(run(paused, tick, turn('up')).snake).toEqual(paused.snake);
    expect(run(paused, { type: 'toggle-pause' }).status).toBe('running');
  });

  it('restart resets score, snake and status after game over', () => {
    const dead = running({ snake: line({ x: 19, y: 5 }, -1, 0, 3), score: 7 });
    const over = run(dead, tick);
    const fresh = run(over, { type: 'restart' });
    expect(fresh.status).toBe('ready');
    expect(fresh.score).toBe(0);
    expect(fresh.snake).toEqual(createGame(1).snake);
  });

  it('never spawns food on the snake', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = createGame(seed);
      expect(s.snake.some((p) => p.x === s.food.x && p.y === s.food.y)).toBe(false);
      const eaten = run({ ...s, status: 'running', food: { x: 11, y: 10 } }, tick);
      expect(eaten.snake.some((p) => p.x === eaten.food.x && p.y === eaten.food.y)).toBe(false);
    }
  });

  it('places food deterministically from the seed', () => {
    expect(createGame(7).food).toEqual(createGame(7).food);
  });

  it('wins when the board fills up', () => {
    const s = running({
      cols: 2,
      rows: 2,
      snake: [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      dir: 'right',
      food: { x: 1, y: 1 },
    });
    const after = run(s, tick);
    expect(after.snake).toHaveLength(4);
    expect(after.status).toBe('over');
  });

  it('speeds up with score but never below the floor', () => {
    expect(tickMs(0)).toBe(140);
    expect(tickMs(5)).toBeLessThan(tickMs(0));
    expect(tickMs(1000)).toBe(60);
  });
});
