# Vercel Environment Variables for Travel-Drip

I could not add these directly from this workspace because the Vercel CLI is not installed and this environment is not connected to your Vercel account.

Add these in Vercel:

Project > Settings > Environment Variables

## Required for live Supabase login

```env
NEXT_PUBLIC_SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY
```

Travel-Drip also supports `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and the older `SUPABASE_ANON_KEY`, but the `NEXT_PUBLIC_*` names above match your requested setup.

After these are saved and the site is redeployed, the Sign Up and Log in forms use live Supabase email/password auth. If Supabase email confirmation is enabled, users will see a message to verify their email before logging in.

After deploy, open:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/health
```

The live-login fields should show:

```json
{
  "supabaseUrlConfigured": true,
  "supabasePublishableKeyConfigured": true
}
```

## Required for serverless API routes

```env
SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ADMIN_EMAILS=you@example.com
GUEST_ACCESS_PEPPER=PASTE_A_LONG_RANDOM_SERVER_ONLY_SECRET
```

## Required for push notifications

```env
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=PASTE_YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=PASTE_YOUR_VAPID_PRIVATE_KEY
```

Apply each variable to Production, Preview, and Development unless you intentionally want different values per environment.

After saving, redeploy the Vercel project. Environment variable changes only apply to new deployments.

## CLI option

If you have Vercel CLI installed and the project is linked:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_ADMIN_EMAILS production
vercel env add GUEST_ACCESS_PEPPER production
vercel env add VAPID_SUBJECT production
vercel env add VAPID_PUBLIC_KEY production
vercel env add VAPID_PRIVATE_KEY production
vercel --prod
```

Repeat with `preview` and `development` if needed.

Never commit real values for `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_ACCESS_PEPPER`, or `VAPID_PRIVATE_KEY`.
