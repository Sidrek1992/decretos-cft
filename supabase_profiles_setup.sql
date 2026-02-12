-- Ejecutar una vez en Supabase SQL Editor
create table if not exists public.profiles (
  email text primary key,
  role text not null default 'reader' check (role in ('admin', 'editor', 'reader')),
  first_name text not null default '',
  last_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario autenticado puede leer perfiles (necesario para resolver roles)
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

-- Cada usuario puede insertar/actualizar solo su propio perfil
drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can upsert own profile"
on public.profiles
for insert
to authenticated
with check (auth.jwt() ->> 'email' = email);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.jwt() ->> 'email' = email)
with check (auth.jwt() ->> 'email' = email);

-- Admins autorizados pueden gestionar todos los perfiles
drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
on public.profiles
for all
to authenticated
using (lower(auth.jwt() ->> 'email') in (
  'mguzmanahumada@gmail.com',
  'a.gestiondepersonas@cftestatalaricayparinacota.cl',
  'gestiondepersonas@cftestatalaricayparinacota.cl',
  'analista.gp@cftestatalaricayparinacota.cl',
  'asis.gestiondepersonas@cftestatalaricayparinacota.cl'
))
with check (lower(auth.jwt() ->> 'email') in (
  'mguzmanahumada@gmail.com',
  'a.gestiondepersonas@cftestatalaricayparinacota.cl',
  'gestiondepersonas@cftestatalaricayparinacota.cl',
  'analista.gp@cftestatalaricayparinacota.cl',
  'asis.gestiondepersonas@cftestatalaricayparinacota.cl'
));

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- Usuarios administradores iniciales
insert into public.profiles (email, role, first_name, last_name)
values
  ('a.gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('mguzmanahumada@gmail.com', 'admin', '', ''),
  ('gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('analista.gp@cftestatalaricayparinacota.cl', 'admin', '', ''),
  ('asis.gestiondepersonas@cftestatalaricayparinacota.cl', 'admin', '', '')
on conflict (email)
do update set role = excluded.role, updated_at = now();
