// Dictionnaire français : validation des mots et recherche des plus longs mots possibles.

import { normalize, scoreWord } from './letters.js';

export class Dictionary {
  /** @param {string[]} words mots (avec accents) */
  constructor(words) {
    this.display = new Map(); // forme normalisée -> forme affichée (avec accents)
    for (const w of words) {
      const n = normalize(w);
      if (n.length >= 2 && !this.display.has(n)) this.display.set(n, w);
    }
    this.normalized = [...this.display.keys()];
  }

  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger le dictionnaire (${res.status})`);
    const text = await res.text();
    return new Dictionary(text.split('\n').map((l) => l.trim()).filter(Boolean));
  }

  get size() {
    return this.display.size;
  }

  has(word) {
    return this.display.has(normalize(word));
  }

  /** Forme correctement accentuée si elle existe, sinon le mot tel quel. */
  pretty(word) {
    return this.display.get(normalize(word)) ?? word;
  }

  /** Les `limit` plus longs mots (ordre alphabétique à longueur égale) formables avec `letters`. */
  longest(letters, limit = 5) {
    const pool = new Int8Array(26);
    for (const ch of letters) {
      const n = normalize(ch);
      if (n) pool[n.charCodeAt(0) - 97]++;
    }
    const max = letters.length;
    const found = [];
    const tmp = new Int8Array(26);
    for (const w of this.normalized) {
      if (w.length > max) continue;
      tmp.set(pool);
      let ok = true;
      for (let i = 0; i < w.length; i++) {
        if (--tmp[w.charCodeAt(i) - 97] < 0) { ok = false; break; }
      }
      if (ok) found.push(w);
    }
    found.sort((a, b) => b.length - a.length || a.localeCompare(b));
    return found.slice(0, limit).map((w) => ({
      word: this.display.get(w),
      points: scoreWord(w, max),
    }));
  }
}
