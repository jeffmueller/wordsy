// Game constants
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const EPOCH = new Date(2024, 0, 1).getTime(); // Jan 1, 2024

// Game state
let gameState = {
  answer: '',
  guesses: [],
  results: [],
  currentRow: 0,
  currentTile: 0,
  status: 'playing', // 'playing', 'won', 'lost'
  hardMode: false,
  puzzleNumber: 0,
};

function getPuzzleNumber() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - EPOCH) / 86400000);
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Seeding the RNG per-day samples the answer list *with* replacement, which
// repeats words within weeks (and twice ran the same word on consecutive
// days). Shuffling the list once with a fixed seed and then walking it in
// order keeps the sequence unguessable while guaranteeing every answer is
// used before any is reused.
const SHUFFLE_SEED = 20240101;

function shuffledAnswers() {
  const words = ANSWERS.slice();
  const rng = mulberry32(SHUFFLE_SEED);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

const ANSWER_ORDER = shuffledAnswers();

function getWordOfTheDay() {
  const puzzleNum = getPuzzleNumber();
  gameState.puzzleNumber = puzzleNum;
  // Clocks set before the epoch would otherwise index with a negative value.
  const index = ((puzzleNum % ANSWER_ORDER.length) + ANSWER_ORDER.length) % ANSWER_ORDER.length;
  return ANSWER_ORDER[index];
}

function isValidGuess(word) {
  const w = word.toLowerCase();
  return ANSWERS.includes(w) || VALID_GUESSES.includes(w);
}

function evaluateGuess(guess, answer) {
  const result = new Array(WORD_LENGTH).fill('absent');
  const answerLetters = answer.split('');
  const guessLetters = guess.split('');
  const remaining = {};

  // First pass: mark correct (green)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 'correct';
      answerLetters[i] = null;
    }
  }

  // Count remaining answer letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (answerLetters[i] !== null) {
      remaining[answerLetters[i]] = (remaining[answerLetters[i]] || 0) + 1;
    }
  }

  // Second pass: mark present (yellow)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'absent' && remaining[guessLetters[i]] > 0) {
      result[i] = 'present';
      remaining[guessLetters[i]]--;
    }
  }

  return result;
}

function checkHardMode(guess, guesses, results) {
  if (guesses.length === 0) return null;

  for (let g = 0; g < guesses.length; g++) {
    const prevGuess = guesses[g];
    const prevResult = results[g];

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (prevResult[i] === 'correct' && guess[i] !== prevGuess[i]) {
        return `${ordinal(i + 1)} letter must be ${prevGuess[i].toUpperCase()}`;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (prevResult[i] === 'present') {
        const letter = prevGuess[i];
        if (!guess.includes(letter)) {
          return `Guess must contain ${letter.toUpperCase()}`;
        }
      }
    }
  }

  return null;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Storage helpers
//
// localStorage throws outright when site data is blocked (Safari private
// browsing, hardened privacy settings), and a corrupt value used to throw
// from init() and leave a blank page that survived reloading. Every access
// goes through these, so the worst case is a lost streak rather than a game
// nobody can start.
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`Could not read ${key}`, err);
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Could not save ${key}`, err);
  }
}

function readJSON(key) {
  const stored = readStorage(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (err) {
    console.warn(`Discarding unreadable ${key}`, err);
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // Nothing further to do; the default value is used either way.
    }
    return null;
  }
}

// Stats
function defaultStats() {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
}

function getStats() {
  const stored = readJSON('wordsy-stats');
  if (!stored || typeof stored !== 'object') return defaultStats();

  // Layer over the defaults so stats written by an older version — or written
  // only partially — cannot crash recordWin's distribution bump.
  const defaults = defaultStats();
  return {
    ...defaults,
    ...stored,
    distribution: { ...defaults.distribution, ...(stored.distribution || {}) },
  };
}

function saveStats(stats) {
  writeStorage('wordsy-stats', JSON.stringify(stats));
}

function recordWin(numGuesses) {
  const stats = getStats();
  stats.played++;
  stats.won++;
  stats.currentStreak++;
  if (stats.currentStreak > stats.maxStreak) {
    stats.maxStreak = stats.currentStreak;
  }
  stats.distribution[numGuesses]++;
  saveStats(stats);
}

function recordLoss() {
  const stats = getStats();
  stats.played++;
  stats.currentStreak = 0;
  saveStats(stats);
}

// Game state persistence
function saveGameState() {
  const data = {
    answer: gameState.answer,
    guesses: gameState.guesses,
    results: gameState.results,
    currentRow: gameState.currentRow,
    status: gameState.status,
    hardMode: gameState.hardMode,
    puzzleNumber: gameState.puzzleNumber,
    date: new Date().toDateString(),
  };
  writeStorage('wordsy-state', JSON.stringify(data));
}

function loadGameState() {
  const data = readJSON('wordsy-state');
  if (!data) return false;
  if (data.date !== new Date().toDateString()) return false;

  // Restoring a half-written or hand-edited state would break the board
  // renderer, so start fresh unless the shape is what we wrote.
  if (typeof data.answer !== 'string' ||
      !Array.isArray(data.guesses) ||
      !Array.isArray(data.results)) {
    return false;
  }

  gameState.answer = data.answer;
  gameState.guesses = data.guesses;
  gameState.results = data.results;
  gameState.currentRow = data.currentRow;
  gameState.status = data.status;
  gameState.hardMode = data.hardMode;
  gameState.puzzleNumber = data.puzzleNumber;
  return true;
}

function loadHardModeSetting() {
  const stored = readStorage('wordsy-hard-mode');
  if (stored !== null) {
    gameState.hardMode = stored === 'true';
  }
}

function saveHardModeSetting() {
  writeStorage('wordsy-hard-mode', String(gameState.hardMode));
}

function generateShareText() {
  const rows = gameState.results.map(result =>
    result.map(r => {
      if (r === 'correct') return '🟩';
      if (r === 'present') return '🟨';
      return '⬛';
    }).join('')
  );

  const score = gameState.status === 'won' ? gameState.currentRow : 'X';
  const mode = gameState.hardMode ? '*' : '';
  return `Wordsy ${gameState.puzzleNumber} ${score}/${MAX_GUESSES}${mode}\n\n${rows.join('\n')}`;
}
