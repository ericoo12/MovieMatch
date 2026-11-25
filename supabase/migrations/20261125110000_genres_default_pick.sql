-- Teamets önskemål: 20 filmer som standard, genrefilter och gemensam slumpvald film.

alter table rooms alter column movie_count set default 20;

-- TMDB-genre-id:n som rumsledaren valt. Tom lista = alla genrer.
alter table rooms add column genre_ids int[] not null default '{}';

-- Filmen som slumpades fram bland matcherna. Syns för alla via Realtime.
alter table rooms add column picked_tmdb_id int;

create function set_genres(p_room uuid, p_genre_ids int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set genre_ids = coalesce(p_genre_ids, '{}')
    where id = p_room and host_id = auth.uid() and status = 'lobby';
  if not found then
    raise exception 'Bara rumsledaren kan välja genrer innan start';
  end if;
end;
$$;

-- Vilken deltagare som helst kan slumpa fram en film bland rummets filmer när röstningen är klar.
-- Klienten väljer bland matcherna; servern kontrollerar att filmen hör till rummet.
create function pick_movie(p_room uuid, p_tmdb_id int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_room) then
    raise exception 'Du är inte med i rummet';
  end if;
  if not exists (select 1 from room_movies where room_id = p_room and tmdb_id = p_tmdb_id) then
    raise exception 'Filmen finns inte i rummet';
  end if;
  update rooms set picked_tmdb_id = p_tmdb_id where id = p_room and status = 'finished';
  if not found then
    raise exception 'Röstningen är inte klar';
  end if;
end;
$$;
