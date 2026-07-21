# Connect Traveldrip to Vercel

Use `outputs/traveldrip` as the Vercel project root.

## Fastest Path

1. Go to https://vercel.com/new.
2. Import the repository or upload this project folder.
3. Set the project root to `outputs/traveldrip`.
4. Keep framework preset as `Other` if Vercel does not auto-detect it.
5. Add the environment variables from `VERCEL_ENV_SETUP.md`.
6. Deploy.
7. Open `/api/health` on the deployed URL and confirm the required values are `true`.

## Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ADMIN_EMAILS=you@example.com
GUEST_ACCESS_PEPPER=PASTE_A_LONG_RANDOM_SERVER_ONLY_SECRET
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=PASTE_YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=PASTE_YOUR_VAPID_PRIVATE_KEY
```

Never paste real `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_ACCESS_PEPPER`, or `VAPID_PRIVATE_KEY` into browser files.

## CLI Path

From `outputs/traveldrip`:

```bash
npm install
npx vercel
npx vercel --prod
```

After deploy, add your deployed URL to Supabase Auth allowed redirect URLs:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app
https://YOUR-VERCEL-DOMAIN.vercel.app/login
https://YOUR-VERCEL-DOMAIN.vercel.app/register
```
