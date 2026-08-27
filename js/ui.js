// UI Elements
const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const toastContainer = document.getElementById('toast-container');

// Keyboard layout
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'],
];

// Track keyboard key states
const keyStates = {};

// Current input buffer
let currentInput = [];

// Animation lock — prevent input during reveal
let isRevealing = false;

function init() {
  loadHardModeSetting();

  const restored = loadGameState();
  if (!restored) {
    gameState.answer = getWordOfTheDay();
    gameState.guesses = [];
    gameState.results = [];
    gameState.currentRow = 0;
    gameState.status = 'playing';
  }

  renderBoard();
  renderKeyboard();

  if (restored) {
    restoreBoard();
    document.getElementById('hard-mode-toggle').checked = gameState.hardMode;
    if (gameState.status !== 'playing') {
      setTimeout(() => showStatsModal(), 500);
    }
  } else {
    document.getElementById('hard-mode-toggle').checked = gameState.hardMode;
  }

  // Event listeners
  document.addEventListener('keydown', handleKeyDown);
  keyboardEl.addEventListener('click', handleKeyboardClick);

  document.getElementById('help-btn').addEventListener('click', () => toggleModal('help-modal', true));
  document.getElementById('settings-btn').addEventListener('click', () => toggleModal('settings-modal', true));

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  document.getElementById('hard-mode-toggle').addEventListener('change', (e) => {
    if (gameState.currentRow > 0 && gameState.status === 'playing') {
      e.target.checked = gameState.hardMode;
      showToast('Hard Mode can only be changed at the start of a game');
      return;
    }
    gameState.hardMode = e.target.checked;
    saveHardModeSetting();
    saveGameState();
  });

  document.getElementById('share-btn').addEventListener('click', () => {
    copyToClipboard(generateShareText()).then(() => {
      showToast('Copied results to clipboard');
    }).catch(() => {
      showToast('Failed to copy');
    });
  });
}

// The Clipboard API only exists in a secure context, so a self-hosted copy
// reached over plain HTTP (http://nas.local:8080, any LAN IP) has no
// navigator.clipboard at all — the old code threw a TypeError before the
// promise existed, so even the failure toast never fired. Fall back to the
// legacy selection copy, which has no such restriction.
function copyToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);

    ta.select();
    ta.setSelectionRange(0, text.length);   // iOS Safari needs the explicit range

    try {
      if (document.execCommand('copy')) {
        resolve();
      } else {
        reject(new Error('Copy command was rejected'));
      }
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = r;
    for (let t = 0; t < WORD_LENGTH; t++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = r;
      tile.dataset.col = t;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    row.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.dataset.key = key;

      if (key === 'Enter') {
        btn.textContent = 'ENTER';
        btn.classList.add('wide');
      } else if (key === 'Backspace') {
        btn.innerHTML = '⌫';
        btn.classList.add('wide');
      } else {
        btn.textContent = key.toUpperCase();
      }

      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function restoreBoard() {
  for (let r = 0; r < gameState.guesses.length; r++) {
    const guess = gameState.guesses[r];
    const result = gameState.results[r];
    for (let t = 0; t < WORD_LENGTH; t++) {
      const tile = getTile(r, t);
      tile.textContent = guess[t].toUpperCase();
      tile.classList.add('filled', result[t]);
    }
  }

  // Restore keyboard colors
  for (let r = 0; r < gameState.guesses.length; r++) {
    const guess = gameState.guesses[r];
    const result = gameState.results[r];
    for (let t = 0; t < WORD_LENGTH; t++) {
      updateKeyState(guess[t], result[t]);
    }
  }
  applyKeyboardColors();
}

function getTile(row, col) {
  return boardEl.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function handleKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isRevealing) return;
  if (gameState.status !== 'playing') return;

  if (e.key === 'Enter') {
    submitGuess();
  } else if (e.key === 'Backspace') {
    deleteLetter();
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    addLetter(e.key.toLowerCase());
  }
}

function handleKeyboardClick(e) {
  const btn = e.target.closest('.key');
  if (!btn) return;
  if (isRevealing) return;
  if (gameState.status !== 'playing') return;

  const key = btn.dataset.key;
  if (key === 'Enter') {
    submitGuess();
  } else if (key === 'Backspace') {
    deleteLetter();
  } else {
    addLetter(key);
  }
}

function addLetter(letter) {
  if (currentInput.length >= WORD_LENGTH) return;
  currentInput.push(letter);
  const tile = getTile(gameState.currentRow, currentInput.length - 1);
  tile.textContent = letter.toUpperCase();
  tile.classList.add('filled');
  tile.classList.add('pop');
  setTimeout(() => tile.classList.remove('pop'), 100);
}

function deleteLetter() {
  if (currentInput.length === 0) return;
  currentInput.pop();
  const tile = getTile(gameState.currentRow, currentInput.length);
  tile.textContent = '';
  tile.classList.remove('filled');
}

function submitGuess() {
  if (currentInput.length < WORD_LENGTH) {
    shakeRow(gameState.currentRow);
    showToast('Not enough letters');
    return;
  }

  const guess = currentInput.join('');

  if (!isValidGuess(guess)) {
    shakeRow(gameState.currentRow);
    showToast('Not in word list');
    return;
  }

  if (gameState.hardMode) {
    const violation = checkHardMode(guess, gameState.guesses, gameState.results);
    if (violation) {
      shakeRow(gameState.currentRow);
      showToast(violation);
      return;
    }
  }

  const result = evaluateGuess(guess, gameState.answer);
  gameState.guesses.push(guess);
  gameState.results.push(result);
  gameState.currentRow++;

  isRevealing = true;
  revealRow(gameState.currentRow - 1, result, guess, () => {
    isRevealing = false;

    if (guess === gameState.answer) {
      gameState.status = 'won';
      saveGameState();
      recordWin(gameState.currentRow);
      const messages = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];
      showToast(messages[gameState.currentRow - 1]);
      bounceRow(gameState.currentRow - 1);
      setTimeout(() => showStatsModal(), 2000);
    } else if (gameState.currentRow >= MAX_GUESSES) {
      gameState.status = 'lost';
      saveGameState();
      recordLoss();
      showToast(gameState.answer.toUpperCase(), 3000);
      setTimeout(() => showStatsModal(), 2000);
    } else {
      saveGameState();
    }
  });

  currentInput = [];
}

function revealRow(row, result, guess, callback) {
  const FLIP_DURATION = 300;
  const STAGGER = 300;

  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = getTile(row, i);
    setTimeout(() => {
      tile.classList.add('flip');
      setTimeout(() => {
        tile.classList.add(result[i]);
        tile.classList.remove('flip');
        tile.classList.add('flip-back');
        updateKeyState(guess[i], result[i]);
        applyKeyboardColors();
        setTimeout(() => tile.classList.remove('flip-back'), FLIP_DURATION);
      }, FLIP_DURATION);
    }, i * STAGGER);
  }

  setTimeout(callback, WORD_LENGTH * STAGGER + FLIP_DURATION * 2);
}

function bounceRow(row) {
  const STAGGER = 100;
  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = getTile(row, i);
    setTimeout(() => {
      tile.classList.add('bounce');
      setTimeout(() => tile.classList.remove('bounce'), 500);
    }, i * STAGGER);
  }
}

function updateKeyState(letter, state) {
  const priority = { absent: 1, present: 2, correct: 3 };
  const current = keyStates[letter];
  if (!current || priority[state] > priority[current]) {
    keyStates[letter] = state;
  }
}

function applyKeyboardColors() {
  for (const [letter, state] of Object.entries(keyStates)) {
    const btn = keyboardEl.querySelector(`[data-key="${letter}"]`);
    if (btn) {
      btn.classList.remove('absent', 'present', 'correct');
      btn.classList.add(state);
    }
  }
}

function shakeRow(row) {
  const rowEl = boardEl.querySelector(`.row[data-row="${row}"]`);
  rowEl.classList.add('shake');
  setTimeout(() => rowEl.classList.remove('shake'), 600);
}

function showToast(message, duration = 1500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.prepend(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function toggleModal(id, show) {
  document.getElementById(id).classList.toggle('hidden', !show);
}

function showStatsModal() {
  const stats = getStats();

  const summaryEl = document.getElementById('stats-summary');
  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  summaryEl.innerHTML = `
    <div class="stat-items">
      <div class="stat-item">
        <span class="stat-number">${stats.played}</span>
        <span class="stat-label">Played</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${winPct}</span>
        <span class="stat-label">Win %</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${stats.currentStreak}</span>
        <span class="stat-label">Current Streak</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${stats.maxStreak}</span>
        <span class="stat-label">Max Streak</span>
      </div>
    </div>
  `;

  const distEl = document.getElementById('guess-distribution');
  const maxDist = Math.max(1, ...Object.values(stats.distribution));
  distEl.innerHTML = '';
  for (let i = 1; i <= MAX_GUESSES; i++) {
    const count = stats.distribution[i];
    const pct = Math.max(7, (count / maxDist) * 100);
    const isHighlight = gameState.status === 'won' && gameState.currentRow === i;
    distEl.innerHTML += `
      <div class="dist-row">
        <span class="dist-label">${i}</span>
        <div class="dist-bar${isHighlight ? ' highlight' : ''}" style="width: ${pct}%">
          <span class="dist-count">${count}</span>
        </div>
      </div>
    `;
  }

  const shareBtn = document.getElementById('share-btn');
  shareBtn.classList.toggle('hidden', gameState.status === 'playing');

  toggleModal('stats-modal', true);
}

// Start the game
init();
