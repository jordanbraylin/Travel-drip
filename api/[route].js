import adminStatus from "../server/api/admin-status.js";
import aiInvitation from "../server/api/ai-invitation.js";
import aiPlanner from "../server/api/ai-planner.js";
import audit from "../server/api/audit.js";
import config from "../server/api/config.js";
import corporateBookings from "../server/api/corporate-bookings.js";
import events from "../server/api/events.js";
import explore from "../server/api/explore.js";
import flightTracking from "../server/api/flight-tracking.js";
import ghlSync from "../server/api/ghl-sync.js";
import guestAccess from "../server/api/guest-access.js";
import health from "../server/api/health.js";
import hotelAvailability from "../server/api/hotel-availability.js";
import invitations from "../server/api/invitations.js";
import notify from "../server/api/notify.js";
import ownershipTransfer from "../server/api/ownership-transfer.js";
import rsvp from "../server/api/rsvp.js";
import schedule from "../server/api/schedule.js";
import subscribe from "../server/api/subscribe.js";
import travelSearch from "../server/api/travel-search.js";
import trips from "../server/api/trips.js";
import walletReminders from "../server/api/wallet-reminders.js";
import wallet from "../server/api/wallet.js";
import { applySecurityHeaders } from "../server/api/_security.js";

const routes = Object.freeze({
  "admin-status": adminStatus,
  "ai-invitation": aiInvitation,
  "ai-planner": aiPlanner,
  audit,
  config,
  "corporate-bookings": corporateBookings,
  events,
  explore,
  "flight-tracking": flightTracking,
  "ghl-sync": ghlSync,
  "guest-access": guestAccess,
  health,
  "hotel-availability": hotelAvailability,
  invitations,
  notify,
  "ownership-transfer": ownershipTransfer,
  rsvp,
  schedule,
  subscribe,
  "travel-search": travelSearch,
  trips,
  "wallet-reminders": walletReminders,
  wallet,
});

export default async function handler(request, response) {
  const routeParam = request.query?.route;
  const route = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const routeHandler = routes[route];

  if (!routeHandler) {
    applySecurityHeaders(response);
    response.status(404).json({ error: "API route not found" });
    return;
  }

  await routeHandler(request, response);
}
