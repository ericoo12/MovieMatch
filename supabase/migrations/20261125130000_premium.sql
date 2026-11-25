-- Free och Premium. Betalning är inte på riktigt: uppgraderingen är ett testläge för kursen.

create type plan as enum ('free', 'premium');

-- En profil per användare (anonym eller med konto).
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan plan not null default 'free',
  premium_since timestamptz,
  -- Premium: sparade streamingtjänster som fylls i automatiskt i nya rum.
  saved_provider_ids int[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Ett rum skapat av en premiumanvändare är reklamfritt för alla deltagare.
alter table rooms add column is_premium boolean not null default false;

-- Personliga filmlistor (Premium): favoriter, watchlist och sedda filmer.
create type movie_list as enum ('favorite', 'watchlist', 'seen');

create table saved_movies (
  user_id uuid not null references auth.users (id) on delete cascade,
  list movie_list not null,
  tmdb_id int not null,
  -- Titel, affisch, genrer och tjänster sparas så att listan kan visas utan TMDB-anrop.
  movie jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, list, tmdb_id)
);

-- Permanenta filmgrupper (Premium).
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Gruppens gemensamma listor: matchningar, sedda filmer och watchlist.
create type group_list as enum ('match', 'seen', 'watchlist');

create table group_movies (
  group_id uuid not null references groups (id) on delete cascade,
  list group_list not null,
  tmdb_id int not null,
  movie jsonb not null,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, list, tmdb_id)
);

-- Ett rum kan startas från en grupp. Matchningarna sparas då i gruppen.
alter table rooms add column group_id uuid references groups (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner
-- ---------------------------------------------------------------------------

create function is_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and plan = 'premium');
$$;

create function is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table saved_movies enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_movies enable row level security;

create policy "egen profil" on profiles for select using (user_id = auth.uid());

create policy "egna filmer läses" on saved_movies for select using (user_id = auth.uid());
create policy "egna filmer läggs till" on saved_movies for insert with check (user_id = auth.uid() and is_premium());
create policy "egna filmer tas bort" on saved_movies for delete using (user_id = auth.uid());

create policy "medlemmar läser gruppen" on groups for select using (is_group_member(id));
create policy "medlemmar läser medlemmar" on group_members for select using (is_group_member(group_id));
create policy "medlemmar läser gruppens filmer" on group_movies for select using (is_group_member(group_id));
create policy "medlemmar lägger till filmer" on group_movies
  for insert with check (is_group_member(group_id) and added_by = auth.uid());
create policy "medlemmar tar bort filmer" on group_movies for delete using (is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- RPC-funktioner
-- ---------------------------------------------------------------------------

-- Hämtar (och skapar vid behov) den inloggades profil.
create function my_profile() returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  insert into profiles (user_id) values (auth.uid()) on conflict do nothing;
  select * into v from profiles where user_id = auth.uid();
  return v;
end;
$$;

-- TESTLÄGE: ingen betalning. I en riktig produkt skulle en betalleverantör anropa detta.
create function set_plan(p_plan plan) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
begin
  perform my_profile();
  update profiles
    set plan = p_plan,
        premium_since = case when p_plan = 'premium' then coalesce(premium_since, now()) else null end
    where user_id = auth.uid()
    returning * into v;
  return v;
end;
$$;

create function save_my_providers(p_providers int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_premium() then
    raise exception 'Sparade tjänster ingår i Premium';
  end if;
  update profiles set saved_provider_ids = coalesce(p_providers, '{}') where user_id = auth.uid();
end;
$$;

-- Den gamla versionen utan parametrar ersätts (annars blir anropet tvetydigt).
drop function create_room();

-- Rum: skapas som premiumrum om rumsledaren har Premium, och kan kopplas till en grupp.
create or replace function create_room(p_group uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  if p_group is not null and not is_group_member(p_group) then
    raise exception 'Du är inte med i gruppen';
  end if;
  insert into rooms (code, host_id, is_premium, group_id)
    values (new_room_code(), auth.uid(), is_premium(), p_group)
    returning * into v_room;
  insert into participants (room_id, user_id, is_host) values (v_room.id, auth.uid(), true);
  return v_room.code;
end;
$$;

-- Grupper
create function create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_premium() then
    raise exception 'Grupper ingår i Premium';
  end if;
  insert into groups (name, code, owner_id) values (trim(p_name), new_room_code(), auth.uid()) returning id into v_id;
  insert into group_members (group_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

-- Alla med koden kan gå med i en grupp. Det är gruppens ägare som behöver Premium.
create function join_group(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  select id into v_id from groups where code = upper(trim(p_code));
  if v_id is null then
    raise exception 'Gruppen finns inte';
  end if;
  if (select count(*) from group_members where group_id = v_id) >= 20 then
    raise exception 'Gruppen är full (max 20 medlemmar)';
  end if;
  insert into group_members (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end;
$$;

create function leave_group(p_group uuid) returns void
language sql security definer set search_path = public as $$
  delete from group_members where group_id = p_group and user_id = auth.uid();
$$;

-- Sparar rummets enhälliga matchningar i gruppen. Kan anropas flera gånger utan dubbletter.
create function save_group_matches(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  v_count int;
begin
  select * into v_room from rooms where id = p_room;
  if v_room.group_id is null or v_room.status <> 'finished' or not is_member(p_room) then
    return 0;
  end if;
  with voters as (
    select id from participants where room_id = p_room and finished_voting_at is not null
  ), likes as (
    select v.tmdb_id, count(*) as n from votes v
      join voters on voters.id = v.participant_id
      where v.room_id = p_room and v.liked
      group by v.tmdb_id
  ), inserted as (
    insert into group_movies (group_id, list, tmdb_id, movie, added_by)
      select v_room.group_id, 'match', m.tmdb_id,
             jsonb_build_object('title', m.title, 'poster_path', m.poster_path, 'genres', m.genres,
                                'providers', m.providers, 'release_year', m.release_year),
             auth.uid()
        from room_movies m join likes l on l.tmdb_id = m.tmdb_id
        where m.room_id = p_room and m.round = v_room.round
          and l.n = (select count(*) from voters) and l.n > 0
      on conflict do nothing
      returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- Senaste aktiva rum i gruppen, så att medlemmar kan hoppa in från gruppsidan.
create function group_active_room(p_group uuid) returns text
language sql stable security definer set search_path = public as $$
  select code from rooms
    where group_id = p_group and status <> 'finished' and expires_at > now() and is_group_member(p_group)
    order by created_at desc limit 1;
$$;

alter publication supabase_realtime add table group_movies;
