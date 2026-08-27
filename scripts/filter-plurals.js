#!/usr/bin/env node
/**
 * Removes plural words from ANSWERS and VALID_GUESSES in js/words.js.
 * Detects plurals by checking whether the singular form (without 's', 'es',
 * etc.) appears in a system word list.
 *
 *   node scripts/filter-plurals.js
 *   DICT_FILE=/path/to/words node scripts/filter-plurals.js
 *
 * The word list ships with macOS. On Debian/Ubuntu install `wordlist`, on
 * Fedora `words`, on Arch `words`. Windows has no equivalent — point
 * DICT_FILE at any newline-delimited word file.
 */

const fs = require('fs');
const path = require('path');

const WORDS_FILE = path.join(__dirname, '..', 'js', 'words.js');

const DICT_CANDIDATES = [
  process.env.DICT_FILE,
  '/usr/share/dict/words',
  '/usr/share/dict/american-english',
  '/usr/dict/words',
].filter(Boolean);

const DICT_FILE = DICT_CANDIDATES.find(f => fs.existsSync(f));
if (!DICT_FILE) {
  console.error(
    'No system dictionary found. Looked in:\n' +
    DICT_CANDIDATES.map(f => `  ${f}`).join('\n') +
    '\n\nInstall one (apt install wordlist / dnf install words / pacman -S words)\n' +
    'or set DICT_FILE to a newline-delimited word list.'
  );
  process.exit(1);
}

// Words that end in 's' but are NOT plurals (false positives from dictionary)
const FORCE_KEEP = new Set([
  'chaos', 'trans', 'corps', 'yours', 'aegis', 'atlas', 'alias', 'oasis',
  'rebus', 'nexus', 'sinus', 'torus', 'humus', 'conus', 'pious', 'genus',
]);

// Words that ARE plurals but the dictionary is missing the singular form
const FORCE_REMOVE = new Set([
  'boxes', 'bytes', 'elves', 'foxes',
]);

// Load system dictionary
const dictWords = new Set(
  fs.readFileSync(DICT_FILE, 'utf8')
    .split('\n')
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 0)
);

function isPlural(word) {
  if (FORCE_KEEP.has(word)) return false;
  if (FORCE_REMOVE.has(word)) return true;
  if (!word.endsWith('s')) return false;
  if (word.endsWith('ss')) return false;  // glass, dress, bliss
  if (word.endsWith('us')) return false;  // bonus, focus, virus
  if (word.endsWith('is')) return false;  // basis, oasis

  // Remove 's' -> check base
  const baseS = word.slice(0, -1);
  if (baseS.length >= 3 && dictWords.has(baseS)) return true;

  // Remove 'es' -> check base (gases -> gas, buses -> bus)
  if (word.endsWith('es')) {
    const baseEs = word.slice(0, -2);
    if (baseEs.length >= 3 && dictWords.has(baseEs)) return true;
  }

  // 'ies' -> 'y' (skies -> sky)
  if (word.endsWith('ies')) {
    const baseIes = word.slice(0, -3) + 'y';
    if (baseIes.length >= 3 && dictWords.has(baseIes)) return true;
  }

  // 'ves' -> 'f' or 'fe' (elves -> elf, knives -> knife... but knives is 6 letters)
  if (word.endsWith('ves')) {
    const baseF = word.slice(0, -3) + 'f';
    const baseFe = word.slice(0, -3) + 'fe';
    if ((baseF.length >= 3 && dictWords.has(baseF)) || (baseFe.length >= 3 && dictWords.has(baseFe))) return true;
  }

  return false;
}

// Parse arrays from words.js
const content = fs.readFileSync(WORDS_FILE, 'utf8');

function extractArray(name) {
  const regex = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`);
  const match = content.match(regex);
  if (!match) throw new Error(`Could not find ${name} array`);
  return match[1].match(/"(\w+)"/g).map(w => w.replace(/"/g, ''));
}

const answers = extractArray('ANSWERS');
const guesses = extractArray('VALID_GUESSES');

const removedAnswers = answers.filter(isPlural);
const filteredAnswers = answers.filter(w => !isPlural(w));
// Wordle accepts plural guesses even though no puzzle has a plural solution.
// Keep VALID_GUESSES untouched and merge the plurals removed from ANSWERS into it.
const guessSet = new Set(guesses);
for (const w of removedAnswers) guessSet.add(w);
const filteredGuesses = Array.from(guessSet).sort();

console.log(`ANSWERS: ${answers.length} -> ${filteredAnswers.length} (removed ${removedAnswers.length})`);
console.log(`VALID_GUESSES: ${guesses.length} -> ${filteredGuesses.length} (+${filteredGuesses.length - guesses.length} moved from ANSWERS)`);

// Show remaining words ending in 's' for review
const keptS = filteredAnswers.filter(w => w.endsWith('s'));
console.log(`\nKept ANSWERS ending in 's': ${keptS.join(', ')}`);

const removedSample = removedAnswers.slice(0, 40);
console.log(`\nSample removed ANSWERS: ${removedSample.join(', ')}...`);

// Format array as JS
function formatArray(name, words) {
  const lines = [];
  lines.push(`const ${name} = [`);
  for (let i = 0; i < words.length; i += 10) {
    const chunk = words.slice(i, i + 10);
    const quoted = chunk.map(w => `"${w}"`).join(', ');
    const comma = (i + 10 < words.length) ? ',' : '';
    lines.push(`  ${quoted}${comma}`);
  }
  lines.push('];');
  return lines.join('\n');
}

const output = formatArray('ANSWERS', filteredAnswers) + '\n\n' + formatArray('VALID_GUESSES', filteredGuesses) + '\n';
fs.writeFileSync(WORDS_FILE, output);
console.log(`\nWrote filtered words to ${WORDS_FILE}`);
