const GENRE_MAP: Record<string, { text: string; bg: string; border: string }> = {
  Drama:       { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)' },
  Comedy:      { text: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  Horror:      { text: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' },
  Action:      { text: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  Thriller:    { text: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  Romance:     { text: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)' },
  'Sci-Fi':    { text: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.3)' },
  Fantasy:     { text: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  Animation:   { text: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.3)' },
  Documentary: { text: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.3)' },
  Mystery:     { text: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  Crime:       { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  Adventure:   { text: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
  Family:      { text: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.3)' },
  Music:       { text: '#e879f9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.3)' },
  War:         { text: '#a8a29e', bg: 'rgba(168,162,158,0.12)', border: 'rgba(168,162,158,0.3)' },
  History:     { text: '#d6b06b', bg: 'rgba(214,176,107,0.12)', border: 'rgba(214,176,107,0.3)' },
  Western:     { text: '#d97706', bg: 'rgba(217,119,6,0.12)',   border: 'rgba(217,119,6,0.3)' },
  Sport:       { text: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)' },
  Biography:   { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
};

const DEFAULT = { text: '#ff6b6b', bg: 'rgba(229,9,20,0.12)', border: 'rgba(229,9,20,0.3)' };

export function getGenreColor(genre: string) {
  return GENRE_MAP[genre] || DEFAULT;
}
