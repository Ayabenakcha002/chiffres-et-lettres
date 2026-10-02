import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Dictionary } from '../js/dictionary.js';

const words = readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const dict = new Dictionary(words);

test('le dictionnaire contient des mots courants (avec ou sans accents)', () => {
  assert.ok(dict.size > 100000);
  for (const w of ['bonjour', 'maison', 'ecole', 'ÉCOLE', 'été', 'chiffres', 'lettres']) {
    assert.ok(dict.has(w), w);
  }
  assert.ok(!dict.has('zzzzqx'));
});

test('pretty restitue les accents', () => {
  assert.equal(dict.pretty('ecole'), 'école');
});

test('longest trouve les plus longs mots possibles', () => {
  const res = dict.longest('MAISONTRPE'.split(''), 5);
  assert.ok(res.length > 0);
  assert.ok(res[0].word.length >= 6);
  for (let i = 1; i < res.length; i++) {
    assert.ok(res[i - 1].word.length >= res[i].word.length);
  }
});

test('longest ne propose que des mots réalisables', () => {
  const rack = 'ETOILESRNA'.split('');
  for (const { word } of dict.longest(rack, 20)) {
    const pool = [...rack.map((c) => c.toLowerCase())];
    for (const ch of word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) {
      const i = pool.indexOf(ch);
      assert.notEqual(i, -1, `${word} utilise trop de « ${ch} »`);
      pool.splice(i, 1);
    }
  }
});
