# The Cocktail Locker

Everyone's house cocktail specs, scaled for one glass or the whole party.

Anyone can browse every drink, filter by locker, cocktail type, base spirit, method or ingredient type, and batch any recipe by number of drinks or container size. Sign in with your email to get your own locker: add drinks with ingredients, recommended brands, floats and a photo, and copy other people's drinks into your locker to tweak them. You can only change drinks in your own locker.

It's a single static page (`index.html`) on GitHub Pages, with recipes, lockers and photos in a free Supabase project.

Live site: https://westwoodeleven.github.io/Cocktail-Locker/

## Setup

### Supabase

1. Open **SQL Editor**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql), and click **Run**. It creates the lockers, recipes and photo storage with the access rules. Running it again is safe and keeps existing recipes.
2. Under **Authentication**, make sure new sign-ups are **allowed**, since anyone can create a locker.
3. Under **Authentication > URL Configuration**, set **Site URL** to `https://westwoodeleven.github.io/Cocktail-Locker/` and add the same address to **Redirect URLs**.
4. Put the Project URL and publishable key in [`config.js`](config.js) (already done for this site).

### Claiming the first recipes

Recipes from before lockers existed don't belong to anyone. Sign in on the site once, then edit the email in [`supabase/claim-recipes.sql`](supabase/claim-recipes.sql) to yours and run it. Those recipes move into your locker.

### GitHub Pages

**Settings > Pages**, deploy from branch `main`, folder `/ (root)`.

## Sign-in emails

Supabase's built-in email service only sends a few sign-in emails per hour, which is fine for a handful of people. For more traffic, connect your own email provider under **Authentication > Emails > SMTP Settings**.

## Files

- `index.html`: the whole site
- `config.js`: Supabase project URL and publishable key
- `supabase/setup.sql`: tables, photo storage and access rules
- `supabase/claim-recipes.sql`: moves unowned recipes into one person's locker
