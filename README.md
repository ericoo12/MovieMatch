# MovieMatch

Mobilanpassad webbapp där en grupp väljer film tillsammans genom att swipa ja eller nej på filmförslag från gruppens streamingtjänster. Kursprojekt i TDDE02.

**Teknik:** React + Vite + TypeScript, Tailwind CSS, Motion (swipe), Supabase (Postgres, anonym inloggning, Realtime, Edge Functions), TMDB API. Frontend hostas på Vercel.

## Så hänger det ihop

```
src/
  pages/        Home (skapa/gå med), RoomPage (väljer skärm efter rummets status), About
  components/   Lobby, ServicePicker, Voting, MovieCard, Results
  lib/          Supabase-klient, API-anrop, useRoom (realtid), resultatlogik + tester
supabase/
  migrations/   Tabeller, Row Level Security och databasfunktioner (create_room, join_room, cast_vote …)
  functions/    providers (svenska tjänster), start-room (väljer N filmer från TMDB)
```

Ett rum går från `lobby` → `voting` → `finished`. Rumsledaren startar röstningen, och rummet blir `finished` när alla röstat på alla filmer eller när rumsledaren avslutar. Reglerna för match och topplista finns i `src/lib/results.ts`.

## Kom igång

Krav: Node 22, ett [Supabase](https://supabase.com)-konto och en [TMDB](https://www.themoviedb.org/settings/api)-nyckel.

1. Installera paket: `npm install`
2. Skapa ett Supabase-projekt (region EU). Under **Authentication → Sign In / Providers**, slå på **Allow anonymous sign-ins**.
3. Installera [Supabase CLI](https://supabase.com/docs/guides/cli) och koppla projektet:
   ```
   npx supabase login
   npx supabase link --project-ref <ditt-project-ref>
   npx supabase db push
   npx supabase secrets set TMDB_API_KEY=<din TMDB API Read Access Token>
   npx supabase functions deploy providers --no-verify-jwt
   npx supabase functions deploy start-room
   npx supabase functions deploy solo-movies
   ```
4. Kopiera `.env.example` till `.env.local` och fyll i URL och anon key från **Project Settings → API**.
5. Starta: `npm run dev`. Testa på mobilen med `npm run dev -- --host` på samma wifi.

## Free och Premium

Prissidan finns på `/premium`. Uppgraderingen är ett **testläge** utan betalning (`set_plan` i databasen), och kan stängas av igen under Profil. Annonser i Free är platshållare (`AdSlot`).

| Premium | Var |
| --- | --- |
| Permanenta grupper, sparade matchningar, sedda filmer, gemensam watchlist | `/grupper` |
| Solo Swipe | `/solo` |
| Favoriter, watchlist, personlig historik, sparade tjänster | `/profil` |
| Reklamfritt, även för vänner i ditt rum | Rum skapade av Premium (`rooms.is_premium`) |

Konto med e-post och lösenord skapas under Profil. Slå av **Confirm email** under Authentication → Sign In / Providers → Email i Supabase, annars krävs en bekräftelselänk via e-post.

## Kommandon

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Utvecklingsserver |
| `npm test` | Kör Vitest-testerna |
| `npm run lint` | Lint med oxlint |
| `npm run build` | Typkontroll och produktionsbygge |

## Deploy

Koppla repot i Vercel, lägg till `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` som miljövariabler. `vercel.json` gör att länkar som `/r/K7PX2M` fungerar.

Städa bort utgångna rum genom att schemalägga `delete_expired_rooms()` med pg_cron i Supabase (se kommentar i migrationen).

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Streamingdata kommer från JustWatch via TMDB.
