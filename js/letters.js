// Logique du jeu « Le Mot le plus long » : tirage, validation, score.

export const RACK_SIZE = 10;
export const MIN_PER_KIND = 2; // au moins 2 voyelles et 2 consonnes dans le tirage

// Répartition des lettres inspirée du Scrabble français.
export const VOWEL_COUNTS = { A: 9, E: 15, I: 8, O: 6, U: 6, Y: 1 };
export const CONSONANT_COUNTS = {
  B: 2, C: 2, D: 3, F: 2, G: 2, H: 2, J: 1, K: 1, L: 5, M: 3,
  N: 6, P: 2, Q: 1, R: 6, S: 6, T: 6, V: 2, W: 1, X: 1, Z: 1,
};

const VOWELS = new Set(Object.keys(VOWEL_COUNTS));

export const isVowel = (ch) => VOWELS.has(ch.toUpperCase());

/** Minuscules, sans accents ni ligatures, uniquement a-z. */
export function normalize(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const expand = (counts) => Object.entries(counts).flatMap(([l, n]) => Array(n).fill(l));

/** Sac de lettres : tire sans remise, se remplit à nouveau quand il est vide. */
export class LetterDeck {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.bags = { vowel: [], consonant: [] };
  }

  draw(kind) {
    if (kind !== 'vowel' && kind !== 'consonant') throw new Error(`Type inconnu : ${kind}`);
    if (!this.bags[kind].length) {
      const counts = kind === 'vowel' ? VOWEL_COUNTS : CONSONANT_COUNTS;
      this.bags[kind] = shuffle(expand(counts), this.rng);
    }
    return this.bags[kind].pop();
  }
}

/** Quels types de lettres peut-on encore tirer sans empêcher le minimum de chaque type ? */
export function allowedKinds(rack, size = RACK_SIZE, min = MIN_PER_KIND) {
  const vowels = rack.filter(isVowel).length;
  const consonants = rack.length - vowels;
  const remaining = size - rack.length;
  const needV = Math.max(0, min - vowels);
  const needC = Math.max(0, min - consonants);
  return {
    vowel: remaining >= 1 && remaining - 1 >= needC,
    consonant: remaining >= 1 && remaining - 1 >= needV,
  };
}

/** Choisit voyelle / consonne au hasard en respectant le minimum de chaque type. */
export function randomKind(rack, rng = Math.random, size = RACK_SIZE, min = MIN_PER_KIND) {
  const ok = allowedKinds(rack, size, min);
  if (ok.vowel && ok.consonant) return rng() < 0.42 ? 'vowel' : 'consonant';
  return ok.vowel ? 'vowel' : 'consonant';
}

/** Le mot peut-il être formé avec les lettres du tirage (chacune utilisée au plus une fois) ? */
export function canForm(word, rack) {
  const pool = {};
  for (const ch of rack) {
    const k = normalize(ch);
    pool[k] = (pool[k] || 0) + 1;
  }
  for (const ch of normalize(word)) {
    if (!pool[ch]) return false;
    pool[ch]--;
  }
  return true;
}

/** 1 point par lettre ; les mots de 9 et 10 lettres comptent double. */
export function scoreWord(word, size = RACK_SIZE) {
  const n = normalize(word).length;
  if (n === 0) return 0;
  return n >= size - 1 ? n * 2 : n;
}
