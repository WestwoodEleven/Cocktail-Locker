# My Cocktail Cart

Everyone's house cocktail specs, scaled for one glass or the whole party.

Anyone can browse every drink, filter by locker, cocktail type, base spirit, method or ingredient type, and batch any recipe by number of drinks or container size. Sign in with your email to get your own locker: add drinks with ingredients, recommended brands, floats and a photo, and copy other people's drinks into your locker to tweak them. You can only change drinks in your own locker.

It's a static site on GitHub Pages, with recipes, lockers and photos in a free Supabase project.

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

### Search and standard recipes

Search covers every locker. Versions of the same drink are grouped together and sorted by rating by default (weighted, so a drink needs a few ratings to reach the top); people can also sort A–Z or by newest. If nobody has a drink, signed-in people can tap **Look up the standard recipe**: Claude fills in the classic spec once and saves it to a shared library, so every later lookup is instant and free. Standard recipes appear in search results, can be rated and favorited, and can be saved to a locker to make a personal version. If you ran `setup.sql` before this existed, run [`supabase/standard-setup.sql`](supabase/standard-setup.sql) and redeploy the `read-recipe` function.

### Tools, lists and sharing

- **What can I make?** matches your saved bar (plus fresh items) against every recipe and shows what's ready, and what's one or two ingredients away. No AI, so it's free.
- **Plan a party**: pick drinks and a guest count for batches, one combined shopping list (bottles, citrus, cans, ice) and a printable menu. Saved on the device.
- **Stock my bar**: photograph your shelves (several photos, several bottles each); Claude lists every bottle with its brand, you review and edit the list, and it's added to your bar. Already-owned bottles are skipped, brands are filled in on existing ones, and mixers go to Fresh today. Each photo is one AI request.
- **Swap**: next to each ingredient, Claude suggests substitutes (from your bar first) and can start your own version with the swap.
- **Make it**: a big, step-by-step checklist that keeps the screen on while you mix.
- **Lists**: your own named lists (Thanksgiving, Summer patio). Public lists show on your locker page; you can make any list private.
- **Notes with ratings**: add a short note when you rate; everyone sees them under "What people say".
- **Locker pages and following**: tap a locker name to see all its drinks and public lists, copy its link (`#locker-…`), and follow it. "People I follow" appears in the Locker filter.
- **Ingredient names**: the editor suggests names others already use and offers to match near-duplicates, which keeps filters and matching tidy.
- **Install as an app**: the site can be added to a phone's home screen (Android shows an Install button; iPhone shows a tip) and opens offline, though recipes need a connection.

If you ran `setup.sql` before these existed, run [`supabase/social-setup.sql`](supabase/social-setup.sql) and redeploy the `read-recipe` function.

### Claiming the first recipes

Recipes from before lockers existed don't belong to anyone. Sign in on the site once, then edit the email in [`supabase/claim-recipes.sql`](supabase/claim-recipes.sql) to yours and run it. Those recipes move into your locker.

### GitHub Pages

**Settings > Pages**, deploy from branch `main`, folder `/ (root)`.

## Sign-in emails

Supabase's built-in email service only sends a few sign-in emails per hour, which is fine for a handful of people. For more traffic, connect your own email provider under **Authentication > Emails > SMTP Settings**.

## Making changes

After editing anything in `js/` or `styles.css`, run `node tools/stamp.mjs`. It adds a version to each file link in `index.html` so phones and browsers load the new code right away instead of a cached copy. The tests fail if you forget.

## Tests

`npm install`, then `npm test`. It runs the site in headless Chromium against an in-memory stand-in for Supabase (`tests/mock-supabase.js`), plus the `read-recipe` function against a fake Claude. GitHub runs the same tests on every push (`.github/workflows/tests.yml`).

## Files

- `index.html`: the page; `styles.css`: its styles; `js/`: its code, loaded in numbered order and sharing one scope
- `manifest.webmanifest`, `sw.js`, `icons/`: installing as an app and opening offline
- `config.js`: Supabase project URL and publishable key
- `supabase/setup.sql`: tables, photo storage and access rules
- `supabase/claim-recipes.sql`: moves unowned recipes into one person's locker
- `supabase/social-setup.sql`: adds lists, rating notes and following to an existing project
- `supabase/standard-setup.sql`: adds the shared standard recipe library to an existing project
- `supabase/favorites-setup.sql`: adds favorites to an existing project
- `supabase/bartender-setup.sql`: adds saved bars, ratings and the AI allowance to an existing project
- `supabase/functions/read-recipe/index.ts`: reads recipe and bottle photos, suggests drinks and swaps, and looks up standard recipes with Claude
