# Connect Travel-Drip to Vercel

Use `outputs/traveldrip` as the Vercel project root.

The production site is https://travel-drip.com. Verify the deployed services at https://travel-drip.com/api/health. The `ready` field covers core configuration; check `optionalChecks` and `walletFundingConfigured` separately for AI, search providers, CRM, and funding capabilities.

## Fastest Path

1. Go to https://vercel.com/new.
2. Import the GitHub repository `jordanbraylin/Travel-drip`.
3. Set **Root Directory** to `.` because this repository contains the Travel-Drip app at its root. Use `outputs/traveldrip` only when deploying the parent workspace directly.
4. Keep the framework preset as **Other**. `vercel.json` sets `framework` to `null` and runs `npm run build:vercel` to validate and prepare the static app and server routes.
5. Add the environment variables from `VERCEL_ENV_SETUP.md`.
6. Deploy.
7. Open `/api/health` on the deployed URL and confirm the required values are `true`.

## Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://osjexitranwtndehqyxw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL=https://osjexitranwtndehqyxw.supabase.co
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
npx vercel@latest
npx vercel@latest --prod
```

After deploy, add your deployed URL to Supabase Auth allowed redirect URLs:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app
https://YOUR-VERCEL-DOMAIN.vercel.app/login
https://YOUR-VERCEL-DOMAIN.vercel.app/register
```
