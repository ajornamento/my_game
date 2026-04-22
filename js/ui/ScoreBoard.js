/**
 * ScoreBoard — renders current score and per-game high score.
 * Expects DOM:
 *   <div id="score-board">
 *     <span id="score-current">0</span>
 *     <span id="score-high">0</span>
 *   </div>
 */
export class ScoreBoard {
  /**
   * @param {import('../core/GameManager').GameManager} gameManager
   */
  constructor(gameManager) {
    this._gm = gameManager;
    this._elCurrent = document.getElementById('score-current');
    this._elHigh = document.getElementById('score-high');
    this._currentGameId = null;

    this._gm.on('scoreUpdate', ({ gameId, score }) => {
      this._currentGameId = gameId;
      this._render(score, this._gm.getHighScore(gameId));
    });

    this._gm.on('gameSwitched', ({ gameId }) => {
      this._currentGameId = gameId;
      this._render(0, this._gm.getHighScore(gameId));
    });

    this._gm.on('gameOver', ({ gameId, score, highScore }) => {
      this._render(score, highScore);
    });
  }

  _render(current, high) {
    if (this._elCurrent) this._elCurrent.textContent = String(current);
    if (this._elHigh)    this._elHigh.textContent    = String(high);
  }
}
