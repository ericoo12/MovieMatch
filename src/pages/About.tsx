export default function About() {
  return (
    <div className="flex flex-col gap-4 text-sm text-slate-300">
      <h1 className="text-2xl font-bold text-slate-100">Om MovieMatch</h1>
      <p>
        MovieMatch hjälper en grupp att välja film tillsammans. Alla väljer sina streamingtjänster och swipar ja eller
        nej på samma filmförslag.
      </p>
      <p>
        Appen sparar inga namn eller e-postadresser. Varje deltagare får en anonym session, och rum med röster raderas
        efter 24 timmar.
      </p>
      <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
        <img
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
          alt="TMDB"
          className="h-5"
        />
        <p className="text-xs">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
      <p className="text-xs">
        Information om var filmerna finns att streama kommer från{' '}
        <a href="https://www.justwatch.com" className="underline" target="_blank" rel="noreferrer">
          JustWatch
        </a>{' '}
        och kan vara några dagar gammal.
      </p>
    </div>
  )
}
