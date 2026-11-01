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

### AI features: recipe scanning and the AI bartender

Signed-in people can tap **Scan a recipe** (or **Fill from a photo** in a new drink) to read a recipe from a photo, and **Make me a drink** to get 3 cocktail ideas from the ingredients they have. Their liquors, syrups and bitters are saved as their bar for next time. Both use Claude through the `read-recipe` function, cost roughly a cent or two per use, and share one allowance of 25 per person per day.

Anyone signed in can also rate any drink 1 to 5 stars; averages show on each drink and in the list, and the Rating filter finds the best ones.

To switch these on:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) (Settings > API Keys) and add a little credit under Billing.
2. If you ran `setup.sql` before these features existed, run [`supabase/bartender-setup.sql`](supabase/bartender-setup.sql) in the SQL Editor (it adds saved bars, ratings and the daily allowance).
3. In Supabase, open **Edge Functions > Deploy a new function > Via Editor**. Name it `read-recipe`, replace the sample code with [`supabase/functions/read-recipe/index.ts`](supabase/functions/read-recipe/index.ts), and deploy. In the function's **Details** tab, turn off **Verify JWT** (the function checks sign-in itself).
4. Under **Edge Functions > Secrets**, add `ANTHROPIC_API_KEY` with your key.

Optional secrets: `RECIPE_DAILY_LIMIT` (default 25) and `RECIPE_MODEL` (default `claude-sonnet-5-5`).

### My locker and favorites

Signed-in people get a **My locker** page (the button at the top) showing their drinks, their favorites and their bar, which they can edit there. Anyone signed in can tap **♡ Favorite** on any drink; favorites are private to each person. If you ran `setup.sql` before favorites existed, run [`supabase/favorites-setup.sql`](supabase/favorites-setup.sql).

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
- `supabase/favorites-setup.sql`: adds favorites to an existing project
- `supabase/bartender-setup.sql`: adds saved bars, ratings and the AI allowance to an existing project
- `supabase/functions/read-recipe/index.ts`: reads recipe photos and suggests drinks with Claude
