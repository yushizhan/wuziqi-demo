export type Point = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
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
};

export type Action =
  | { type: 'tick' }
  | { type: 'turn'; dir: Direction }
  | { type: 'toggle-pause' }
  | { type: 'start' }
  | { type: 'restart' };

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

export function createGame(seed: number, cols = COLS, rows = ROWS): GameState {
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
  const target = { x: head.x + d.x, y: head.y + d.y };

  const hitsWall =
    target.x < 0 || target.y < 0 || target.x >= state.cols || target.y >= state.rows;
  const eats = target.x === state.food.x && target.y === state.food.y;
  // The tail cell is free this tick unless the snake grows into it.
  const body = eats ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = body.some((p) => p.x === target.x && p.y === target.y);

  if (hitsWall || hitsSelf) {
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

const restart: Handler = (state) => createGame(state.seed, state.cols, state.rows);

const transitions: Record<Status, Partial<Record<Action['type'], Handler>>> = {
  ready: {
    start: (s) => ({ ...s, status: 'running' }),
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
    restart,
  },
  over: {
    restart,
  },
};

export function reduce(state: GameState, action: Action): GameState {
  const handler = transitions[state.status][action.type];
  return handler ? handler(state, action) : state;
}
