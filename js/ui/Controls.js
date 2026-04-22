/**
 * Controls — Start/Pause/Stop buttons and dynamic virtual controls for mobile.
 *
 * Desktop: keyboard shortcuts only (games register their own keydown listeners).
 * Mobile:  injects a game-specific virtual-pad into #virtual-controls.
 *
 * Virtual pad configs are registered per game-id via registerPad().
 */
export class Controls {
  /**
   * @param {import('../core/GameManager').GameManager} gameManager
   */
  constructor(gameManager) {
    this._gm = gameManager;
    this._padConfigs = new Map();
    this._elVirtual = document.getElementById('virtual-controls');
    this._activeGameId = null;

    this._bindSystemButtons();

    this._gm.on('gameSwitched', ({ gameId }) => {
      this._activeGameId = gameId;
      // game starts in idle state — show Start button on mobile
      this._renderIdlePad();
      this._syncButtonStates('idle');
    });

    this._gm.on('stateChange', ({ state }) => {
      this._syncButtonStates(state);
      if (state === 'gameover') this._renderGameOverPad();
      else if (state === 'idle')    this._renderIdlePad();
      else if (state === 'paused')  this._renderPausedPad();
      else if (state === 'running') this._renderVirtualPad(this._activeGameId);
    });
  }

  /**
   * Register a virtual-pad layout for a game.
   * @param {string} gameId
   * @param {Array<{label: string, icon: string, action: string, classes?: string}>} buttons
   *   action is a string dispatched as a CustomEvent 'virtual-input' on the canvas.
   */
  registerPad(gameId, buttons) {
    this._padConfigs.set(gameId, buttons);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _bindSystemButtons() {
    this._bind('btn-start', () => {
      if (this._gm.getCurrentState() === 'gameover') {
        this._gm.stop(); this._gm.start();
      } else {
        this._gm.start();
      }
    });
    this._bind('btn-pause',  () => this._gm.pause());
    this._bind('btn-stop',   () => this._gm.stop());
    this._bind('btn-theme',  () => this._toggleTheme());
    this._bind('btn-sfx',    () => this._toggleSfx());
    this._bind('btn-bgm',    () => this._toggleBgm());
  }

  _bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  _syncButtonStates(state) {
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnStop  = document.getElementById('btn-stop');
    if (btnStart) {
      btnStart.disabled    = state === 'running';
      btnStart.textContent = state === 'gameover' ? '↺ Restart' : '▶ Start';
    }
    if (btnPause) btnPause.disabled = state === 'idle' || state === 'gameover';
    if (btnStop)  btnStop.disabled  = state === 'idle' || state === 'gameover';
    if (btnPause) btnPause.textContent = state === 'paused' ? '▶ Resume' : '⏸ Pause';
  }

  _renderVirtualPad(gameId) {
    if (!this._elVirtual) return;
    this._elVirtual.innerHTML = '';
    const config = this._padConfigs.get(gameId);
    if (!config) return;

    const pad = document.createElement('div');
    pad.className = `virtual-pad virtual-pad--${gameId}`;

    for (const { label, icon, action, classes } of config) {
      const btn = document.createElement('button');
      btn.className = `vpad-btn ${classes ?? ''}`;
      btn.innerHTML = icon ? `<span>${icon}</span>` : label;
      btn.setAttribute('aria-label', label);

      const dispatch = () => {
        const canvas = document.getElementById('game-canvas');
        canvas?.dispatchEvent(new CustomEvent('virtual-input', { detail: { action } }));
      };

      // touch-start fires on mobile without delay; click fallback for desktop
      btn.addEventListener('touchstart', e => { e.preventDefault(); dispatch(); }, { passive: false });
      btn.addEventListener('click', dispatch);
      pad.appendChild(btn);
    }

    this._elVirtual.appendChild(pad);
  }

  _renderIdlePad() {
    this._renderActionPad('▶', 'Start', () => this._gm.start());
  }

  _renderPausedPad() {
    this._renderActionPad('▶', 'Resume', () => this._gm.pause());
  }

  _renderGameOverPad() {
    this._renderActionPad('↺', 'Restart', () => { this._gm.stop(); this._gm.start(); });
  }

  _renderActionPad(icon, label, action) {
    if (!this._elVirtual) return;
    this._elVirtual.innerHTML = '';
    const pad = document.createElement('div');
    pad.className = 'virtual-pad virtual-pad--action';

    const btn = document.createElement('button');
    btn.className = 'vpad-btn vpad-btn--action';
    btn.innerHTML = `<span>${icon}</span>`;
    btn.setAttribute('aria-label', label);

    btn.addEventListener('touchstart', e => { e.preventDefault(); action(); }, { passive: false });
    btn.addEventListener('click', action);

    pad.appendChild(btn);
    this._elVirtual.appendChild(pad);
  }

  _toggleTheme() {
    const root = document.documentElement;
    const isDark = root.dataset.theme === 'dark';
    root.dataset.theme = isDark ? 'light' : 'dark';
    localStorage.setItem('mgame_settings_theme', isDark ? 'light' : 'dark');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  }

  _toggleSfx() {
    const { resourceManager } = window.__mgame ?? {};
    if (!resourceManager) return;
    const next = !resourceManager._sfxEnabled;
    resourceManager.setSfxEnabled(next);
    const btn = document.getElementById('btn-sfx');
    if (btn) btn.textContent = next ? '🔊 SFX' : '🔇 SFX';
  }

  _toggleBgm() {
    const { resourceManager } = window.__mgame ?? {};
    if (!resourceManager) return;
    const next = !resourceManager._bgmEnabled;
    resourceManager.setBgmEnabled(next);
    const btn = document.getElementById('btn-bgm');
    if (btn) btn.textContent = next ? '🎵 BGM' : '🔕 BGM';
  }
}
