import type { MovieActivity } from './firestore';

export function sortMovies(movies: MovieActivity[], sortBy: string): MovieActivity[] {
  const sorted = [...movies];
  switch (sortBy) {
    case 'date':
      return sorted.sort((a, b) => {
        const dateA = a.watchedAt || a.updatedAt || a.addedAt;
        const dateB = b.watchedAt || b.updatedAt || b.addedAt;
        if (!dateA || !dateB) return 0;
        return (dateB.toMillis?.() ?? 0) - (dateA.toMillis?.() ?? 0);
      });
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

export function filterByGenre(movies: MovieActivity[], genre: string): MovieActivity[] {
  if (genre === 'all') return movies;
  return movies.filter(m => m.genres?.some(g => g.toLowerCase() === genre.toLowerCase()));
}

export function searchByTitle(movies: MovieActivity[], q: string): MovieActivity[] {
  if (!q) return movies;
  const lower = q.toLowerCase();
  return movies.filter(m => m.title.toLowerCase().includes(lower));
}

export function getUniqueGenres(movies: MovieActivity[]): string[] {
  const set = new Set<string>();
  movies.forEach(m => m.genres?.forEach(g => set.add(g)));
  return Array.from(set).sort();
}
