import { BaseGame } from '../../core/BaseGame.js';

export class Snake extends BaseGame {
  constructor() { super('snake'); }

  _onInit(_options) {
    // TODO: implement Snake logic
    this._ctx.fillStyle = '#0d1b2a';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.fillStyle = '#4ade80';
    this._ctx.font = '20px monospace';
    this._ctx.textAlign = 'center';
    this._ctx.fillText('Snake — Coming Soon', this._canvas.width / 2, this._canvas.height / 2);
  }
}
