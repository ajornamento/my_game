/**
 * SoundEngine — procedural audio via Web Audio API (no sound files needed).
 * Supports multiple BGM themes and game-specific SFX.
 */

// ── Note frequency table ──────────────────────────────────────────────────────
const F = {
  B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
  C6:1046.50,
};

// ── BGM melodies ──────────────────────────────────────────────────────────────

// Tetris: Korobeiniki  [note, quarter-note beats]
const TETRIS_MELODY = [
  ['E5',1],['B4',.5],['C5',.5],['D5',1],['C5',.5],['B4',.5],
  ['A4',1],['A4',.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
  ['D5',1.5],['F5',.5],['A5',1],['G5',.5],['F5',.5],
  ['E5',1.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1],['B4',.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
];

// Snake: upbeat 8-bit loop in G major
const SNAKE_MELODY = [
  ['G4',.5],['B4',.5],['D5',.5],['G5',.5],
  ['D5',.5],['B4',.5],['G4',1],
  ['A4',.5],['C5',.5],['E5',.5],['A5',.5],
  ['E5',.5],['C5',.5],['A4',1],
  ['B4',.5],['D5',.5],['G5',.5],['B5',.5],
  ['G5',.5],['D5',.5],['B4',1],
  ['C5',.5],['E5',.5],['G5',.5],['E5',.5],
  ['D5',.5],['B4',.5],['G4',1],
];

const MELODIES  = { tetris: TETRIS_MELODY, snake: SNAKE_MELODY };
const BGM_TEMPO = { tetris: 0.30, snake: 0.22 };

// ── Engine ────────────────────────────────────────────────────────────────────

class SoundEngine {
  constructor() {
    this._ac        = null;
    this._master    = null;
    this._bgmBus    = null;
    this._sfxBus    = null;
    this._bgmOn     = true;
    this._sfxOn     = true;
    this._bgmActive = false;
    this._bgmTheme  = 'tetris';
    this._bgmIdx    = 0;
    this._bgmNext   = 0;
    this._timerId   = null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  resume() {
    this._init();
    if (this._ac.state === 'suspended') this._ac.resume();
  }

  /** @param {'tetris'|'snake'} [theme='tetris'] */
  startBgm(theme = 'tetris') {
    this._init();
    if (this._ac.state === 'suspended') this._ac.resume();
    if (!this._bgmOn) return;
    // Restart if theme changed
    if (this._bgmActive && this._bgmTheme === theme) return;
    this.stopBgm();
    this._bgmTheme  = theme;
    this._bgmActive = true;
    this._bgmIdx    = 0;
    this._bgmNext   = this._ac.currentTime + 0.05;
    this._scheduleBgm();
  }

  stopBgm() {
    this._bgmActive = false;
    clearTimeout(this._timerId);
  }

  /**
   * Play a one-shot SFX.
   * Tetris: move rotate softDrop hardDrop lock lineClear tetris hold gameOver undo
   * Snake:  snakeEat snakeDie
   */
  play(id, opts = {}) {
    if (!this._sfxOn) return;
    this._init();
    if (this._ac.state === 'suspended') this._ac.resume();
    const t = this._ac.currentTime;
    switch (id) {
      // ── Tetris SFX ──
      case 'move':      this._blip(t, 220, 0.04, 'square', 0.12); break;
      case 'rotate':    this._sweep(t, 330, 440, 0.07, 'square', 0.14); break;
      case 'softDrop':  this._blip(t, 180, 0.03, 'square', 0.10); break;
      case 'hardDrop':  this._impact(t); break;
      case 'lock':      this._blip(t, 110, 0.12, 'sine', 0.20); break;
      case 'lineClear': this._lineClear(t, opts.lines ?? 1); break;
      case 'tetris':    this._tetrisJingle(t); break;
      case 'hold':      this._sweep(t, 440, 660, 0.10, 'triangle', 0.18); break;
      case 'gameOver':  this._gameOver(t); break;
      case 'undo':      this._sweep(t, 440, 220, 0.12, 'square', 0.16); break;
      // ── Snake SFX ──
      case 'snakeEat':  this._snakeEat(t); break;
      case 'snakeDie':  this._snakeDie(t); break;
    }
  }

  setBgmEnabled(v) {
    this._bgmOn = v;
    if (!v) this.stopBgm();
  }
  setSfxEnabled(v) { this._sfxOn = v; }
  get bgmEnabled()  { return this._bgmOn; }
  get sfxEnabled()  { return this._sfxOn; }

  // ── Init ──────────────────────────────────────────────────────────────────

  _init() {
    if (this._ac) return;
    this._ac = new (window.AudioContext || window.webkitAudioContext)();

    this._master = this._ac.createGain();
    this._master.gain.value = 0.6;
    this._master.connect(this._ac.destination);

    this._bgmBus = this._ac.createGain();
    this._bgmBus.gain.value = 0.35;
    this._bgmBus.connect(this._master);

    this._sfxBus = this._ac.createGain();
    this._sfxBus.gain.value = 0.9;
    this._sfxBus.connect(this._master);
  }

  // ── BGM scheduler ─────────────────────────────────────────────────────────

  _scheduleBgm() {
    if (!this._bgmActive) return;
    const melody = MELODIES[this._bgmTheme] ?? TETRIS_MELODY;
    const tempo  = BGM_TEMPO[this._bgmTheme] ?? 0.30;
    while (this._bgmNext < this._ac.currentTime + 0.4) {
      const [note, beats] = melody[this._bgmIdx % melody.length];
      const dur = beats * tempo;
      this._bgmNote(F[note], dur, this._bgmNext);
      this._bgmNext += dur;
      this._bgmIdx++;
    }
    this._timerId = setTimeout(() => this._scheduleBgm(), 120);
  }

  _bgmNote(freq, dur, t) {
    const osc = this._ac.createOscillator();
    const env = this._ac.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.01);
    env.gain.setValueAtTime(1, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
    osc.connect(env); env.connect(this._bgmBus);
    osc.start(t); osc.stop(t + dur);
  }

  // ── SFX primitives ────────────────────────────────────────────────────────

  _blip(t, freq, dur, type, vol) {
    const osc = this._ac.createOscillator();
    const env = this._ac.createGain();
    osc.type = type; osc.frequency.value = freq;
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(this._sfxBus);
    osc.start(t); osc.stop(t + dur + 0.01);
  }

  _sweep(t, f0, f1, dur, type, vol) {
    const osc = this._ac.createOscillator();
    const env = this._ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(this._sfxBus);
    osc.start(t); osc.stop(t + dur + 0.01);
  }

  // ── Tetris SFX ────────────────────────────────────────────────────────────

  _impact(t) {
    this._sweep(t, 160, 60, 0.15, 'sine', 0.4);
    this._blip(t, 800, 0.04, 'square', 0.15);
  }

  _lineClear(t, lines) {
    const notes = [F.C5, F.E5, F.G5, F.C6];
    const step  = 0.07 / (lines * 0.4);
    notes.slice(0, lines + 1).forEach((freq, i) => {
      this._blip(t + i * step, freq, 0.12, 'square', 0.22);
    });
  }

  _tetrisJingle(t) {
    [F.C5, F.E5, F.G5, F.C6, F.E5 * 2].forEach((freq, i) => {
      this._blip(t + i * 0.06, freq, 0.15, 'square', 0.20);
    });
    this._sweep(t + 0.3, F.C6, F.C6 * 1.5, 0.25, 'triangle', 0.15);
  }

  _gameOver(t) {
    [F.E5, F.D5, F.C5, F.B4, F.A4].forEach((freq, i) => {
      this._blip(t + i * 0.18, freq, 0.20, 'square', 0.20);
    });
  }

  // ── Snake SFX ─────────────────────────────────────────────────────────────

  _snakeEat(t) {
    // Satisfying ascending two-note pop
    this._sweep(t,      F.C5, F.G5, 0.06, 'triangle', 0.28);
    this._sweep(t+0.06, F.G5, F.C6, 0.06, 'triangle', 0.20);
  }

  _snakeDie(t) {
    // Descending crunch
    this._sweep(t,      F.A4, F.E4, 0.12, 'square',   0.30);
    this._sweep(t+0.10, F.E4, F.C4, 0.15, 'square',   0.25);
    this._sweep(t+0.22, F.C4, F.B3, 0.20, 'sawtooth', 0.20);
  }
}

export const soundEngine = new SoundEngine();
