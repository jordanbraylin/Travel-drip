import webpush from "web-push";

const WALLET_NOTIFICATION_TYPES = [
  "wallet_deposit_confirmed",
  "wallet_payment_request",
  "wallet_payment_due"
];

export async function dispatchQueuedNotifications(supabase, {
  notificationIds = [],
  notificationTypes = WALLET_NOTIFICATION_TYPES
} = {}) {
  const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { enabled: false, sent: 0, checked: 0, reason: "VAPID keys are not configured" };
  }

  let query = supabase
    .from("notifications")
    .select("id, user_id, title, body, metadata, status")
    .eq("status", "queued")
    .in("notification_type", notificationTypes)
    .order("created_at", { ascending: true })
    .limit(100);
  if (notificationIds.length) query = query.in("id", notificationIds);

  const { data: notifications, error: notificationError } = await query;
  if (notificationError) throw new Error(notificationError.message);
  if (!notifications?.length) return { enabled: true, sent: 0, checked: 0 };

  const userIds = [...new Set(notifications.map((notification) => notification.user_id).filter(Boolean))];
  const { data: subscriptions, error: subscriptionError } = userIds.length
    ? await supabase.from("push_subscriptions").select("endpoint, user_id, subscription").in("user_id", userIds)
    : { data: [], error: null };
  if (subscriptionError) throw new Error(subscriptionError.message);

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const subscriptionsByUser = new Map();
  for (const subscription of subscriptions || []) {
    const list = subscriptionsByUser.get(subscription.user_id) || [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  }

  let sent = 0;
  for (const notification of notifications) {
    let notificationSent = 0;
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: "/wallet",
      notificationId: notification.id
    });
    for (const subscription of subscriptionsByUser.get(notification.user_id) || []) {
      try {
        await webpush.sendNotification(subscription.subscription, payload);
        notificationSent += 1;
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        }
      }
    }

    await supabase
      .from("notifications")
      .update({
        status: "delivered",
        metadata: {
          ...(notification.metadata || {}),
          push_attempted_at: new Date().toISOString(),
          push_sent_count: notificationSent
        }
      })
      .eq("id", notification.id)
      .eq("status", "queued");
  }

  return { enabled: true, sent, checked: notifications.length };
}
