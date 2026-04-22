/**
 * GameMenu — game-selection tab bar.
 * Expects DOM: <nav id="game-menu"></nav>
 * Generates one button per registered game.
 */
export class GameMenu {
  /**
   * @param {import('../core/GameManager').GameManager} gameManager
   * @param {Array<{id: string, label: string, icon: string}>} games
   */
  constructor(gameManager, games) {
    this._gm = gameManager;
    this._games = games;
    this._el = document.getElementById('game-menu');
    this._activeId = null;
    this._render();

    this._gm.on('gameSwitched', ({ gameId }) => {
      this._setActive(gameId);
    });
  }

  _render() {
    if (!this._el) return;
    this._el.innerHTML = '';
    for (const { id, label, icon } of this._games) {
      const btn = document.createElement('button');
      btn.className = 'game-menu__btn';
      btn.dataset.gameId = id;
      btn.innerHTML = `<span class="game-menu__icon">${icon}</span><span class="game-menu__label">${label}</span>`;
      btn.addEventListener('click', () => {
        this._gm.switchTo(id);
        this._gm.start();
      });
      this._el.appendChild(btn);
    }
  }

  _setActive(gameId) {
    if (!this._el) return;
    this._activeId = gameId;
    this._el.querySelectorAll('.game-menu__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.gameId === gameId);
    });
  }
}
