import { gameManager }     from './core/GameManager.js';
import { resourceManager } from './core/ResourceManager.js';
import { ScoreBoard }      from './ui/ScoreBoard.js';
import { GameMenu }        from './ui/GameMenu.js';
import { Controls }        from './ui/Controls.js';

import { Tetris }      from './games/tetris/Tetris.js';
import { Snake }       from './games/snake/Snake.js';
import { Minesweeper } from './games/minesweeper/Minesweeper.js';
import { Breakout }    from './games/breakout/Breakout.js';

// ── Expose singletons for Controls toggle helpers ──────────────────────────
window.__mgame = { gameManager, resourceManager };

// ── Canvas setup ───────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
gameManager.setCanvas(canvas);

// ── Register games ─────────────────────────────────────────────────────────
gameManager.register('tetris',      Tetris);
gameManager.register('snake',       Snake);
gameManager.register('minesweeper', Minesweeper);
gameManager.register('breakout',    Breakout);

// ── Game metadata for UI ───────────────────────────────────────────────────
const GAMES = [
  { id: 'tetris',      label: 'Tetris',      icon: '🟦' },
  { id: 'snake',       label: 'Snake',       icon: '🐍' },
  { id: 'minesweeper', label: 'Minesweeper', icon: '💣' },
  { id: 'breakout',    label: 'Breakout',    icon: '🧱' },
];

// ── Bootstrap UI ───────────────────────────────────────────────────────────
new ScoreBoard(gameManager);
new GameMenu(gameManager, GAMES);
const controls = new Controls(gameManager);

// ── Virtual-pad layouts ────────────────────────────────────────────────────
controls.registerPad('tetris', [
  { label: 'Left',      icon: '◀',  action: 'ArrowLeft',  classes: 'vpad-btn--left'  },
  { label: 'Rotate',    icon: '↺',  action: 'ArrowUp',    classes: 'vpad-btn--up'    },
  { label: 'Right',     icon: '▶',  action: 'ArrowRight', classes: 'vpad-btn--right' },
  { label: 'Soft drop', icon: '▼',  action: 'ArrowDown',  classes: 'vpad-btn--down'  },
  { label: 'Hard drop', icon: '⏬', action: ' '                                       },
  { label: 'Hold',      icon: '📦', action: 'c'                                       },
]);

controls.registerPad('snake', [
  { label: 'Up',    icon: '▲', action: 'ArrowUp',    classes: 'vpad-btn--up'    },
  { label: 'Left',  icon: '◀', action: 'ArrowLeft',  classes: 'vpad-btn--left'  },
  { label: 'Down',  icon: '▼', action: 'ArrowDown',  classes: 'vpad-btn--down'  },
  { label: 'Right', icon: '▶', action: 'ArrowRight', classes: 'vpad-btn--right' },
]);

controls.registerPad('breakout', [
  { label: 'Left',  icon: '◀', action: 'ArrowLeft',  classes: 'vpad-btn--left'  },
  { label: 'Right', icon: '▶', action: 'ArrowRight', classes: 'vpad-btn--right' },
]);

// ── Restore theme preference ───────────────────────────────────────────────
const savedTheme = localStorage.getItem('mgame_settings_theme') ?? 'dark';
document.documentElement.dataset.theme = savedTheme;

// ── Canvas resize helper ───────────────────────────────────────────────────
// Games set their own canvas dimensions in _onInit; main.js only sets a
// default size for the idle/placeholder state.
function resizeCanvas() {
  const game = gameManager.getCurrentGame();
  if (game) return; // active game owns canvas dimensions
  const area = canvas.parentElement;
  const size = Math.min(area.clientWidth - 32, area.clientHeight - 32, 560);
  canvas.width  = size;
  canvas.height = size;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Launch last game or default ────────────────────────────────────────────
const lastGame = resourceManager.getLastGame() ?? 'tetris';
gameManager.switchTo(lastGame);
