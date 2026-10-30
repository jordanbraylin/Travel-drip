export function walletFundingStatus(env = process.env) {
  const missing = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'APP_BASE_URL'].filter(name => !String(env[name] || '').trim());
  return {
    available: missing.length === 0,
    missing,
    message: missing.length ? 'Payments are temporarily unavailable while the secure payment connection is completed. No money has been moved.' : ''
  };
}
