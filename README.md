# My Cocktail Cart

Everyone's house cocktail specs, scaled for one glass or the whole party.

Anyone can browse every drink, filter by locker, cocktail type, base spirit, method or ingredient type, and batch any recipe by number of drinks or container size. Sign in with your email to get your own locker: add drinks with ingredients, recommended brands, floats and a photo, and copy other people's drinks into your locker to tweak them. You can only change drinks in your own locker.

It's a static site on GitHub Pages, with recipes, lockers and photos in a free Supabase project.

Live site: https://www.mycocktailcart.com (the old https://westwoodeleven.github.io/Cocktail-Locker/ address redirects there)

## Setup

### Supabase

1. Open **SQL Editor**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql), and click **Run**. It creates the lockers, recipes and photo storage with the access rules. Running it again is safe and keeps existing recipes.
2. Under **Authentication**, make sure new sign-ups are **allowed**, since anyone can create a locker.
3. Under **Authentication > URL Configuration**, set **Site URL** to `https://www.mycocktailcart.com` and add `https://www.mycocktailcart.com/**` and `https://mycocktailcart.com/**` to **Redirect URLs**.
4. Put the Project URL and publishable key in [`config.js`](config.js) (already done for this site).

### Signing in

Sign-in is by email, with no password. The email has a 6-digit code to type into the site, plus a link. The code matters for the app added to an iPhone home screen: it keeps its own sign-in, separate from Safari, and email links always open in Safari. For the code to appear, the **Magic Link** email template in Supabase (Authentication > Emails > Templates) must include `{{ .Token }}`, for example:

```html
<h2>Your My Cocktail Cart sign-in code</h2>
<p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
<p>Type this code on the site. It works once and expires soon.</p>
<p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> in this browser.</p>
```

### AI features: recipe scanning and the AI bartender

Signed-in people can tap **Scan a recipe** (or **Fill from a photo** in a new drink) to read a recipe from a photo, and **Make me a drink** to get 3 cocktail ideas from the ingredients they have. Their liquors, syrups and bitters are saved as their bar for next time. Both use Claude through the `read-recipe` function, cost roughly a cent or two per use, and share one allowance of 25 per person per day.

Anyone signed in can also rate any drink 1 to 5 stars; averages show on each drink and in the list, and the Rating filter finds the best ones.

To switch these on:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) (Settings > API Keys) and add a little credit under Billing.
2. If you ran `setup.sql` before these features existed, run [`supabase/bartender-setup.sql`](supabase/bartender-setup.sql) in the SQL Editor (it adds saved bars, ratings and the daily allowance).
3. In Supabase, open **Edge Functions > Deploy a new function > Via Editor**. Name it `read-recipe`, replace the sample code with [`supabase/functions/read-recipe/index.ts`](supabase/functions/read-recipe/index.ts), and deploy. In the function's **Details** tab, turn off **Verify JWT** (the function checks sign-in itself).
4. Under **Edge Functions > Secrets**, add `ANTHROPIC_API_KEY` with your key.

Optional secrets: `RECIPE_DAILY_LIMIT` (default 25), `RECIPE_MODEL` (default `claude-sonnet-5-5`) and `UNLIMITED_EMAILS` (comma-separated emails with no daily limit). Site admins (see Bottle guide below) also have no daily limit.

### My Cocktail Cart and favorites

Signed-in people get a **My Cocktail Cart** page (called a locker in the code and database) (the button at the top) showing their drinks, their favorites and their bar, which they can edit there. Anyone signed in can tap **♡ Favorite** on any drink; favorites are private to each person. If you ran `setup.sql` before favorites existed, run [`supabase/favorites-setup.sql`](supabase/favorites-setup.sql).

### Search and standard recipes

Search covers every locker. On Home, the drink list is split into **My Drinks**, **Trending** (most viewed this week; **Recently Added** until there are views), **Highest Rated** and **The Classics**, five drinks each with **Show more** and then **See all**, plus **Browse all drinks** at the bottom. Searching, a filter chip or Browse all switches to one flat list with your own drinks first, then everyone else's, sorted by rating by default (or Trending, A–Z, Newest) (weighted, so a drink needs a few ratings to reach the top); people can also sort A–Z or by newest. If nobody has a drink, signed-in people can tap **Look up the standard recipe**: Claude fills in the classic spec once and saves it to a shared library, so every later lookup is instant and free. Standard recipes appear in search results, can be rated and favorited, and can be saved to a locker to make a personal version. If you ran `setup.sql` before this existed, run [`supabase/standard-setup.sql`](supabase/standard-setup.sql) and redeploy the `read-recipe` function.

### Look and feel

The "Back bar" design: condensed all-caps display type (Big Shoulders Display), Instrument Sans for text and IBM Plex Mono for measurements; near-black and off-white with one cherry-red accent (light and dark modes). A dark top bar holds the logo, the main sections and the search box. Recipe pages and Ask the bartender are full width. Home is also the drink list: the welcome and drink of the day on top, then every drink with quick filter chips and the full filters, then Plan & explore; typing in the search box filters that list in place and hides the welcome so results come first; on phones a tab bar (Home, My drinks, My bottles) sits at the bottom and an open drink comes before the drink list. Drinks without a photo get a line drawing of their glass (coupe, rocks, highball or tiki mug, from the drink's glass or style) filled with a color guessed from its ingredients (`js/25-look.js`). The design mockup lives on a Claude design canvas.

### Phone navigation

- **Back button**: every page change is a browser history step (`setHash` pushes, `routeHash` handles Back/forward), and Back from a recipe returns to the same spot on Home with search and filters kept (the recipe's ← Back does the same).
- **Header**: one slim row on phones (logo, search button, account button). The account button opens a menu with My Cocktail Cart, What can I make?, Bottle guide, Plan a party, Install, Sign in/out. The header tucks away while scrolling down and returns on scroll up.
- **Tabs**: Home (the drink list), Bartender, My Cocktail Cart. Tapping the open tab scrolls to the top.
- **Recipe actions**: Ask, Mocktail, Share, ♥ and ⋯ More (Add to list, party plan, copy, Edit, Add photo, Delete), pinned above the tabs on phones.
- **Drink list**: quick filter chips above the drinks on Home; the full filters open from the Filters button on phones.
- **Pop-ups** slide up from the bottom on phones. Recipes, ratings and photos people have loaded are kept by the service worker so they open offline (public data only).

### Home page

Visitors who arrive without a link to something specific (and anyone who taps the logo) see the home page: for new visitors, a short intro, a search box, Sign in or join, and what the site can do; for signed-in people, quick actions (My Cocktail Cart, What can I make?, Make me a drink, + New drink). Everyone gets a drink of the day (one of the best-rated drinks, preferring ones with photos; the same pick all day), the top-rated drinks and the newest. On phones the home page comes before the drink list.

### Ask the bartender

One place for the AI (`#ask`; the Bartender tab on phones, the top bar on computers, and the home page tile). People ask in their own words or tap a quick start (Use what I have, Surprise me, Make a mocktail, Find a substitute, Look up a classic). The reply is a short answer plus up to 3 drink cards with amounts, what they'd need to buy, and **Save to my cart**, **Make it** and **Try another**. Follow-ups ("less sweet", "make it for 8") refine the last answer; the last 10 messages are sent with each question. "Use my bottles" sends their in-stock bottles and fresh items. It stays on drinks and declines anything else. Each question is one AI request (the `ask` mode of `read-recipe`, logged as kind `ask`), so redeploy the function after updating.

### Classics and riffs

Each drink can be tied to the classic it is or riffs on (`js/12-classics.js`). The site recognizes about 40 classics from their signature ingredients (tequila + lime + orange liqueur is a Margarita, so "Mitch-A-Rita" is recognized), and owners can set it or choose "Not a riff on anything" in the editor's **Riff on a classic** field (saved as `classic` in the drink's data; AI-made drinks keep the classic the AI names). Search matches the classic as if it were part of the name, the list shows "Riff on a Margarita", and the recipe shows "A riff on the Margarita" (tap it to see the others).

The classics themselves live in the shared standard library: run `supabase/classics.sql` once in the Supabase SQL Editor to load 42 classic specs (it never overwrites ones already there). They appear in the main drink list tagged **Classic**, with a **Classics** chip to show only them; a house drink with the same name sorts first. A classic's page lists the house riffs on it. Site admins can correct a classic from ⋯ More > **Edit this classic**. To change the starting specs, edit `tools/classics-data.mjs` and run `node tools/make-classics-sql.mjs`.

### Tools, lists and sharing

- **What can I make?** matches your saved bar (plus fresh items) against every recipe and shows what's ready, and what's one or two ingredients away. No AI, so it's free.
- **Plan a party**: pick drinks and a guest count for batches, one combined shopping list (bottles, citrus, cans, ice) and a printable menu. Saved on the device.
- **Stock my bottles**: photograph your shelves (several photos, several bottles each); Claude lists every bottle with its brand, you review and edit the list, and it's added to your bottles. Already-owned bottles are skipped, brands are filled in on existing ones, and mixers go to Fresh today. Each photo is one AI request.
- **Missing something?**: one link under the spec opens a list of the ingredients; pick the one you don't have and Claude suggests substitutes (from your bottles first) and can start your own version with the swap.
- **Make it a mocktail**: on any drink, the AI makes a zero-proof version that keeps the drink's own non-alcoholic ingredients and uses your bottles first, shows each swap and anything you'd need to buy, and can be saved to your cart or made step by step. One AI request.
- **Ask about a recipe**: the Ask button on every recipe opens a pop-up conversation with the bartender about that drink (its spec goes along with the first question): sweeter or drier versions, swaps, batching, pairings, history. Each question is one AI request. (The step-by-step Make it mode is switched off for now; its code is still in `js/15-swap-makemode.js`.)
- **Lists**: your own named lists (Thanksgiving, Summer patio). Public lists show on your locker page; you can make any list private.
- **Notes with ratings**: add a short note when you rate; everyone sees them under "What people say".
- **Locker pages and following**: tap a locker name to see all its drinks and public lists, copy its link (`#locker-…`), and follow it. "People I follow" appears in the Locker filter.
- **Ingredient names**: the editor suggests names others already use and offers to match near-duplicates, which keeps filters and matching tidy.
- **Install as an app**: the site can be added to a phone's home screen (Android shows an Install button; iPhone shows a tip) and opens offline, though recipes need a connection.

If you ran `setup.sql` before these existed, run [`supabase/social-setup.sql`](supabase/social-setup.sql) and redeploy the `read-recipe` function.

### Bottle guide

Every bottle gets a shared page: details and a short description (written by the AI the first time anyone looks the bottle up, then saved for everyone), people's own photos of the bottle, 1–5 star ratings with comments, the recipes that name it as their recommended brand, and an **Add to my bottles** button. Open one by tapping a recommended brand on a recipe, a bottle in your bottles, a bottle in search results, or from **Bottle guide** in Tools (links look like `#bottle-buffalo-trace`).

Anyone signed in can add a photo, rate, comment and **Suggest a fix**. Site admins can **Edit details**, read suggested fixes and remove bad photos or reviews. To make yourself an admin, sign in once, put your email in [`supabase/make-me-admin.sql`](supabase/make-me-admin.sql) and run it. If you ran `setup.sql` before this existed, run [`supabase/bottles-setup.sql`](supabase/bottles-setup.sql) and redeploy `read-recipe`.

### Age check

On a device's first visit, a welcome screen asks whether the visitor is 21 or older (remembered on that device; "No" can't get in). Signing in also needs a ticked "I'm 21 or older and agree to the privacy policy" box, and the time it was ticked is saved on new accounts (Supabase **Authentication > Users**, in the user's metadata as `confirmed_21_at`).

### Reports and terms

### Drink views

Opening someone else's drink adds one view (once per drink per visit; your own drinks don't count). Views are stored as a count per drink per day, with nothing about who viewed. Run [`supabase/views-setup.sql`](supabase/views-setup.sql) once (it's also in `setup.sql`), then re-run `stats-setup.sql` so Site stats shows views too.

### Drink log

**✓ I made this** under a recipe's ratings adds a private, dated entry (today by default) with an optional note. The recipe shows "Made 3 times · Last on Oct 28" and your notes, newest first, each with Edit and, when there's a note, **Make my version with this change** (starts your own riff of the drink, with that note). If you haven't rated the drink, logging it asks "How was it?" with stars that set your normal public rating. **My Log** on My Cocktail Cart shows this month, all time, your most-made drink and a month-by-month timeline; drink lists show "Made 4×". Only you can see your log. Run [`supabase/log-setup.sql`](supabase/log-setup.sql) once (it's also in `setup.sql`).

### How-to guides

Syrups and fresh citrus in a recipe's spec have a dotted underline: tap the name for a short guide (simple, rich 2:1, honey, honey-ginger, demerara, agave, ginger, cinnamon and raspberry syrups, grenadine, orgeat, saline, fresh citrus). The ratio in the name picks the version ("2:1 simple syrup" opens rich simple syrup, "3:1 honey syrup" shows 3 parts honey to 1 water). Each guide says how much the drink (or the batch you've scaled to) needs and how much to make, for example "This batch needs 9 oz. 1 cup sugar and 1 cup hot water makes about 12 oz", or how many limes to squeeze. Syrups people usually buy (orgeat, grenadine, ginger) lead with what to look for. Techniques (shake, stir, dry shake, double strain, muddle, rinse, float, express a peel) show as a **How to** row with the drink's instructions, under About (or Notes). All of it lives in `js/30-howto.js`.

### Photo check

New drink and bottle photos get a quick AI check (`photo_check` in the `read-recipe` function, about 800 px, one small request). Drink-related photos go up right away; anything that isn't about drinks or looks inappropriate is uploaded but hidden in `photo_reviews` until an admin approves or rejects it on **Review photos** (My Cocktail Cart, or `#photo-review`). The owner sees "waiting for a quick review". Photo checks don't count toward the 25-a-day AI allowance; they have their own cap (`PHOTO_DAILY_LIMIT`, default 30). Admins' own photos skip the check. If the check can't run, the photo goes up as before and the Report button still applies. The check runs in the browser before upload, so it's a filter for honest mistakes and casual misuse, not a hard security wall. Run [`supabase/photo-review-setup.sql`](supabase/photo-review-setup.sql) once and redeploy `read-recipe`.

### Site stats and traffic

Admins get **Site stats** on My Cocktail Cart (or `#stats`): members, sign-ins this week, drinks, photos, ratings, favorites and lists; bar charts of new members, drinks added and AI requests for the last 8 weeks; AI use by feature for the last 30 days (and how many people hit the daily limit); and the top-rated and most-favorited drinks. It's one database call, `admin_stats()`, that only admins can run: run [`supabase/stats-setup.sql`](supabase/stats-setup.sql) once (it also adds a `created_at` to drinks).

Visitor traffic (page views, referrers, countries, devices) comes from **Cloudflare Web Analytics**, which uses no cookies. Either turn on automatic setup in Cloudflare (when the domain is proxied through Cloudflare), or paste the site token into `CF_BEACON_TOKEN` at the bottom of `js/27-stats.js`.

Next to other people's drinks, rating notes, bottle comments, bottle photos and carts there's a small **Report** link (reason plus optional details). Only site admins can read reports: admins get **Review reports** on My Cocktail Cart (or `#reports`), grouped by what was reported, with buttons to remove a drink's photo, delete the drink, remove a note or comment, delete a bottle photo, reset a cart name, or dismiss. Run [`supabase/reports-setup.sql`](supabase/reports-setup.sql) once (it's also in `setup.sql`). The rules people agree to are in [`terms.html`](terms.html), linked from the footer, the age check and sign-in.

### Deleting an account

People can delete their own account from the bottom of **My Cocktail Cart** (they type DELETE to confirm). The `read-recipe` function removes their photos and their sign-in account, and the database removes everything else that belongs to them: drinks, ratings, notes, comments, bottle photos, lists, favorites, bar and follows. Standard recipes and bottle guide entries they started stay, without their name. This needs the latest `read-recipe` deployed; no SQL changes.

### Claiming the first recipes

Recipes from before lockers existed don't belong to anyone. Sign in on the site once, then edit the email in [`supabase/claim-recipes.sql`](supabase/claim-recipes.sql) to yours and run it. Those recipes move into your locker.

### GitHub Pages

**Settings > Pages**, deploy from branch `main`, folder `/ (root)`. Custom domain: `www.mycocktailcart.com` (the `CNAME` file), with **Enforce HTTPS** on. DNS: a CNAME record `www` → `westwoodeleven.github.io`, and A records for the bare domain → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

## Sign-in emails

Supabase's built-in email service only sends a few sign-in emails per hour, which is fine for a handful of people. For more traffic, connect your own email provider under **Authentication > Emails > SMTP Settings**.

## Making changes

After editing anything in `js/` or `styles.css`, run `node tools/stamp.mjs`. It adds a version to each file link in `index.html` so phones and browsers load the new code right away instead of a cached copy. The tests fail if you forget.

## Tests

`npm install`, then `npm test`. It runs the site in headless Chromium against an in-memory stand-in for Supabase (`tests/mock-supabase.js`), plus the `read-recipe` function against a fake Claude. GitHub runs the same tests on every push (`.github/workflows/tests.yml`).

## Files

- `index.html`: the page; `styles.css`: its styles; `js/`: its code, loaded in numbered order and sharing one scope
- `terms.html`: the terms of use; `privacy.html`: the privacy policy (linked from the footer and the sign-in form; contact privacy@mycocktailcart.com). Update it when the site starts collecting something new or uses a new service.
- `manifest.webmanifest`, `sw.js`, `icons/`: installing as an app and opening offline
- `config.js`: Supabase project URL and publishable key
- `supabase/setup.sql`: tables, photo storage and access rules
- `supabase/claim-recipes.sql`: moves unowned recipes into one person's locker
- `supabase/reports-setup.sql`: adds reporting and admin moderation
- `supabase/bottles-setup.sql`: adds the bottle guide to an existing project; `supabase/make-me-admin.sql`: makes you a site admin
- `supabase/social-setup.sql`: adds lists, rating notes and following to an existing project
- `supabase/standard-setup.sql`: adds the shared standard recipe library to an existing project
- `supabase/favorites-setup.sql`: adds favorites to an existing project
- `supabase/bartender-setup.sql`: adds saved bars, ratings and the AI allowance to an existing project
- `supabase/functions/read-recipe/index.ts`: reads recipe and bottle photos, suggests drinks and swaps, and looks up standard recipes with Claude
