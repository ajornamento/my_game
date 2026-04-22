/**
 * ResourceManager — centralised store for sounds, images, and settings.
 * All persistence goes through localStorage under the 'mgame_' namespace.
 */
export class ResourceManager {
  constructor() {
    this._sounds = new Map();   // id → { audio: AudioBuffer|HTMLAudioElement, gain? }
    this._images = new Map();   // id → HTMLImageElement
    this._audioCtx = null;
    this._masterGain = null;
    this._sfxEnabled = true;
    this._bgmEnabled = true;
    this._currentBgm = null;
  }

  // ─── Audio context (lazy init to respect browser autoplay policy) ─────────

  _getAudioCtx() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._audioCtx.createGain();
      this._masterGain.connect(this._audioCtx.destination);
    }
    return this._audioCtx;
  }

  // ─── Sound ────────────────────────────────────────────────────────────────

  /**
   * Register an HTML audio element under an id.
   * @param {string} id
   * @param {string} src  path relative to project root
   * @param {object} [opts]  { loop, volume }
   */
  registerSound(id, src, opts = {}) {
    const audio = new Audio(src);
    audio.loop = opts.loop ?? false;
    audio.volume = opts.volume ?? 1.0;
    this._sounds.set(id, { audio, opts });
  }

  playSound(id) {
    const entry = this._sounds.get(id);
    if (!entry) return;
    const { audio, opts } = entry;
    const isBgm = opts.loop;
    if (isBgm && !this._bgmEnabled) return;
    if (!isBgm && !this._sfxEnabled) return;

    if (isBgm) {
      if (this._currentBgm && this._currentBgm !== audio) {
        this._currentBgm.pause();
        this._currentBgm.currentTime = 0;
      }
      this._currentBgm = audio;
    }
    audio.currentTime = isBgm ? audio.currentTime : 0;
    audio.play().catch(() => {});
  }

  stopSound(id) {
    const entry = this._sounds.get(id);
    if (!entry) return;
    entry.audio.pause();
    entry.audio.currentTime = 0;
    if (this._currentBgm === entry.audio) this._currentBgm = null;
  }

  stopAllSounds() {
    for (const { audio } of this._sounds.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    this._currentBgm = null;
  }

  setSfxEnabled(v) { this._sfxEnabled = v; this._saveSettings(); }
  setBgmEnabled(v) {
    this._bgmEnabled = v;
    if (!v && this._currentBgm) { this._currentBgm.pause(); }
    this._saveSettings();
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  /** @returns {Promise<HTMLImageElement>} */
  loadImage(id, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this._images.set(id, img); resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  getImage(id) { return this._images.get(id) ?? null; }

  // ─── Settings (localStorage) ──────────────────────────────────────────────

  getSettings() {
    try {
      const raw = localStorage.getItem('mgame_settings');
      return raw ? JSON.parse(raw) : this._defaultSettings();
    } catch { return this._defaultSettings(); }
  }

  saveSetting(key, value) {
    const s = this.getSettings();
    s[key] = value;
    localStorage.setItem('mgame_settings', JSON.stringify(s));
  }

  getHighScore(gameId) {
    const val = localStorage.getItem(`mgame_hs_${gameId}`);
    return val !== null ? parseInt(val, 10) : 0;
  }

  saveHighScore(gameId, score) {
    if (score > this.getHighScore(gameId)) {
      localStorage.setItem(`mgame_hs_${gameId}`, String(score));
    }
    // Always record to top-10 list (score > 0 only)
    if (score > 0) this._pushTopScore(gameId, score);
  }

  /** @returns {Array<{score:number, date:string}>} sorted desc, max 10 */
  getTopScores(gameId) {
    try {
      const raw = localStorage.getItem(`mgame_top_${gameId}`);
      const list = raw ? JSON.parse(raw) : [];
      // Back-fill: if mgame_hs exists but top list is empty, add it as a seed entry
      if (list.length === 0) {
        const hs = this.getHighScore(gameId);
        if (hs > 0) list.push({ score: hs, date: new Date(0).toISOString() });
      }
      return list;
    } catch { return []; }
  }

  _pushTopScore(gameId, score) {
    const list = this.getTopScores(gameId);
    list.push({ score, date: new Date().toISOString() });
    list.sort((a, b) => b.score - a.score);
    list.splice(10);
    localStorage.setItem(`mgame_top_${gameId}`, JSON.stringify(list));
  }

  getLastGame() {
    return localStorage.getItem('mgame_last_game') ?? null;
  }

  saveLastGame(gameId) {
    localStorage.setItem('mgame_last_game', gameId);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _defaultSettings() {
    return { theme: 'dark', sfxEnabled: true, bgmEnabled: true };
  }

  _saveSettings() {
    this.saveSetting('sfxEnabled', this._sfxEnabled);
    this.saveSetting('bgmEnabled', this._bgmEnabled);
  }

  _loadPersistedSettings() {
    const s = this.getSettings();
    this._sfxEnabled = s.sfxEnabled ?? true;
    this._bgmEnabled = s.bgmEnabled ?? true;
  }
}

export const resourceManager = new ResourceManager();
