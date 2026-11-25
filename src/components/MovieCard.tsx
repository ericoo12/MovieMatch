import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { posterUrl } from '../lib/tmdb'
import type { MovieInfo } from '../lib/types'
import ProviderBadges from './ProviderBadges'

const SWIPE_DISTANCE = 110

type Props = {
  movie: MovieInfo
  onVote: (liked: boolean) => void
}

export default function MovieCard({ movie, onVote }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  const yesOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1])
  const noOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0])
  const poster = posterUrl(movie.poster_path)

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > 600) onVote(true)
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -600) onVote(false)
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-3xl bg-slate-800 shadow-2xl select-none active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() >= 0 ? 400 : -400, opacity: 0, transition: { duration: 0.25 } }}
    >
      {poster ? (
        <img src={poster} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-2xl font-bold">{movie.title}</div>
      )}

      <motion.span
        style={{ opacity: yesOpacity }}
        className="absolute top-6 left-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black text-emerald-400"
      >
        JA
      </motion.span>
      <motion.span
        style={{ opacity: noOpacity }}
        className="absolute top-6 right-6 rotate-12 rounded-lg border-4 border-red-400 px-3 py-1 text-2xl font-black text-red-400"
      >
        NEJ
      </motion.span>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-16">
        <h2 className="text-2xl leading-tight font-bold">
          {movie.title}
          {movie.release_year && (
            <span className="ml-2 text-base font-normal text-slate-300">{movie.release_year}</span>
          )}
        </h2>
        {movie.genres.length > 0 && <p className="text-sm text-slate-300">{movie.genres.join(' · ')}</p>}
        <ProviderBadges providers={movie.providers} />
      </div>
    </motion.div>
  )
}
