import { BaseGame }    from '../../core/BaseGame.js';
import { soundEngine } from '../../core/SoundEngine.js';

// ── Difficulty configs ────────────────────────────────────────────────────────
const DIFFS = {
  easy:   { cols:  9, rows:  9, mines:  10, cell: 36 },
  medium: { cols: 16, rows: 16, mines:  40, cell: 24 },
  hard:   { cols: 30, rows: 16, mines:  99, cell: 20 },
};
const SIDE = 120;

// ── Number colours (index = neighbour count) ─────────────────────────────────
const NUM_CLR = [
  '', '#4ade80', '#60a5fa', '#f87171',
  '#a78bfa', '#fb923c', '#2dd4bf', '#e879f9', '#94a3b8',
];

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a1628',
  side:     '#0d1b2a',
  hidden:   '#1e3a5f',
  hiddenHi: '#264e82',
  revealed: '#0d1b2a',
  mine:     '#f38ba8',
  red:      '#f87171',
  text:     '#e2e2f0',
  muted:    '#8888aa',
  gold:     '#f0c040',
  green:    '#4ade80',
  bar:      '#1e3a5f',
};

// ── Minesweeper ───────────────────────────────────────────────────────────────
export class Minesweeper extends BaseGame {
  constructor() { super('minesweeper'); }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  _onInit() {
    this._diff         = 'easy';
    this._flagMode     = false;
    this._cells        = null;
    this._minesPlaced  = false;
    this._startTime    = null;
    this._elapsed      = 0;
    this._revealedCount = 0;
    this._flagCount    = 0;
    this._won          = false;
    this._lost         = false;
    this._lostMine     = null;
    this._nextDiff     = null;
    // Touch state — reset each press
    this._touchStartX      = 0;
    this._touchStartY      = 0;
    this._touchMoved       = false;
    this._fingerDown       = false;
    this._longPressDidFire = false;
    this._longPressTimer   = null;

    this._setCanvasSize('easy');
    this._renderIdle();

    // Desktop: click + right-click
    this._addListener(this._canvas, 'click',        e => this._onClick(e));
    this._addListener(this._canvas, 'contextmenu',  e => this._onRightClick(e));
    this._addListener(window,       'keydown',       e => this._onKey(e));
    this._addListener(this._canvas, 'virtual-input', e => this._onVirtual(e));
    // Mobile: handle all interaction in touch events (passive:false so we can preventDefault)
    this._addListener(this._canvas, 'touchstart',
      e => this._onTouchStart(e), { passive: false });
    this._addListener(this._canvas, 'touchend',
      e => this._onTouchEnd(e),   { passive: false });
    this._addListener(this._canvas, 'touchmove',
      e => this._onTouchMove(e),  { passive: false });
  }

  _onStart() {
    this._initBoard();
    this._minesPlaced  = false;
    this._startTime    = null;
    this._elapsed      = 0;
    this._revealedCount = 0;
    this._flagCount    = 0;
    this._won          = false;
    this._lost         = false;
    this._lostMine     = null;
    soundEngine.resume();
  }

  _onPause() {
    if (this._startTime !== null) {
      this._elapsed  = Math.floor((performance.now() - this._startTime) / 1000);
      this._startTime = null;
    }
  }

  _onResume() {
    if (this._minesPlaced) {
      this._startTime = performance.now() - this._elapsed * 1000;
    }
  }

  _onStop() {
    if (this._nextDiff) {
      this._diff     = this._nextDiff;
      this._nextDiff = null;
    }
    this._won   = false;
    this._lost  = false;
    this._cells = null;
    this._lostMine    = null;
    this._startTime   = null;
    this._elapsed     = 0;
    this._revealedCount = 0;
    this._flagCount   = 0;
    this._setCanvasSize(this._diff);
    this._renderIdle();
  }

  _onDestroy() {
    clearTimeout(this._longPressTimer);
    this._canvas.width  = 480;
    this._canvas.height = 480;
  }

  _onUpdate() {
    if (this._startTime !== null && !this._won && !this._lost) {
      this._elapsed = Math.floor((performance.now() - this._startTime) / 1000);
    }
  }

  _onRender(ctx) {
    this._drawBoard(ctx);
    this._drawSide(ctx);
    if (this._won || this._lost) this._drawEndOverlay(ctx);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  _cellAt(clientX, clientY) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    const px     = (clientX - rect.left) * scaleX;
    const py     = (clientY - rect.top)  * scaleY;
    const cfg    = DIFFS[this._diff];
    const col    = Math.floor(px / cfg.cell);
    const row    = Math.floor(py / cfg.cell);
    if (col < 0 || col >= cfg.cols || row < 0 || row >= cfg.rows) return null;
    return { col, row };
  }

  _onClick(e) {
    if (this._state === 'idle') { this._handleIdleClick(e); return; }
    if (this._state !== 'running' || this._won || this._lost) return;
    const cell = this._cellAt(e.clientX, e.clientY);
    if (!cell) return;
    if (this._flagMode) this._toggleFlag(cell.col, cell.row);
    else                this._revealCell(cell.col, cell.row);
  }

  _onRightClick(e) {
    e.preventDefault();
    if (this._state !== 'running' || this._won || this._lost) return;
    const cell = this._cellAt(e.clientX, e.clientY);
    if (cell) this._toggleFlag(cell.col, cell.row);
  }

  _onKey(e) {
    if (this._won || this._lost) {
      if (e.key === 'r' || e.key === 'R') { this.stop(); this.start(); }
      return;
    }
    if (e.key === 'p' || e.key === 'P') { this.pause(); return; }
    if (e.key === 'f' || e.key === 'F') { this._flagMode = !this._flagMode; }
  }

  _onVirtual(e) {
    if (e.detail.action === 'flag') this._flagMode = !this._flagMode;
  }

  _onTouchStart(e) {
    // Always save coords immediately — touch objects are recycled by the browser
    // and become stale inside async callbacks (setTimeout).
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this._touchStartX      = touch.clientX;
    this._touchStartY      = touch.clientY;
    this._touchMoved       = false;
    this._fingerDown       = true;
    this._longPressDidFire = false;

    // Only intercept touch when the game is actively running.
    // Idle/gameover taps fall through to the click handler normally.
    if (this._state !== 'running' || this._won || this._lost) return;

    // Suppress the synthetic click/mousedown that would otherwise fire ~300ms
    // after touchend — we handle everything ourselves in touchend / setTimeout.
    e.preventDefault();

    const sx = this._touchStartX;  // local copy, immune to recycling
    const sy = this._touchStartY;

    this._longPressTimer = setTimeout(() => {
      // Check our own _fingerDown flag, not e.touches (live/stale collection)
      if (!this._touchMoved && this._fingerDown) {
        const cell = this._cellAt(sx, sy);
        if (cell) {
          this._toggleFlag(cell.col, cell.row);
          this._longPressDidFire = true;
          if (navigator.vibrate) navigator.vibrate(40);
        }
      }
    }, 380);
  }

  _onTouchEnd() {
    this._fingerDown = false;
    clearTimeout(this._longPressTimer);

    if (this._state !== 'running' || this._won || this._lost) return;
    // Long press already handled — don't also reveal/flag on finger-up
    if (this._touchMoved || this._longPressDidFire) return;

    // Short tap: use the saved coords (touch objects are gone by now)
    const cell = this._cellAt(this._touchStartX, this._touchStartY);
    if (!cell) return;
    if (this._flagMode) this._toggleFlag(cell.col, cell.row);
    else                this._revealCell(cell.col, cell.row);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!e.touches.length) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;
    // Ignore sub-10px drift — mobile fingers are never perfectly still and
    // touchmove fires for every pixel, which would block every tap otherwise.
    if (dx * dx + dy * dy > 100) {
      this._touchMoved = true;
      clearTimeout(this._longPressTimer);
    }
  }

  // ── Idle: difficulty selection ────────────────────────────────────────────

  _diffButtons() {
    const cfg  = DIFFS[this._diff];
    const bw   = cfg.cols * cfg.cell;
    const bh   = cfg.rows * cfg.cell;
    const btnW = 180, btnH = 52, gap = 14;
    const totalH = 3 * btnH + 2 * gap;
    const startY = (bh - totalH) / 2 + 40;
    const cx = bw / 2;
    return [
      { id: 'easy',   x: cx - btnW / 2, y: startY,                 w: btnW, h: btnH },
      { id: 'medium', x: cx - btnW / 2, y: startY + btnH + gap,    w: btnW, h: btnH },
      { id: 'hard',   x: cx - btnW / 2, y: startY + (btnH+gap)*2,  w: btnW, h: btnH },
    ];
  }

  _handleIdleClick(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;

    for (const btn of this._diffButtons()) {
      if (px >= btn.x && px <= btn.x + btn.w &&
          py >= btn.y && py <= btn.y + btn.h) {
        this._diff = btn.id;
        this._setCanvasSize(btn.id);
        this._renderIdle();
        return;
      }
    }
  }

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  _setCanvasSize(diffId) {
    const cfg = DIFFS[diffId];
    this._canvas.width  = cfg.cols * cfg.cell + SIDE;
    this._canvas.height = cfg.rows * cfg.cell;
  }

  // ── Board initialisation ──────────────────────────────────────────────────

  _initBoard() {
    const cfg = DIFFS[this._diff];
    this._cells = Array.from({ length: cfg.rows }, () =>
      Array.from({ length: cfg.cols }, () =>
        ({ mine: false, adj: 0, state: 'hidden', wrongFlag: false })
      )
    );
  }

  _placeMines(safeCol, safeRow) {
    const cfg = DIFFS[this._diff];
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr, c = safeCol + dc;
        if (r >= 0 && r < cfg.rows && c >= 0 && c < cfg.cols) safe.add(`${r},${c}`);
      }

    let placed = 0;
    while (placed < cfg.mines) {
      const r = Math.floor(Math.random() * cfg.rows);
      const c = Math.floor(Math.random() * cfg.cols);
      if (!safe.has(`${r},${c}`) && !this._cells[r][c].mine) {
        this._cells[r][c].mine = true;
        placed++;
      }
    }

    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++) {
        if (this._cells[r][c].mine) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols &&
                this._cells[nr][nc].mine) n++;
          }
        this._cells[r][c].adj = n;
      }

    this._minesPlaced = true;
    this._startTime = performance.now();
  }

  // ── Game logic ────────────────────────────────────────────────────────────

  _revealCell(col, row) {
    const cell = this._cells[row][col];
    if (cell.state !== 'hidden') return;

    if (!this._minesPlaced) this._placeMines(col, row);

    if (cell.mine) {
      cell.state = 'revealed';
      soundEngine.play('mineExplosion');
      this._explode(col, row);
      return;
    }

    soundEngine.play('mineReveal');
    this._floodReveal(col, row);
    this._checkWin();
  }

  _floodReveal(col, row) {
    const cfg   = DIFFS[this._diff];
    const queue = [{ col, row }];
    while (queue.length) {
      const { col: c, row: r } = queue.shift();
      if (r < 0 || r >= cfg.rows || c < 0 || c >= cfg.cols) continue;
      const cell = this._cells[r][c];
      if (cell.state !== 'hidden') continue;
      cell.state = 'revealed';
      this._revealedCount++;
      if (cell.adj === 0) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (dr !== 0 || dc !== 0) queue.push({ col: c + dc, row: r + dr });
      }
    }
  }

  _toggleFlag(col, row) {
    const cell = this._cells[row][col];
    if (cell.state === 'hidden') {
      cell.state = 'flagged';
      this._flagCount++;
      soundEngine.play('mineFlag');
    } else if (cell.state === 'flagged') {
      cell.state = 'hidden';
      this._flagCount--;
      soundEngine.play('mineFlag');
    }
  }

  _checkWin() {
    const cfg   = DIFFS[this._diff];
    const total = cfg.cols * cfg.rows - cfg.mines;
    if (this._revealedCount < total) return;

    // Auto-flag remaining mines
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++) {
        const cell = this._cells[r][c];
        if (cell.mine && cell.state !== 'flagged') {
          cell.state = 'flagged';
          this._flagCount++;
        }
      }

    const timeBonus  = Math.max(0, 300 - this._elapsed);
    const diffBonus  = { easy: 100, medium: 300, hard: 700 }[this._diff];
    this._updateScore(diffBonus + timeBonus);

    // Save best time per difficulty
    const key  = `mgame_best_ms_${this.id}_${this._diff}`;
    const prev = parseInt(localStorage.getItem(key) ?? '999999', 10);
    if (this._elapsed < prev) localStorage.setItem(key, String(this._elapsed));

    // Advance difficulty for next game
    const order = ['easy', 'medium', 'hard'];
    const nextIdx = order.indexOf(this._diff) + 1;
    this._nextDiff = nextIdx < order.length ? order[nextIdx] : null;

    this._won = true;
    soundEngine.play('mineWin');
    this._triggerGameOver();
    this._onRender(this._ctx);
  }

  _explode(mineCol, mineRow) {
    const cfg = DIFFS[this._diff];
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++) {
        const cell = this._cells[r][c];
        if (cell.mine && cell.state !== 'flagged') cell.state = 'revealed';
        if (!cell.mine && cell.state === 'flagged') cell.wrongFlag = true;
      }
    this._lostMine = { col: mineCol, row: mineRow };
    this._lost = true;
    this._triggerGameOver();
    this._onRender(this._ctx);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _renderIdle() {
    const ctx = this._ctx;
    const cfg = DIFFS[this._diff];
    const bw  = cfg.cols * cfg.cell;
    const bh  = cfg.rows * cfg.cell;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // Faint grid
    ctx.fillStyle = C.hidden;
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++)
        ctx.fillRect(c * cfg.cell + 1, r * cfg.cell + 1, cfg.cell - 2, cfg.cell - 2);

    // Side panel background
    ctx.fillStyle = C.side;
    ctx.fillRect(bw, 0, SIDE, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bw, 0); ctx.lineTo(bw, bh); ctx.stroke();

    // Dark overlay on board
    ctx.fillStyle = 'rgba(10,22,40,0.84)';
    ctx.fillRect(0, 0, bw, bh);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 26px monospace';
    ctx.fillText('MINESWEEPER', bw / 2, bh / 2 - 115);
    ctx.fillStyle = C.muted;
    ctx.font = '12px monospace';
    ctx.fillText('Choose Difficulty', bw / 2, bh / 2 - 82);

    // Difficulty buttons
    const btnLabels = {
      easy:   { text: 'EASY',   sub: '9×9 · 10 mines',   color: '#22c55e' },
      medium: { text: 'MEDIUM', sub: '16×16 · 40 mines', color: '#3b82f6' },
      hard:   { text: 'HARD',   sub: '30×16 · 99 mines', color: '#ef4444' },
    };
    for (const btn of this._diffButtons()) {
      const lbl      = btnLabels[btn.id];
      const isActive = btn.id === this._diff;
      ctx.fillStyle  = isActive ? lbl.color : '#1a3050';
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();
      if (!isActive) {
        ctx.strokeStyle = lbl.color;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.fillStyle = isActive ? '#fff' : C.text;
      ctx.font      = 'bold 15px monospace';
      ctx.fillText(lbl.text, btn.x + btn.w / 2, btn.y + 20);
      ctx.fillStyle = isActive ? 'rgba(255,255,255,0.75)' : C.muted;
      ctx.font      = '11px monospace';
      ctx.fillText(lbl.sub,  btn.x + btn.w / 2, btn.y + 38);
    }

    ctx.textAlign = 'left';
    this._drawSide(ctx);
  }

  _drawBoard(ctx) {
    const cfg = DIFFS[this._diff];
    const bw  = cfg.cols * cfg.cell;
    const bh  = cfg.rows * cfg.cell;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, bw, bh);

    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++)
        this._drawCell(ctx, c, r, cfg);

    ctx.fillStyle = C.side;
    ctx.fillRect(bw, 0, SIDE, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bw, 0); ctx.lineTo(bw, bh); ctx.stroke();
  }

  _drawCell(ctx, c, r, cfg) {
    const cell = this._cells[r][c];
    const x = c * cfg.cell, y = r * cfg.cell;
    const s = cfg.cell;

    if (cell.state === 'hidden') {
      ctx.fillStyle = C.hidden;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = C.hiddenHi;
      ctx.fillRect(x + 1, y + 1, s - 2, 2);
      ctx.fillRect(x + 1, y + 1, 2, s - 2);
      return;
    }

    if (cell.state === 'flagged') {
      ctx.fillStyle = C.hidden;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.font = `${Math.floor(s * 0.58)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🚩', x + s / 2, y + s * 0.72);
      ctx.textAlign = 'left';
      return;
    }

    // Revealed
    ctx.fillStyle = C.revealed;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

    if (cell.mine) {
      const isOrigin = this._lostMine &&
        this._lostMine.col === c && this._lostMine.row === r;
      if (isOrigin) {
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(x, y, s, s);
      }
      ctx.font = `${Math.floor(s * 0.62)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('💣', x + s / 2, y + s * 0.72);
      ctx.textAlign = 'left';
    } else if (cell.adj > 0) {
      ctx.fillStyle = NUM_CLR[cell.adj];
      ctx.font = `bold ${Math.floor(s * 0.55)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(cell.adj, x + s / 2, y + s * 0.70);
      ctx.textAlign = 'left';
    }

    if (cell.wrongFlag) {
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);     ctx.lineTo(x + s - 4, y + s - 4);
      ctx.moveTo(x + s - 4, y + 4); ctx.lineTo(x + 4, y + s - 4);
      ctx.stroke();
    }
  }

  _drawSide(ctx) {
    const cfg = DIFFS[this._diff];
    const bw  = cfg.cols * cfg.cell;
    const px  = bw + 8;
    const w   = SIDE - 14;

    const label = (text, y) => {
      ctx.fillStyle = C.muted;
      ctx.font = '10px monospace';
      ctx.fillText(text, px, y);
    };
    const value = (text, y, color = C.text, size = 18) => {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px monospace`;
      ctx.fillText(text, px, y);
    };

    const mines     = cfg.mines;
    const remaining = mines - this._flagCount;
    const diffClr   = { easy: '#22c55e', medium: '#3b82f6', hard: '#ef4444' };

    label('MINES',   24); value(remaining,            44, remaining > 0 ? C.red : C.green);
    label('TIME',    68); value(this._fmt(this._elapsed), 88, C.gold);
    label('DIFF',   112); value(this._diff.toUpperCase(), 130, diffClr[this._diff], 13);

    const safeCells = cfg.cols * cfg.rows - mines;
    const pct       = safeCells > 0 ? this._revealedCount / safeCells : 0;
    label('PROGRESS', 156);
    ctx.fillStyle = C.bar;   ctx.fillRect(px, 162, w, 6);
    ctx.fillStyle = C.green; ctx.fillRect(px, 162, w * Math.min(pct, 1), 6);

    if (this._flagMode) {
      ctx.fillStyle = C.red;
      ctx.font      = 'bold 10px monospace';
      ctx.fillText('FLAG MODE', px, 192);
    }

    const bestKey  = `mgame_best_ms_${this.id}_${this._diff}`;
    const bestTime = localStorage.getItem(bestKey);
    if (bestTime) {
      label('BEST',    210);
      value(this._fmt(parseInt(bestTime, 10)), 228, C.gold, 13);
    }
  }

  _fmt(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  _drawEndOverlay(ctx) {
    const cfg = DIFFS[this._diff];
    const bw  = cfg.cols * cfg.cell;
    const bh  = cfg.rows * cfg.cell;

    ctx.fillStyle = 'rgba(0,0,0,0.74)';
    ctx.fillRect(0, 0, bw, bh);

    ctx.textAlign = 'center';
    if (this._won) {
      ctx.fillStyle = C.green;
      ctx.font = 'bold 30px monospace';
      ctx.fillText('YOU WIN! 🎉', bw / 2, bh / 2 - 52);
      ctx.fillStyle = C.gold;
      ctx.font = '17px monospace';
      ctx.fillText(`Time: ${this._fmt(this._elapsed)}`, bw / 2, bh / 2 - 18);
      ctx.fillStyle = C.text;
      ctx.font = '14px monospace';
      ctx.fillText(`Score: ${this._score}`, bw / 2, bh / 2 + 10);

      if (this._nextDiff) {
        const nextClr = { medium: '#3b82f6', hard: '#ef4444' }[this._nextDiff];
        ctx.fillStyle = nextClr;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`▲ Next: ${this._nextDiff.toUpperCase()}`, bw / 2, bh / 2 + 34);
      } else {
        ctx.fillStyle = C.gold;
        ctx.font = 'bold 13px monospace';
        ctx.fillText('★ HARD CLEARED! CHAMPION! ★', bw / 2, bh / 2 + 34);
      }
    } else {
      ctx.fillStyle = C.red;
      ctx.font = 'bold 30px monospace';
      ctx.fillText('GAME OVER 💣', bw / 2, bh / 2 - 44);
      ctx.fillStyle = C.muted;
      ctx.font = '14px monospace';
      ctx.fillText(`Time: ${this._fmt(this._elapsed)}`, bw / 2, bh / 2 - 8);
    }
    ctx.fillStyle = C.muted;
    ctx.font = '13px monospace';
    ctx.fillText('Press R to restart', bw / 2, bh / 2 + 52);
    ctx.textAlign = 'left';
  }
}
