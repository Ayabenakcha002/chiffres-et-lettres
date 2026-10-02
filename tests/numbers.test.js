import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawPlates, drawTarget, apply, scoreNumbers, solve, LARGE_PLATES } from '../js/numbers.js';

test('drawPlates donne 6 plaques avec le bon nombre de grands', () => {
  for (let large = 0; large <= 4; large++) {
    const plates = drawPlates(large);
    assert.equal(plates.length, 6);
    assert.equal(plates.filter((p) => LARGE_PLATES.includes(p)).length, large);
  }
});

test('drawTarget reste entre 101 et 999', () => {
  for (let i = 0; i < 2000; i++) {
    const t = drawTarget();
    assert.ok(t >= 101 && t <= 999);
  }
});

test('apply refuse les opérations interdites', () => {
  assert.equal(apply(3, '+', 4), 7);
  assert.equal(apply(3, '−', 4), null);
  assert.equal(apply(4, '−', 4), null);
  assert.equal(apply(6, '×', 7), 42);
  assert.equal(apply(8, '÷', 4), 2);
  assert.equal(apply(7, '÷', 2), null);
  assert.equal(apply(7, '÷', 0), null);
});

test('scoreNumbers', () => {
  assert.deepEqual([0, 3, 5, 6, 10, 11].map(scoreNumbers), [10, 7, 7, 5, 5, 0]);
});

// Rejoue les étapes pour vérifier qu'elles sont valides et mènent bien au résultat annoncé.
function verify(plates, solution) {
  const pool = [...plates];
  for (const { a, op, b, r } of solution.steps) {
    const ia = pool.indexOf(a);
    assert.notEqual(ia, -1, `${a} indisponible`);
    pool.splice(ia, 1);
    const ib = pool.indexOf(b);
    assert.notEqual(ib, -1, `${b} indisponible`);
    pool.splice(ib, 1);
    assert.equal(apply(a, op, b), r);
    pool.push(r);
  }
  assert.ok(pool.includes(solution.value));
}

test('solve trouve le compte exact quand il existe', () => {
  const plates = [25, 50, 75, 100, 3, 6];
  const sol = solve(plates, 952);
  assert.equal(sol.diff, 0);
  assert.equal(sol.value, 952);
  verify(plates, sol);
});

test('solve renvoie le plus proche sinon', () => {
  const plates = [1, 1, 2, 2, 3, 3];
  const sol = solve(plates, 999);
  assert.ok(sol.diff > 0);
  assert.equal(Math.abs(sol.value - 999), sol.diff);
  verify(plates, sol);
});

test('solve reste rapide sur 30 tirages aléatoires', () => {
  const start = performance.now();
  for (let i = 0; i < 30; i++) {
    const plates = drawPlates(i % 5);
    const sol = solve(plates, drawTarget());
    verify(plates, sol);
  }
  const avg = (performance.now() - start) / 30;
  console.log(`  durée moyenne du solveur : ${avg.toFixed(0)} ms`);
  assert.ok(avg < 3000);
});
