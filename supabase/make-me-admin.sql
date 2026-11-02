-- Makes one person a site admin (can edit bottle details, read fix suggestions, remove bad photos and reviews).
-- Sign in on the site once first. Replace the email below with yours, then run this in Supabase's SQL Editor.
insert into public.site_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict (user_id) do nothing;

select u.email from public.site_admins a join auth.users u on u.id = a.user_id;
