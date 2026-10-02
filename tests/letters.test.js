import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, LetterDeck, allowedKinds, randomKind, canForm, scoreWord, isVowel, RACK_SIZE, MIN_PER_KIND,
} from '../js/letters.js';

test('normalize retire accents, ligatures et ponctuation', () => {
  assert.equal(normalize('Été'), 'ete');
  assert.equal(normalize('cœur'), 'coeur');
  assert.equal(normalize('Ça va!'), 'cava');
});

test('canForm respecte la quantité de chaque lettre', () => {
  const rack = 'MAISONTRPE'.split('');
  assert.ok(canForm('maison', rack));
  assert.ok(canForm('entrepas'.slice(0, 3), rack));
  assert.ok(!canForm('mamie', rack)); // un seul M... et un seul A
  assert.ok(!canForm('zebre', rack));
});

test('scoreWord : 1 point par lettre, double dès 9 lettres', () => {
  assert.equal(scoreWord('maison'), 6);
  assert.equal(scoreWord('abcdefghi'), 18);
  assert.equal(scoreWord('abcdefghij'), 20);
  assert.equal(scoreWord(''), 0);
});

test('LetterDeck tire des voyelles et des consonnes, même au-delà du sac', () => {
  const deck = new LetterDeck();
  for (let i = 0; i < 200; i++) {
    assert.ok(isVowel(deck.draw('vowel')));
    assert.ok(!isVowel(deck.draw('consonant')));
  }
  assert.throws(() => deck.draw('autre'));
});

test('allowedKinds force le minimum de voyelles et de consonnes', () => {
  // 8 consonnes déjà tirées : il reste 2 places -> obligatoirement 2 voyelles
  const rack = 'BCDFGHJK'.split('');
  assert.deepEqual(allowedKinds(rack), { vowel: true, consonant: false });
  const rack2 = 'AEIOUAEI'.split('');
  assert.deepEqual(allowedKinds(rack2), { vowel: false, consonant: true });
  assert.deepEqual(allowedKinds([]), { vowel: true, consonant: true });
});

test('un tirage aléatoire complet respecte toujours le minimum', () => {
  for (let n = 0; n < 500; n++) {
    const deck = new LetterDeck();
    const rack = [];
    while (rack.length < RACK_SIZE) rack.push(deck.draw(randomKind(rack)));
    const vowels = rack.filter(isVowel).length;
    assert.ok(vowels >= MIN_PER_KIND && RACK_SIZE - vowels >= MIN_PER_KIND, rack.join(''));
  }
});
