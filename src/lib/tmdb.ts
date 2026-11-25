const IMAGE_BASE = 'https://image.tmdb.org/t/p'

export function posterUrl(path: string | null, size: 'w342' | 'w500' = 'w500'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}

export function logoUrl(path: string | null): string | null {
  return path ? `${IMAGE_BASE}/w92${path}` : null
}
