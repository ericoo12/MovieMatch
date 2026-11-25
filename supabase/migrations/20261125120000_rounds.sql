-- Flera omgångar i samma rum. Varje omgång får nya filmer som inte visats förut i rummet.

alter table rooms add column round int not null default 1;

alter table room_movies add column round int not null default 1;
alter table room_movies drop constraint room_movies_room_id_position_key;
alter table room_movies add constraint room_movies_round_position_key unique (room_id, round, position);

-- Röstningen räknar bara filmerna i rummets aktuella omgång.
create or replace function cast_vote(p_room uuid, p_tmdb_id int, p_liked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := my_participant_id(p_room);
  v_round int;
  v_total int;
  v_mine int;
begin
  if v_pid is null then
    raise exception 'Du är inte med i rummet';
  end if;
  select round into v_round from rooms where id = p_room and status = 'voting';
  if not found then
    raise exception 'Röstningen pågår inte';
  end if;
  if not exists (select 1 from room_movies where room_id = p_room and tmdb_id = p_tmdb_id and round = v_round) then
    raise exception 'Filmen hör inte till den här omgången';
  end if;

  insert into votes (room_id, participant_id, tmdb_id, liked)
    values (p_room, v_pid, p_tmdb_id, p_liked)
    on conflict (participant_id, tmdb_id) do update set liked = excluded.liked;

  select count(*) into v_total from room_movies where room_id = p_room and round = v_round;
  select count(*) into v_mine from votes v
    join room_movies m on m.room_id = v.room_id and m.tmdb_id = v.tmdb_id
    where v.participant_id = v_pid and m.round = v_round;
  if v_mine >= v_total then
    update participants set finished_voting_at = coalesce(finished_voting_at, now()) where id = v_pid;
  end if;

  if not exists (select 1 from participants where room_id = p_room and finished_voting_at is null) then
    update rooms set status = 'finished', finished_at = now() where id = p_room and status = 'voting';
  end if;
end;
$$;

-- En deltagare som tryckt Klar kan ångra sig och ändra sina tjänster innan start.
create function reopen_services(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update participants set services_done = false
    where room_id = p_room and user_id = auth.uid()
      and exists (select 1 from rooms where id = p_room and status = 'lobby');
end;
$$;
