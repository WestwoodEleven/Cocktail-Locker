-- My Cocktail Cart: drink view counts (for Trending on the home page and admin stats).
-- Paste into the Supabase SQL Editor and run once. Safe to run again.
-- Counts are per drink per day. Nothing records who viewed what.

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
