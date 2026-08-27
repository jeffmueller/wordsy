#!/usr/bin/env node
/**
 * Removes offensive words from ANSWERS and VALID_GUESSES in js/words.js.
 *
 * The blocklist below is the project's content policy in executable form:
 * slurs and crude vulgarities are removed, while ordinary vocabulary is kept
 * even when it is unpleasant ("death", "slave", "crack"). Editing this list
 * and re-running the script is the supported way to change that policy.
 *
 * Only 5-letter entries matter — both word lists are 5-letter words.
 *
 *   node scripts/filter-offensive.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const WORDS_FILE = path.join(__dirname, '..', 'js', 'words.js');
const DRY_RUN = process.argv.includes('--dry-run');

// Slurs and crude vulgarities. Grouped for reviewability; the groups are
// merged into one set at load.
const BLOCKLIST = {
  racial: [
    'abbos', 'boong', 'chink', 'coons', 'dagos', 'darky', 'gippo', 'gooks',
    'gyppo', 'guido', 'honky', 'hymie', 'injun', 'jewed', 'kikes', 'negro',
    'nigga', 'polak', 'sambo', 'spick', 'spics', 'wetba',
  ],
  lgbtq: [
    'dyked', 'dykes', 'faggy', 'fagot', 'homos', 'nancy', 'pansy', 'poofs',
    'poove', 'queer', 'sissy',
  ],
  ableist: [
    'mongo', 'spazs', 'spazz',
  ],
  misogynistic: [
    'bimbo', 'bitch', 'cunts', 'floozy', 'hussy', 'skank', 'sluts', 'twats',
    'whore',
  ],
  vulgar: [
    'arses', 'boobs', 'cocks', 'dicks', 'dildo', 'felch', 'fucks', 'jizzy',
    'porno', 'pussy', 'queef', 'shite', 'shits', 'titty', 'turds', 'wanks',
  ],
  hate: [
    'lynch', 'nazis', 'raped', 'rapes', 'rapey',
  ],
};

// Deliberately NOT blocked: ordinary English that merely sounds unpleasant,
// and clinical anatomy. Listed here so the choice is visible and arguable.
const KEPT_ON_PURPOSE = [
  'balls', 'blunt', 'crack', 'death', 'doped', 'dunce', 'erect', 'fairy',
  'idiot', 'jihad', 'joint', 'junky', 'kills', 'moron', 'noose', 'opium',
  'penis', 'prick', 'screw', 'shoot', 'slave', 'spunk', 'stabs', 'vulva',
];

const blocked = new Set(Object.values(BLOCKLIST).flat());

const content = fs.readFileSync(WORDS_FILE, 'utf8');

function extractArray(name) {
  const match = content.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Could not find ${name} array`);
  return match[1].match(/"(\w+)"/g).map(w => w.replace(/"/g, ''));
}

// Same 10-per-line shape filter-plurals.js emits, so re-running either script
// never produces a formatting-only diff.
function formatArray(name, words) {
  const lines = [`const ${name} = [`];
  for (let i = 0; i < words.length; i += 10) {
    const quoted = words.slice(i, i + 10).map(w => `"${w}"`).join(', ');
    lines.push(`  ${quoted}${i + 10 < words.length ? ',' : ''}`);
  }
  lines.push('];');
  return lines.join('\n');
}

const answers = extractArray('ANSWERS');
const guesses = extractArray('VALID_GUESSES');

const hitAnswers = answers.filter(w => blocked.has(w));
const hitGuesses = guesses.filter(w => blocked.has(w));
const keptAnswers = answers.filter(w => !blocked.has(w));
const keptGuesses = guesses.filter(w => !blocked.has(w));

console.log(`ANSWERS:       ${answers.length} -> ${keptAnswers.length} (removed ${hitAnswers.length})`);
console.log(`VALID_GUESSES: ${guesses.length} -> ${keptGuesses.length} (removed ${hitGuesses.length})`);
if (hitAnswers.length) console.log(`\nRemoved from ANSWERS: ${hitAnswers.join(', ')}`);
if (hitGuesses.length) console.log(`\nRemoved from VALID_GUESSES:\n  ${hitGuesses.join(', ')}`);

const unused = [...blocked].filter(w => !answers.includes(w) && !guesses.includes(w)).sort();
console.log(`\nBlocklist entries not present in either list (${unused.length}): ${unused.join(', ')}`);

const keptPresent = KEPT_ON_PURPOSE.filter(w => answers.includes(w) || guesses.includes(w));
console.log(`\nKept on purpose (${keptPresent.length}): ${keptPresent.join(', ')}`);

if (DRY_RUN) {
  console.log('\n--dry-run: js/words.js not modified.');
} else {
  fs.writeFileSync(
    WORDS_FILE,
    formatArray('ANSWERS', keptAnswers) + '\n\n' + formatArray('VALID_GUESSES', keptGuesses) + '\n'
  );
  console.log(`\nWrote ${WORDS_FILE}`);
}
