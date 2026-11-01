-- Chez nous : un seul appart, deux personnes au maximum.
-- La clé publique de l'app est visible dans le navigateur : toute la sécurité repose sur les règles RLS ci-dessous.

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index members_one_household_per_user on public.members (user_id);

create table public.shopping_items (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (char_length(quantity) <= 40),
  category text not null check (char_length(category) <= 40),
  status text not null check (status in ('needed', 'stocked')),
  updated_at timestamptz not null default now()
);
create index shopping_items_household on public.shopping_items (household_id);

create table public.tasks (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  assignee uuid,
  done_at timestamptz,
  done_by uuid,
  created_at timestamptz not null default now()
);
create index tasks_household on public.tasks (household_id);

create table public.chores (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  room text check (char_length(room) <= 40),
  every_days integer not null check (every_days between 1 and 730),
  last_done_at timestamptz,
  last_done_by uuid,
  created_at timestamptz not null default now()
);
create index chores_household on public.chores (household_id);

create table public.chore_log (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  chore_id uuid not null references public.chores on delete cascade,
  done_by uuid not null,
  done_at timestamptz not null default now()
);
create index chore_log_household on public.chore_log (household_id);
create index chore_log_chore on public.chore_log (chore_id);

create table public.devices (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  room text check (char_length(room) <= 40),
  app text not null check (app in ('google_home', 'alexa', 'autre')),
  created_at timestamptz not null default now()
);
create index devices_household on public.devices (household_id);

-- Jetons Philips Hue : seule la fonction serveur y accède, jamais le navigateur (RLS sans aucune règle).
create table public.hue_connections (
  household_id uuid primary key references public.households on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  app_key text not null,
  updated_at timestamptz not null default now()
);

create table public.hue_oauth_states (
  state text primary key,
  household_id uuid not null references public.households on delete cascade,
  created_at timestamptz not null default now()
);
create index hue_oauth_states_household on public.hue_oauth_states (household_id);

create function private.is_member(p_household uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = p_household and m.user_id = (select auth.uid())
  )
$$;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.shopping_items enable row level security;
alter table public.tasks enable row level security;
alter table public.chores enable row level security;
alter table public.chore_log enable row level security;
alter table public.devices enable row level security;
alter table public.hue_connections enable row level security;
alter table public.hue_oauth_states enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

grant select on public.households to authenticated;
create policy "lire son appart" on public.households for select to authenticated
  using ((select private.is_member(id)));

grant select on public.members to authenticated;
grant update (display_name, color) on public.members to authenticated;
create policy "lire les membres de son appart" on public.members for select to authenticated
  using ((select private.is_member(household_id)));
create policy "modifier son propre profil" on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.shopping_items, public.tasks, public.chores, public.chore_log, public.devices to authenticated;
create policy "membres de l'appart" on public.shopping_items for all to authenticated
  using ((select private.is_member(household_id))) with check ((select private.is_member(household_id)));
create policy "membres de l'appart" on public.tasks for all to authenticated
  using ((select private.is_member(household_id))) with check ((select private.is_member(household_id)));
create policy "membres de l'appart" on public.chores for all to authenticated
  using ((select private.is_member(household_id))) with check ((select private.is_member(household_id)));
create policy "membres de l'appart" on public.chore_log for all to authenticated
  using ((select private.is_member(household_id))) with check ((select private.is_member(household_id)));
create policy "membres de l'appart" on public.devices for all to authenticated
  using ((select private.is_member(household_id))) with check ((select private.is_member(household_id)));

create function private.new_invite_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
  end loop;
  return code;
end
$$;
revoke all on function private.new_invite_code() from public;

-- Le tout premier compte crée l'appart. Ensuite, on n'entre plus qu'avec le code d'invitation.
create function public.create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  lock table public.households in share row exclusive mode;
  if exists (select 1 from public.households) then
    raise exception 'HOUSEHOLD_EXISTS';
  end if;
  insert into public.households (name, invite_code)
    values (trim(p_name), private.new_invite_code())
    returning id into hid;
  insert into public.members (household_id, user_id, display_name, color)
    values (hid, uid, trim(p_display_name), '#D9482B');
  return hid;
end
$$;

create function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  select id into hid from public.households
    where invite_code = upper(trim(p_code)) for update;
  if hid is null then
    raise exception 'INVALID_CODE';
  end if;
  if exists (select 1 from public.members where household_id = hid and user_id = uid) then
    return hid;
  end if;
  if (select count(*) from public.members where household_id = hid) >= 2 then
    raise exception 'HOUSEHOLD_FULL';
  end if;
  insert into public.members (household_id, user_id, display_name, color)
    values (hid, uid, trim(p_display_name), '#0E8A7D');
  return hid;
end
$$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

alter publication supabase_realtime add table
  public.members, public.shopping_items, public.tasks, public.chores, public.chore_log, public.devices;
