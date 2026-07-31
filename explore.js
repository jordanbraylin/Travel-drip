import { applySecurityHeaders, methodNotAllowed, sanitizeText } from "./_security.js";

const categories = {
  trending: {
    label: "Trending",
    items: [
      ["Miami Sunset Yacht Experience", "Miami, Florida", 18500, "Viral group sunset cruise with skyline photos and music."],
      ["Three-Day New Orleans Food Weekend", "New Orleans, Louisiana", 62000, "Creator-loved food route with jazz, brunch, and local history."],
      ["Tokyo Night Market Walk", "Tokyo, Japan", 7800, "Solo-friendly evening crawl through street food and hidden shopping lanes."]
    ]
  },
  food: {
    label: "Food and Restaurants",
    items: [
      ["Oceanview Rooftop Sushi", "Miami, Florida", 5500, "Japanese rooftop dining with group reservations and ocean views."],
      ["Local Cuban Cafe", "Miami, Florida", 2200, "Casual brunch favorite with strong coffee, sandwiches, and local pastries."],
      ["Chef's Table Market Tour", "Barcelona, Spain", 6900, "Market tasting walk that ends with a shared tapas table."]
    ]
  },
  nightlife: {
    label: "Nightclubs and Nightlife",
    items: [
      ["Skyline Rooftop Lounge", "Atlanta, Georgia", 2500, "R&B and hip-hop rooftop with upscale casual dress code."],
      ["Ocean Beach Club", "Cancun, Mexico", 4000, "Beachfront electronic music venue with table reservation options."],
      ["Late Jazz Cellar", "Paris, France", 1800, "Low-lit live music room for relaxed nights and small groups."]
    ]
  },
  under900: {
    label: "Trips Under $900",
    items: [
      ["Three-Day Miami Getaway", "Miami, Florida", 87500, "Estimate includes flight, two hotel nights, food, activities, and rides."],
      ["Four-Day Nashville Weekend", "Nashville, Tennessee", 82000, "Music, food halls, hotel estimate, local rides, and one headline activity."],
      ["Two-Day Orlando Escape", "Orlando, Florida", 69000, "Hotel stay, dining allowance, one major activity, and local transport estimate."]
    ]
  },
  activities: {
    label: "Activities",
    items: [
      ["Sunrise Paddle Tour", "San Diego, California", 6400, "Guided waterfront activity with beginner-friendly instruction."],
      ["Old Town Photo Walk", "Cartagena, Colombia", 3500, "Colorful architecture, local stories, and social-ready photo stops."]
    ]
  },
  hidden_gems: {
    label: "Hidden Gems",
    items: [
      ["Secret Garden Tea House", "Kyoto, Japan", 2800, "Quiet cultural stop near temples and side streets."],
      ["Local Vinyl Listening Bar", "Lisbon, Portugal", 2400, "Small late-night music lounge popular with locals."]
    ]
  },
  beaches: {
    label: "Beaches",
    items: [
      ["Clearwater Sandbar Day", "Clearwater, Florida", 5200, "Boat day estimate with snacks, swim stops, and sunset return."],
      ["Tulum Beach Club Pass", "Tulum, Mexico", 4500, "Daybed access estimate with food credit and music."]
    ]
  },
  shopping: {
    label: "Shopping",
    items: [
      ["SoHo Boutique Trail", "New York, New York", 0, "Walkable creator favorites for fashion, coffee, and street photos."],
      ["Local Artisan Market", "Marrakesh, Morocco", 0, "Guided market route with handmade goods and negotiation tips."]
    ]
  },
  outdoor: {
    label: "Outdoor Adventures",
    items: [
      ["Desert Sunset Hike", "Scottsdale, Arizona", 3600, "Guided hike with safety timing and photo viewpoints."],
      ["Rainforest Zipline", "San Juan, Puerto Rico", 8900, "Half-day outdoor adventure with transportation options."]
    ]
  },
  family: {
    label: "Family-Friendly",
    items: [
      ["Family Museum Pass", "Chicago, Illinois", 4200, "Kid-friendly indoor plan with nearby lunch options."],
      ["Beach Picnic Kit", "Santa Monica, California", 5800, "Easy family beach day with rental and food estimates."]
    ]
  },
  luxury: {
    label: "Luxury Experiences",
    items: [
      ["Private Chef Villa Dinner", "Malibu, California", 21000, "Premium dining experience for retreats or celebrations."],
      ["Spa Resort Day Pass", "Sedona, Arizona", 15500, "Wellness day with pools, massage availability, and views."]
    ]
  },
  events: {
    label: "Local Events",
    items: [
      ["Weekend Street Festival", "Austin, Texas", 1500, "Seasonal food, music, makers, and group-friendly meeting points."],
      ["Outdoor Cinema Night", "London, United Kingdom", 2200, "Evening event with picnic seating and transit tips."]
    ]
  },
  weekend: {
    label: "Weekend Getaways",
    items: [
      ["Charleston Food and Beach Weekend", "Charleston, South Carolina", 54000, "Two-night getaway estimate for food, history, and coast."],
      ["Santa Fe Art Weekend", "Santa Fe, New Mexico", 61000, "Galleries, boutique stay estimate, local dining, and outdoor views."]
    ]
  }
};

function normalizeCategory(raw) {
  const category = sanitizeText(raw, "trending", 80).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (category === "under_900" || category === "trips_under_900") return "under900";
  if (category === "nightclubs") return "nightlife";
  if (category === "food_and_restaurants") return "food";
  if (category === "outdoor_adventures") return "outdoor";
  if (category === "family_friendly") return "family";
  if (category === "luxury_experiences") return "luxury";
  if (category === "local_events") return "events";
  if (category === "weekend_getaways") return "weekend";
  return categories[category] ? category : "trending";
}

export default function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "GET") {
    methodNotAllowed(response, "GET");
    return;
  }

  const url = new URL(request.url, "https://traveldrip.local");
  const categoryKey = normalizeCategory(url.searchParams.get("category"));
  const destination = sanitizeText(url.searchParams.get("destination"), "", 160).toLowerCase();
  const tripType = sanitizeText(url.searchParams.get("tripType"), "group_trip", 80);
  const maxBudget = Number(url.searchParams.get("maxBudgetCents") || 0);
  const search = sanitizeText(url.searchParams.get("q"), "", 120).toLowerCase();

  const category = categories[categoryKey];
  let results = category.items.map(([title, location, priceCents, summary], index) => ({
    id: `${categoryKey}-${index + 1}`,
    category: categoryKey,
    title,
    location,
    priceCents,
    estimated: true,
    rating: Number((4.5 + (index % 4) / 10).toFixed(1)),
    summary,
    tripTypeFit: tripType,
    actions: {
      details: `/explore/${categoryKey}/${categoryKey}-${index + 1}`,
      addToTrip: "/itinerary",
      save: "/saved",
      share: "/share",
      directions: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
      book: "/booking"
    }
  }));

  if (destination) {
    const filtered = results.filter((item) => item.location.toLowerCase().includes(destination));
    results = filtered.length ? filtered : results;
  }

  if (maxBudget > 0) {
    results = results.filter((item) => !item.priceCents || item.priceCents <= maxBudget);
  }

  if (search) {
    results = results.filter((item) => (
      item.title.toLowerCase().includes(search)
      || item.location.toLowerCase().includes(search)
      || item.summary.toLowerCase().includes(search)
    ));
  }

  response.status(200).json({
    category: categoryKey,
    label: category.label,
    filters: {
      destination: destination || null,
      tripType,
      maxBudgetCents: maxBudget || null,
      q: search || null
    },
    emptyState: results.length ? null : {
      message: "No exact matches were found. Try changing your dates, destination, or budget.",
      actions: ["Adjust Filters", "Increase Budget", "View Nearby Options", "Ask AI Trip Manager", "Clear Filters"]
    },
    results
  });
}
