-- My Cocktail Cart: site stats for admins (the Stats box on My Cocktail Cart).
-- Paste into the Supabase SQL Editor and run once. Safe to run again (run it again after updates).
-- Needs the bottle guide (is_site_admin) and drink views (views-setup.sql) set up first.

-- When each drink was first added (older drinks use their last edit time).
alter table public.drinks add column if not exists created_at timestamptz;
update public.drinks set created_at = updated_at where created_at is null;
alter table public.drinks alter column created_at set default now();

-- Which days each signed-in member opened the site: one row per member per day, nothing about what they looked at.
-- Counts "Active this week" and "Came back after week 1". Rows go when the account is deleted.
create table if not exists public.member_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);
create index if not exists member_days_day_idx on public.member_days (day);
alter table public.member_days enable row level security;
-- No policies on purpose: nobody reads or writes the table directly. touch_seen() adds today's row; admin_stats() counts.

-- The site calls this once a day for a signed-in member.
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  insert into member_days (user_id, day)
  select auth.uid(), current_date where auth.uid() is not null
  on conflict do nothing;
$$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

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
      'active_7d', (select count(distinct user_id) from member_days where day > current_date - 7),
      -- Of members who joined at least a week ago, how many opened the site a week or more after joining.
      'returned', (select count(distinct m.user_id) from member_days m join auth.users u on u.id = m.user_id
                   where u.created_at <= now() - interval '7 days' and m.day >= (u.created_at + interval '7 days')::date),
      'returned_of', (select count(*) from auth.users where created_at <= now() - interval '7 days'),
      'seen_since', (select min(day) from member_days),
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
        'active', (select count(distinct m.user_id) from member_days m where m.day >= w::date and m.day < (w + interval '7 days')::date),
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
