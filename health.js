import { applySecurityHeaders } from "./_security.js";

export default function handler(_request, response) {
  applySecurityHeaders(response);
  response.status(200).json({
    ok: true,
    app: "Travel-Drip",
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
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
    ghlApiKeyConfigured: Boolean(process.env.GHL_API_KEY),
    ghlLocationConfigured: Boolean(process.env.GHL_LOCATION_ID),
    ghlPipelineConfigured: Boolean(process.env.GHL_PIPELINE_ID),
    ghlWorkflowConfigured: Boolean(process.env.GHL_DEFAULT_WORKFLOW_ID)
  });
}
