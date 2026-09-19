import { applySecurityHeaders } from "./_security.js";

export default function handler(_request, response) {
  applySecurityHeaders(response);
  const requiredChecks = {
    supabasePublicUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServerUrlConfigured: Boolean(process.env.SUPABASE_URL),
    supabasePublishableKeyConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        || process.env.SUPABASE_PUBLISHABLE_KEY
        || process.env.SUPABASE_ANON_KEY
    ),
    supabaseServiceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    adminEmailsConfigured: Boolean(process.env.SUPABASE_ADMIN_EMAILS),
    guestAccessPepperConfigured: Boolean(process.env.GUEST_ACCESS_PEPPER),
    vapidSubjectConfigured: Boolean(process.env.VAPID_SUBJECT),
    vapidPublicKeyConfigured: Boolean(process.env.VAPID_PUBLIC_KEY),
    vapidPrivateKeyConfigured: Boolean(process.env.VAPID_PRIVATE_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  };
  const missingRequired = Object.entries(requiredChecks)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);
  const requiredEnvNames = {
    supabasePublicUrlConfigured: "NEXT_PUBLIC_SUPABASE_URL",
    supabaseServerUrlConfigured: "SUPABASE_URL",
    supabasePublishableKeyConfigured: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    supabaseServiceRoleConfigured: "SUPABASE_SERVICE_ROLE_KEY",
    adminEmailsConfigured: "SUPABASE_ADMIN_EMAILS",
    guestAccessPepperConfigured: "GUEST_ACCESS_PEPPER",
    vapidSubjectConfigured: "VAPID_SUBJECT",
    vapidPublicKeyConfigured: "VAPID_PUBLIC_KEY",
    vapidPrivateKeyConfigured: "VAPID_PRIVATE_KEY",
    cronSecretConfigured: "CRON_SECRET",
    appBaseUrlConfigured: "APP_BASE_URL",
    stripeSecretConfigured: "STRIPE_SECRET_KEY",
    stripeWebhookConfigured: "STRIPE_WEBHOOK_SECRET"
  };
  const optionalChecks = {
    ghlApiKeyConfigured: Boolean(process.env.GHL_API_KEY),
    ghlLocationConfigured: Boolean(process.env.GHL_LOCATION_ID),
    ghlPipelineConfigured: Boolean(process.env.GHL_PIPELINE_ID),
    ghlWorkflowConfigured: Boolean(process.env.GHL_DEFAULT_WORKFLOW_ID),
    googlePlacesConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
    flightAwareConfigured: Boolean(process.env.FLIGHTAWARE_API_KEY || process.env.FLIGHT_TRACKING_API_KEY),
    amadeusHotelsConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openAiModelConfigured: Boolean(process.env.OPENAI_MODEL)
  };
  response.status(200).json({
    ok: true,
    app: "Travel-Drip",
    ready: missingRequired.length === 0,
    readinessStatus: missingRequired.length ? "blocked" : "ready",
    missingRequired,
    missingRequiredEnv: missingRequired.map((name) => requiredEnvNames[name] || name),
    requiredChecks,
    optionalChecks,
    supabaseUrlConfigured: requiredChecks.supabasePublicUrlConfigured && requiredChecks.supabaseServerUrlConfigured,
    ...requiredChecks,
    ...optionalChecks,
    invitationAiConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
    walletFundingConfigured: Boolean(
      process.env.STRIPE_SECRET_KEY
        && process.env.STRIPE_WEBHOOK_SECRET
        && process.env.APP_BASE_URL
    )
  });
}
