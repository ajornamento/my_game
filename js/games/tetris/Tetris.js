import { BaseGame } from '../../core/BaseGame.js';

// ── Constants ────────────────────────────────────────────────────────────────
const COLS        = 10;
const ROWS        = 20;
const CELL        = 28;
const SIDE        = 124;  // side panel width (next + hold)
const BOARD_W     = COLS * CELL;
const BOARD_H     = ROWS * CELL;
const CANVAS_W    = BOARD_W + SIDE;
const CANVAS_H    = BOARD_H;

// ── Piece definitions ─────────────────────────────────────────────────────────
const TYPES = ['I','O','T','S','Z','J','L'];

const COLORS = {
  I:'#00f0f0', O:'#f0f000', T:'#a000f0',
  S:'#00f000', Z:'#f00000', J:'#2020f0', L:'#f0a000',
};

// Each piece: array of 4 rotation states, each a 2-D array
const SHAPES = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  O: [
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
  ],
  T: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
  S: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
  Z: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
  J: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
  L: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
};

// SRS wall-kick offsets to try after base rotation (dx, dy — y↓positive)
const KICKS_JLSTZ = {
  '0>1':[[-1,0],[-1,-1],[0,2],[-1,2]],
  '1>0':[[1,0],[1,1],[0,-2],[1,-2]],
  '1>2':[[1,0],[1,1],[0,-2],[1,-2]],
  '2>1':[[-1,0],[-1,-1],[0,2],[-1,2]],
  '2>3':[[1,0],[1,-1],[0,2],[1,2]],
  '3>2':[[-1,0],[-1,1],[0,-2],[-1,-2]],
  '3>0':[[-1,0],[-1,1],[0,-2],[-1,-2]],
  '0>3':[[1,0],[1,-1],[0,2],[1,2]],
};
const KICKS_I = {
  '0>1':[[-2,0],[1,0],[-2,1],[1,-2]],
  '1>0':[[2,0],[-1,0],[2,-1],[-1,2]],
  '1>2':[[-1,0],[2,0],[-1,-2],[2,1]],
  '2>1':[[1,0],[-2,0],[1,2],[-2,-1]],
  '2>3':[[2,0],[-1,0],[2,-1],[-1,2]],
  '3>2':[[-2,0],[1,0],[-2,1],[1,-2]],
  '3>0':[[1,0],[-2,0],[1,2],[-2,-1]],
  '0>3':[[-1,0],[2,0],[-1,-2],[2,1]],
};

// Drop speed ms per row by level
const DROP_MS = [800,717,633,550,467,383,300,217,133,100,83,83,83,83,83,67];

// Scoring: lines cleared → base points
const LINE_PTS = [0, 100, 300, 500, 800];

// ── Helper ────────────────────────────────────────────────────────────────────
function cloneBoard(b) { return b.map(r => [...r]); }

function createBag() {
  const bag = [...TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// ── Main class ────────────────────────────────────────────────────────────────
export class Tetris extends BaseGame {
  constructor() { super('tetris'); }

  // ── Init ──────────────────────────────────────────────────────────────────

  _onInit() {
    this._canvas.width  = CANVAS_W;
    this._canvas.height = CANVAS_H;

    this._board    = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this._bag      = createBag();
    this._nextBag  = createBag();
    this._next     = [];
    this._held     = null;
    this._canHold  = true;
    this._level    = 1;
    this._lines    = 0;
    this._dropAcc  = 0;
    this._lastTs   = null;
    this._undoState = null;  // { board, piece } for undo

    // Fill next queue with 3 pieces
    for (let i = 0; i < 3; i++) this._next.push(this._drawBag());
    this._current = this._spawnPiece(this._drawBag());

    this._bindKeys();
    this._renderIdle();
  }

  _onStart() {
    this._lastTs = null;
  }

  _onPause() {
    this._drawPauseOverlay();
  }

  _onResume() {
    this._lastTs = null;
  }

  _onStop() {
    this._board   = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this._score   = 0;
    this._level   = 1;
    this._lines   = 0;
    this._held    = null;
    this._canHold = true;
    this._bag     = createBag();
    this._nextBag = createBag();
    this._next    = [];
    for (let i = 0; i < 3; i++) this._next.push(this._drawBag());
    this._current = this._spawnPiece(this._drawBag());
    this._undoState = null;
    this._renderIdle();
  }

  _onDestroy() {
    this._canvas.width  = 480;
    this._canvas.height = 480;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  _onUpdate(ts) {
    if (this._lastTs === null) { this._lastTs = ts; return; }
    const dt = ts - this._lastTs;
    this._lastTs = ts;

    this._dropAcc += dt;
    const dropMs = DROP_MS[Math.min(this._level - 1, DROP_MS.length - 1)];
    if (this._dropAcc >= dropMs) {
      this._dropAcc -= dropMs;
      this._softDrop(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _onRender(ctx) {
    this._drawBackground(ctx);
    this._drawBoard(ctx);
    this._drawGhost(ctx);
    this._drawPiece(ctx, this._current);
    this._drawSidePanel(ctx);
    if (this._state === 'gameover') this._drawGameOverOverlay(ctx);
  }

  _renderIdle() {
    const ctx = this._ctx;
    this._drawBackground(ctx);
    this._drawBoard(ctx);
    this._drawPiece(ctx, this._current);
    this._drawSidePanel(ctx);
  }

  // ── Keyboard input ────────────────────────────────────────────────────────

  _bindKeys() {
    const handler = e => this._onKey(e);
    this._addListener(window, 'keydown', handler);

    // Virtual pad support
    const vHandler = e => this._onVirtualInput(e);
    this._addListener(this._canvas, 'virtual-input', vHandler);
  }

  _onKey(e) {
    if (this._state === 'gameover') {
      if (e.key === 'r' || e.key === 'R') { this.stop(); this.start(); }
      return;
    }
    if (e.key === 'p' || e.key === 'P') { this.pause(); return; }
    if (this._state !== 'running') return;

    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); this._move(-1); break;
      case 'ArrowRight': e.preventDefault(); this._move(1);  break;
      case 'ArrowDown':  e.preventDefault(); this._softDrop(true); break;
      case 'ArrowUp':    e.preventDefault(); this._rotate(1); break;
      case 'z': case 'Z': this._rotate(-1); break;
      case 'x': case 'X': this._rotate(1);  break;
      case ' ':          e.preventDefault(); this._hardDrop(); break;
      case 'c': case 'C': this._holdPiece(); break;
      case 'u': case 'U': this._undo(); break;
      case 'r': case 'R': this.stop(); this.start(); break;
    }
  }

  _onVirtualInput(e) {
    if (this._state !== 'running') return;
    const { action } = e.detail;
    switch (action) {
      case 'ArrowLeft':  this._move(-1);   break;
      case 'ArrowRight': this._move(1);    break;
      case 'ArrowDown':  this._softDrop(true); break;
      case 'ArrowUp':    this._rotate(1);  break;
      case ' ':          this._hardDrop(); break;
      case 'c':          this._holdPiece(); break;
    }
  }

  // ── Game actions ──────────────────────────────────────────────────────────

  _move(dx) {
    const p = { ...this._current, x: this._current.x + dx };
    if (this._valid(p)) { this._current = p; return true; }
    return false;
  }

  _rotate(dir) {
    const p     = this._current;
    const rot   = (p.rotation + dir + 4) % 4;
    const key   = `${p.rotation}>${rot}`;
    const kicks = p.type === 'I' ? KICKS_I[key] : KICKS_JLSTZ[key];
    const rotated = { ...p, rotation: rot, shape: SHAPES[p.type][rot] };

    // Try base position first
    if (this._valid(rotated)) { this._current = rotated; return; }

    // Try SRS wall kicks
    if (kicks) {
      for (const [dx, dy] of kicks) {
        const kicked = { ...rotated, x: rotated.x + dx, y: rotated.y + dy };
        if (this._valid(kicked)) { this._current = kicked; return; }
      }
    }
  }

  _softDrop(userInitiated) {
    const p = { ...this._current, y: this._current.y + 1 };
    if (this._valid(p)) {
      this._current = p;
      if (userInitiated) this._updateScore(1);
    } else {
      this._lockPiece();
    }
  }

  _hardDrop() {
    let dropped = 0;
    while (true) {
      const p = { ...this._current, y: this._current.y + 1 };
      if (!this._valid(p)) break;
      this._current = p;
      dropped++;
    }
    this._updateScore(dropped * 2);
    this._lockPiece();
  }

  _holdPiece() {
    if (!this._canHold) return;
    const type = this._current.type;
    if (this._held !== null) {
      this._current = this._spawnPiece(this._held);
    } else {
      this._current = this._spawnPiece(this._next.shift());
      this._next.push(this._drawBag());
    }
    this._held    = type;
    this._canHold = false;
  }

  _undo() {
    if (!this._undoState) return;
    this._board   = cloneBoard(this._undoState.board);
    this._current = { ...this._undoState.piece };
    this._canHold = true;
    this._undoState = null;
  }

  // ── Piece mechanics ───────────────────────────────────────────────────────

  _spawnPiece(type) {
    const shape = SHAPES[type][0];
    return {
      type,
      shape,
      rotation: 0,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: type === 'I' ? -1 : 0,
    };
  }

  _drawBag() {
    if (this._bag.length === 0) this._bag = this._nextBag, this._nextBag = createBag();
    return this._bag.shift();
  }

  _valid(piece) {
    const { shape, x, y } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = x + c, ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && this._board[ny][nx]) return false;
      }
    }
    return true;
  }

  _ghostY() {
    let gy = this._current.y;
    while (this._valid({ ...this._current, y: gy + 1 })) gy++;
    return gy;
  }

  _lockPiece() {
    // Save state for undo BEFORE locking
    this._undoState = {
      board: cloneBoard(this._board),
      piece: { ...this._current },
    };

    const { shape, x, y, type } = this._current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const row = y + r;
        if (row < 0) { this._triggerGameOver(); return; }
        this._board[row][x + c] = COLORS[type];
      }
    }

    const cleared = this._clearLines();
    if (cleared > 0) {
      this._updateScore(LINE_PTS[cleared] * this._level);
      this._lines += cleared;
      this._level = Math.floor(this._lines / 10) + 1;
    }

    const nextType = this._next.shift();
    this._next.push(this._drawBag());
    this._current = this._spawnPiece(nextType);
    this._canHold = true;
    this._dropAcc = 0;

    if (!this._valid(this._current)) this._triggerGameOver();
  }

  _clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this._board[r].every(c => c !== null)) {
        this._board.splice(r, 1);
        this._board.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // recheck same row index
      }
    }
    return cleared;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _drawBackground(ctx) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, BOARD_H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(BOARD_W, r * CELL); ctx.stroke();
    }

    // Side panel bg
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(BOARD_W, 0, SIDE, CANVAS_H);
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BOARD_W, 0); ctx.lineTo(BOARD_W, CANVAS_H); ctx.stroke();
  }

  _drawBoard(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = this._board[r][c];
        if (color) this._drawCell(ctx, c, r, color, 1);
      }
    }
  }

  _drawGhost(ctx) {
    if (!this._current) return;
    const gy = this._ghostY();
    const { shape, x, type } = this._current;
    const color = COLORS[type];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) this._drawCell(ctx, x + c, gy + r, color, 0.18);
      }
    }
  }

  _drawPiece(ctx, piece) {
    if (!piece) return;
    const { shape, x, y, type } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) this._drawCell(ctx, x + c, y + r, COLORS[type], 1);
      }
    }
  }

  _drawCell(ctx, col, row, color, alpha) {
    if (row < 0) return;
    const x = col * CELL, y = row * CELL;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(x + 1, y + 1, CELL - 2, 4);
    ctx.fillRect(x + 1, y + 1, 4, CELL - 2);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x + 1, y + CELL - 5, CELL - 2, 4);
    ctx.fillRect(x + CELL - 5, y + 1, 4, CELL - 2);
    ctx.globalAlpha = 1;
  }

  _drawSidePanel(ctx) {
    const px = BOARD_W + 8;
    ctx.fillStyle = '#8888aa';
    ctx.font = '11px monospace';

    // ── HOLD ──
    ctx.fillText('HOLD', px, 20);
    this._drawMiniPiece(ctx, this._held, px, 26, this._canHold ? 1 : 0.35);

    // ── NEXT ──
    ctx.fillStyle = '#8888aa';
    ctx.fillText('NEXT', px, 130);
    for (let i = 0; i < this._next.length; i++) {
      this._drawMiniPiece(ctx, this._next[i], px, 136 + i * 90, 1);
    }

    // ── BEST / LEVEL / LINES ──
    const infoY = CANVAS_H - 130;
    ctx.font = '11px monospace';

    ctx.fillStyle = '#8888aa';
    ctx.fillText('BEST', px, infoY);
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(this.getHighScore().toLocaleString(), px, infoY + 20);

    ctx.fillStyle = '#8888aa';
    ctx.font = '11px monospace';
    ctx.fillText('LEVEL', px, infoY + 44);
    ctx.fillStyle = '#a29bfe';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(this._level, px, infoY + 66);

    ctx.fillStyle = '#8888aa';
    ctx.font = '11px monospace';
    ctx.fillText('LINES', px, infoY + 90);
    ctx.fillStyle = '#a29bfe';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(this._lines, px, infoY + 112);
  }

  _drawMiniPiece(ctx, type, px, py, alpha) {
    if (!type) {
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, SIDE - 16, 70);
      ctx.globalAlpha = 1;
      return;
    }
    const shape = SHAPES[type][0];
    const mini  = 16;
    const cols  = shape[0].length;
    const rows  = shape.length;
    const ox = px + Math.floor((SIDE - 16 - cols * mini) / 2);
    const oy = py + Math.floor((70 - rows * mini) / 2);
    const color = COLORS[type];

    ctx.globalAlpha = alpha;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!shape[r][c]) continue;
        ctx.fillStyle = color;
        ctx.fillRect(ox + c * mini + 1, oy + r * mini + 1, mini - 2, mini - 2);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(ox + c * mini + 1, oy + r * mini + 1, mini - 2, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawPauseOverlay(ctx = this._ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(0, 0, BOARD_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', BOARD_W / 2, CANVAS_H / 2 - 16);
    ctx.fillStyle = '#8888aa';
    ctx.font = '16px monospace';
    ctx.fillText('Press P to resume', BOARD_W / 2, CANVAS_H / 2 + 20);
    ctx.textAlign = 'left';
  }

  _drawGameOverOverlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(0, 0, BOARD_W, CANVAS_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f38ba8';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('GAME OVER', BOARD_W / 2, CANVAS_H / 2 - 40);
    ctx.fillStyle = '#e2e2f0';
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, BOARD_W / 2, CANVAS_H / 2 + 0);
    ctx.fillStyle = '#a29bfe';
    ctx.font = '14px monospace';
    ctx.fillText(`Best: ${this.getHighScore()}`, BOARD_W / 2, CANVAS_H / 2 + 28);
    ctx.fillStyle = '#8888aa';
    ctx.font = '13px monospace';
    ctx.fillText('Press R to restart', BOARD_W / 2, CANVAS_H / 2 + 62);
    ctx.textAlign = 'left';
  }
}
