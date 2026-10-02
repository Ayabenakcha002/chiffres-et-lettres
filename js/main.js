// Interface du jeu : menu, manches de lettres et de chiffres, partie complète.

import { Dictionary } from './dictionary.js';
import * as L from './letters.js';
import * as N from './numbers.js';
import { sound } from './sound.js';
import { store } from './storage.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined));
  return node;
}

/* ------------------------------------------------------------------ */
/* Thème, son, notifications                                           */
/* ------------------------------------------------------------------ */

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const pref = store.settings.theme;
  const root = document.documentElement;
  root.dataset.theme = pref;
  root.classList.toggle('auto-dark', pref === 'auto' && darkQuery.matches);
  const dark = pref === 'dark' || (pref === 'auto' && darkQuery.matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#0d2326' : '#eef3ef');
}

function applySound() {
  sound.enabled = store.settings.sound;
  $('#btn-sound').setAttribute('aria-pressed', String(sound.enabled));
}

let toastTimer;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ */
/* Minuteur                                                            */
/* ------------------------------------------------------------------ */

const RING = 2 * Math.PI * 45;

class Timer {
  constructor(root) {
    this.root = root;
    root.innerHTML =
      `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="45"/>` +
      `<circle class="fg" cx="50" cy="50" r="45" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>` +
      `<span class="t">--</span>`;
    this.fg = $('.fg', root);
    this.label = $('.t', root);
    this.interval = null;
  }

  show(seconds) {
    this.root.classList.remove('urgent');
    this.fg.style.strokeDashoffset = 0;
    this.label.textContent = seconds;
  }

  start(seconds, onEnd) {
    this.stop();
    const end = performance.now() + seconds * 1000;
    let lastShown = -1;
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      const secs = Math.ceil(left / 1000);
      this.fg.style.strokeDashoffset = RING * (1 - left / (seconds * 1000));
      if (secs !== lastShown) {
        lastShown = secs;
        this.label.textContent = secs;
        const urgent = secs <= 5 && secs > 0;
        this.root.classList.toggle('urgent', urgent);
        if (urgent) sound.tick();
      }
      if (left <= 0) {
        this.stop();
        onEnd();
      }
    };
    this.interval = setInterval(tick, 100);
    tick();
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }
}

/* ------------------------------------------------------------------ */
/* État global                                                         */
/* ------------------------------------------------------------------ */

let dict = null;
const views = ['menu', 'letters', 'numbers', 'final'];
let timerL;
let timerN;

const SERIES = ['letters', 'letters', 'numbers', 'letters', 'letters', 'numbers'];

/** `session` : partie en cours (série de manches ou manche libre). */
let session = null;

function newSession(rounds) {
  return { rounds, index: 0, player: 0, machine: 0, log: [] };
}

function showView(name) {
  for (const v of views) $(`#view-${v}`).hidden = v !== name;
  window.scrollTo({ top: 0 });
}

function stopTimers() {
  timerL?.stop();
  timerN?.stop();
}

function goMenu() {
  stopTimers();
  session = null;
  letters.phase = 'idle';
  numbers.phase = 'idle';
  numbers.roundToken++;
  renderStats();
  showView('menu');
}

function renderStats() {
  const s = store.stats;
  const parts = [];
  if (s.seriesPlayed) parts.push(`Parties complètes jouées : ${s.seriesPlayed}`);
  if (s.bestSeries) parts.push(`Meilleur score : ${s.bestSeries} pts`);
  if (s.bestWord) parts.push(`Meilleur mot : ${s.bestWord} (${s.bestWordPoints} pts)`);
  $('#stats-line').textContent = parts.join(' · ');
}

function updateScores() {
  for (const p of ['l', 'n']) {
    $(`#${p}-score`).textContent = session.player;
    $(`#${p}-machine`).textContent = session.machine;
  }
}

function roundLabel() {
  return session.rounds.length > 1
    ? `Manche ${session.index + 1} / ${session.rounds.length}`
    : 'Manche libre';
}

function startRound() {
  const kind = session.rounds[session.index];
  updateScores();
  if (kind === 'letters') startLetters();
  else startNumbers();
}

function resultButtons(container) {
  const last = session.index >= session.rounds.length - 1;
  const single = session.rounds.length === 1;
  const next = h('button', {
        class: 'btn btn-primary btn-next', type: 'button',
        onclick: () => {
          if (single) startRound();
          else if (last) endSeries();
          else { session.index++; startRound(); }
        },
      }, single ? 'Nouvelle manche' : last ? 'Voir le résultat' : 'Manche suivante');
  container.append(
    h('div', { class: 'actions' }, next,
      single ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: goMenu }, 'Menu') : null),
  );
  return next;
}

function endSeries() {
  stopTimers();
  const { player, machine, log } = session;
  const s = store.stats;
  store.updateStats({
    seriesPlayed: s.seriesPlayed + 1,
    bestSeries: Math.max(s.bestSeries, player),
  });
  const won = player > machine;
  const draw = player === machine;
  $('#f-title').textContent = won ? 'Bravo, tu as gagné !' : draw ? 'Égalité parfaite' : "L'ordinateur l'emporte";
  $('#f-player').textContent = player;
  $('#f-machine').textContent = machine;
  const list = $('#f-breakdown');
  list.replaceChildren(...log.map((e, i) => h('li', {},
    h('span', {}, `${i + 1}. ${e.label}`),
    h('span', {}, `${e.player} – ${e.machine}`),
  )));
  showView('final');
  if (won) sound.fanfare();
}

/* ------------------------------------------------------------------ */
/* Manche de lettres                                                   */
/* ------------------------------------------------------------------ */

const letters = { phase: 'idle', deck: null, rack: [], entry: [], nextId: 0 };

function renderRack() {
  const box = $('#l-rack');
  const tiles = [];
  for (let i = 0; i < L.RACK_SIZE; i++) {
    const item = letters.rack[i];
    if (!item) { tiles.push(h('div', { class: 'tile empty', 'aria-hidden': 'true' })); continue; }
    const used = letters.entry.includes(item.id);
    const tile = h('button', {
      class: 'tile' + (item.fresh ? ' new' : ''), type: 'button', 'data-id': item.id,
      'aria-label': `Lettre ${item.ch}`,
      onclick: () => addLetter(item.id),
    }, item.ch);
    item.fresh = false;
    tile.disabled = letters.phase !== 'play' || used;
    tiles.push(tile);
  }
  box.replaceChildren(...tiles);
}

function currentWord() {
  return letters.entry.map((id) => letters.rack.find((r) => r.id === id).ch).join('');
}

function renderWord(state = '') {
  const box = $('#l-word');
  box.className = 'word' + (state ? ` ${state}` : '');
  if (!letters.entry.length) {
    box.replaceChildren(h('span', { class: 'word-placeholder' }, 'Clique sur les lettres ou tape ton mot'));
    return;
  }
  box.replaceChildren(...letters.entry.map((id, pos) => {
    const item = letters.rack.find((r) => r.id === id);
    return h('button', {
      class: 'tile', type: 'button', 'aria-label': `Retirer ${item.ch}`,
      disabled: letters.phase === 'play' ? null : 'disabled',
      onclick: () => removeLetter(pos),
    }, item.ch);
  }));
}

function addLetter(id) {
  if (letters.phase !== 'play' || letters.entry.includes(id)) return;
  letters.entry.push(id);
  sound.click();
  renderRack();
  renderWord();
}

function removeLetter(pos) {
  if (letters.phase !== 'play') return;
  letters.entry.splice(pos, 1);
  sound.click();
  renderRack();
  renderWord();
}

function typeLetter(ch) {
  const target = L.normalize(ch);
  if (!target) return;
  const match = letters.rack.find((r) => L.normalize(r.ch) === target && !letters.entry.includes(r.id));
  if (match) addLetter(match.id);
  else { sound.fail(); toast(`Plus de « ${ch.toUpperCase()} » disponible`); }
}

function startLetters() {
  Object.assign(letters, { phase: 'draw', deck: new L.LetterDeck(), rack: [], entry: [], nextId: 0 });
  showView('letters');
  $('#l-round').textContent = roundLabel();
  $('#l-hint').textContent = 'Choisis 10 lettres : voyelles ou consonnes (minimum 2 de chaque).';
  $('#l-draw-actions').hidden = false;
  $('#l-play').hidden = true;
  $$('#l-play .actions button').forEach((b) => { b.hidden = false; });
  $('#l-result').hidden = true;
  timerL.show(store.settings.letterTime);
  renderRack();
  updateDrawButtons();
}

function updateDrawButtons() {
  const ok = L.allowedKinds(letters.rack.map((r) => r.ch));
  const drawing = letters.phase === 'draw';
  $('#l-vowel').disabled = !drawing || !ok.vowel;
  $('#l-consonant').disabled = !drawing || !ok.consonant;
  $('#l-random').disabled = !drawing;
}

function drawLetter(kind) {
  if (letters.phase !== 'draw' || letters.rack.length >= L.RACK_SIZE) return;
  const ok = L.allowedKinds(letters.rack.map((r) => r.ch));
  if (!ok[kind]) return;
  letters.rack.push({ id: letters.nextId++, ch: letters.deck.draw(kind), fresh: true });
  sound.flip();
  renderRack();
  if (letters.rack.length === L.RACK_SIZE) {
    letters.phase = 'starting';
    updateDrawButtons();
    setTimeout(beginLettersPlay, 600);
  } else {
    updateDrawButtons();
  }
}

async function drawRandomRack() {
  if (letters.phase !== 'draw') return;
  letters.phase = 'auto';
  updateDrawButtons();
  while (letters.rack.length < L.RACK_SIZE) {
    const kind = L.randomKind(letters.rack.map((r) => r.ch));
    letters.rack.push({ id: letters.nextId++, ch: letters.deck.draw(kind), fresh: true });
    sound.flip();
    renderRack();
    await wait(170);
    if (letters.phase !== 'auto') return; // abandon (retour au menu)
  }
  letters.phase = 'starting';
  setTimeout(beginLettersPlay, 500);
}

function beginLettersPlay() {
  if (letters.phase !== 'starting') return;
  letters.phase = 'play';
  $('#l-draw-actions').hidden = true;
  $('#l-play').hidden = false;
  $('#l-hint').textContent = 'Forme le mot le plus long possible !';
  renderRack();
  renderWord();
  timerL.start(store.settings.letterTime, () => submitLetters(true));
}

function submitLetters(timeout = false) {
  if (letters.phase !== 'play') return;
  letters.phase = 'result';
  timerL.stop();

  const word = currentWord();
  const norm = L.normalize(word);
  const rackChars = letters.rack.map((r) => r.ch);
  const inDict = norm.length >= 2 && dict.has(norm);
  const points = inDict ? L.scoreWord(norm) : 0;
  const best = dict.longest(rackChars, 5);
  const machinePoints = best.length ? best[0].points : 0;

  session.player += points;
  session.machine += machinePoints;
  session.log.push({ label: 'Lettres', player: points, machine: machinePoints });
  updateScores();

  renderRack();
  renderWord(norm ? (inDict ? 'valid' : 'invalid') : '');
  $$('#l-play .actions button').forEach((b) => { b.hidden = true; });
  $('#l-hint').textContent = timeout ? 'Temps écoulé !' : '';

  if (inDict) {
    sound.ok();
    if (points > store.stats.bestWordPoints) {
      store.updateStats({ bestWord: dict.pretty(norm), bestWordPoints: points });
    }
  } else {
    sound.fail();
  }

  const box = $('#l-result');
  box.replaceChildren(
    norm
      ? inDict
        ? h('h3', { class: 'ok' }, `« ${dict.pretty(norm)} » : +${points} point${points > 1 ? 's' : ''}`)
        : h('h3', { class: 'bad' }, `« ${word} » n'est pas dans le dictionnaire`)
      : h('h3', { class: 'bad' }, 'Aucun mot proposé'),
    h('hr'),
    h('p', { class: 'big' }, best.length
      ? `L'ordinateur propose « ${best[0].word} » (${best[0].points} pts)`
      : "L'ordinateur n'a rien trouvé"),
    best.length > 1
      ? h('ul', { class: 'chips' }, ...best.slice(1).map((b) => h('li', {}, b.word, h('small', {}, `${b.points} pts`))))
      : null,
  );
  const next = resultButtons(box);
  box.hidden = false;
  next.focus();
}

/* ------------------------------------------------------------------ */
/* Manche de chiffres                                                  */
/* ------------------------------------------------------------------ */

const numbers = {
  phase: 'idle', plates: [], target: 0, tiles: [], undoStack: [], steps: [],
  selected: null, op: null, nextId: 0, roundToken: 0,
};

function makeTile(value, large = false, derived = false) {
  return { id: numbers.nextId++, value, large, derived };
}

function bestTile() {
  return numbers.tiles.reduce((best, t) =>
    Math.abs(t.value - numbers.target) < Math.abs(best.value - numbers.target) ? t : best);
}

function renderNumbers() {
  const play = numbers.phase === 'play';
  const closest = numbers.tiles.length ? bestTile() : null;
  $('#n-tiles').replaceChildren(...numbers.tiles.map((t) => {
    const cls = ['num'];
    if (t.large) cls.push('large');
    if (t.derived) cls.push('result');
    if (numbers.selected === t.id) cls.push('selected');
    if (!play && closest && closest.id === t.id && t.value === numbers.target) cls.push('exact');
    return h('button', {
      class: cls.join(' '), type: 'button', onclick: () => pickTile(t.id),
      disabled: play ? null : 'disabled',
    }, String(t.value));
  }));
  $$('#n-play .op').forEach((b) => b.classList.toggle('active', b.dataset.op === numbers.op));
  $('#n-history').replaceChildren(...numbers.steps.map((s) => h('li', {}, N.formatStep(s))));
  $('#n-undo').disabled = !numbers.undoStack.length;
  $('#n-reset').disabled = !numbers.undoStack.length;
  if (play) {
    $('#n-hint').textContent = closest
      ? `Le plus proche : ${closest.value} (écart ${Math.abs(closest.value - numbers.target)})`
      : '';
  }
}

function startNumbers() {
  numbers.roundToken++;
  Object.assign(numbers, {
    phase: 'draw', plates: [], target: 0, tiles: [], undoStack: [], steps: [],
    selected: null, op: null, nextId: 0,
  });
  showView('numbers');
  $('#n-round').textContent = roundLabel();
  $('#n-hint').textContent = 'Combien de grands nombres (25, 50, 75, 100) veux-tu ?';
  $('#n-target').textContent = '---';
  $('#n-draw-actions').hidden = false;
  $('#n-play').hidden = true;
  $('#n-result').hidden = true;
  timerN.show(store.settings.numberTime);
  renderNumbers();
}

async function drawNumbers(choice) {
  if (numbers.phase !== 'draw') return;
  const token = numbers.roundToken;
  numbers.phase = 'drawing';
  const large = choice === 'random' ? Math.floor(Math.random() * 5) : Number(choice);
  numbers.plates = N.drawPlates(large);
  numbers.target = N.drawTarget();
  $('#n-draw-actions').hidden = true;
  $('#n-hint').textContent = '';

  // Les plaques apparaissent une à une.
  for (const v of numbers.plates) {
    numbers.tiles.push(makeTile(v, N.LARGE_PLATES.includes(v)));
    sound.flip();
    renderNumbers();
    await wait(220);
    if (token !== numbers.roundToken) return;
  }
  // Le nombre cible « tourne » avant de se fixer.
  for (let i = 0; i < 14; i++) {
    $('#n-target').textContent = N.drawTarget();
    sound.tick();
    await wait(60 + i * 8);
    if (token !== numbers.roundToken) return;
  }
  $('#n-target').textContent = numbers.target;
  sound.ok();

  numbers.phase = 'play';
  $('#n-play').hidden = false;
  renderNumbers();
  timerN.start(store.settings.numberTime, () => submitNumbers(true));
}

function pickTile(id) {
  if (numbers.phase !== 'play') return;
  sound.click();
  if (numbers.selected === null || !numbers.op) {
    numbers.selected = numbers.selected === id ? null : id;
    renderNumbers();
    return;
  }
  if (numbers.selected === id) return;
  const a = numbers.tiles.find((t) => t.id === numbers.selected);
  const b = numbers.tiles.find((t) => t.id === id);
  const result = N.apply(a.value, numbers.op, b.value);
  if (result === null) {
    sound.fail();
    toast(numbers.op === '−' ? 'Le résultat doit être positif' : numbers.op === '÷' ? 'La division doit tomber juste' : 'Opération impossible');
    numbers.selected = null;
    numbers.op = null;
    renderNumbers();
    return;
  }
  numbers.undoStack.push({
    tiles: numbers.tiles.map((t) => ({ ...t })), steps: [...numbers.steps],
  });
  numbers.steps.push({ a: a.value, op: numbers.op, b: b.value, r: result });
  numbers.tiles = [
    ...numbers.tiles.filter((t) => t.id !== a.id && t.id !== b.id),
    makeTile(result, false, true),
  ];
  numbers.selected = null;
  numbers.op = null;
  renderNumbers();
  if (result === numbers.target) {
    toast('Le compte est bon !');
    setTimeout(() => submitNumbers(false), 500);
  }
}

function setOp(op) {
  if (numbers.phase !== 'play' || numbers.selected === null) {
    if (numbers.phase === 'play') toast("Choisis d'abord un nombre");
    return;
  }
  numbers.op = numbers.op === op ? null : op;
  sound.click();
  renderNumbers();
}

function undoNumbers() {
  const prev = numbers.undoStack.pop();
  if (!prev || numbers.phase !== 'play') return;
  numbers.tiles = prev.tiles;
  numbers.steps = prev.steps;
  numbers.selected = null;
  numbers.op = null;
  renderNumbers();
}

function resetNumbers() {
  if (numbers.phase !== 'play' || !numbers.undoStack.length) return;
  const first = numbers.undoStack[0];
  numbers.undoStack = [];
  numbers.tiles = first.tiles;
  numbers.steps = [];
  numbers.selected = null;
  numbers.op = null;
  renderNumbers();
}

function submitNumbers(timeout = false) {
  if (numbers.phase !== 'play') return;
  numbers.phase = 'result';
  timerN.stop();

  const tile = bestTile();
  const diff = Math.abs(tile.value - numbers.target);
  const points = N.scoreNumbers(diff);

  // Solveur de l'ordinateur (exécuté après affichage du résultat).
  const solution = N.solve(numbers.plates, numbers.target);
  const machinePoints = N.scoreNumbers(solution.diff);

  session.player += points;
  session.machine += machinePoints;
  session.log.push({ label: 'Chiffres', player: points, machine: machinePoints });
  updateScores();

  numbers.selected = null;
  numbers.op = null;
  renderNumbers();
  $('#n-play').hidden = true;
  $('#n-hint').textContent = timeout ? 'Temps écoulé !' : '';
  if (points > 0) sound.ok(); else sound.fail();

  const box = $('#n-result');
  const title = diff === 0
    ? h('h3', { class: 'ok' }, `Le compte est bon ! +${points} points`)
    : h('h3', { class: points ? 'ok' : 'bad' }, `${tile.value} : à ${diff} de la cible, +${points} point${points > 1 ? 's' : ''}`);
  const stepsList = (steps) => steps.length
    ? h('ol', { class: 'steps' }, ...steps.map((s) => h('li', {}, N.formatStep(s))))
    : h('p', {}, 'Aucune opération nécessaire.');

  box.replaceChildren(
    title,
    h('hr'),
    h('p', { class: 'big' }, solution.diff === 0
      ? `L'ordinateur trouve le compte exact (${machinePoints} pts) :`
      : `L'ordinateur n'a pas le compte exact : il approche avec ${solution.value}, à ${solution.diff} (${machinePoints} pts) :`),
    stepsList(solution.steps),
  );
  const next = resultButtons(box);
  box.hidden = false;
  next.focus();
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */

function bindUI() {
  $('#btn-home').addEventListener('click', goMenu);
  $('#start-series').addEventListener('click', () => { session = newSession(SERIES); startRound(); });
  $('#start-letters').addEventListener('click', () => { session = newSession(['letters']); startRound(); });
  $('#start-numbers').addEventListener('click', () => { session = newSession(['numbers']); startRound(); });
  $('#f-again').addEventListener('click', () => { session = newSession(SERIES); startRound(); });
  $('#f-menu').addEventListener('click', goMenu);

  $('#btn-rules').addEventListener('click', () => $('#dlg-rules').showModal());
  $('#btn-settings').addEventListener('click', () => {
    $('#set-letter-time').value = String(store.settings.letterTime);
    $('#set-number-time').value = String(store.settings.numberTime);
    $('#dlg-settings').showModal();
  });
  $('#set-letter-time').addEventListener('change', (e) => store.updateSettings({ letterTime: Number(e.target.value) }));
  $('#set-number-time').addEventListener('change', (e) => store.updateSettings({ numberTime: Number(e.target.value) }));
  $('#set-reset').addEventListener('click', (e) => {
    e.preventDefault();
    store.updateStats({ bestSeries: 0, seriesPlayed: 0, bestWord: '', bestWordPoints: 0 });
    renderStats();
    toast('Records effacés');
  });
  $('#btn-sound').addEventListener('click', () => {
    store.updateSettings({ sound: !store.settings.sound });
    applySound();
    sound.click();
  });
  $('#btn-theme').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(store.settings.theme) + 1) % order.length];
    store.updateSettings({ theme: next });
    applyTheme();
    toast({ auto: 'Thème automatique', light: 'Thème clair', dark: 'Thème sombre' }[next]);
  });
  darkQuery.addEventListener('change', applyTheme);

  // Lettres
  $('#l-vowel').addEventListener('click', () => drawLetter('vowel'));
  $('#l-consonant').addEventListener('click', () => drawLetter('consonant'));
  $('#l-random').addEventListener('click', drawRandomRack);
  $('#l-clear').addEventListener('click', () => { letters.entry = []; renderRack(); renderWord(); });
  $('#l-shuffle').addEventListener('click', () => {
    letters.rack = L.shuffle(letters.rack);
    renderRack();
  });
  $('#l-submit').addEventListener('click', () => submitLetters(false));

  // Chiffres
  $$('#n-draw-actions [data-large]').forEach((b) =>
    b.addEventListener('click', () => drawNumbers(b.dataset.large)));
  $$('#n-play .op').forEach((b) => b.addEventListener('click', () => setOp(b.dataset.op)));
  $('#n-undo').addEventListener('click', undoNumbers);
  $('#n-reset').addEventListener('click', resetNumbers);
  $('#n-submit').addEventListener('click', () => submitNumbers(false));

  // Clavier
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (letters.phase === 'play' && !$('#view-letters').hidden) {
      if (e.key === 'Enter') { e.preventDefault(); submitLetters(false); }
      else if (e.key === 'Backspace') { e.preventDefault(); removeLetter(letters.entry.length - 1); }
      else if (e.key === 'Escape') { letters.entry = []; renderRack(); renderWord(); }
      else if (e.key.length === 1 && /\p{L}/u.test(e.key)) typeLetter(e.key);
    } else if (numbers.phase === 'play' && !$('#view-numbers').hidden) {
      const map = { '+': '+', '-': '−', '*': '×', '/': '÷' };
      if (map[e.key]) { e.preventDefault(); setOp(map[e.key]); }
      else if (e.key === 'Backspace') undoNumbers();
      else if (e.key === 'Enter') submitNumbers(false);
    }
  });
}

async function init() {
  applyTheme();
  applySound();
  timerL = new Timer($('#l-timer'));
  timerN = new Timer($('#n-timer'));
  bindUI();

  try {
    dict = await Dictionary.load('data/words.txt');
  } catch (err) {
    $('#loading').textContent = `Erreur : ${err.message}. Lance le jeu via un serveur local (npm start).`;
    return;
  }
  $('#loading').hidden = true;
  renderStats();
  showView('menu');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Pour les tests automatisés et le débogage.
  window.__game = { dict, letters, numbers };
}

init();
