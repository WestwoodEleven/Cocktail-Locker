-- Bottle guide: a shared page for each bottle (description, photos, ratings and comments).
-- Run once in Supabase (SQL Editor > New query > paste > Run). Safe to run again.

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
