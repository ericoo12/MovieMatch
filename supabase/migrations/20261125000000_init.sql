-- MovieMatch: rum, anonyma deltagare, tjänsteval, filmer och röster.

create type room_status as enum ('lobby', 'voting', 'finished');

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  status room_status not null default 'lobby',
  movie_count int not null default 10 check (movie_count between 5 and 30),
  region text not null default 'SE',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_host boolean not null default false,
  services_done boolean not null default false,
  finished_voting_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table participant_services (
  participant_id uuid not null references participants (id) on delete cascade,
  provider_id int not null,
  primary key (participant_id, provider_id)
);

create table room_movies (
  room_id uuid not null references rooms (id) on delete cascade,
  position int not null,
  tmdb_id int not null,
  title text not null,
  poster_path text,
  genres text[] not null default '{}',
  -- Endast de tjänster i gruppen som filmen finns på: [{id, name, logo_path}]
  providers jsonb not null default '[]',
  popularity real not null default 0,
  release_year int,
  primary key (room_id, tmdb_id),
  unique (room_id, position)
);

create table votes (
  room_id uuid not null references rooms (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  tmdb_id int not null,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (participant_id, tmdb_id),
  foreign key (room_id, tmdb_id) references room_movies (room_id, tmdb_id) on delete cascade
);

create index on participants (room_id);
create index on votes (room_id);

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för behörigheter (security definer undviker RLS-rekursion)
-- ---------------------------------------------------------------------------

create function is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from participants where room_id = p_room and user_id = auth.uid());
$$;

create function my_participant_id(p_room uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from participants where room_id = p_room and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: bara deltagare läser rummet, skrivningar går via RPC
-- ---------------------------------------------------------------------------

alter table rooms enable row level security;
alter table participants enable row level security;
alter table participant_services enable row level security;
alter table room_movies enable row level security;
alter table votes enable row level security;

create policy "deltagare läser rummet" on rooms
  for select using (is_member(id));

create policy "deltagare läser deltagarlistan" on participants
  for select using (is_member(room_id));

create policy "deltagare läser egna tjänster" on participant_services
  for select using (participant_id in (select id from participants where user_id = auth.uid()));

create policy "deltagare läser rummets filmer" on room_movies
  for select using (is_member(room_id));

-- Egna röster syns alltid, andras först när rummet är klart.
create policy "röster syns efter avslut" on votes
  for select using (
    participant_id = my_participant_id(room_id)
    or (is_member(room_id) and exists (select 1 from rooms r where r.id = room_id and r.status = 'finished'))
  );

-- ---------------------------------------------------------------------------
-- RPC-funktioner som klienten anropar
-- ---------------------------------------------------------------------------

-- Kod utan förväxlingsbara tecken (0/O, 1/I/L).
create function new_room_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = result);
  end loop;
  return result;
end;
$$;

create function create_room() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  insert into rooms (code, host_id) values (new_room_code(), auth.uid()) returning * into v_room;
  insert into participants (room_id, user_id, is_host) values (v_room.id, auth.uid(), true);
  return v_room.code;
end;
$$;

create function join_room(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  select * into v_room from rooms where code = upper(trim(p_code)) and expires_at > now();
  if not found then
    raise exception 'Rummet finns inte eller har gått ut';
  end if;
  if exists (select 1 from participants where room_id = v_room.id and user_id = auth.uid()) then
    return v_room.id;
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Röstningen har redan börjat i det här rummet';
  end if;
  insert into participants (room_id, user_id) values (v_room.id, auth.uid());
  return v_room.id;
end;
$$;

create function set_services(p_room uuid, p_providers int[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := my_participant_id(p_room);
begin
  if v_pid is null then
    raise exception 'Du är inte med i rummet';
  end if;
  if (select status from rooms where id = p_room) <> 'lobby' then
    raise exception 'Röstningen har redan börjat';
  end if;
  if coalesce(array_length(p_providers, 1), 0) = 0 then
    raise exception 'Välj minst en tjänst';
  end if;
  delete from participant_services where participant_id = v_pid;
  insert into participant_services (participant_id, provider_id)
    select v_pid, unnest(p_providers) on conflict do nothing;
  update participants set services_done = true where id = v_pid;
end;
$$;

create function set_movie_count(p_room uuid, p_count int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set movie_count = p_count
    where id = p_room and host_id = auth.uid() and status = 'lobby';
  if not found then
    raise exception 'Bara rumsledaren kan ändra antal filmer innan start';
  end if;
end;
$$;

-- Sparar en röst. När alla har röstat på alla filmer blir rummet klart.
create function cast_vote(p_room uuid, p_tmdb_id int, p_liked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := my_participant_id(p_room);
  v_total int;
begin
  if v_pid is null then
    raise exception 'Du är inte med i rummet';
  end if;
  if (select status from rooms where id = p_room) <> 'voting' then
    raise exception 'Röstningen pågår inte';
  end if;

  insert into votes (room_id, participant_id, tmdb_id, liked)
    values (p_room, v_pid, p_tmdb_id, p_liked)
    on conflict (participant_id, tmdb_id) do update set liked = excluded.liked;

  select count(*) into v_total from room_movies where room_id = p_room;
  if (select count(*) from votes where participant_id = v_pid) >= v_total then
    update participants set finished_voting_at = coalesce(finished_voting_at, now()) where id = v_pid;
  end if;

  if not exists (select 1 from participants where room_id = p_room and finished_voting_at is null) then
    update rooms set status = 'finished', finished_at = now() where id = p_room and status = 'voting';
  end if;
end;
$$;

-- Rumsledaren kan avsluta i förtid, t.ex. om någon har lämnat.
create function finish_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'finished', finished_at = now()
    where id = p_room and host_id = auth.uid() and status = 'voting';
  if not found then
    raise exception 'Bara rumsledaren kan avsluta röstningen';
  end if;
end;
$$;

-- Städar bort utgångna rum. Schemalägg t.ex. med pg_cron:
-- select cron.schedule('delete-expired-rooms', '0 * * * *', 'select delete_expired_rooms()');
create function delete_expired_rooms() returns void
language sql security definer set search_path = public as $$
  delete from rooms where expires_at < now();
$$;

revoke execute on function delete_expired_rooms() from public, anon, authenticated;
revoke execute on function new_room_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtid: klienterna lyssnar på rummets status och deltagarlistan
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table rooms, participants;
