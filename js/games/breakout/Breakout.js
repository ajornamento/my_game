import { BaseGame } from '../../core/BaseGame.js';

export class Breakout extends BaseGame {
  constructor() { super('breakout'); }

  _onInit(_options) {
    // TODO: implement Breakout logic
    this._ctx.fillStyle = '#13111c';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.fillStyle = '#a9b1d6';
    this._ctx.font = '20px monospace';
    this._ctx.textAlign = 'center';
    this._ctx.fillText('Breakout — Coming Soon', this._canvas.width / 2, this._canvas.height / 2);
  }
}
