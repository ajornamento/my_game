import { resourceManager } from './ResourceManager.js';

/**
 * GameManager — single point of control for all registered games.
 * Handles game switching, lifecycle orchestration, and RAF management.
 */
export class GameManager {
  constructor() {
    this._registry = new Map();   // id → GameClass
    this._current = null;         // active BaseGame instance
    this._canvas = null;
    this._uiCallbacks = {
      scoreUpdate: [],
      stateChange: [],
      gameOver: [],
      gameSwitched: [],
    };
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement} canvas  shared canvas for all games
   */
  setCanvas(canvas) {
    this._canvas = canvas;
  }

  /**
   * Register a game class under a unique id.
   * @param {string} id
   * @param {typeof import('./BaseGame').BaseGame} GameClass
   */
  register(id, GameClass) {
    this._registry.set(id, GameClass);
  }

  // ─── Game switching ───────────────────────────────────────────────────────

  /**
   * Destroy the current game (if any) and initialise a new one.
   * @param {string} gameId
   * @param {object} [options]  forwarded to game.init()
   */
  switchTo(gameId, options = {}) {
    if (!this._registry.has(gameId)) {
      throw new Error(`GameManager: unknown game id "${gameId}"`);
    }

    this._destroyCurrent();

    const GameClass = this._registry.get(gameId);
    const game = new GameClass();

    game
      .on('scoreUpdate', score => this._emit('scoreUpdate', { gameId, score }))
      .on('stateChange', state => this._emit('stateChange', { gameId, state }))
      .on('gameOver', data => {
        resourceManager.saveHighScore(gameId, data.score);
        this._emit('gameOver', { gameId, ...data });
      });

    game.init(this._canvas, options);
    this._current = game;
    resourceManager.saveLastGame(gameId);
    this._emit('gameSwitched', { gameId, game });
  }

  // ─── Passthrough controls ─────────────────────────────────────────────────

  start()  { this._current?.start(); }
  pause()  { this._current?.pause(); }
  stop()   { this._current?.stop(); }

  getCurrentGame() { return this._current; }
  getCurrentState() { return this._current?.state ?? 'idle'; }
  getCurrentScore() { return this._current?.getScore() ?? 0; }
  getHighScore(gameId) { return resourceManager.getHighScore(gameId); }

  // ─── UI event bus ─────────────────────────────────────────────────────────

  on(event, cb) {
    if (this._uiCallbacks[event]) this._uiCallbacks[event].push(cb);
    return this;
  }

  off(event, cb) {
    if (this._uiCallbacks[event]) {
      this._uiCallbacks[event] = this._uiCallbacks[event].filter(f => f !== cb);
    }
    return this;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _destroyCurrent() {
    if (this._current) {
      this._current.stop();
      this._current.destroy();
      this._current = null;
    }
  }

  _emit(event, data) {
    (this._uiCallbacks[event] || []).forEach(cb => cb(data));
  }
}

export const gameManager = new GameManager();
