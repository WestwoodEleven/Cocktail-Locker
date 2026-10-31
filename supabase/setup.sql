-- Mitch's Cocktails: run this once in Supabase (SQL Editor > New query > paste > Run).

-- Recipes
create table if not exists public.drinks (
  id text primary key,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.drinks enable row level security;

drop policy if exists "Anyone can read drinks" on public.drinks;
drop policy if exists "Signed-in users can add drinks" on public.drinks;
drop policy if exists "Signed-in users can edit drinks" on public.drinks;
drop policy if exists "Signed-in users can delete drinks" on public.drinks;
create policy "Anyone can read drinks" on public.drinks for select using (true);
create policy "Signed-in users can add drinks" on public.drinks for insert to authenticated with check (true);
create policy "Signed-in users can edit drinks" on public.drinks for update to authenticated using (true) with check (true);
create policy "Signed-in users can delete drinks" on public.drinks for delete to authenticated using (true);

-- Live updates, so an open page refreshes when a recipe changes
do $$ begin
  alter publication supabase_realtime add table public.drinks;
exception when duplicate_object then null; end $$;

-- Photos
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view drink photos" on storage.objects;
drop policy if exists "Signed-in users can upload drink photos" on storage.objects;
drop policy if exists "Signed-in users can change drink photos" on storage.objects;
drop policy if exists "Signed-in users can delete drink photos" on storage.objects;
create policy "Anyone can view drink photos" on storage.objects for select using (bucket_id = 'photos');
create policy "Signed-in users can upload drink photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "Signed-in users can change drink photos" on storage.objects for update to authenticated using (bucket_id = 'photos');
create policy "Signed-in users can delete drink photos" on storage.objects for delete to authenticated using (bucket_id = 'photos');

-- Your recipes so far
insert into public.drinks (id, name, data) values
  ('mitch-a-rita-bbgcq', 'Mitch-A-Rita', '{"garnish": "", "glass": "", "ingredients": [{"amount": 1.5, "brand": "Corralejo Silver", "name": "Tequila Blanco", "unit": "oz"}, {"amount": 1, "name": "Lime Juice (Freshly Squeezed)", "unit": "oz"}, {"amount": 0.5, "name": "1:1 Simple Syrup", "unit": "oz"}, {"amount": 0.5, "brand": "Cointreau", "name": "Orange Liqueur", "unit": "oz"}], "method": "Shaken", "name": "Mitch-A-Rita", "notes": "", "updatedAt": "2026-10-31T19:48:05.636Z"}'::jsonb),
  ('painkiller-86miq', 'Painkiller', '{"garnish": "", "glass": "", "ingredients": [{"amount": 2, "brand": "Planteray 5-Year-Old Barbados Rum", "name": "Gold Rum", "unit": "oz"}, {"amount": 3, "name": "Pineapple Juice", "unit": "oz"}, {"amount": 1, "brand": "Liquid Alchemist Coconut Syrup", "name": "Coconut Syrup", "unit": "oz"}, {"amount": 1, "name": "Orange Juice", "unit": "oz"}, {"amount": 0.5, "brand": "Coruba Dark Jamaican Rum", "float": true, "name": "Dark Rum Float", "unit": "oz"}], "method": "Shaken", "name": "Painkiller", "notes": "", "updatedAt": "2026-10-31T19:44:15.199Z"}'::jsonb)
on conflict (id) do nothing;
