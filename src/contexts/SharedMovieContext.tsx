import React, { createContext, useContext, useState, useCallback } from 'react';
import type { MovieResult } from '../api/client';

interface SharedMovieContextType {
  sharedMovie: MovieResult | null;
  openSharedMovie: (movie: MovieResult) => void;
  clearSharedMovie: () => void;
}

const SharedMovieContext = createContext<SharedMovieContextType>({
  sharedMovie: null,
  openSharedMovie: () => {},
  clearSharedMovie: () => {},
});

export function SharedMovieProvider({ children }: { children: React.ReactNode }) {
  const [sharedMovie, setSharedMovie] = useState<MovieResult | null>(null);
  const openSharedMovie = useCallback((movie: MovieResult) => setSharedMovie(movie), []);
  const clearSharedMovie = useCallback(() => setSharedMovie(null), []);

  return (
    <SharedMovieContext.Provider value={{ sharedMovie, openSharedMovie, clearSharedMovie }}>
      {children}
    </SharedMovieContext.Provider>
  );
}

export const useSharedMovie = () => useContext(SharedMovieContext);
