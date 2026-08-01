import fs from "node:fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Render requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

if (!/^https:\/\/[^\s/]+\.supabase\.co$/.test(supabaseUrl)) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.");
}

const publicConfig = {
  supabaseUrl,
  supabaseAnonKey: supabasePublishableKey,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || ""
};

fs.writeFileSync(
  "public-config.js",
  `window.TRAVELDRIP_PUBLIC_CONFIG = ${JSON.stringify(publicConfig, null, 2)};\n`,
  "utf8"
);
