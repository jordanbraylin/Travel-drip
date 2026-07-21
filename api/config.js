export default function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      || process.env.SUPABASE_URL
      || "https://bfuiqmmbsgfcnyeneunv.supabase.co",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || "",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ""
  });
}
