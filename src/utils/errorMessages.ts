const ERROR_MAP: [RegExp, string][] = [
  [/429|rate.?limit|too many/i, 'Too many requests. Please wait a moment and try again.'],
  [/tmdb|themoviedb/i, 'Movie data is temporarily unavailable. Please try again.'],
  [/gemini|openai|ai.?error/i, 'AI service is temporarily unavailable. Please try again.'],
  [/network|timeout|econnrefused|fetch failed/i, 'Connection error. Check your internet and try again.'],
  [/unauthorized|403|401/i, 'Session expired. Please sign in again.'],
  [/500|internal server/i, 'Something went wrong on our end. Please try again later.'],
];

export function getFriendlyError(err: any, fallback = 'Something went wrong. Please try again.'): string {
  const raw = err?.response?.data?.message || err?.message || '';
  const status = err?.response?.status;

  if (status === 429) return ERROR_MAP[0][1];

  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(raw) || pattern.test(String(status))) return message;
  }

  return fallback;
}
