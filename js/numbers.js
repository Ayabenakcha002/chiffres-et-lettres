// Logique du jeu « Le Compte est bon » : tirage, opérations, solveur.

export const SMALL_PLATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const LARGE_PLATES = [25, 50, 75, 100];
export const PLATE_COUNT = 6;
export const OPS = ['+', '−', '×', '÷'];

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tire `largeCount` grands nombres (0 à 4) et complète avec des petits jusqu'à 6 plaques. */
export function drawPlates(largeCount, rng = Math.random) {
  const n = Math.max(0, Math.min(4, Math.round(largeCount)));
  const large = shuffle(LARGE_PLATES, rng).slice(0, n);
  const small = shuffle(SMALL_PLATES, rng).slice(0, PLATE_COUNT - n);
  return [...large, ...small];
}

/** Nombre cible entre 101 et 999. */
export function drawTarget(rng = Math.random) {
  return 101 + Math.floor(rng() * 899);
}

/** Applique une opération ; renvoie null si elle n'est pas permise (négatif, non entier, zéro). */
export function apply(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '−':
    case '-': return a > b ? a - b : null;
    case '×':
    case '*':
    case 'x': return a * b;
    case '÷':
    case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

/** 10 points si exact, 7 à ±5, 5 à ±10, sinon 0. */
export function scoreNumbers(diff) {
  if (diff === 0) return 10;
  if (diff <= 5) return 7;
  if (diff <= 10) return 5;
  return 0;
}

export const formatStep = (s) => `${s.a} ${s.op} ${s.b} = ${s.r}`;

/**
 * Cherche le résultat le plus proche de `target` (recherche exhaustive avec mémoïsation).
 * Renvoie { value, diff, steps: [{a, op, b, r}] } avec uniquement les étapes utiles.
 */
export function solve(plates, target) {
  let best = { value: null, diff: Infinity, steps: [] };
  const seen = new Set();
  const path = [];

  const closure = (stepIndex) => {
    const needed = new Set();
    const visit = (i) => {
      if (i < 0 || needed.has(i)) return;
      needed.add(i);
      visit(path[i].deps[0]);
      visit(path[i].deps[1]);
    };
    visit(stepIndex);
    return [...needed].sort((x, y) => x - y).map((i) => {
      const { a, op, b, r } = path[i];
      return { a, op, b, r };
    });
  };

  const consider = (items) => {
    for (const it of items) {
      const d = Math.abs(it.v - target);
      if (d > best.diff) continue;
      if (d === best.diff && it.step < 0 && best.steps.length === 0) continue;
      const steps = closure(it.step);
      if (d < best.diff || steps.length < best.steps.length) {
        best = { value: it.v, diff: d, steps };
      }
    }
  };

  const dfs = (items) => {
    consider(items);
    if (best.diff === 0 || items.length < 2) return;
    const key = items.map((i) => i.v).sort((x, y) => x - y).join(',');
    if (seen.has(key)) return;
    seen.add(key);

    for (let i = 0; i < items.length - 1; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [hi, lo] = items[i].v >= items[j].v ? [items[i], items[j]] : [items[j], items[i]];
        const rest = items.filter((_, k) => k !== i && k !== j);
        const tries = [['+', hi.v + lo.v]];
        if (hi.v !== lo.v) tries.push(['−', hi.v - lo.v]);
        if (lo.v !== 1) {
          tries.push(['×', hi.v * lo.v]);
          if (hi.v % lo.v === 0) tries.push(['÷', hi.v / lo.v]);
        }
        for (const [op, r] of tries) {
          path.push({ a: hi.v, op, b: lo.v, r, deps: [hi.step, lo.step] });
          dfs([...rest, { v: r, step: path.length - 1 }]);
          path.pop();
          if (best.diff === 0) return;
        }
      }
    }
  };

  dfs(plates.map((v) => ({ v, step: -1 })));
  return best;
}
