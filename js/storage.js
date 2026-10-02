// Accès sécurisé à localStorage (peut être indisponible en navigation privée).

const KEY = 'chiffres-et-lettres:v1';

const DEFAULTS = {
  settings: { letterTime: 30, numberTime: 60, sound: true, theme: 'auto' },
  stats: { bestSeries: 0, seriesPlayed: 0, bestWord: '', bestWordPoints: 0 },
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
      stats: { ...DEFAULTS.stats, ...(raw.stats || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let data = read();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignoré */
  }
}

export const store = {
  get settings() { return data.settings; },
  get stats() { return data.stats; },
  updateSettings(patch) { Object.assign(data.settings, patch); persist(); },
  updateStats(patch) { Object.assign(data.stats, patch); persist(); },
  reset() { data = structuredClone(DEFAULTS); persist(); },
};
