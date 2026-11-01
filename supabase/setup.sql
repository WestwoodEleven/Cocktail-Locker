-- Cocktail Locker database setup.
-- Run the whole file in Supabase (SQL Editor > New query > paste > Run).
-- It is safe to run again: it updates an existing project without losing recipes.

-------------------------------------------------------------------------------
-- Lockers: one profile per person, holding the name shown on their drinks
-------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Anyone can see locker names" on public.profiles;
drop policy if exists "People can create their own profile" on public.profiles;
drop policy if exists "People can rename their own locker" on public.profiles;
create policy "Anyone can see locker names" on public.profiles for select using (true);
create policy "People can create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "People can rename their own locker" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Every new sign-up gets an empty profile; the site asks them to name their locker.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for anyone who signed up before this ran
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-------------------------------------------------------------------------------
-- Recipes: everyone reads all of them, people change only their own
-------------------------------------------------------------------------------
create table if not exists public.drinks (
  id text primary key,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.drinks add column if not exists owner uuid references auth.users (id) on delete cascade;
alter table public.drinks alter column owner set default auth.uid();
create index if not exists drinks_owner_idx on public.drinks (owner);
alter table public.drinks enable row level security;

drop policy if exists "Anyone can read drinks" on public.drinks;
drop policy if exists "Signed-in users can add drinks" on public.drinks;
drop policy if exists "Signed-in users can edit drinks" on public.drinks;
drop policy if exists "Signed-in users can delete drinks" on public.drinks;
drop policy if exists "People add drinks to their own locker" on public.drinks;
drop policy if exists "People edit only their own drinks" on public.drinks;
drop policy if exists "People delete only their own drinks" on public.drinks;
create policy "Anyone can read drinks" on public.drinks for select using (true);
create policy "People add drinks to their own locker" on public.drinks for insert to authenticated with check (owner = auth.uid());
create policy "People edit only their own drinks" on public.drinks for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "People delete only their own drinks" on public.drinks for delete to authenticated using (owner = auth.uid());

-- Live updates, so an open page refreshes when a recipe changes
do $$ begin
  alter publication supabase_realtime add table public.drinks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;

-------------------------------------------------------------------------------
-- Photos: public to view; each person writes only inside their own folder
-- (photos are stored as <user id>/<drink id>/<file>)
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view drink photos" on storage.objects;
drop policy if exists "Signed-in users can upload drink photos" on storage.objects;
drop policy if exists "Signed-in users can change drink photos" on storage.objects;
drop policy if exists "Signed-in users can delete drink photos" on storage.objects;
drop policy if exists "People upload photos to their own folder" on storage.objects;
drop policy if exists "People change photos in their own folder" on storage.objects;
drop policy if exists "People delete photos in their own folder" on storage.objects;
create policy "Anyone can view drink photos" on storage.objects for select using (bucket_id = 'photos');
create policy "People upload photos to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "People change photos in their own folder" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "People delete photos in their own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-------------------------------------------------------------------------------
-- Mitch's first recipes (no locker yet; claim them with claim-recipes.sql)
-------------------------------------------------------------------------------
insert into public.drinks (id, name, data) values
  ('mitch-a-rita-bbgcq', 'Mitch-A-Rita', '{"garnish": "", "glass": "", "ingredients": [{"amount": 1.5, "brand": "Corralejo Silver", "name": "Tequila Blanco", "unit": "oz"}, {"amount": 1, "name": "Lime Juice (Freshly Squeezed)", "unit": "oz"}, {"amount": 0.5, "name": "1:1 Simple Syrup", "unit": "oz"}, {"amount": 0.5, "brand": "Cointreau", "name": "Orange Liqueur", "unit": "oz"}], "method": "Shaken", "name": "Mitch-A-Rita", "notes": "", "updatedAt": "2026-10-31T19:48:05.636Z"}'::jsonb),
  ('painkiller-86miq', 'Painkiller', '{"garnish": "", "glass": "", "ingredients": [{"amount": 2, "brand": "Planteray 5-Year-Old Barbados Rum", "name": "Gold Rum", "unit": "oz"}, {"amount": 3, "name": "Pineapple Juice", "unit": "oz"}, {"amount": 1, "brand": "Liquid Alchemist Coconut Syrup", "name": "Coconut Syrup", "unit": "oz"}, {"amount": 1, "name": "Orange Juice", "unit": "oz"}, {"amount": 0.5, "brand": "Coruba Dark Jamaican Rum", "float": true, "name": "Dark Rum Float", "unit": "oz"}], "method": "Shaken", "name": "Painkiller", "notes": "", "updatedAt": "2026-10-31T19:44:15.199Z"}'::jsonb)
on conflict (id) do nothing;

-------------------------------------------------------------------------------
-- Recipe photo scans: a log the read-recipe function uses for its daily limit.
-- Row level security with no policies: only the function (service role) can use it.
-------------------------------------------------------------------------------
create table if not exists public.recipe_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipe_scans_user_time_idx on public.recipe_scans (user_id, created_at);
alter table public.recipe_scans enable row level security;
