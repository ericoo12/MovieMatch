import type { ReactNode } from 'react'
import { posterUrl } from '../lib/tmdb'
import type { MovieInfo } from '../lib/types'
import ProviderBadges from './ProviderBadges'

/** En rad med affisch, titel, genrer och tjänster. Används i profil- och grupplistor. */
export default function MovieListItem({ movie, children }: { movie: MovieInfo; children?: ReactNode }) {
  const poster = posterUrl(movie.poster_path, 'w342')
  return (
    <li className="flex gap-3 rounded-2xl bg-slate-800 p-3">
      {poster && <img src={poster} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover" />}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="leading-tight font-semibold">
          {movie.title}
          {movie.release_year && (
            <span className="ml-1.5 text-sm font-normal text-slate-400">{movie.release_year}</span>
          )}
        </h3>
        {movie.genres.length > 0 && <p className="text-xs text-slate-400">{movie.genres.join(' · ')}</p>}
        <ProviderBadges providers={movie.providers} />
        {children}
      </div>
    </li>
  )
}
