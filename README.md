# Mitch's Cocktails

House cocktail specs, scaled for one glass or the whole party. Add drinks with their ingredients, recommended brands, floats and a photo, then batch any recipe by number of drinks or container size.

It's a single static page (`index.html`) hosted on GitHub Pages. Recipes and photos live in a free Supabase project. Anyone with the link can browse and scale drinks; only you can sign in and edit.

## One-time setup

### 1. Supabase (database and photos)

1. Create a free account at [supabase.com](https://supabase.com) and a new project.
2. Open **SQL Editor**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql), and click **Run**. This creates the recipe table and the photo bucket, sets who can read and edit, and loads your existing recipes.
3. Go to **Authentication > Sign In / Providers** and turn off **Allow new users to sign up**. This keeps anyone else from making an account that could edit.
4. Go to **Authentication > Users > Add user** and add your own email address.
5. Go to **Authentication > URL Configuration** and set **Site URL** to your GitHub Pages address (for example `https://westwoodeleven.github.io/Cocktail-Locker/`). Add the same address under **Redirect URLs**.
6. Copy your **Project URL** and **publishable (anon) key** into [`config.js`](config.js).

### 2. GitHub Pages

In the repo, go to **Settings > Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The site appears at `https://westwoodeleven.github.io/Cocktail-Locker/` within a minute or two.

## Editing recipes

Click **Sign in to edit**, enter your email, and open the link Supabase sends you. You stay signed in on that device. **Sign out** returns the page to browse-only.

## Files

- `index.html`: the whole site
- `config.js`: your Supabase project URL and key
- `supabase/setup.sql`: database, photo storage and access rules
