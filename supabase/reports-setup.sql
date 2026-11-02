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
