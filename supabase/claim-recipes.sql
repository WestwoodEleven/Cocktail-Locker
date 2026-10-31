-- Moves recipes that don't belong to anyone yet into one person's locker.
-- 1. Sign in on the site once with this email, so the account exists.
-- 2. Replace the email below with yours, then run this in Supabase's SQL Editor.

update public.drinks
set owner = (select id from auth.users where email = 'you@example.com')
where owner is null
  and exists (select 1 from auth.users where email = 'you@example.com');

-- Shows whose locker each recipe is in now
select d.name, p.display_name as locker
from public.drinks d left join public.profiles p on p.id = d.owner
order by d.name;
