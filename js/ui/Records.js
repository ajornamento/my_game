import { resourceManager } from '../core/ResourceManager.js';

const GAMES = [
  { id: 'tetris',      label: 'Tetris',      icon: '🟦' },
  { id: 'snake',       label: 'Snake',       icon: '🐍' },
  { id: 'minesweeper', label: 'Minesweeper', icon: '💣' },
  { id: 'breakout',    label: 'Breakout',    icon: '🧱' },
];

export class Records {
  constructor(gameManager) {
    this._gm       = gameManager;
    this._activeId = 'tetris';

    this._modal  = document.getElementById('records-modal');
    this._tabs   = document.getElementById('records-tabs');
    this._tbody  = document.getElementById('records-tbody');
    this._empty  = document.getElementById('records-empty');

    document.getElementById('btn-records')?.addEventListener('click', () => this.open());
    document.getElementById('records-close')?.addEventListener('click', () => this.close());
    this._modal?.addEventListener('click', e => { if (e.target === this._modal) this.close(); });

    this._gm.on('gameSwitched', ({ gameId }) => { this._activeId = gameId; });
    this._buildTabs();
  }

  open() {
    this._renderTable(this._activeId);
    this._modal?.classList.add('is-open');
  }

  close() {
    this._modal?.classList.remove('is-open');
  }

  _buildTabs() {
    if (!this._tabs) return;
    for (const { id, label, icon } of GAMES) {
      const btn = document.createElement('button');
      btn.className = 'records-tab';
      btn.dataset.gameId = id;
      btn.textContent = `${icon} ${label}`;
      btn.addEventListener('click', () => this._renderTable(id));
      this._tabs.appendChild(btn);
    }
  }

  _renderTable(gameId) {
    if (!this._tbody) return;
    this._activeId = gameId;

    // Update active tab
    this._tabs?.querySelectorAll('.records-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.gameId === gameId);
    });

    const scores = resourceManager.getTopScores(gameId);
    this._tbody.innerHTML = '';

    if (scores.length === 0) {
      this._empty?.classList.remove('is-hidden');
      return;
    }
    this._empty?.classList.add('is-hidden');

    scores.forEach(({ score, date }, i) => {
      const tr = document.createElement('tr');
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
      const d = new Date(date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      tr.innerHTML = `
        <td class="records-rank">${medal}</td>
        <td class="records-score">${score.toLocaleString()}</td>
        <td class="records-date">${dateStr}<span class="records-time">${timeStr}</span></td>
      `;
      if (rank === 1) tr.classList.add('is-best');
      this._tbody.appendChild(tr);
    });
  }
}
