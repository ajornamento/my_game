import { BaseGame }    from '../../core/BaseGame.js';
import { soundEngine } from '../../core/SoundEngine.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS          = 20;
const ROWS          = 20;
const CELL          = 20;
const BOARD_W       = COLS * CELL;
const BOARD_H       = ROWS * CELL;
const SIDE          = 110;
const CANVAS_W      = BOARD_W + SIDE;
const CANVAS_H      = BOARD_H;

const BASE_INTERVAL = 160;  // ms per move (level 1)
const MIN_INTERVAL  = 55;   // ms per move (max speed)
const FOOD_PER_LVL  = 5;    // foods eaten before level up
const SCORE_BASE    = 10;   // points per food at level 1
const OBS_EVERY     = 5;    // spawn 1 obstacle every N foods

// ── Direction vectors ─────────────────────────────────────────────────────────
const UP    = { x: 0,  y: -1 };
const DOWN  = { x: 0,  y:  1 };
const LEFT  = { x: -1, y:  0 };
const RIGHT = { x: 1,  y:  0 };

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0d1b2a',
  grid:    'rgba(255,255,255,0.03)',
  side:    '#111827',
  head:    '#4ade80',
  bodyHi:  '#22c55e',
  bodyLo:  '#15803d',
  eye:     '#0d1b2a',
  food:    '#f87171',
  foodGlo: 'rgba(248,113,113,0.4)',
  obs:     '#475569',
  obsHi:   'rgba(255,255,255,0.12)',
  text:    '#e2e2f0',
  muted:   '#8888aa',
  gold:    '#f0c040',
  green:   '#4ade80',
  bar:     '#252540',
};

// ── Snake game ────────────────────────────────────────────────────────────────
export class Snake extends BaseGame {
  constructor() { super('snake'); }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  _onInit() {
    this._canvas.width  = CANVAS_W;
    this._canvas.height = CANVAS_H;
    this._reset();
    this._addListener(window, 'keydown',         e => this._onKey(e));
    this._addListener(this._canvas, 'virtual-input', e => this._onVirtual(e));
    this._renderIdle();
  }

  _onStart() {
    this._lastTs = null;
    soundEngine.resume();
    soundEngine.startBgm('snake');
  }

  _onPause()  { soundEngine.stopBgm(); }
  _onResume() { this._lastTs = null; soundEngine.startBgm('snake'); }

  _onStop() {
    soundEngine.stopBgm();
    this._reset();
    this._renderIdle();
  }

  _onDestroy() {
    soundEngine.stopBgm();
    this._canvas.width  = 480;
    this._canvas.height = 480;
  }

  // ── State reset ─────────────────────────────────────────────────────────────

  _reset() {
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    this._body      = [{ x: cx, y: cy }, { x: cx-1, y: cy }, { x: cx-2, y: cy }];
    this._dir       = RIGHT;
    this._dirQueue  = [];   // buffered input (max 2)
    this._foods     = [];
    this._obstacles = [];
    this._eaten     = 0;    // total foods eaten
    this._interval  = BASE_INTERVAL;
    this._moveAcc   = 0;
    this._lastTs    = null;
    this._pulse     = 0;    // food pulse animation
    this._spawnFood();
  }

  // ── Game loop ───────────────────────────────────────────────────────────────

  _onUpdate(ts) {
    if (this._lastTs === null) { this._lastTs = ts; return; }
    const dt = ts - this._lastTs;
    this._lastTs = ts;
    this._pulse += dt * 0.004;
    this._moveAcc += dt;
    if (this._moveAcc >= this._interval) {
      this._moveAcc -= this._interval;
      this._tick();
    }
  }

  _onRender(ctx) {
    this._drawBg(ctx);
    this._drawObstacles(ctx);
    this._drawFood(ctx);
    this._drawSnake(ctx);
    this._drawSide(ctx);
    if (this._state === 'gameover') this._drawGameOver(ctx);
  }

  _renderIdle() {
    this._drawBg(this._ctx);
    this._drawFood(this._ctx);
    this._drawSnake(this._ctx);
    this._drawSide(this._ctx);
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  _onKey(e) {
    if (this._state === 'gameover') {
      if (e.key === 'r' || e.key === 'R') { this.stop(); this.start(); }
      return;
    }
    if (e.key === 'p' || e.key === 'P') { this.pause(); return; }
    if (this._state !== 'running') return;
    const map = {
      ArrowUp: UP, w: UP, W: UP,
      ArrowDown: DOWN, s: DOWN, S: DOWN,
      ArrowLeft: LEFT, a: LEFT, A: LEFT,
      ArrowRight: RIGHT, d: RIGHT, D: RIGHT,
    };
    const d = map[e.key];
    if (d) { e.preventDefault(); this._enqueue(d); }
  }

  _onVirtual(e) {
    if (this._state !== 'running') return;
    const map = { ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT };
    const d = map[e.detail.action];
    if (d) this._enqueue(d);
  }

  _enqueue(d) {
    const last = this._dirQueue.at(-1) ?? this._dir;
    if (d.x === -last.x && d.y === -last.y) return;  // 180° reversal blocked
    if (this._dirQueue.length < 2) this._dirQueue.push(d);
  }

  // ── Tick logic ──────────────────────────────────────────────────────────────

  _tick() {
    if (this._dirQueue.length) this._dir = this._dirQueue.shift();

    const head = this._body[0];
    const nx = head.x + this._dir.x;
    const ny = head.y + this._dir.y;

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { this._die(); return; }
    // Obstacle collision
    if (this._obstacles.some(o => o.x === nx && o.y === ny)) { this._die(); return; }
    // Self collision (tail excluded — it will move away)
    if (this._body.slice(0, -1).some(s => s.x === nx && s.y === ny)) { this._die(); return; }

    const foodIdx = this._foods.findIndex(f => f.x === nx && f.y === ny);
    this._body.unshift({ x: nx, y: ny });

    if (foodIdx !== -1) {
      this._foods.splice(foodIdx, 1);
      this._eaten++;
      const lvl = this._level();
      this._updateScore(SCORE_BASE * lvl);
      this._interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - this._eaten * 5);
      soundEngine.play('snakeEat');
      this._spawnFood();
      if (this._eaten % OBS_EVERY === 0) this._spawnObstacle();
    } else {
      this._body.pop();
    }
  }

  _die() {
    soundEngine.play('snakeDie');
    soundEngine.stopBgm();
    this._triggerGameOver();
  }

  _level() { return Math.floor(this._eaten / FOOD_PER_LVL) + 1; }

  // ── Board helpers ────────────────────────────────────────────────────────────

  _occupied() {
    const s = new Set();
    for (const c of this._body)      s.add(`${c.x},${c.y}`);
    for (const c of this._foods)     s.add(`${c.x},${c.y}`);
    for (const c of this._obstacles) s.add(`${c.x},${c.y}`);
    return s;
  }

  _emptyCells() {
    const occ = this._occupied();
    const out = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!occ.has(`${x},${y}`)) out.push({ x, y });
    return out;
  }

  _spawnFood() {
    const cells = this._emptyCells();
    if (!cells.length) return;
    const c = cells[Math.floor(Math.random() * cells.length)];
    this._foods.push({ x: c.x, y: c.y });
  }

  _spawnObstacle() {
    const head = this._body[0];
    // Prefer cells far from the snake head
    const cells = this._emptyCells()
      .filter(c => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) > 4);
    if (!cells.length) return;
    const c = cells[Math.floor(Math.random() * cells.length)];
    this._obstacles.push({ x: c.x, y: c.y });
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  _drawBg(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    // Grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, BOARD_H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(BOARD_W, y * CELL); ctx.stroke();
    }
    // Side panel
    ctx.fillStyle = C.side;
    ctx.fillRect(BOARD_W, 0, SIDE, CANVAS_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BOARD_W, 0); ctx.lineTo(BOARD_W, CANVAS_H); ctx.stroke();
  }

  _drawObstacles(ctx) {
    for (const o of this._obstacles) {
      const x = o.x * CELL, y = o.y * CELL;
      ctx.fillStyle = C.obs;
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = C.obsHi;
      ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
      ctx.fillRect(x + 1, y + 1, 3, CELL - 2);
    }
  }

  _drawFood(ctx) {
    const glow = (Math.sin(this._pulse) + 1) / 2;  // 0→1
    for (const f of this._foods) {
      const cx = f.x * CELL + CELL / 2;
      const cy = f.y * CELL + CELL / 2;
      const r  = CELL / 2 - 2;
      // Outer glow
      ctx.globalAlpha = glow * 0.45;
      ctx.fillStyle   = C.foodGlo;
      ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill();
      // Body
      ctx.globalAlpha = 1;
      ctx.fillStyle   = C.food;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(cx - 2, cy - 2, r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawSnake(ctx) {
    const len = this._body.length;
    for (let i = len - 1; i >= 0; i--) {
      const { x, y } = this._body[i];
      const px = x * CELL, py = y * CELL;

      if (i === 0) {
        // Head
        ctx.fillStyle = C.head;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        // Eyes — position depends on direction
        this._drawEyes(ctx, px, py);
      } else {
        // Body gradient: brighter near head, darker near tail
        const t = i / len;
        const g = Math.round(200 - t * 100);
        ctx.fillStyle = `rgb(22,${g},60)`;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        // Connecting highlight between segments
        ctx.fillStyle = 'rgba(74,222,128,0.12)';
        ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
      }
    }
  }

  _drawEyes(ctx, px, py) {
    ctx.fillStyle = C.eye;
    const d = this._dir;
    // Each eye: 3×3 px
    let e1, e2;
    if      (d === RIGHT) { e1 = [14, 4];  e2 = [14, 12]; }
    else if (d === LEFT)  { e1 = [3,  4];  e2 = [3,  12]; }
    else if (d === UP)    { e1 = [4,  3];  e2 = [12,  3]; }
    else                  { e1 = [4,  14]; e2 = [12, 14]; }
    ctx.fillRect(px + e1[0], py + e1[1], 3, 3);
    ctx.fillRect(px + e2[0], py + e2[1], 3, 3);
  }

  _drawSide(ctx) {
    const px  = BOARD_W + 8;
    const lvl = this._level();
    const speedPct = 1 - (this._interval - MIN_INTERVAL) / (BASE_INTERVAL - MIN_INTERVAL);

    const label = (text, y) => {
      ctx.fillStyle = C.muted; ctx.font = '11px monospace'; ctx.fillText(text, px, y);
    };
    const value = (text, y, color = C.text, size = 18) => {
      ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.fillText(text, px, y);
    };

    label('SCORE', 28);  value(this._score.toLocaleString(), 48);
    label('BEST',  72);  value(this.getHighScore().toLocaleString(), 92, C.gold);
    label('LEVEL', 118); value(lvl, 146, C.green, 28);
    label('LENGTH',178); value(this._body.length, 202, C.green, 22);
    label('FOOD',  230); value(this._eaten, 254, C.food, 22);

    // Speed bar
    label('SPEED', 280);
    const bw = SIDE - 20;
    ctx.fillStyle = C.bar;  ctx.fillRect(px, 285, bw, 7);
    ctx.fillStyle = C.green; ctx.fillRect(px, 285, bw * Math.min(speedPct, 1), 7);

    // Obstacles
    if (this._obstacles.length) {
      label('WALLS', 310);
      value(this._obstacles.length, 332, C.obs, 18);
    }
  }

  _drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('GAME OVER', BOARD_W / 2, BOARD_H / 2 - 40);
    ctx.fillStyle = C.text;
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, BOARD_W / 2, BOARD_H / 2);
    ctx.fillStyle = C.gold;
    ctx.font = '14px monospace';
    ctx.fillText(`Best: ${this.getHighScore()}`, BOARD_W / 2, BOARD_H / 2 + 28);
    ctx.fillStyle = C.muted;
    ctx.font = '13px monospace';
    ctx.fillText('Press R to restart', BOARD_W / 2, BOARD_H / 2 + 60);
    ctx.textAlign = 'left';
  }
}
