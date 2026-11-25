-- Max 20 deltagare per rum, så att ingen kan spamma ett rum med anonyma konton.
create or replace function join_room(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  max_participants constant int := 20;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  -- Låser rummets rad så att två som går med samtidigt inte kan passera gränsen.
  select * into v_room from rooms where code = upper(trim(p_code)) and expires_at > now() for update;
  if not found then
    raise exception 'Rummet finns inte eller har gått ut';
  end if;
  if exists (select 1 from participants where room_id = v_room.id and user_id = auth.uid()) then
    return v_room.id;
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Röstningen har redan börjat i det här rummet';
  end if;
  if (select count(*) from participants where room_id = v_room.id) >= max_participants then
    raise exception 'Rummet är fullt (max % deltagare)', max_participants;
  end if;
  insert into participants (room_id, user_id) values (v_room.id, auth.uid());
  return v_room.id;
end;
$$;
