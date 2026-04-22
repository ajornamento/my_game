import { BaseGame } from '../../core/BaseGame.js';

export class Minesweeper extends BaseGame {
  constructor() { super('minesweeper'); }

  _onInit(_options) {
    // TODO: implement Minesweeper logic
    this._ctx.fillStyle = '#1e1e2e';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.fillStyle = '#f38ba8';
    this._ctx.font = '20px monospace';
    this._ctx.textAlign = 'center';
    this._ctx.fillText('Minesweeper — Coming Soon', this._canvas.width / 2, this._canvas.height / 2);
  }
}
