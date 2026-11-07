export type Point = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Walls = 'solid' | 'wrap';
export type Status = 'ready' | 'running' | 'paused' | 'over';

export type GameState = {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Point[];
  dir: Direction;
  /** Turns waiting for upcoming ticks, at most MAX_QUEUED. */
  queued: Direction[];
  food: Point;
  score: number;
  status: Status;
  seed: number;
  walls: Walls;
};

export type Action =
  | { type: 'tick' }
  | { type: 'turn'; dir: Direction }
  | { type: 'toggle-pause' }
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'set-walls'; walls: Walls };

const MAX_QUEUED = 2;
const COLS = 20;
const ROWS = 20;

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const STEP_INTO: Record<Walls, (p: Point, cols: number, rows: number) => Point | 'wall'> = {
  solid: (p, cols, rows) => (p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows ? 'wall' : p),
  wrap: (p, cols, rows) => ({ x: (p.x + cols) % cols, y: (p.y + rows) % rows }),
};

export function tickMs(score: number): number {
  return Math.max(60, 140 - score * 4);
}

// mulberry32, split so the caller keeps the seed in state and stays pure.
function nextRandom(seed: number): [value: number, seed: number] {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

function placeFood(
  snake: Point[],
  cols: number,
  rows: number,
  seed: number,
): [food: Point | null, seed: number] {
  const taken = new Set(snake.map((p) => p.y * cols + p.x));
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!taken.has(y * cols + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return [null, seed];
  const [r, next] = nextRandom(seed);
  return [free[Math.floor(r * free.length)]!, next];
}

export function createGame(seed: number, walls: Walls = 'solid', cols = COLS, rows = ROWS): GameState {
  const cy = Math.floor(rows / 2);
  const cx = Math.floor(cols / 2);
  const snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const [food, nextSeed] = placeFood(snake, cols, rows, seed);
  return {
    cols,
    rows,
    snake,
    dir: 'right',
    queued: [],
    food: food!,
    score: 0,
    status: 'ready',
    seed: nextSeed,
    walls,
  };
}

export function isWon(state: GameState): boolean {
  return state.snake.length === state.cols * state.rows;
}

function tick(state: GameState): GameState {
  const [next, ...rest] = state.queued;
  const dir = next ?? state.dir;
  const d = DELTA[dir];
  const head = state.snake[0]!;
  const target = STEP_INTO[state.walls](
    { x: head.x + d.x, y: head.y + d.y },
    state.cols,
    state.rows,
  );
  if (target === 'wall') return { ...state, dir, queued: rest, status: 'over' };

  const eats = target.x === state.food.x && target.y === state.food.y;
  // The tail cell is free this tick unless the snake grows into it.
  const body = eats ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = body.some((p) => p.x === target.x && p.y === target.y);

  if (hitsSelf) {
    return { ...state, dir, queued: rest, status: 'over' };
  }

  const snake = [target, ...body];
  if (!eats) return { ...state, snake, dir, queued: rest };

  const [food, seed] = placeFood(snake, state.cols, state.rows, state.seed);
  return {
    ...state,
    snake,
    dir,
    queued: rest,
    score: state.score + 1,
    // On a full board there is no free cell; the game is won, so food is never drawn.
    food: food ?? state.food,
    seed,
    status: food ? 'running' : 'over',
  };
}

function turn(state: GameState, dir: Direction): GameState {
  if (state.queued.length >= MAX_QUEUED) return state;
  const effective = state.queued.at(-1) ?? state.dir;
  if (dir === effective || dir === OPPOSITE[effective]) return state;
  return { ...state, queued: [...state.queued, dir] };
}

type Handler = (state: GameState, action: Action) => GameState;

const restart: Handler = (state) => createGame(state.seed, state.walls, state.cols, state.rows);

const restartWithWalls: Handler = (s, a) =>
  createGame(s.seed, (a as Extract<Action, { type: 'set-walls' }>).walls, s.cols, s.rows);

const transitions: Record<Status, Partial<Record<Action['type'], Handler>>> = {
  ready: {
    start: (s) => ({ ...s, status: 'running' }),
    'set-walls': restartWithWalls,
    restart,
  },
  running: {
    tick,
    turn: (s, a) => turn(s, (a as Extract<Action, { type: 'turn' }>).dir),
    'toggle-pause': (s) => ({ ...s, status: 'paused' }),
    restart,
  },
  paused: {
    'toggle-pause': (s) => ({ ...s, status: 'running' }),
    'set-walls': restartWithWalls,
    restart,
  },
  over: {
    'set-walls': restartWithWalls,
    restart,
  },
};

export function reduce(state: GameState, action: Action): GameState {
  const handler = transitions[state.status][action.type];
  return handler ? handler(state, action) : state;
}
