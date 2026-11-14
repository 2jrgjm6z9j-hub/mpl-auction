# MPL Auction – Admin Module: Setup Guide (for beginners)

You will do 6 parts. Take your time; each part is small.
Total time: about 30–40 minutes. Everything used here is free.

---------------------------------------------------------------
## PART 1 – Install the tools on your computer (Windows / Mac)

1. Go to https://nodejs.org and download the **LTS** version. Install it (press Next, Next, Finish).
2. Check it worked:
   - Windows: press the Windows key, type **cmd**, press Enter.
   - Mac: open **Terminal**.
   - Type `node -v` and press Enter. You should see a number like v20.x.x.
3. (Recommended) Install **VS Code** from https://code.visualstudio.com – a free editor to open the project folder.

---------------------------------------------------------------
## PART 2 – Create your Supabase project (the database)

1. Go to https://supabase.com → click **Start your project** → sign up (GitHub or email).
2. Click **New project**.
   - Name: `mpl-auction`
   - Database Password: create a strong one and **save it somewhere safe**.
   - Region: choose the closest to you (e.g. **Mumbai / South Asia (Mumbai)**).
   - Click **Create new project**. Wait 1–2 minutes.
3. Get your two keys:
   - Left menu → **Project Settings** (gear icon) → **API** (or "Data API").
   - Copy **Project URL** (looks like https://abcdxyz.supabase.co).
   - Copy the **anon public** key (a very long text; some pages call it "Publishable key").
   - Keep this page open; you need them in Part 5.
   - NEVER copy the "service_role" / "secret" key into this app.

---------------------------------------------------------------
## PART 3 – Create the database tables

1. In Supabase left menu click **SQL Editor** → **New query**.
2. Open the file `supabase/01_schema.sql` from this project, select ALL text, copy it,
   paste into the SQL Editor, click **Run**. You should see "Success. No rows returned".
3. Click **New query** again. Paste everything from `supabase/02_storage.sql` → **Run**.
   (This creates the places where logos and player photos are stored.)
4. If a script shows an error saying something "already exists", you ran it twice – that is fine.
   Any other error: take a screenshot and send it to me.

---------------------------------------------------------------
## PART 4 – Create your Admin login

1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a password. **Tick "Auto Confirm User"**. Click **Create user**.
3. Left menu → **SQL Editor** → **New query**. Paste `supabase/03_make_me_admin.sql`.
   **Change `PUT_YOUR_EMAIL_HERE` to the exact email you just used.** Click **Run**.
   This tells the database that this user is the Admin.
4. (Recommended) Authentication → **Sign In / Providers** → **Email**: turn OFF "Allow new users to sign up"
   so strangers cannot create accounts.

---------------------------------------------------------------
## PART 5 – Run the app on your computer

1. Unzip `mpl-admin.zip`. You get a folder `mpl-app`.
2. Inside the folder, find the file `.env.example`. **Copy it and rename the copy to `.env`**
   (on Windows, if you cannot see it, enable "File name extensions"/"Hidden items" in File Explorer).
3. Open `.env` and replace the two values with the ones from Part 2:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your long key...
   ```
   No spaces, no quotes. Save.
4. Open Terminal/cmd **inside the folder**:
   - Windows: open the folder, click the address bar, type `cmd`, press Enter.
   - Mac: right-click the folder → "New Terminal at Folder".
5. Type these two commands (press Enter after each; the first takes 1–2 minutes):
   ```
   npm install
   npm run dev
   ```
6. It prints a link like `http://localhost:5173`. Open it in your browser.
   It also prints a "Network" link – open that on your phone (same Wi-Fi) to test mobile.
7. Log in with the admin email + password from Part 4.

---------------------------------------------------------------
## PART 6 – Use the app (in this order)

1. **Create Tournament** (first screen): name, season, logo, credits (110), squad (13),
   bid increments (1, 2, 5), timers. "Create empty teams" = 8.
2. **Teams** tab: rename each team, upload logos.
3. **Categories** tab: set min/max per team (e.g. Wicket Keeper min 1, max 2). Add custom ones.
4. **Players** tab: add players one-by-one with photo, OR use **Import** tab for Excel/CSV
   (download the template, fill it, upload it). Add photos later from the Players tab.
5. **Dashboard** tab: shows the readiness checklist. Red ❌ = must fix, yellow ⚠️ = recommended.
6. **Preview** tab: see teams and players the way the auction will show them.

---------------------------------------------------------------
## Test checklist for this module (please confirm each one works)

- [ ] Login works; wrong password shows an error; Logout works
- [ ] Tournament created; refresh the page – it is still there
- [ ] Team added, edited, logo uploaded, deleted
- [ ] Category added with min/max
- [ ] Player added with photo; edited; deleted
- [ ] Import CSV with 5 players works
- [ ] Dashboard shows correct counts
- [ ] Works on your phone

## Common problems

| Problem | Fix |
|---|---|
| "Supabase is not configured" on login | `.env` file missing/misnamed, or you did not restart `npm run dev` after editing it |
| "Invalid login credentials" | Wrong password, or "Auto Confirm User" was not ticked – delete user and recreate |
| "Not an admin" screen | Part 4 step 3 not done or email typed wrongly |
| "Permission denied / row-level security" | Same as above, or SQL from Part 3 not fully run |
| Image upload fails | `02_storage.sql` not run |
| `npm` is not recognized | Node.js not installed – redo Part 1 and reopen cmd |

## Putting it online later (so everyone can open it on their phones)
Not needed yet. When the full app is ready I will guide you to deploy it free on Vercel.
