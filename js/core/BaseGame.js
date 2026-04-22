/**
 * BaseGame — abstract base class all games must extend.
 * Provides the common interface consumed by GameManager.
 */
export class BaseGame {
  /** @param {string} id  unique key used for localStorage, e.g. 'tetris' */
  constructor(id) {
    if (new.target === BaseGame) throw new Error('BaseGame is abstract');
    this.id = id;
    this._state = 'idle'; // idle | running | paused | gameover
    this._score = 0;
    this._canvas = null;
    this._ctx = null;
    this._rafId = null;
    this._boundListeners = [];
    this._callbacks = { scoreUpdate: [], gameOver: [], stateChange: [] };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Attach to a canvas element and prepare internal state.
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   */
  init(canvas, options = {}) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._options = options;
    this._score = 0;
    this._state = 'idle';
    this._onInit(options);
  }

  start() {
    if (this._state === 'running') return;
    this._state = 'running';
    this._emit('stateChange', this._state);
    this._onStart();
    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  pause() {
    if (this._state === 'running') {
      this._state = 'paused';
      this._stopLoop();
      this._emit('stateChange', this._state);
      this._onPause();
    } else if (this._state === 'paused') {
      this._state = 'running';
      this._emit('stateChange', this._state);
      this._onResume();
      this._rafId = requestAnimationFrame(ts => this._loop(ts));
    }
  }

  stop() {
    this._stopLoop();
    this._state = 'idle';
    this._emit('stateChange', this._state);
    this._onStop();
  }

  /** Release all event listeners and resources — called by GameManager on switch */
  destroy() {
    this._stopLoop();
    for (const { target, type, fn } of this._boundListeners) {
      target.removeEventListener(type, fn);
    }
    this._boundListeners = [];
    this._onDestroy();
  }

  // ─── Score / persistence ──────────────────────────────────────────────────

  getScore() { return this._score; }

  getHighScore() {
    const val = localStorage.getItem(`hs_${this.id}`);
    return val !== null ? parseInt(val, 10) : 0;
  }

  saveHighScore() {
    if (this._score > this.getHighScore()) {
      localStorage.setItem(`hs_${this.id}`, String(this._score));
    }
  }

  get state() { return this._state; }

  // ─── Event bus ────────────────────────────────────────────────────────────

  on(event, cb) {
    if (this._callbacks[event]) this._callbacks[event].push(cb);
    return this;
  }

  off(event, cb) {
    if (this._callbacks[event]) {
      this._callbacks[event] = this._callbacks[event].filter(f => f !== cb);
    }
    return this;
  }

  // ─── Protected helpers ────────────────────────────────────────────────────

  /**
   * Register an event listener that is automatically removed on destroy().
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} fn
   * @param {object} [opts]
   */
  _addListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._boundListeners.push({ target, type, fn });
  }

  _updateScore(delta) {
    this._score += delta;
    this._emit('scoreUpdate', this._score);
  }

  _triggerGameOver() {
    this.saveHighScore();
    this._stopLoop();
    this._state = 'gameover';
    this._emit('stateChange', this._state);
    this._emit('gameOver', { score: this._score, highScore: this.getHighScore() });
  }

  _loop(timestamp) {
    if (this._state !== 'running') return;
    this._onUpdate(timestamp);
    this._onRender(this._ctx);
    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _emit(event, data) {
    (this._callbacks[event] || []).forEach(cb => cb(data));
  }

  // ─── Abstract hooks (subclasses override) ────────────────────────────────

  /** Called once after init — set up board, pieces, etc. */
  _onInit(_options) {}
  /** Called when start() transitions idle→running */
  _onStart() {}
  /** Called when pause() transitions running→paused */
  _onPause() {}
  /** Called when pause() transitions paused→running */
  _onResume() {}
  /** Called when stop() is invoked */
  _onStop() {}
  /** Called by destroy() after listeners are removed */
  _onDestroy() {}
  /** Game logic tick — called every animation frame while running */
  _onUpdate(_timestamp) {}
  /** Render tick — called every animation frame while running */
  _onRender(_ctx) {}
}
