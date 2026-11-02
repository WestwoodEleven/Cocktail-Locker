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

-------------------------------------------------------------------------------
-- AI bartender (saved bars) and star ratings
-------------------------------------------------------------------------------

-- Each person's saved bar supplies (liquors, syrups, bitters). Private to them.
create table if not exists public.bars (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bars enable row level security;
drop policy if exists "People see their own bar" on public.bars;
drop policy if exists "People save their own bar" on public.bars;
drop policy if exists "People update their own bar" on public.bars;
create policy "People see their own bar" on public.bars for select to authenticated using (user_id = auth.uid());
create policy "People save their own bar" on public.bars for insert to authenticated with check (user_id = auth.uid());
create policy "People update their own bar" on public.bars for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Star ratings: one per person per drink. Everyone sees them; people change only their own.
create table if not exists public.ratings (
  drink_id text not null references public.drinks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (drink_id, user_id)
);
alter table public.ratings enable row level security;
drop policy if exists "Anyone can see ratings" on public.ratings;
drop policy if exists "People add their own rating" on public.ratings;
drop policy if exists "People change their own rating" on public.ratings;
drop policy if exists "People remove their own rating" on public.ratings;
create policy "Anyone can see ratings" on public.ratings for select using (true);
create policy "People add their own rating" on public.ratings for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own rating" on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People remove their own rating" on public.ratings for delete to authenticated using (user_id = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.ratings;
exception when duplicate_object then null; end $$;

-- Scans and drink ideas share one daily allowance; record which was which.
create table if not exists public.recipe_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.recipe_scans add column if not exists kind text not null default 'scan';
create index if not exists recipe_scans_user_time_idx on public.recipe_scans (user_id, created_at);
alter table public.recipe_scans enable row level security;

-------------------------------------------------------------------------------
-- Favorites
-------------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  drink_id text not null references public.drinks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, drink_id)
);
alter table public.favorites enable row level security;
drop policy if exists "People see their own favorites" on public.favorites;
drop policy if exists "People add their own favorites" on public.favorites;
drop policy if exists "People remove their own favorites" on public.favorites;
create policy "People see their own favorites" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "People add their own favorites" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "People remove their own favorites" on public.favorites for delete to authenticated using (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Standard recipe library
-------------------------------------------------------------------------------
create table if not exists public.standard_recipes (
  slug text primary key,
  name text not null,
  data jsonb not null,
  aliases text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.standard_recipes enable row level security;
drop policy if exists "Anyone can read standard recipes" on public.standard_recipes;
create policy "Anyone can read standard recipes" on public.standard_recipes for select using (true);
do $$ begin
  alter publication supabase_realtime add table public.standard_recipes;
exception when duplicate_object then null; end $$;

-- Let people rate and favorite standard recipes too (their ids start with "std:"),
-- and tidy up ratings and favorites when someone deletes one of their drinks.
alter table public.ratings drop constraint if exists ratings_drink_id_fkey;
alter table public.favorites drop constraint if exists favorites_drink_id_fkey;
create or replace function public.cleanup_drink_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ratings where drink_id = old.id;
  delete from public.favorites where drink_id = old.id;
  return old;
end $$;
drop trigger if exists drinks_cleanup_refs on public.drinks;
create trigger drinks_cleanup_refs after delete on public.drinks
  for each row execute function public.cleanup_drink_refs();

-------------------------------------------------------------------------------
-- Lists, rating notes and following
-------------------------------------------------------------------------------

-- Notes on ratings ("Too sweet, cut the syrup")
alter table public.ratings add column if not exists note text check (note is null or char_length(note) <= 280);

-- Lists (collections) of drinks. Public lists show on the owner's locker page; private ones only to the owner.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
drop policy if exists "See public lists and your own" on public.collections;
drop policy if exists "Create your own lists" on public.collections;
drop policy if exists "Change your own lists" on public.collections;
drop policy if exists "Delete your own lists" on public.collections;
create policy "See public lists and your own" on public.collections for select using (is_public or owner = auth.uid());
create policy "Create your own lists" on public.collections for insert to authenticated with check (owner = auth.uid());
create policy "Change your own lists" on public.collections for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "Delete your own lists" on public.collections for delete to authenticated using (owner = auth.uid());

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  drink_id text not null,
  added_at timestamptz not null default now(),
  primary key (collection_id, drink_id)
);
alter table public.collection_items enable row level security;
drop policy if exists "See items in lists you can see" on public.collection_items;
drop policy if exists "Add to your own lists" on public.collection_items;
drop policy if exists "Remove from your own lists" on public.collection_items;
create policy "See items in lists you can see" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.owner = auth.uid())));
create policy "Add to your own lists" on public.collection_items for insert to authenticated
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner = auth.uid()));
create policy "Remove from your own lists" on public.collection_items for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner = auth.uid()));

-- Following other lockers. Everyone can see follower counts; people manage only their own follows.
create table if not exists public.follows (
  follower uuid not null references auth.users (id) on delete cascade default auth.uid(),
  followee uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "Anyone can see follows" on public.follows;
drop policy if exists "Follow as yourself" on public.follows;
drop policy if exists "Unfollow as yourself" on public.follows;
create policy "Anyone can see follows" on public.follows for select using (true);
create policy "Follow as yourself" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "Unfollow as yourself" on public.follows for delete to authenticated using (follower = auth.uid());

-- When a drink is deleted, also take it out of lists (ratings and favorites were already handled).
create or replace function public.cleanup_drink_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ratings where drink_id = old.id;
  delete from public.favorites where drink_id = old.id;
  delete from public.collection_items where drink_id = old.id;
  return old;
end $$;
drop trigger if exists drinks_cleanup_refs on public.drinks;
create trigger drinks_cleanup_refs after delete on public.drinks
  for each row execute function public.cleanup_drink_refs();

-------------------------------------------------------------------------------
-- Bottle guide
-------------------------------------------------------------------------------

-- Site admins can edit bottle details and remove bad photos. Add yourself with make-me-admin.sql.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.site_admins enable row level security;
drop policy if exists "People can see whether they are an admin" on public.site_admins;
create policy "People can see whether they are an admin" on public.site_admins for select to authenticated using (user_id = auth.uid());
create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;

-- One row per bottle. Filled in by the read-recipe function the first time someone looks a bottle up.
create table if not exists public.bottles (
  slug text primary key,
  name text not null,
  product text,
  ingredient text,
  category text,
  producer text,
  origin text,
  abv numeric,
  age text,
  description text,
  aliases text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bottles enable row level security;
drop policy if exists "Anyone can read bottles" on public.bottles;
drop policy if exists "Admins can edit bottles" on public.bottles;
drop policy if exists "Admins can delete bottles" on public.bottles;
create policy "Anyone can read bottles" on public.bottles for select using (true);
create policy "Admins can edit bottles" on public.bottles for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Admins can delete bottles" on public.bottles for delete to authenticated using (public.is_site_admin());

-- Photos people add of their own bottles (stored in the photos bucket under their own folder).
create table if not exists public.bottle_photos (
  id bigint generated always as identity primary key,
  slug text not null references public.bottles (slug) on delete cascade,
  path text not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.bottle_photos enable row level security;
drop policy if exists "Anyone can see bottle photos" on public.bottle_photos;
drop policy if exists "People add their own bottle photos" on public.bottle_photos;
drop policy if exists "People or admins remove bottle photos" on public.bottle_photos;
create policy "Anyone can see bottle photos" on public.bottle_photos for select using (true);
create policy "People add their own bottle photos" on public.bottle_photos for insert to authenticated with check (user_id = auth.uid());
create policy "People or admins remove bottle photos" on public.bottle_photos for delete to authenticated using (user_id = auth.uid() or public.is_site_admin());

-- Ratings and comments: one per person per bottle.
create table if not exists public.bottle_reviews (
  slug text not null references public.bottles (slug) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  updated_at timestamptz not null default now(),
  primary key (slug, user_id)
);
alter table public.bottle_reviews enable row level security;
drop policy if exists "Anyone can read bottle reviews" on public.bottle_reviews;
drop policy if exists "People add their own bottle review" on public.bottle_reviews;
drop policy if exists "People change their own bottle review" on public.bottle_reviews;
drop policy if exists "People or admins remove bottle reviews" on public.bottle_reviews;
create policy "Anyone can read bottle reviews" on public.bottle_reviews for select using (true);
create policy "People add their own bottle review" on public.bottle_reviews for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own bottle review" on public.bottle_reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People or admins remove bottle reviews" on public.bottle_reviews for delete to authenticated using (user_id = auth.uid() or public.is_site_admin());

-- "Suggest a fix" reports; only admins can read them.
create table if not exists public.bottle_reports (
  id bigint generated always as identity primary key,
  slug text not null references public.bottles (slug) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.bottle_reports enable row level security;
drop policy if exists "People send fix suggestions" on public.bottle_reports;
drop policy if exists "Admins read fix suggestions" on public.bottle_reports;
drop policy if exists "Admins clear fix suggestions" on public.bottle_reports;
create policy "People send fix suggestions" on public.bottle_reports for insert to authenticated with check (user_id = auth.uid());
create policy "Admins read fix suggestions" on public.bottle_reports for select to authenticated using (public.is_site_admin());
create policy "Admins clear fix suggestions" on public.bottle_reports for delete to authenticated using (public.is_site_admin());

do $$ begin
  alter publication supabase_realtime add table public.bottles;
exception when duplicate_object then null; end $$;
