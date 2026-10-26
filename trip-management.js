let pendingTripRemoval = null;

function openTripRemoval(trip) {
  pendingTripRemoval = trip;
  const owner = trip.owner_user_id === state.session?.user?.id;
  document.getElementById("tripRemovalTitle").textContent = `${owner ? "Remove" : "Leave"} ${trip.title || "this trip"}?`;
  document.getElementById("tripRemovalCopy").textContent = owner
    ? "This moves the trip to Removed trips for all members. You can restore it later. Bookings and payments are not cancelled."
    : "This removes the trip from your list. Other members keep their access. You will need a new invitation to join again. Bookings and payments are not cancelled.";
  document.getElementById("confirmTripRemovalButton").textContent = owner ? "Remove trip" : "Leave trip";
  document.getElementById("tripRemovalStatus").textContent = "";
  document.getElementById("tripRemovalDialog").showModal();
}

function appendRemovedTripsControl(container) {
  const details = document.createElement("details");
  details.className = "simple-disclosure removed-trips";
  const summary = document.createElement("summary");
  summary.textContent = "Removed trips";
  const list = document.createElement("div");
  list.setAttribute("role", "status");
  details.append(summary, list);
  details.addEventListener("toggle", async () => {
    if (!details.open) return;
    list.textContent = "Loading removed trips...";
    try {
      const result = await apiRequest("/api/trips?scope=removed");
      list.replaceChildren();
      if (!result.trips?.length) list.textContent = "No removed trips.";
      for (const trip of result.trips || []) {
        const row = document.createElement("div");
        row.className = "removed-trip-row";
        const title = document.createElement("strong");
        title.textContent = trip.title || "Untitled trip";
        row.append(title);
        if (trip.owner_user_id === state.session?.user?.id && trip.status === "archived") {
          const restore = document.createElement("button");
          restore.type = "button";
          restore.textContent = "Restore trip";
          restore.addEventListener("click", async () => {
            restore.disabled = true;
            try {
              await apiRequest("/api/trips", { method: "PATCH", body: JSON.stringify({ tripId: trip.id, action: "restore" }) });
              await loadAccountData();
              renderRoute("tripsPanel");
            } catch (error) { list.textContent = error.message; }
          });
          row.append(restore);
        } else {
          const note = document.createElement("span");
          note.textContent = "Ask the organizer for an invitation to rejoin.";
          row.append(note);
        }
        list.append(row);
      }
    } catch (error) { list.textContent = error.message; }
  });
  container.append(details);
}

function initializeTripManagement() {
  const form = document.getElementById("tripRemovalForm");
  if (!form) return;
  document.getElementById("cancelTripRemovalButton").addEventListener("click", () => document.getElementById("tripRemovalDialog").close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingTripRemoval) return;
    const button = document.getElementById("confirmTripRemovalButton");
    button.disabled = true;
    try {
      const result = await apiRequest("/api/trips", { method: "PATCH", body: JSON.stringify({ tripId: pendingTripRemoval.id, action: "remove" }) });
      if (result.skipped) throw new Error("Sign in to manage your trips.");
      pendingTripRemoval = null;
      document.getElementById("tripRemovalDialog").close();
      await loadAccountData();
      renderRoute("tripsPanel", { updateHistory: true });
    } catch (error) { document.getElementById("tripRemovalStatus").textContent = error.message; }
    finally { button.disabled = false; }
  });
}
