import axios from 'axios';
import { auth } from '../lib/firebase';

const API_BASE = 'https://backend-eta-ochre-46.vercel.app';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const headers = await getAuthHeaders();
  Object.assign(config.headers, headers);
  return config;
});

export interface MovieResult {
  Title: string;
  Year: string;
  Poster: string;
  Genre: string;
  Plot: string;
  tmdbRating: string;
  voteCount?: number;
  Runtime?: string;
  Country?: string;
  Type?: string;
  Episodes?: number;
  Seasons?: number;
  Director?: string;
  Actors?: string;
  Language?: string;
  imdbID?: string;
  tmdbID?: number;
  Rated?: string;
  Backdrop?: string;
  Tagline?: string;
  Status?: string;
}

export interface SearchResponse {
  success: boolean;
  movies: MovieResult[];
  count: number;
  cached: boolean;
}

export async function searchMovies(
  query: string,
  category: 'movie' | 'tv' | 'all' = 'all',
  uid?: string,
  exclude?: string[],
  aiMode: boolean = true
): Promise<SearchResponse> {
  let enrichedQuery = query;
  if (exclude?.length) {
    enrichedQuery += `. Do NOT include any of these titles I already have: ${exclude.join(', ')}`;
  }
  const res = await api.post('/api/trpc/movies.search', {
    json: { query: enrichedQuery, category, uid: uid || null, aiMode },
  });

  const raw = res.data;
  const data = Array.isArray(raw) ? raw[0] : raw;
  const payload =
    data?.result?.data?.json ??
    data?.result?.data ??
    data?.result ??
    data;
  if (payload?.movies) return payload;
  throw new Error('Unexpected API response format');
}

export default api;
