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

-------------------------------------------------------------------------------
-- Reports and moderation
-- Anyone signed in can report a drink, a rating note, a bottle comment, a bottle photo or a cart.
-- Only site admins can read reports, and admins can remove the reported content.
-- Safe to run more than once. Needs the bottle guide (is_site_admin) set up first.
-------------------------------------------------------------------------------
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('drink', 'note', 'comment', 'bottle_photo', 'cart')),
  target text not null check (char_length(target) between 1 and 200),
  target_owner uuid references auth.users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'offensive', 'not_theirs', 'unsafe', 'other')),
  details text check (details is null or char_length(details) <= 500),
  snapshot text check (snapshot is null or char_length(snapshot) <= 600),
  reporter uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists reports_once_each on public.reports (reporter, kind, target);
alter table public.reports enable row level security;
drop policy if exists "People report others' content" on public.reports;
drop policy if exists "Admins read reports" on public.reports;
drop policy if exists "Admins clear reports" on public.reports;
create policy "People report others' content" on public.reports for insert to authenticated
  with check (reporter = auth.uid() and (target_owner is null or target_owner <> auth.uid()));
create policy "Admins read reports" on public.reports for select to authenticated using (public.is_site_admin());
create policy "Admins clear reports" on public.reports for delete to authenticated using (public.is_site_admin());

-- What admins can do about a report
drop policy if exists "Admins can edit any drink" on public.drinks;
drop policy if exists "Admins can delete any drink" on public.drinks;
create policy "Admins can edit any drink" on public.drinks for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Admins can delete any drink" on public.drinks for delete to authenticated using (public.is_site_admin());
drop policy if exists "Admins can clear rating notes" on public.ratings;
create policy "Admins can clear rating notes" on public.ratings for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Admins can reset cart names" on public.profiles;
create policy "Admins can reset cart names" on public.profiles for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Admins can delete any photo" on storage.objects;
create policy "Admins can delete any photo" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_site_admin());

-------------------------------------------------------------------------------
-- Classics (same as classics.sql)
-------------------------------------------------------------------------------
-- Site admins can correct classics from the recipe page (⋯ More > Edit this classic).
drop policy if exists "Admins can edit standard recipes" on public.standard_recipes;
create policy "Admins can edit standard recipes" on public.standard_recipes for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

insert into public.standard_recipes (slug, name, data, aliases) values
  ('old-fashioned', 'Old Fashioned', '{"name":"Old Fashioned","type":"Spirit-forward","base":"Whiskey","method":"Stirred","glass":"Rocks","garnish":"Orange peel","classic":"Old Fashioned","about":"The original definition of a cocktail: spirit, sugar, water and bitters. Stir over ice and serve on one large cube.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Bourbon or rye whiskey"},{"amount":0.25,"unit":"oz","name":"Simple syrup"},{"amount":2,"unit":"dash","name":"Angostura bitters"},{"amount":1,"unit":"dash","name":"Orange bitters"}]}'::jsonb, array['old-fashioned']::text[]),
  ('manhattan', 'Manhattan', '{"name":"Manhattan","type":"Spirit-forward","base":"Whiskey","method":"Stirred","glass":"Coupe","garnish":"Brandied cherry","classic":"Manhattan","about":"A New York classic from the 1880s. Rye is traditional; bourbon makes it rounder and sweeter.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Rye whiskey"},{"amount":1,"unit":"oz","name":"Sweet vermouth"},{"amount":2,"unit":"dash","name":"Angostura bitters"}]}'::jsonb, array[]::text[]),
  ('martini', 'Martini', '{"name":"Martini","type":"Spirit-forward","base":"Gin","method":"Stirred","glass":"Coupe","garnish":"Lemon twist or olive","classic":"Martini","about":"Gin and dry vermouth, stirred very cold. Adjust the vermouth to taste, from wet (1 oz) to very dry (a rinse).","notes":"","ingredients":[{"amount":2.5,"unit":"oz","name":"Gin"},{"amount":0.5,"unit":"oz","name":"Dry vermouth"},{"amount":1,"unit":"dash","name":"Orange bitters"}]}'::jsonb, array['dry-martini', 'gin-martini']::text[]),
  ('negroni', 'Negroni', '{"name":"Negroni","type":"Spirit-forward","base":"Gin","method":"Stirred","glass":"Rocks","garnish":"Orange peel","classic":"Negroni","about":"Equal parts gin, Campari and sweet vermouth, said to have been first made in Florence around 1919.","notes":"","ingredients":[{"amount":1,"unit":"oz","name":"Gin"},{"amount":1,"unit":"oz","name":"Campari"},{"amount":1,"unit":"oz","name":"Sweet vermouth"}]}'::jsonb, array[]::text[]),
  ('boulevardier', 'Boulevardier', '{"name":"Boulevardier","type":"Spirit-forward","base":"Whiskey","method":"Stirred","glass":"Rocks","garnish":"Orange peel","classic":"Boulevardier","about":"A Negroni with whiskey in place of gin, from 1920s Paris.","notes":"","ingredients":[{"amount":1.5,"unit":"oz","name":"Bourbon"},{"amount":1,"unit":"oz","name":"Campari"},{"amount":1,"unit":"oz","name":"Sweet vermouth"}]}'::jsonb, array[]::text[]),
  ('sazerac', 'Sazerac', '{"name":"Sazerac","type":"Spirit-forward","base":"Whiskey","method":"Stirred","glass":"Rocks","garnish":"Lemon peel, discarded","classic":"Sazerac","about":"New Orleans'' signature drink. Rinse a chilled glass with absinthe, then strain in the stirred whiskey, served without ice.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Rye whiskey"},{"amount":0.25,"unit":"oz","name":"Simple syrup"},{"amount":3,"unit":"dash","name":"Peychaud''s bitters"},{"amount":1,"unit":"dash","name":"Angostura bitters"},{"amount":1,"unit":"barspoon","name":"Absinthe, to rinse the glass"}]}'::jsonb, array[]::text[]),
  ('last-word', 'Last Word', '{"name":"Last Word","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Brandied cherry","classic":"Last Word","about":"An equal-parts Prohibition-era drink from the Detroit Athletic Club, revived in Seattle in the 2000s.","notes":"","ingredients":[{"amount":0.75,"unit":"oz","name":"Gin"},{"amount":0.75,"unit":"oz","name":"Green Chartreuse"},{"amount":0.75,"unit":"oz","name":"Maraschino liqueur"},{"amount":0.75,"unit":"oz","name":"Lime juice"}]}'::jsonb, array[]::text[]),
  ('paper-plane', 'Paper Plane', '{"name":"Paper Plane","type":"Sour","base":"Whiskey","method":"Shaken","glass":"Coupe","garnish":"","classic":"Paper Plane","about":"A modern equal-parts classic created by Sam Ross in 2008.","notes":"","ingredients":[{"amount":0.75,"unit":"oz","name":"Bourbon"},{"amount":0.75,"unit":"oz","name":"Aperol"},{"amount":0.75,"unit":"oz","name":"Amaro Nonino"},{"amount":0.75,"unit":"oz","name":"Lemon juice"}]}'::jsonb, array[]::text[]),
  ('aviation', 'Aviation', '{"name":"Aviation","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Brandied cherry","classic":"Aviation","about":"A pre-Prohibition gin sour with a pale sky-blue color from crème de violette.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Gin"},{"amount":0.5,"unit":"oz","name":"Maraschino liqueur"},{"amount":0.25,"unit":"oz","name":"Crème de violette"},{"amount":0.75,"unit":"oz","name":"Lemon juice"}]}'::jsonb, array[]::text[]),
  ('corpse-reviver-no-2', 'Corpse Reviver No. 2', '{"name":"Corpse Reviver No. 2","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Orange peel","classic":"Corpse Reviver No. 2","about":"An equal-parts sour from the Savoy Cocktail Book (1930), meant as a morning-after reviver.","notes":"","ingredients":[{"amount":0.75,"unit":"oz","name":"Gin"},{"amount":0.75,"unit":"oz","name":"Lillet Blanc"},{"amount":0.75,"unit":"oz","name":"Cointreau"},{"amount":0.75,"unit":"oz","name":"Lemon juice"},{"amount":1,"unit":"dash","name":"Absinthe"}]}'::jsonb, array['corpse-reviver-2', 'corpse-reviver']::text[]),
  ('daiquiri', 'Daiquiri', '{"name":"Daiquiri","type":"Sour","base":"Rum","method":"Shaken","glass":"Coupe","garnish":"Lime wheel","classic":"Daiquiri","about":"Rum, lime and sugar, from Cuba around 1900. The test of any bartender''s balance.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"White rum"},{"amount":1,"unit":"oz","name":"Lime juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('hemingway-daiquiri', 'Hemingway Daiquiri', '{"name":"Hemingway Daiquiri","type":"Sour","base":"Rum","method":"Shaken","glass":"Coupe","garnish":"Lime wheel","classic":"Hemingway Daiquiri","about":"Made for Ernest Hemingway at El Floridita in Havana. Also called the Papa Doble.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"White rum"},{"amount":0.75,"unit":"oz","name":"Lime juice"},{"amount":0.5,"unit":"oz","name":"Grapefruit juice"},{"amount":0.5,"unit":"oz","name":"Maraschino liqueur"}]}'::jsonb, array['papa-doble']::text[]),
  ('margarita', 'Margarita', '{"name":"Margarita","type":"Sour","base":"Tequila","method":"Shaken","glass":"Rocks","garnish":"Lime wheel, salt rim (optional)","classic":"Margarita","about":"Tequila, orange liqueur and lime. Serve up or on the rocks, with or without a salt rim.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Blanco tequila"},{"amount":1,"unit":"oz","name":"Cointreau"},{"amount":0.75,"unit":"oz","name":"Lime juice"}]}'::jsonb, array[]::text[]),
  ('tommy-s-margarita', 'Tommy''s Margarita', '{"name":"Tommy''s Margarita","type":"Sour","base":"Tequila","method":"Shaken","glass":"Rocks","garnish":"Lime wheel","classic":"Tommy''s Margarita","about":"Agave syrup in place of orange liqueur, from Tommy''s Mexican Restaurant in San Francisco.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Blanco tequila"},{"amount":1,"unit":"oz","name":"Lime juice"},{"amount":0.5,"unit":"oz","name":"Agave syrup"}]}'::jsonb, array['tommys-margarita']::text[]),
  ('paloma', 'Paloma', '{"name":"Paloma","type":"Highball","base":"Tequila","method":"Built","glass":"Highball","garnish":"Lime wheel, salt rim (optional)","classic":"Paloma","about":"Mexico''s favorite tequila highball: tequila, lime and grapefruit soda.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Blanco tequila"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":4,"unit":"oz","name":"Grapefruit soda"},{"amount":1,"unit":"each","name":"Pinch of salt"}]}'::jsonb, array[]::text[]),
  ('mojito', 'Mojito', '{"name":"Mojito","type":"Highball","base":"Rum","method":"Built","glass":"Highball","garnish":"Mint sprig","classic":"Mojito","about":"A Cuban highball. Gently press the mint with the syrup, add rum and lime, fill with crushed ice and top with soda.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"White rum"},{"amount":1,"unit":"oz","name":"Lime juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"},{"amount":8,"unit":"each","name":"Mint leaves"},{"amount":2,"unit":"oz","name":"Soda water"}]}'::jsonb, array[]::text[]),
  ('caipirinha', 'Caipirinha', '{"name":"Caipirinha","type":"Sour","base":"Other","method":"Built","glass":"Rocks","garnish":"","classic":"Caipirinha","about":"Brazil''s national cocktail. Muddle the lime with the sugar, add cachaça and ice, and stir.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Cachaça"},{"amount":0.5,"unit":"each","name":"Lime, cut into wedges"},{"amount":0.75,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('pisco-sour', 'Pisco Sour', '{"name":"Pisco Sour","type":"Sour","base":"Brandy","method":"Shaken","glass":"Coupe","garnish":"Angostura bitters on the foam","classic":"Pisco Sour","about":"The pride of Peru and Chile. Dry shake first to foam the egg white, then shake with ice.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Pisco"},{"amount":1,"unit":"oz","name":"Lime juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"},{"amount":1,"unit":"each","name":"Egg white"},{"amount":3,"unit":"dash","name":"Angostura bitters"}]}'::jsonb, array[]::text[]),
  ('whiskey-sour', 'Whiskey Sour', '{"name":"Whiskey Sour","type":"Sour","base":"Whiskey","method":"Shaken","glass":"Rocks","garnish":"Lemon peel and cherry","classic":"Whiskey Sour","about":"Whiskey, lemon and sugar, written down in the 1860s. Egg white makes it silky.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Bourbon"},{"amount":0.75,"unit":"oz","name":"Lemon juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"},{"amount":1,"unit":"each","name":"Egg white (optional)"}]}'::jsonb, array['whisky-sour', 'bourbon-sour']::text[]),
  ('amaretto-sour', 'Amaretto Sour', '{"name":"Amaretto Sour","type":"Sour","base":"Liqueur","method":"Shaken","glass":"Rocks","garnish":"Lemon peel and cherry","classic":"Amaretto Sour","about":"Jeffrey Morgenthaler''s version adds bourbon for backbone, turning a sweet 1970s drink into a balanced sour.","notes":"","ingredients":[{"amount":1.5,"unit":"oz","name":"Amaretto"},{"amount":0.75,"unit":"oz","name":"Bourbon"},{"amount":1,"unit":"oz","name":"Lemon juice"},{"amount":1,"unit":"barspoon","name":"Rich simple syrup"},{"amount":1,"unit":"each","name":"Egg white"}]}'::jsonb, array[]::text[]),
  ('gold-rush', 'Gold Rush', '{"name":"Gold Rush","type":"Sour","base":"Whiskey","method":"Shaken","glass":"Rocks","garnish":"Lemon peel","classic":"Gold Rush","about":"A whiskey sour with honey, created at Milk & Honey in New York in the 2000s.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Bourbon"},{"amount":0.75,"unit":"oz","name":"Honey syrup"},{"amount":0.75,"unit":"oz","name":"Lemon juice"}]}'::jsonb, array[]::text[]),
  ('bee-s-knees', 'Bee''s Knees', '{"name":"Bee''s Knees","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Lemon twist","classic":"Bee''s Knees","about":"A Prohibition-era gin sour sweetened with honey.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Gin"},{"amount":0.75,"unit":"oz","name":"Honey syrup"},{"amount":0.75,"unit":"oz","name":"Lemon juice"}]}'::jsonb, array['bees-knees']::text[]),
  ('penicillin', 'Penicillin', '{"name":"Penicillin","type":"Sour","base":"Whiskey","method":"Shaken","glass":"Rocks","garnish":"Candied ginger","classic":"Penicillin","about":"Sam Ross''s 2005 modern classic: a Gold Rush with Scotch and ginger, topped with a smoky float.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Blended Scotch"},{"amount":0.75,"unit":"oz","name":"Honey-ginger syrup"},{"amount":0.75,"unit":"oz","name":"Lemon juice"},{"amount":0.25,"unit":"oz","name":"Islay Scotch, floated"}]}'::jsonb, array[]::text[]),
  ('sidecar', 'Sidecar', '{"name":"Sidecar","type":"Sour","base":"Brandy","method":"Shaken","glass":"Coupe","garnish":"Orange peel, sugar rim (optional)","classic":"Sidecar","about":"Cognac, orange liqueur and lemon, from Paris or London around the end of World War I.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Cognac"},{"amount":0.75,"unit":"oz","name":"Cointreau"},{"amount":0.75,"unit":"oz","name":"Lemon juice"}]}'::jsonb, array[]::text[]),
  ('gimlet', 'Gimlet', '{"name":"Gimlet","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Lime wheel","classic":"Gimlet","about":"Gin and lime. Originally made with Rose''s lime cordial; fresh lime and syrup is the modern way.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Gin"},{"amount":0.75,"unit":"oz","name":"Lime juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('clover-club', 'Clover Club', '{"name":"Clover Club","type":"Sour","base":"Gin","method":"Shaken","glass":"Coupe","garnish":"Raspberries","classic":"Clover Club","about":"A pre-Prohibition Philadelphia drink, pink and frothy. Dry shake first, then shake with ice.","notes":"","ingredients":[{"amount":1.5,"unit":"oz","name":"Gin"},{"amount":0.5,"unit":"oz","name":"Dry vermouth"},{"amount":0.5,"unit":"oz","name":"Lemon juice"},{"amount":0.5,"unit":"oz","name":"Raspberry syrup"},{"amount":1,"unit":"each","name":"Egg white"}]}'::jsonb, array[]::text[]),
  ('tom-collins', 'Tom Collins', '{"name":"Tom Collins","type":"Fizz & Collins","base":"Gin","method":"Built","glass":"Collins","garnish":"Lemon wheel and cherry","classic":"Tom Collins","about":"A tall, sparkling gin lemonade from the 1870s.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Gin"},{"amount":1,"unit":"oz","name":"Lemon juice"},{"amount":0.75,"unit":"oz","name":"Simple syrup"},{"amount":2,"unit":"oz","name":"Soda water"}]}'::jsonb, array[]::text[]),
  ('french-75', 'French 75', '{"name":"French 75","type":"Spritz & bubbly","base":"Gin","method":"Shaken","glass":"Flute","garnish":"Lemon twist","classic":"French 75","about":"Named after a French field gun. Shake the gin, lemon and sugar, strain into a flute and top with Champagne.","notes":"","ingredients":[{"amount":1,"unit":"oz","name":"Gin"},{"amount":0.5,"unit":"oz","name":"Lemon juice"},{"amount":0.5,"unit":"oz","name":"Simple syrup"},{"amount":3,"unit":"oz","name":"Champagne"}]}'::jsonb, array[]::text[]),
  ('aperol-spritz', 'Aperol Spritz', '{"name":"Aperol Spritz","type":"Spritz & bubbly","base":"Wine & fortified","method":"Built","glass":"Wine glass","garnish":"Orange slice","classic":"Aperol Spritz","about":"The Venetian aperitivo: three parts prosecco, two parts Aperol, one part soda, over ice.","notes":"","ingredients":[{"amount":3,"unit":"oz","name":"Prosecco"},{"amount":2,"unit":"oz","name":"Aperol"},{"amount":1,"unit":"oz","name":"Soda water"}]}'::jsonb, array['spritz']::text[]),
  ('espresso-martini', 'Espresso Martini', '{"name":"Espresso Martini","type":"Flip & creamy","base":"Vodka","method":"Shaken","glass":"Coupe","garnish":"Three coffee beans","classic":"Espresso Martini","about":"Dick Bradsell''s 1980s London creation. Shake hard for a thick crema.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Vodka"},{"amount":1,"unit":"oz","name":"Fresh espresso"},{"amount":0.5,"unit":"oz","name":"Coffee liqueur"},{"amount":0.25,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('cosmopolitan', 'Cosmopolitan', '{"name":"Cosmopolitan","type":"Sour","base":"Vodka","method":"Shaken","glass":"Coupe","garnish":"Orange peel","classic":"Cosmopolitan","about":"The 1990s icon, popularized by Toby Cecchini in New York.","notes":"","ingredients":[{"amount":1.5,"unit":"oz","name":"Citrus vodka"},{"amount":0.75,"unit":"oz","name":"Cointreau"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":0.75,"unit":"oz","name":"Cranberry juice"}]}'::jsonb, array['cosmo']::text[]),
  ('moscow-mule', 'Moscow Mule', '{"name":"Moscow Mule","type":"Highball","base":"Vodka","method":"Built","glass":"Copper mug","garnish":"Lime wedge","classic":"Moscow Mule","about":"Vodka, lime and ginger beer, launched in the 1940s along with its copper mug.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Vodka"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":4,"unit":"oz","name":"Ginger beer"}]}'::jsonb, array['mule']::text[]),
  ('kentucky-mule', 'Kentucky Mule', '{"name":"Kentucky Mule","type":"Highball","base":"Whiskey","method":"Built","glass":"Copper mug","garnish":"Lime wedge and mint","classic":"Kentucky Mule","about":"A Moscow Mule made with bourbon.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Bourbon"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":4,"unit":"oz","name":"Ginger beer"}]}'::jsonb, array['bourbon-mule']::text[]),
  ('dark-n-stormy', 'Dark ''n'' Stormy', '{"name":"Dark ''n'' Stormy","type":"Highball","base":"Rum","method":"Built","glass":"Highball","garnish":"Lime wedge","classic":"Dark ''n'' Stormy","about":"Bermuda''s national drink: dark rum floated over ginger beer.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Dark rum"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":4,"unit":"oz","name":"Ginger beer"}]}'::jsonb, array['dark-and-stormy']::text[]),
  ('cuba-libre', 'Cuba Libre', '{"name":"Cuba Libre","type":"Highball","base":"Rum","method":"Built","glass":"Highball","garnish":"Lime wedge","classic":"Cuba Libre","about":"Rum and cola with lime, from Havana around 1900.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"White rum"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":4,"unit":"oz","name":"Cola"}]}'::jsonb, array['rum-and-coke']::text[]),
  ('gin-and-tonic', 'Gin and Tonic', '{"name":"Gin and Tonic","type":"Highball","base":"Gin","method":"Built","glass":"Highball","garnish":"Lime wedge","classic":"Gin and Tonic","about":"Gin and tonic over plenty of ice. A lime wedge is classic; cucumber or grapefruit work too.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Gin"},{"amount":4,"unit":"oz","name":"Tonic water"}]}'::jsonb, array['g-and-t', 'gin-tonic']::text[]),
  ('mint-julep', 'Mint Julep', '{"name":"Mint Julep","type":"Spirit-forward","base":"Whiskey","method":"Built","glass":"Julep cup","garnish":"Big mint bouquet","classic":"Mint Julep","about":"The drink of the Kentucky Derby. Press the mint gently with the syrup, add bourbon and pack with crushed ice.","notes":"","ingredients":[{"amount":2.5,"unit":"oz","name":"Bourbon"},{"amount":0.5,"unit":"oz","name":"Simple syrup"},{"amount":8,"unit":"each","name":"Mint leaves"}]}'::jsonb, array[]::text[]),
  ('mai-tai', 'Mai Tai', '{"name":"Mai Tai","type":"Tiki","base":"Rum","method":"Shaken","glass":"Rocks","garnish":"Mint sprig and spent lime shell","classic":"Mai Tai","about":"Trader Vic''s 1944 original: two rums, lime, curaçao and orgeat, shaken and served over crushed ice.","notes":"","ingredients":[{"amount":1,"unit":"oz","name":"Aged Jamaican rum"},{"amount":1,"unit":"oz","name":"Aged agricole or Demerara rum"},{"amount":0.75,"unit":"oz","name":"Lime juice"},{"amount":0.5,"unit":"oz","name":"Orange curaçao"},{"amount":0.5,"unit":"oz","name":"Orgeat"},{"amount":0.25,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('jungle-bird', 'Jungle Bird', '{"name":"Jungle Bird","type":"Tiki","base":"Rum","method":"Shaken","glass":"Rocks","garnish":"Pineapple wedge","classic":"Jungle Bird","about":"Created at the Kuala Lumpur Hilton in 1978: tiki with a bitter Campari edge.","notes":"","ingredients":[{"amount":1.5,"unit":"oz","name":"Blackstrap or dark rum"},{"amount":0.75,"unit":"oz","name":"Campari"},{"amount":1.5,"unit":"oz","name":"Pineapple juice"},{"amount":0.5,"unit":"oz","name":"Lime juice"},{"amount":0.5,"unit":"oz","name":"Simple syrup"}]}'::jsonb, array[]::text[]),
  ('painkiller', 'Painkiller', '{"name":"Painkiller","type":"Tiki","base":"Rum","method":"Shaken","glass":"Tiki mug","garnish":"Grated nutmeg and orange","classic":"Painkiller","about":"From the Soggy Dollar Bar in the British Virgin Islands. Served over crushed ice with plenty of nutmeg.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Navy-strength rum"},{"amount":4,"unit":"oz","name":"Pineapple juice"},{"amount":1,"unit":"oz","name":"Orange juice"},{"amount":1,"unit":"oz","name":"Cream of coconut"}]}'::jsonb, array[]::text[]),
  ('pina-colada', 'Piña Colada', '{"name":"Piña Colada","type":"Tiki","base":"Rum","method":"Blended","glass":"Hurricane","garnish":"Pineapple wedge and cherry","classic":"Piña Colada","about":"Puerto Rico''s national drink. Blend with ice until smooth, or shake and serve over crushed ice.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"White rum"},{"amount":3,"unit":"oz","name":"Pineapple juice"},{"amount":1.5,"unit":"oz","name":"Cream of coconut"},{"amount":0.5,"unit":"oz","name":"Lime juice"}]}'::jsonb, array['pina-colada']::text[]),
  ('bloody-mary', 'Bloody Mary', '{"name":"Bloody Mary","type":"Other","base":"Vodka","method":"Built","glass":"Highball","garnish":"Celery stalk and lemon wedge","classic":"Bloody Mary","about":"The brunch classic. Roll it between two tins instead of shaking to keep the tomato from foaming.","notes":"","ingredients":[{"amount":2,"unit":"oz","name":"Vodka"},{"amount":4,"unit":"oz","name":"Tomato juice"},{"amount":0.5,"unit":"oz","name":"Lemon juice"},{"amount":2,"unit":"dash","name":"Worcestershire sauce"},{"amount":2,"unit":"dash","name":"Hot sauce"},{"amount":1,"unit":"each","name":"Pinch of salt and pepper"}]}'::jsonb, array[]::text[])
on conflict (slug) do nothing;

-------------------------------------------------------------------------------
-- Drink view counts (same as views-setup.sql)
-------------------------------------------------------------------------------

create table if not exists public.drink_views (
  drink_id text not null,
  day date not null default current_date,
  views integer not null default 0,
  primary key (drink_id, day)
);
alter table public.drink_views enable row level security;
drop policy if exists "Anyone can read view counts" on public.drink_views;
create policy "Anyone can read view counts" on public.drink_views for select using (true);
create index if not exists drink_views_day_idx on public.drink_views (day);

-- The only way to add a view: one call per drink opened (the site skips repeat opens and your own drinks).
create or replace function public.record_view(p_drink text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_drink is null or char_length(p_drink) > 80 then return; end if;
  if not exists (select 1 from drinks where id = p_drink)
     and not exists (select 1 from standard_recipes where 'std:' || slug = p_drink) then return; end if;
  insert into drink_views (drink_id, day, views) values (p_drink, current_date, 1)
  on conflict (drink_id, day) do update set views = drink_views.views + 1;
end $$;
revoke all on function public.record_view(text) from public;
grant execute on function public.record_view(text) to anon, authenticated;

-------------------------------------------------------------------------------
-- Site stats for admins (same as stats-setup.sql)
-------------------------------------------------------------------------------
-- When each drink was first added (older drinks use their last edit time).
alter table public.drinks add column if not exists created_at timestamptz;
update public.drinks set created_at = updated_at where created_at is null;
alter table public.drinks alter column created_at set default now();

-- One call returns everything the Stats box shows. Only site admins get anything back.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  week0 timestamptz := date_trunc('week', now());
begin
  if not public.is_site_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'members', (select count(*) from auth.users),
      'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'drinks', (select count(*) from drinks),
      'drink_photos', (select count(*) from drinks where coalesce(data->>'photo', '') <> ''),
      'classics', (select count(*) from standard_recipes),
      'ratings', (select count(*) from ratings),
      'favorites', (select count(*) from favorites),
      'bottle_photos', (select count(*) from bottle_photos),
      'bottle_reviews', (select count(*) from bottle_reviews),
      'lists', (select count(*) from collections),
      'follows', (select count(*) from follows)
    ),
    'weeks', (
      select jsonb_agg(jsonb_build_object(
        'week', to_char(w, 'YYYY-MM-DD'),
        'signups', (select count(*) from auth.users u where u.created_at >= w and u.created_at < w + interval '7 days'),
        'drinks', (select count(*) from drinks d where d.created_at >= w and d.created_at < w + interval '7 days'),
        'ai', (select count(*) from recipe_scans s where s.created_at >= w and s.created_at < w + interval '7 days')
      ) order by w)
      from generate_series(week0 - interval '7 weeks', week0, interval '1 week') as w
    ),
    'ai_30d', coalesce((
      select jsonb_object_agg(kind, n) from (
        select kind, count(*) as n from recipe_scans where created_at > now() - interval '30 days' group by kind
      ) k
    ), '{}'::jsonb),
    'ai_today', (select count(*) from recipe_scans where created_at > now() - interval '24 hours'),
    'at_limit_today', (
      select count(*) from (
        select user_id from recipe_scans where created_at > now() - interval '24 hours' group by user_id having count(*) >= 25
      ) l
    ),
    'top_rated', coalesce((
      select jsonb_agg(t) from (
        select r.drink_id as id, coalesce(d.name, s.name, r.drink_id) as name,
               round(avg(r.stars)::numeric, 1) as avg, count(*) as n
        from ratings r
        left join drinks d on d.id = r.drink_id
        left join standard_recipes s on 'std:' || s.slug = r.drink_id
        group by r.drink_id, d.name, s.name
        having count(*) >= 2
        order by avg(r.stars) desc, count(*) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'views_7d', coalesce((select sum(views) from drink_views where day > current_date - 7), 0),
    'most_viewed', coalesce((
      select jsonb_agg(t) from (
        select v.drink_id as id, coalesce(d.name, s.name, v.drink_id) as name, sum(v.views) as n
        from drink_views v
        left join drinks d on d.id = v.drink_id
        left join standard_recipes s on 'std:' || s.slug = v.drink_id
        where v.day > current_date - 30
        group by v.drink_id, d.name, s.name
        order by sum(v.views) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'most_saved', coalesce((
      select jsonb_agg(t) from (
        select f.drink_id as id, coalesce(d.name, s.name, f.drink_id) as name, count(*) as n
        from favorites f
        left join drinks d on d.id = f.drink_id
        left join standard_recipes s on 'std:' || s.slug = f.drink_id
        group by f.drink_id, d.name, s.name
        order by count(*) desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-------------------------------------------------------------------------------
-- Photos held for review (same as photo-review-setup.sql)
-------------------------------------------------------------------------------
create table if not exists public.photo_reviews (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('drink', 'bottle')),
  target text not null check (char_length(target) between 1 and 200),
  target_name text check (target_name is null or char_length(target_name) <= 120),
  path text not null check (char_length(path) <= 300),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
alter table public.photo_reviews enable row level security;
drop policy if exists "People hold their own photos" on public.photo_reviews;
drop policy if exists "People and admins see held photos" on public.photo_reviews;
drop policy if exists "People and admins clear held photos" on public.photo_reviews;
create policy "People hold their own photos" on public.photo_reviews for insert to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');
create policy "People and admins see held photos" on public.photo_reviews for select to authenticated
  using (user_id = auth.uid() or public.is_site_admin());
create policy "People and admins clear held photos" on public.photo_reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_site_admin());

-- Approving a held bottle photo adds it in the name of the person who took it.
drop policy if exists "Admins add approved bottle photos" on public.bottle_photos;
create policy "Admins add approved bottle photos" on public.bottle_photos for insert to authenticated
  with check (public.is_site_admin());

-------------------------------------------------------------------------------
-- Drink log (same as log-setup.sql)
-------------------------------------------------------------------------------
create table if not exists public.drink_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  drink_id text not null check (char_length(drink_id) between 1 and 200),
  drink_name text check (drink_name is null or char_length(drink_name) <= 120),
  made_on date not null default current_date,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists drink_log_user_idx on public.drink_log (user_id, made_on desc);
alter table public.drink_log enable row level security;
drop policy if exists "People read their own log" on public.drink_log;
drop policy if exists "People add to their own log" on public.drink_log;
drop policy if exists "People edit their own log" on public.drink_log;
drop policy if exists "People delete from their own log" on public.drink_log;
create policy "People read their own log" on public.drink_log for select to authenticated using (user_id = auth.uid());
create policy "People add to their own log" on public.drink_log for insert to authenticated with check (user_id = auth.uid());
create policy "People edit their own log" on public.drink_log for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People delete from their own log" on public.drink_log for delete to authenticated using (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Shopping list (same as shopping-setup.sql)
-------------------------------------------------------------------------------
create table if not exists public.shopping_list (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'other' check (kind in ('bottle', 'mixer', 'other')),
  reason text check (reason is null or char_length(reason) <= 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_list_user_idx on public.shopping_list (user_id, created_at);
alter table public.shopping_list enable row level security;
drop policy if exists "People read their own shopping list" on public.shopping_list;
drop policy if exists "People add to their own shopping list" on public.shopping_list;
drop policy if exists "People change their own shopping list" on public.shopping_list;
drop policy if exists "People delete from their own shopping list" on public.shopping_list;
create policy "People read their own shopping list" on public.shopping_list for select to authenticated using (user_id = auth.uid());
create policy "People add to their own shopping list" on public.shopping_list for insert to authenticated with check (user_id = auth.uid());
create policy "People change their own shopping list" on public.shopping_list for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "People delete from their own shopping list" on public.shopping_list for delete to authenticated using (user_id = auth.uid());
