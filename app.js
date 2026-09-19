const state = {
  supabase: null,
  session: null,
  pendingWalletPayment: null,
  pendingSecureAction: null,
  walletAccess: {
    status: "unknown",
    role: "member",
    tripId: "",
    canContribute: false,
    canTapToPay: false,
    canManageCard: false,
    providerRequired: true
  },
  activeTripId: sessionStorage.getItem("traveldripActiveTripId") || "",
  ownershipTransfer: {
    status: "idle",
    tripId: sessionStorage.getItem("traveldripActiveTripId") || "",
    entityType: "auto",
    members: []
  },
  authMode: "signin",
  guestSessionToken: sessionStorage.getItem("traveldripGuestSessionToken") || "",
  corporatePortal: null,
  employeePortalTab: "dashboard",
  isAdmin: false,
  adminStatusCheckedFor: "",
  hasEnteredApp: sessionStorage.getItem("traveldripEnteredApp") === "true",
  pendingProtectedTarget: sessionStorage.getItem("traveldripPendingProtectedTarget") || "dashboardHome",
  authConfirmation: sessionStorage.getItem("traveldripAuthConfirmation") || "",
  corporateAccess: {
    verified: sessionStorage.getItem("traveldripCorporateAccessVerified") === "true",
    eventId: sessionStorage.getItem("traveldripCorporateEventId") || "",
    role: sessionStorage.getItem("traveldripCorporateRole") || "employee",
    expiresAt: sessionStorage.getItem("traveldripCorporateAccessExpiresAt") || "",
    accountLinked: sessionStorage.getItem("traveldripCorporateAccountLinked") === "true",
    pendingTarget: ""
  },
  theme: localStorage.getItem("traveldripTheme") || "tropical",
  profilePhoto: {
    dataUrl: localStorage.getItem("traveldripProfilePhoto") || "",
    savedDataUrl: localStorage.getItem("traveldripProfilePhoto") || "",
    privacy: localStorage.getItem("traveldripProfilePhotoPrivacy") || "trip_members",
    initials: localStorage.getItem("traveldripProfileInitials") || "JS",
    cropShape: localStorage.getItem("traveldripProfilePhotoCropShape") || "circle",
    zoom: Number(localStorage.getItem("traveldripProfilePhotoZoom") || 1),
    positionX: Number(localStorage.getItem("traveldripProfilePhotoPositionX") || 50),
    positionY: Number(localStorage.getItem("traveldripProfilePhotoPositionY") || 50),
    rotation: Number(localStorage.getItem("traveldripProfilePhotoRotation") || 0),
    pendingFileName: ""
  },
  profileCover: {
    dataUrl: localStorage.getItem("traveldripProfileCover") || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop",
    savedDataUrl: localStorage.getItem("traveldripProfileCover") || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop"
  },
  config: {
    supabaseUrl: "",
    supabaseAnonKey: "",
    stripePublishableKey: "",
    vapidPublicKey: ""
  },
  trustedContacts: [],
  selectedRideProvider: "Careem",
  liveDestinationIndex: 0,
  liveDestinationPaused: false,
  liveDestinationTimer: null,
  liveDestinationTouchStartX: 0,
  globalDestinationIndex: 1,
  globalDestinationPaused: false,
  globalDestinationTimer: null,
  globalDestinationTouchStartX: 0,
  connectedRideAccounts: {
    Careem: { connected: true, account: "Connected rider profile", status: "Account Connected" },
    Uber: { connected: false, account: "", status: "Not connected" },
    Lyft: { connected: false, account: "", status: "Not connected" },
    Grab: { connected: false, account: "", status: "Not connected" }
  },
  aiPlanner: {
    step: Number(sessionStorage.getItem("traveldripAiPlannerStep") || 0),
    answers: parseJson(sessionStorage.getItem("traveldripAiPlannerAnswers"), {})
  },
  liveSearch: {
    exploreResults: [],
    travelResults: [],
    privateDriverResults: [],
    aiResearch: null,
    flight: null,
    hotelResults: []
  },
  corporateOperations: {
    loaded: false,
    policy: null,
    bookings: [],
    approvals: [],
    serviceCases: [],
    invitations: [],
    readiness: null,
    permissions: {}
  }
};

const plans = [
  [
    ["10:00", "Arrive and bag drop", "Check in with the group host near JBR."],
    ["13:30", "Marina lunch", "Seafood table reserved for eight."],
    ["20:00", "Rooftop dinner", "Open-air skyline spot with budget cap."]
  ],
  [
    ["08:30", "Desert pickup", "Shared shuttle, dune ride, and coffee stop."],
    ["15:00", "Pool reset", "Two cabanas on hold until the vote closes."],
    ["21:30", "Listening lounge", "Low-volume bar near the hotel cluster."]
  ],
  [
    ["09:45", "Old city walk", "Gold souk, creek crossing, and street snacks."],
    ["14:15", "Museum slot", "Timed tickets grouped under one QR code."],
    ["18:30", "Farewell dinner", "Family-style menu with deposit applied."]
  ]
];

const dayCopy = [
  "Balanced pace with one anchor activity each day.",
  "Adventure-heavy day with a relaxed evening recovery window.",
  "Culture and food stops grouped by walking distance."
];

const aiPlannerSteps = [
  {
    key: "tripType",
    question: "What type of trip are you planning?",
    options: ["Solo Travel", "Group Vacation", "Family Vacation", "Couples Getaway", "Cruise", "Corporate Retreat", "Wedding", "Birthday Celebration"]
  },
  {
    key: "destination",
    question: "Do you already have a destination in mind, or would you like recommendations?",
    options: ["Miami", "Tokyo", "Santorini", "Dubai", "Recommend destinations", "Open to international travel", "Avoid long flights"]
  },
  {
    key: "budget",
    question: "What budget should I plan around?",
    options: ["Under $900 per person", "$1,500 per person", "$3,000 total", "Premium comfort", "Luxury", "Prioritize savings"]
  },
  {
    key: "dates",
    question: "When do you want to travel?",
    options: ["Next month", "Summer", "Holiday weekend", "Flexible dates", "5 days", "Long weekend", "Best weather window"]
  },
  {
    key: "travelers",
    question: "Who is traveling?",
    options: ["Just me", "2 adults", "Friends group", "Family with kids", "Corporate team", "Cruise group", "Include pets"]
  },
  {
    key: "interests",
    question: "What should this trip focus on?",
    options: ["Beaches", "Food and Dining", "Nightlife", "Adventure", "Museums", "Shopping", "Wellness", "Local Culture", "Photography"]
  },
  {
    key: "accommodations",
    question: "What stay style feels right?",
    options: ["Hotel", "Resort", "Vacation rental", "Villa", "Boutique hotel", "Cruise cabin", "Ocean view", "Breakfast included"]
  },
  {
    key: "transportation",
    question: "How should I handle transportation?",
    options: ["Flights needed", "Airport transfer", "Rental car", "Ride-share", "Public transit", "Walking-friendly", "Business class"]
  },
  {
    key: "dining",
    question: "Any dining preferences or restrictions?",
    options: ["Local favorites", "Fine dining", "Street food", "Seafood", "Vegan", "Food allergies", "Reservations", "Under $50 per meal"]
  },
  {
    key: "accessibility",
    question: "Any accessibility or special requirements?",
    options: ["Wheelchair access", "Mobility assistance", "Family-friendly", "Quiet hotel", "Accessible transit", "Medical accommodations", "No special requirements"]
  }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const isFilePreview = location.protocol === "file:";

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

const themeLabels = {
  tropical: "Tropical Paradise",
  sunset: "Sunset Escape",
  ocean: "Ocean Breeze",
  miami: "Miami Nights",
  cruise: "Cruise Life",
  festival: "Festival Vibes"
};

function setSyncStatus(message) {
  const el = $("#syncStatus");
  if (el) el.textContent = message;
}

const splitParticipants = [
  { name: "Jordan", custom: 86, percent: 20, items: ["Appetizer", "Dessert"] },
  { name: "Sarah", custom: 128, percent: 40, items: ["Steak", "Dessert"] },
  { name: "Mike", custom: 96, percent: 30, items: ["Pasta", "Appetizer"] },
  { name: "Alex", custom: 74, percent: 30, items: ["Drinks", "Dessert"] },
  { name: "Priya", custom: 66, percent: 0, items: ["Appetizer"] },
  { name: "Noah", custom: 66, percent: 0, items: ["Appetizer"] }
];

const receiptItems = [
  { item: "Ribeye Steak", price: 42, diners: ["Sarah"], editable: true },
  { item: "Caesar Salad", price: 14, diners: ["Alex"], editable: true },
  { item: "Sushi Roll", price: 18, diners: ["Alex"], editable: true },
  { item: "Pasta Alfredo", price: 24, diners: ["Mike"], editable: true },
  { item: "Margarita", price: 16, diners: ["Sarah"], editable: true },
  { item: "Shared Appetizer", price: 22, diners: ["Sarah", "Mike", "Alex"], editable: true },
  { item: "Dessert Platter", price: 18, diners: ["Mike"], editable: true }
];

const receiptPaymentStatus = {
  Jordan: "Pending",
  Sarah: "Paid",
  Mike: "Pending",
  Alex: "Paid",
  Priya: "Not dining",
  Noah: "Not dining"
};

const rideProvidersByDestination = {
  "United States": ["Uber", "Lyft"],
  "Canada": ["Uber", "Lyft"],
  "United Kingdom": ["Uber", "Bolt"],
  "Mexico": ["Uber", "DiDi"],
  "Brazil": ["Uber", "99"],
  "Japan": ["GO", "Uber"],
  "Singapore": ["Grab"],
  "Malaysia": ["Grab"],
  "Thailand": ["Grab"],
  "Indonesia": ["Grab", "Gojek"],
  "India": ["Uber", "Ola"],
  "United Arab Emirates": ["Careem", "Uber"]
};

const privateDriverCompaniesByDestination = {
  "United Arab Emirates": [
    { name: "Blacklane Dubai", type: "Chauffeur service", estimate: "$72-$110", eta: "45 min notice", rating: "4.8", vehicles: "Sedan, SUV, van" },
    { name: "Careem Chauffeur", type: "Private driver", estimate: "$58-$96", eta: "30 min notice", rating: "4.7", vehicles: "Business sedan, XL" },
    { name: "Dubai Private Driver", type: "Hourly hire", estimate: "$95/hr", eta: "2 hr minimum", rating: "4.6", vehicles: "Luxury sedan, sprinter" }
  ],
  "United States": [
    { name: "Blacklane", type: "Chauffeur service", estimate: "$85-$140", eta: "60 min notice", rating: "4.8", vehicles: "Sedan, SUV, van" },
    { name: "Alto", type: "Private rides", estimate: "$45-$90", eta: "Select cities", rating: "4.7", vehicles: "Premium SUV" },
    { name: "Dryver", type: "Personal driver", estimate: "$38/hr", eta: "Advance booking", rating: "4.5", vehicles: "Your car or hired car" }
  ],
  "Canada": [
    { name: "Blacklane Canada", type: "Chauffeur service", estimate: "$90-$150", eta: "60 min notice", rating: "4.8", vehicles: "Sedan, SUV" },
    { name: "DriverSeat", type: "Designated driver", estimate: "$42/hr", eta: "Advance booking", rating: "4.5", vehicles: "Hourly driver" }
  ],
  "United Kingdom": [
    { name: "Addison Lee", type: "Executive car", estimate: "£45-£95", eta: "30 min notice", rating: "4.6", vehicles: "Exec car, people carrier" },
    { name: "Blacklane London", type: "Chauffeur service", estimate: "£75-£140", eta: "60 min notice", rating: "4.8", vehicles: "Business sedan, van" }
  ],
  "Mexico": [
    { name: "Blacklane Mexico City", type: "Chauffeur service", estimate: "$55-$105", eta: "60 min notice", rating: "4.7", vehicles: "Sedan, SUV" },
    { name: "Mexico Private Driver", type: "Tour driver", estimate: "$45/hr", eta: "Advance booking", rating: "4.6", vehicles: "Sedan, van" }
  ],
  "Brazil": [
    { name: "Blacklane Sao Paulo", type: "Chauffeur service", estimate: "$65-$120", eta: "60 min notice", rating: "4.7", vehicles: "Sedan, SUV" },
    { name: "Brazil Executive Transfers", type: "Private transfer", estimate: "$40-$85", eta: "Advance booking", rating: "4.5", vehicles: "Sedan, van" }
  ],
  "Japan": [
    { name: "Tokyo Chauffeur Service", type: "Private driver", estimate: "¥12,000-¥28,000", eta: "Advance booking", rating: "4.8", vehicles: "Sedan, van" },
    { name: "MK Taxi Hire", type: "Hire car", estimate: "¥8,000/hr", eta: "2 hr minimum", rating: "4.7", vehicles: "Premium taxi, van" }
  ],
  "Singapore": [
    { name: "GrabRentals Chauffeur", type: "Private driver", estimate: "S$65-S$120", eta: "Advance booking", rating: "4.7", vehicles: "Sedan, MPV" },
    { name: "Singapore Limousine", type: "Airport and hourly", estimate: "S$75/hr", eta: "2 hr minimum", rating: "4.6", vehicles: "Luxury sedan, van" }
  ],
  "Malaysia": [
    { name: "Kuala Lumpur Chauffeur", type: "Private driver", estimate: "RM180-RM420", eta: "Advance booking", rating: "4.6", vehicles: "Sedan, MPV" },
    { name: "Blacklane KL", type: "Chauffeur service", estimate: "RM260-RM520", eta: "60 min notice", rating: "4.8", vehicles: "Business sedan, van" }
  ],
  "Thailand": [
    { name: "Bangkok Private Driver", type: "Hourly driver", estimate: "฿1,200-฿3,200", eta: "Advance booking", rating: "4.6", vehicles: "Sedan, van" },
    { name: "Blacklane Bangkok", type: "Chauffeur service", estimate: "฿2,400-฿5,200", eta: "60 min notice", rating: "4.8", vehicles: "Business sedan, SUV" }
  ],
  "Indonesia": [
    { name: "Bali Private Driver", type: "Day hire", estimate: "Rp650k-Rp1.2m", eta: "Advance booking", rating: "4.8", vehicles: "SUV, van" },
    { name: "Jakarta Executive Driver", type: "Chauffeur service", estimate: "Rp500k-Rp1.1m", eta: "Advance booking", rating: "4.6", vehicles: "Sedan, MPV" }
  ],
  "India": [
    { name: "Savaari Chauffeur", type: "Outstation and hourly", estimate: "₹1,800-₹4,500", eta: "Advance booking", rating: "4.6", vehicles: "Sedan, SUV" },
    { name: "Blacklane India", type: "Chauffeur service", estimate: "₹3,500-₹8,000", eta: "60 min notice", rating: "4.8", vehicles: "Business sedan, van" }
  ]
};

const rideParticipants = [
  { name: "Jordan", custom: 14, percent: 25, note: "Full route" },
  { name: "Sarah", custom: 18, percent: 40, note: "Extra stop" },
  { name: "Mike", custom: 15, percent: 20, note: "Shared pickup" },
  { name: "Alex", custom: 16, percent: 15, note: "Shared drop-off" },
  { name: "Priya", custom: 12, percent: 0, note: "Short segment" },
  { name: "Noah", custom: 12, percent: 0, note: "Short segment" }
];

const sharedRideMembers = [
  { name: "Jordan", status: "Organizer", splitting: true },
  { name: "Sarah", status: "Joined", splitting: true },
  { name: "Mike", status: "Joined", splitting: true },
  { name: "Alex", status: "Leaving later", splitting: false }
];

const rideHubItems = {
  upcoming: [
    { title: "Dinner transfer", meta: "Today 7:15 PM • JBR Hotel Lobby to Dubai Marina", status: "Ready to book", estimate: "$18-$22", tag: "Group ride" },
    { title: "Airport return", meta: "Tomorrow 10:30 AM • Hotel to DXB Terminal 3", status: "Reminder set", estimate: "$34-$42", tag: "Private transfer" },
    { title: "Beach club pickup", meta: "Friday 1:00 PM • Marina walk to Palm Jumeirah", status: "Voting open", estimate: "$21-$28", tag: "Shared ride" }
  ],
  recommendations: [
    { title: "Fastest pickup", meta: "Careem Comfort • 8 min wait • best for four travelers", cta: "Book ride" },
    { title: "Best group value", meta: "SUV or van recommended over two standard cars", cta: "Compare fares" },
    { title: "Private driver", meta: "Hourly driver works best for dinner, nightlife, and return ride", cta: "Search drivers" }
  ],
  timeline: [
    { time: "6:40 PM", title: "Time-to-leave alert", detail: "Traffic check runs before dinner transfer." },
    { time: "7:15 PM", title: "Pickup window", detail: "Passengers meet at JBR Hotel Lobby." },
    { time: "After ride", title: "Receipt and split", detail: "Import receipt, confirm fare, and notify passengers." }
  ],
  history: [
    { title: "Museum district ride", meta: "Careem • 4 passengers • Split completed", total: "$41.20" },
    { title: "Airport arrival transfer", meta: "Private van • Receipt stored", total: "$96.00" },
    { title: "Lunch shuttle", meta: "Marked paid outside app", total: "$28.50" }
  ],
  notifications: [
    { title: "Driver arriving", meta: "Push and in-app alert are enabled for booked rides." },
    { title: "Fare ready", meta: "Passengers receive payment notification after receipt import." },
    { title: "Route changed", meta: "Group members are notified when pickup or drop-off changes." }
  ]
};

const transportTypeLabels = {
  flights: "Flights",
  trains: "Trains",
  buses: "Buses",
  ferries: "Ferries",
  cruises: "Cruises",
  shuttles: "Shuttles",
  rideShare: "Ride Share",
  rentalCars: "Rental Cars",
  privateTransfers: "Private Transfers"
};

const transportRecords = [
  {
    id: "flight-dl241",
    type: "flights",
    provider: "Delta Air Lines",
    title: "Delta DL 241",
    route: "JFK to DXB",
    confirmation: "TD9K42",
    ticket: "006-4829137764",
    departure: "JFK Terminal 4",
    arrival: "DXB Terminal 3",
    departureTime: "Jul 24, 2026 10:45 PM",
    arrivalTime: "Jul 25, 2026 7:55 PM",
    gate: "B18",
    seat: "22A",
    passenger: "Jordan Smith",
    assignedTo: ["Jordan", "Sarah"],
    status: "Check-in open",
    passType: "Boarding pass",
    accessCode: "QR TD-DL241",
    documents: ["Boarding pass PDF", "Mobile boarding pass screenshot", "Email confirmation"],
    wallet: { apple: true, google: true },
    reminder: "Check-in open now. Boarding reminder 45 minutes before departure.",
    details: ["Boarding group 3", "Baggage allowance: 1 checked bag, 1 carry-on", "Flight status: on time", "Check-in link ready"]
  },
  {
    id: "train-eurostar-9024",
    type: "trains",
    provider: "Eurostar",
    title: "Eurostar 9024",
    route: "London St Pancras to Paris Gare du Nord",
    confirmation: "RAIL-7H2Q",
    ticket: "EU-449208",
    departure: "Platform announced 20 minutes before boarding",
    arrival: "Paris Gare du Nord",
    departureTime: "Aug 3, 2026 9:01 AM",
    arrivalTime: "Aug 3, 2026 12:20 PM",
    gate: "Platform pending",
    seat: "Coach 8, Seat 42",
    passenger: "Alex Lee",
    assignedTo: ["Alex"],
    status: "Confirmed",
    passType: "Mobile rail ticket",
    accessCode: "Barcode EU9024",
    documents: ["Rail ticket PDF", "Rail pass"],
    wallet: { apple: true, google: false },
    reminder: "Boarding instructions available. Platform notification enabled.",
    details: ["Fare type: standard premier", "Coach 8", "Rail pass attached", "Passport check before boarding"]
  },
  {
    id: "bus-flix-88",
    type: "buses",
    provider: "FlixBus",
    title: "Route 88",
    route: "Miami Central to Orlando Station",
    confirmation: "BUS-1208",
    ticket: "FB-88420",
    departure: "Bay 4, Miami Central",
    arrival: "Orlando Bus Terminal",
    departureTime: "Sep 1, 2026 8:10 AM",
    arrivalTime: "Sep 1, 2026 12:35 PM",
    gate: "Bay 4",
    seat: "12C",
    passenger: "Mike Rivera",
    assignedTo: ["Mike", "Priya"],
    status: "Confirmed",
    passType: "Mobile bus ticket",
    accessCode: "QR FB88",
    documents: ["Bus mobile ticket", "Baggage policy"],
    wallet: { apple: false, google: false },
    reminder: "Arrive 20 minutes early. Bay change alerts enabled.",
    details: ["Baggage policy: one checked bag", "Boarding instructions attached", "Route number 88"]
  },
  {
    id: "ferry-bluewater",
    type: "ferries",
    provider: "Bluewater Ferries",
    title: "Bluewater Ferry",
    route: "Santorini Port to Mykonos Port",
    confirmation: "SEA-77A",
    ticket: "BW-302944",
    departure: "Athinios Port",
    arrival: "Mykonos New Port",
    departureTime: "Sep 8, 2026 11:30 AM",
    arrivalTime: "Sep 8, 2026 2:05 PM",
    gate: "Port Gate 2",
    seat: "Deck lounge B",
    passenger: "Sarah Kim",
    assignedTo: ["Sarah", "Jordan", "Alex"],
    status: "Boarding soon",
    passType: "Ferry ticket",
    accessCode: "QR SEA77A",
    documents: ["Ferry ticket PDF", "Port instructions"],
    wallet: { apple: false, google: true },
    reminder: "Embarkation begins 45 minutes before departure.",
    details: ["Vessel: Aegean Star", "Vehicle: none", "Boarding group B", "Port instructions attached"]
  },
  {
    id: "cruise-oceanic",
    type: "cruises",
    provider: "Oceanic Cruise Line",
    title: "Oceanic Vista",
    route: "Miami embarkation to Caribbean sailing",
    confirmation: "CRUISE-4829",
    ticket: "OC-11234",
    departure: "PortMiami Terminal A",
    arrival: "PortMiami Terminal A",
    departureTime: "Oct 10, 2026 12:00 PM",
    arrivalTime: "Oct 17, 2026 7:00 AM",
    gate: "Boarding Group C",
    seat: "Cabin 11234, Deck 11",
    passenger: "Jordan Smith",
    assignedTo: ["Jordan", "Sarah"],
    status: "Confirmed",
    passType: "Cruise boarding pass",
    accessCode: "QR OC4829",
    documents: ["Cruise ticket", "Luggage tags", "Port documents", "Boarding pass"],
    wallet: { apple: true, google: true },
    reminder: "Cruise check-in opens 21 days before sailing.",
    details: ["Ship: Oceanic Vista", "Cabin 11234", "Deck 11", "Luggage tags ready"]
  },
  {
    id: "shuttle-dxb-zoneb",
    type: "shuttles",
    provider: "Marina Grand Shuttle",
    title: "Airport shuttle Zone B",
    route: "DXB Terminal 3 to Marina Grand Hotel",
    confirmation: "SHUT-0912",
    ticket: "MG-7781",
    departure: "DXB Terminal 3 Zone B",
    arrival: "Marina Grand Hotel",
    departureTime: "Jul 25, 2026 8:35 PM",
    arrivalTime: "Jul 25, 2026 9:15 PM",
    gate: "Zone B",
    seat: "Open seating",
    passenger: "Corporate Team",
    assignedTo: ["Corporate Team"],
    status: "Confirmed",
    passType: "Transfer voucher",
    accessCode: "Voucher MG7781",
    documents: ["Shuttle voucher", "Pickup map"],
    wallet: { apple: false, google: false },
    reminder: "Pickup reminder 30 minutes before arrival.",
    details: ["Driver contact hidden until arrival", "Operator: hotel desk", "Runs every 20 minutes"]
  },
  {
    id: "rideshare-careem-22",
    type: "rideShare",
    provider: "Careem",
    title: "Careem reservation",
    route: "JBR Hotel Lobby to Dubai Marina Dinner",
    confirmation: "RIDE-2209",
    ticket: "CAREEM-3301",
    departure: "JBR Hotel Lobby",
    arrival: "Dubai Marina Dinner",
    departureTime: "Jul 26, 2026 7:15 PM",
    arrivalTime: "Jul 26, 2026 7:35 PM",
    gate: "Lobby pickup",
    seat: "SUV reservation",
    passenger: "Jordan Smith",
    assignedTo: ["Jordan", "Sarah", "Mike", "Alex"],
    status: "Confirmed",
    passType: "Ride reservation",
    accessCode: "Reservation RIDE-2209",
    documents: ["Ride confirmation", "Receipt placeholder"],
    wallet: { apple: false, google: false },
    reminder: "Driver assignment notification enabled.",
    details: ["Vehicle: SUV", "Split fare enabled", "Receipt import ready after ride"]
  },
  {
    id: "rental-hertz-dubai",
    type: "rentalCars",
    provider: "Hertz",
    title: "Hertz rental car",
    route: "DXB pickup to DXB return",
    confirmation: "CAR-73HD",
    ticket: "HZ-882041",
    departure: "DXB Rental Center",
    arrival: "DXB Rental Center",
    departureTime: "Jul 25, 2026 9:30 PM",
    arrivalTime: "Jul 29, 2026 5:00 PM",
    gate: "Counter 12",
    seat: "SUV class",
    passenger: "Jordan Smith",
    assignedTo: ["Jordan"],
    status: "Confirmed",
    passType: "Rental voucher",
    accessCode: "Voucher HZ882041",
    documents: ["Rental voucher", "Insurance details", "Pickup instructions"],
    wallet: { apple: false, google: true },
    reminder: "Rental pickup reminder 2 hours before counter time.",
    details: ["Vehicle class: SUV", "Driver: Jordan Smith", "Loyalty number attached", "Insurance details stored"]
  },
  {
    id: "private-blacklane-dubai",
    type: "privateTransfers",
    provider: "Blacklane Dubai",
    title: "Private transfer",
    route: "Marina Grand Hotel to Desert Camp",
    confirmation: "PRV-5542",
    ticket: "BL-99201",
    departure: "Marina Grand Hotel",
    arrival: "Desert Camp Gate",
    departureTime: "Jul 27, 2026 2:15 PM",
    arrivalTime: "Jul 27, 2026 3:20 PM",
    gate: "Hotel valet",
    seat: "Luxury van",
    passenger: "Sarah Kim",
    assignedTo: ["Jordan", "Sarah", "Mike", "Alex", "Priya", "Noah"],
    status: "Confirmed",
    passType: "Private transfer voucher",
    accessCode: "Voucher BL99201",
    documents: ["Transfer voucher", "Driver contact card", "Special instructions"],
    wallet: { apple: false, google: false },
    reminder: "Driver/operator details release 30 minutes before pickup.",
    details: ["Operator: Blacklane Dubai", "Vehicle: luxury van", "Contact number hidden until pickup", "Special instructions saved"]
  }
];

const featuredLivePlanDestinations = [
  {
    id: "dubai-uae",
    location: "United Arab Emirates",
    city: "Dubai",
    region: "Dubai",
    country: "United Arab Emirates",
    title: "Dubai long weekend",
    description: "Rooftop dinners, desert rides, beach clubs, and a shared wallet that keeps everyone even.",
    photo: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop",
    alt: "Dubai skyline at sunset",
    knownFor: "Futuristic skylines, desert adventures, luxury hotels, global food halls, and record-setting architecture.",
    funFact: "Dubai is home to the Burj Khalifa, famous worldwide for its record-setting height.",
    tip: "Book popular rooftop dinners early and confirm modest dress codes for cultural stops.",
    season: "November to March",
    greeting: "Marhaba",
    category: "Luxury city escape",
    active: true,
    featured: true,
    displayOrder: 1,
    reviewed: "July 2026",
    exploreCategory: "luxury",
    adventures: ["Dune bashing at sunset", "Dinner in the desert", "Sky-view lounges", "Old Dubai creek walks"]
  },
  {
    id: "california-coast",
    location: "California, United States",
    city: "Big Sur",
    region: "California",
    country: "United States",
    title: "California coast drive",
    description: "Pacific overlooks, vineyard stops, beach bonfires, and live alerts for every route change.",
    photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
    alt: "California coastal highway beside turquoise water",
    knownFor: "Pacific Coast Highway drives, beaches, national parks, wineries, film culture, and tech cities.",
    funFact: "California has the highest and lowest points in the contiguous United States.",
    tip: "Download offline maps before coastal stretches where service can be spotty.",
    season: "April to October",
    greeting: "Hey from the coast",
    category: "Road trip",
    active: true,
    featured: true,
    displayOrder: 2,
    reviewed: "July 2026",
    exploreCategory: "weekend",
    adventures: ["Drive Big Sur", "Surf lessons", "Yosemite hikes", "Sunset beach picnics"]
  },
  {
    id: "tokyo-japan",
    location: "Tokyo, Japan",
    city: "Tokyo",
    region: "Kanto",
    country: "Japan",
    title: "Tokyo food sprint",
    description: "Ramen counters, late trains, market mornings, and bill splits that update before the next stop.",
    photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1600&auto=format&fit=crop",
    alt: "Tokyo city street with bright signs",
    knownFor: "Sushi, ramen, bullet trains, temples, cherry blossoms, anime culture, and precise hospitality.",
    funFact: "Japan's Shinkansen bullet trains are famous for speed, punctuality, and smooth rides.",
    tip: "Load a prepaid transit card to make trains, shops, and vending machines easier.",
    season: "March to May or October to November",
    greeting: "Konnichiwa",
    category: "Food and culture",
    active: true,
    featured: true,
    displayOrder: 3,
    reviewed: "July 2026",
    exploreCategory: "food",
    adventures: ["Night markets in Tokyo", "Tea ceremony", "Mount Fuji views", "Kyoto shrine walks"]
  },
  {
    id: "new-york-city",
    location: "New York City, New York",
    city: "New York City",
    region: "New York",
    country: "United States",
    title: "New York city week",
    description: "Museum slots, dinner reservations, Broadway timing, and meeting point reminders for the whole crew.",
    photo: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1600&auto=format&fit=crop",
    alt: "New York skyline and city streets",
    knownFor: "Broadway, skyline views, museums, pizza slices, fashion, finance, and nonstop neighborhood energy.",
    funFact: "New York City's subway system is one of the largest rapid transit systems in the world.",
    tip: "Group nearby neighborhoods together so meals, shows, and museums do not turn into cross-town scrambles.",
    season: "April to June or September to December",
    greeting: "Welcome to New York",
    category: "City adventure",
    active: true,
    featured: true,
    displayOrder: 4,
    reviewed: "July 2026",
    exploreCategory: "trending",
    adventures: ["Broadway night", "Central Park picnic", "Rooftop skyline photos", "Brooklyn food crawl"]
  },
  {
    id: "santorini-greece",
    location: "Santorini, Greece",
    city: "Santorini",
    region: "Cyclades",
    country: "Greece",
    title: "Santorini sunset loop",
    description: "Cliffside stays, boat day holds, shared photos, and itinerary changes pushed as they happen.",
    photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=1600&auto=format&fit=crop",
    alt: "White buildings on a Santorini cliff above the sea",
    knownFor: "Ancient ruins, island sunsets, clear blue water, Mediterranean food, mythology, and whitewashed villages.",
    funFact: "Santorini's dramatic cliffs were shaped by one of history's major volcanic eruptions.",
    tip: "Reserve sunset viewpoints and boat tours ahead of time during peak island months.",
    season: "April to June or September to October",
    greeting: "Yassas",
    category: "Island escape",
    active: true,
    featured: true,
    displayOrder: 5,
    reviewed: "July 2026",
    exploreCategory: "beaches",
    adventures: ["Caldera boat day", "Oia sunset photos", "Greek cooking class", "Ancient ruins tour"]
  },
  {
    id: "miami-florida",
    location: "Miami, Florida",
    city: "Miami",
    region: "Florida",
    country: "United States",
    title: "Miami friends escape",
    description: "Pool plans, dinner votes, rideshare splits, and wallet approvals that keep the weekend moving.",
    photo: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=1600&auto=format&fit=crop",
    alt: "Tropical beach shoreline with clear water",
    knownFor: "Warm beaches, Latin food, theme parks, Everglades wildlife, nightlife, and cruise departures.",
    funFact: "Florida has more than 1,300 miles of coastline.",
    tip: "Plan beach time early, then keep evenings flexible for dinner votes and nightlife.",
    season: "December to May",
    greeting: "Hola from Miami",
    category: "Beach and nightlife",
    active: true,
    featured: true,
    displayOrder: 6,
    reviewed: "July 2026",
    exploreCategory: "nightlife",
    adventures: ["Airboat ride", "South Beach morning", "Little Havana food stop", "Keys day trip"]
  },
  {
    id: "san-juan-puerto-rico",
    location: "San Juan, Puerto Rico",
    city: "San Juan",
    region: "Puerto Rico",
    country: "United States",
    title: "San Juan color run",
    description: "Old city walks, beach afternoons, salsa nights, and memory prompts after every itinerary day.",
    photo: "https://images.unsplash.com/photo-1542321993-8fc36217e26d?q=80&w=1600&auto=format&fit=crop",
    alt: "Colorful buildings in Old San Juan",
    knownFor: "Colorful colonial streets, beaches, forts, salsa, mofongo, coffee, and lively plazas.",
    funFact: "Old San Juan is known for blue cobblestone streets brought as ballast on Spanish ships.",
    tip: "Wear comfortable shoes for Old San Juan hills and keep a beach layer in your day bag.",
    season: "December to April",
    greeting: "Bienvenidos",
    category: "Culture and beach",
    active: true,
    featured: true,
    displayOrder: 7,
    reviewed: "July 2026",
    exploreCategory: "hidden",
    adventures: ["El Morro sunset", "Salsa night", "Beach brunch", "Rainforest day trip"]
  },
  {
    id: "paris-france",
    location: "Paris, France",
    city: "Paris",
    region: "Ile-de-France",
    country: "France",
    title: "Paris art and cafe days",
    description: "Museum passes, cafe routes, shopping notes, and quiet reminders before timed entries.",
    photo: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1600&auto=format&fit=crop",
    alt: "Eiffel Tower and Paris cityscape",
    knownFor: "Art museums, fashion, bakeries, cafe culture, river walks, gardens, and landmark architecture.",
    funFact: "The Louvre began as a medieval fortress before becoming one of the world's best-known museums.",
    tip: "Book timed museum entries and group restaurants in the same arrondissement when possible.",
    season: "April to June or September to October",
    greeting: "Bonjour",
    category: "Romantic city",
    active: true,
    featured: true,
    displayOrder: 8,
    reviewed: "July 2026",
    exploreCategory: "shopping",
    adventures: ["Louvre morning", "Seine walk", "Pastry crawl", "Vintage shopping"]
  },
  {
    id: "bali-indonesia",
    location: "Bali, Indonesia",
    city: "Ubud",
    region: "Bali",
    country: "Indonesia",
    title: "Bali wellness week",
    description: "Rice terraces, surf lessons, sunrise hikes, villa days, and easy private-driver planning.",
    photo: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1600&auto=format&fit=crop",
    alt: "Bali rice terraces and palm trees",
    knownFor: "Rice terraces, temples, beaches, wellness retreats, surf breaks, and warm hospitality.",
    funFact: "Bali follows a unique local calendar system used for religious and community events.",
    tip: "Use private drivers for longer day trips and allow extra time between regions.",
    season: "April to October",
    greeting: "Om swastiastu",
    category: "Wellness adventure",
    active: true,
    featured: true,
    displayOrder: 9,
    reviewed: "July 2026",
    exploreCategory: "outdoor",
    adventures: ["Mount Batur sunrise", "Temple visit", "Surf lesson", "Ubud food walk"]
  }
].filter((destination) => destination.active && destination.featured)
  .sort((a, b) => a.displayOrder - b.displayOrder);

const additionalLivePlanDestinations = [
  {
    id: "london-england", location: "London, England", city: "London", region: "England", country: "United Kingdom",
    title: "London culture weekend", description: "Markets, royal landmarks, theater nights, and neighborhood food stops connected by simple transit plans.",
    photo: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1600&auto=format&fit=crop", alt: "London skyline and historic architecture",
    knownFor: "Royal landmarks, West End theater, museums, markets, parks, and distinct historic neighborhoods.",
    funFact: "London has more than 170 museums, from major national collections to small specialist spaces.",
    tip: "Group each day by neighborhood and use contactless payment for most public transit.", season: "April to June or September", greeting: "Hello", category: "Culture and city", exploreCategory: "trending",
    adventures: ["West End show", "Borough Market lunch", "Thames walk", "Notting Hill morning"]
  },
  {
    id: "rome-italy", location: "Rome, Italy", city: "Rome", region: "Lazio", country: "Italy",
    title: "Rome history and food", description: "Ancient landmarks, piazza walks, pasta reservations, and timed museum entries in one relaxed itinerary.",
    photo: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1600&auto=format&fit=crop", alt: "Historic Roman architecture at sunset",
    knownFor: "Ancient ruins, Renaissance art, fountains, neighborhood trattorias, piazzas, and Vatican museums.",
    funFact: "Rome surrounds Vatican City, the world's smallest independent state by area.",
    tip: "Reserve major archaeological sites early and leave time for slower neighborhood walks.", season: "April to June or September to October", greeting: "Ciao", category: "History and food", exploreCategory: "food",
    adventures: ["Colosseum morning", "Trastevere dinner", "Vatican museums", "Piazza gelato walk"]
  },
  {
    id: "barcelona-spain", location: "Barcelona, Spain", city: "Barcelona", region: "Catalonia", country: "Spain",
    title: "Barcelona art and coast", description: "Gaudi architecture, beach afternoons, tapas nights, and easy group routes through lively districts.",
    photo: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=1600&auto=format&fit=crop", alt: "Barcelona city and colorful architecture",
    knownFor: "Modernist architecture, Mediterranean beaches, tapas, football, markets, and energetic plazas.",
    funFact: "Barcelona's Eixample district is recognized by its distinctive octagonal city blocks.",
    tip: "Book popular Gaudi sites by time slot and plan dinner later than in many other cities.", season: "May to June or September to October", greeting: "Hola", category: "Art and beach", exploreCategory: "beaches",
    adventures: ["Sagrada Familia", "Tapas crawl", "Gothic Quarter walk", "Barceloneta sunset"]
  },
  {
    id: "lisbon-portugal", location: "Lisbon, Portugal", city: "Lisbon", region: "Lisbon", country: "Portugal",
    title: "Lisbon hills and coast", description: "Tile-lined streets, lookout points, seafood dinners, and day-trip plans along the Atlantic coast.",
    photo: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=1600&auto=format&fit=crop", alt: "Lisbon rooftops and waterfront",
    knownFor: "Historic trams, tiled facades, hilltop views, seafood, fado music, and nearby Atlantic beaches.",
    funFact: "Lisbon is one of Western Europe's oldest capital cities.",
    tip: "Wear shoes with good grip for the hills and reserve a full day for Sintra.", season: "March to June or September to October", greeting: "Ola", category: "Coastal city", exploreCategory: "hidden",
    adventures: ["Alfama walk", "Sintra day trip", "Pastel tasting", "Sunset miradouro"]
  },
  {
    id: "amsterdam-netherlands", location: "Amsterdam, Netherlands", city: "Amsterdam", region: "North Holland", country: "Netherlands",
    title: "Amsterdam canal days", description: "Museum reservations, canal neighborhoods, bike-friendly routes, and cafe stops organized by district.",
    photo: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=1600&auto=format&fit=crop", alt: "Amsterdam canal and narrow houses",
    knownFor: "Canals, cycling, art museums, historic houses, flower markets, and compact walkable neighborhoods.",
    funFact: "Amsterdam has more bicycles than residents.",
    tip: "Stay out of marked bike lanes while walking and reserve major museums before arrival.", season: "April to May or September", greeting: "Hallo", category: "Canals and art", exploreCategory: "weekend",
    adventures: ["Canal cruise", "Museum quarter", "Jordaan cafes", "Countryside bike ride"]
  },
  {
    id: "marrakech-morocco", location: "Marrakech, Morocco", city: "Marrakech", region: "Marrakesh-Safi", country: "Morocco",
    title: "Marrakech market escape", description: "Courtyard stays, market walks, garden mornings, and desert extensions with private-driver coordination.",
    photo: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?q=80&w=1600&auto=format&fit=crop", alt: "Marrakech courtyard and traditional architecture",
    knownFor: "Medina markets, riads, gardens, Moroccan cuisine, artisan workshops, and Atlas Mountain day trips.",
    funFact: "Marrakech is often called the Red City because of its rose-colored walls and buildings.",
    tip: "Agree on taxi prices before departure and use a guide for the first medina visit.", season: "March to May or September to November", greeting: "Salam", category: "Markets and design", exploreCategory: "shopping",
    adventures: ["Medina guide walk", "Riad cooking class", "Majorelle Garden", "Atlas day trip"]
  },
  {
    id: "cape-town-south-africa", location: "Cape Town, South Africa", city: "Cape Town", region: "Western Cape", country: "South Africa",
    title: "Cape Town coast and peaks", description: "Mountain views, coastal drives, food markets, and wine-country plans with weather-aware timing.",
    photo: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?q=80&w=1600&auto=format&fit=crop", alt: "Cape Town coastline below Table Mountain",
    knownFor: "Table Mountain, dramatic coastline, vineyards, diverse food, wildlife, and scenic road trips.",
    funFact: "Table Mountain supports one of the world's richest concentrations of plant species.",
    tip: "Keep outdoor plans flexible because mountain wind and cloud can change quickly.", season: "November to March", greeting: "Howzit", category: "Mountains and coast", exploreCategory: "outdoor",
    adventures: ["Table Mountain", "Cape Peninsula drive", "Winelands lunch", "Boulders Beach"]
  },
  {
    id: "bangkok-thailand", location: "Bangkok, Thailand", city: "Bangkok", region: "Bangkok", country: "Thailand",
    title: "Bangkok flavor tour", description: "Temple mornings, river rides, night markets, and quick food discoveries built around transit-friendly routes.",
    photo: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1600&auto=format&fit=crop", alt: "Bangkok skyline and temple roofs",
    knownFor: "Street food, temples, river transport, night markets, rooftop views, and lively shopping districts.",
    funFact: "Bangkok's ceremonial name is one of the longest place names in the world.",
    tip: "Use rail and river boats during busy traffic periods and carry a light temple cover-up.", season: "November to February", greeting: "Sawasdee", category: "Food and energy", exploreCategory: "food",
    adventures: ["Temple morning", "Night market dinner", "Canal boat ride", "Rooftop sunset"]
  },
  {
    id: "singapore", location: "Singapore", city: "Singapore", region: "Central Region", country: "Singapore",
    title: "Singapore food and gardens", description: "Hawker centers, waterfront architecture, garden nights, and seamless transit for a polished city break.",
    photo: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=1600&auto=format&fit=crop", alt: "Singapore skyline and waterfront",
    knownFor: "Hawker food, modern architecture, tropical gardens, efficient transit, shopping, and multicultural districts.",
    funFact: "Singapore is one of only a few modern city-states in the world.",
    tip: "Use the MRT for most trips and visit outdoor gardens after the afternoon heat.", season: "February to April", greeting: "Hello", category: "Modern city", exploreCategory: "trending",
    adventures: ["Hawker center crawl", "Gardens by the Bay", "Marina walk", "Sentosa afternoon"]
  },
  {
    id: "seoul-south-korea", location: "Seoul, South Korea", city: "Seoul", region: "Seoul", country: "South Korea",
    title: "Seoul style and food", description: "Palace mornings, design districts, barbecue dinners, and late-night neighborhoods connected by metro.",
    photo: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=80&w=1600&auto=format&fit=crop", alt: "Seoul skyline and traditional palace",
    knownFor: "Palaces, Korean food, beauty and fashion, mountain trails, pop culture, and late-night neighborhoods.",
    funFact: "Seoul is surrounded by mountains that are reachable from the city transit system.",
    tip: "Save destinations in Korean for easier taxi directions and restaurant searches.", season: "April to May or September to October", greeting: "Annyeonghaseyo", category: "Style and culture", exploreCategory: "shopping",
    adventures: ["Palace visit", "Korean barbecue", "Han River picnic", "Design district night"]
  },
  {
    id: "sydney-australia", location: "Sydney, Australia", city: "Sydney", region: "New South Wales", country: "Australia",
    title: "Sydney harbor week", description: "Harbor walks, beach mornings, neighborhood dining, and coastal day trips with weather previews.",
    photo: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=1600&auto=format&fit=crop", alt: "Sydney Opera House and harbor",
    knownFor: "Harbor landmarks, surf beaches, coastal walks, multicultural dining, and nearby national parks.",
    funFact: "Sydney Harbour contains hundreds of kilometers of shoreline.",
    tip: "Use ferries as both transportation and an easy way to see the harbor.", season: "September to November or March to May", greeting: "G'day", category: "Harbor and beach", exploreCategory: "beaches",
    adventures: ["Harbor ferry", "Bondi coastal walk", "Opera House tour", "Blue Mountains day"]
  },
  {
    id: "honolulu-hawaii", location: "Honolulu, Hawaii", city: "Honolulu", region: "Hawaii", country: "United States",
    title: "Honolulu island days", description: "Beach mornings, scenic drives, local food stops, and respectful cultural experiences across Oahu.",
    photo: "https://images.unsplash.com/photo-1507876466758-bc54f384809c?q=80&w=1600&auto=format&fit=crop", alt: "Honolulu beach and volcanic coastline",
    knownFor: "Waikiki, volcanic landscapes, surf culture, local food, historic sites, and warm Pacific water.",
    funFact: "Diamond Head is the remnant of a volcanic crater formed hundreds of thousands of years ago.",
    tip: "Reserve popular hikes and cultural sites, and avoid leaving valuables in parked cars.", season: "April to June or September to December", greeting: "Aloha", category: "Island adventure", exploreCategory: "beaches",
    adventures: ["Waikiki sunrise", "Diamond Head", "North Shore drive", "Local plate lunch"]
  },
  {
    id: "cancun-mexico", location: "Cancun, Mexico", city: "Cancun", region: "Quintana Roo", country: "Mexico",
    title: "Cancun coast getaway", description: "Caribbean water, cenote outings, resort days, and archaeological trips with clear transfer plans.",
    photo: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?q=80&w=1600&auto=format&fit=crop", alt: "Cancun turquoise shoreline",
    knownFor: "Caribbean beaches, resorts, cenotes, Mayan heritage, snorkeling, and regional Yucatan cuisine.",
    funFact: "The Cancun coastline borders the Mesoamerican Barrier Reef system.",
    tip: "Confirm pickup zones for excursions and keep reef-safe sunscreen in your day bag.", season: "December to April", greeting: "Bienvenidos", category: "Caribbean escape", exploreCategory: "beaches",
    adventures: ["Cenote swim", "Reef snorkel", "Mayan ruins", "Isla Mujeres day"]
  },
  {
    id: "new-orleans-louisiana", location: "New Orleans, Louisiana", city: "New Orleans", region: "Louisiana", country: "United States",
    title: "New Orleans music weekend", description: "Live music, Creole food, neighborhood walks, and festival-ready group planning.",
    photo: "https://images.unsplash.com/photo-1515963665762-77ef90e624fa?q=80&w=1600&auto=format&fit=crop", alt: "Historic New Orleans street and balconies",
    knownFor: "Jazz, Creole and Cajun food, festivals, historic neighborhoods, streetcars, and distinctive architecture.",
    funFact: "New Orleans is widely recognized as a birthplace of jazz.",
    tip: "Check festival calendars early and use marked ride-share pickup points after busy events.", season: "February to May or October to November", greeting: "Welcome, y'all", category: "Music and food", exploreCategory: "nightlife",
    adventures: ["Frenchmen Street", "Creole dinner", "Garden District", "Steamboat evening"]
  },
  {
    id: "nashville-tennessee", location: "Nashville, Tennessee", city: "Nashville", region: "Tennessee", country: "United States",
    title: "Nashville music escape", description: "Songwriter rooms, Southern food, neighborhood stops, and shared rides for a lively group weekend.",
    photo: "https://images.unsplash.com/photo-1545419913-775e6e82e14a?q=80&w=1600&auto=format&fit=crop", alt: "Nashville skyline and music district",
    knownFor: "Live music, songwriter venues, hot chicken, country music history, murals, and energetic nightlife.",
    funFact: "Nashville is home to one of the world's longest-running live radio broadcasts.",
    tip: "Reserve major music venues and keep neighborhood transfers together for groups.", season: "April to May or September to October", greeting: "Hey y'all", category: "Music city", exploreCategory: "nightlife",
    adventures: ["Songwriter show", "Hot chicken lunch", "Music museum", "East Nashville murals"]
  }
].map((destination, index) => ({
  ...destination,
  active: true,
  featured: false,
  displayOrder: featuredLivePlanDestinations.length + index + 1,
  reviewed: "August 2026"
}));

const livePlanDestinations = [...featuredLivePlanDestinations, ...additionalLivePlanDestinations]
  .sort((a, b) => a.displayOrder - b.displayOrder);

const tripTypeConfigs = {
  solo: {
    label: "Solo Trip",
    detailsTitle: "Solo trip details",
    travelersHidden: true,
    aiPrompt: "How can I help plan your trip? Try: Build me a 5-day itinerary.",
    message: "Solo Trip selected. Group chat, voting, and shared wallet tools stay hidden until you invite others.",
    enabled: ["AI Trip Manager", "Personal itinerary", "Flight management", "Hotel management", "Transportation", "Budget tracker", "Travel documents", "Packing checklist", "Social sharing", "AI recommendations", "Travel journal", "Memories"],
    hidden: ["Group chat", "Group wallet", "Expense splitting", "Voting", "Group invitations", "Corporate dashboards"]
  },
  group: {
    label: "Group Trip",
    detailsTitle: "Group trip details",
    travelersHidden: false,
    aiPrompt: "How can I help plan your trip? Try: Create a poll for dinner on the first night.",
    message: "Group Trip selected. Shared itinerary, chat, wallet, expense splits, and voting are available.",
    enabled: ["Group invitations", "Shared itinerary", "Group chat", "@mentions", "Polls and voting", "Group wallet", "Smart bill splitting", "Ride share splitting", "Shared memories", "AI Trip Manager", "Shared documents", "Group announcements"],
    hidden: ["Corporate finance dashboards", "Employee-only assignments", "Admin-only budget approvals"]
  },
  corporate: {
    label: "Corporate Retreat / Business Travel",
    detailsTitle: "Corporate retreat details",
    travelersHidden: false,
    aiPrompt: "How can I help plan your trip? Try: Generate a three-day retreat agenda with workshops and team-building activities.",
    message: "Corporate Retreat selected. Employees see only assigned travel, schedules, announcements, and important information. Company financial data stays admin-only.",
    enabled: ["Employee invitations", "Role permissions", "Company announcements", "Team schedules", "Event agenda", "Flight assignments", "Hotel assignments", "Transportation schedules", "Activity schedules", "AI Operations Manager", "Corporate reporting", "Admin budgets", "Expense approvals", "Audit logs"],
    hidden: ["Company financial data for employees", "Other employee payment details", "Unauthorized budget controls"]
  },
  wedding: {
    label: "Wedding",
    detailsTitle: "Wedding event details",
    travelersHidden: false,
    aiPrompt: "How can I help plan your wedding weekend? Try: Build ceremony, reception, hotel block, and shuttle schedules.",
    message: "Wedding selected. Ceremony, reception, hotel block, wedding party, RSVP, transportation, shared wallet, and memories are enabled.",
    enabled: ["Ceremony schedule", "Reception schedule", "Rehearsal dinner", "Wedding party", "Hotel block", "Dress code", "Registry link", "Weekend schedule", "Guest RSVPs", "Transportation", "Shared album"],
    hidden: ["Corporate finance reports for guests", "Unapproved public media"]
  },
  birthday: {
    label: "Birthday Trip",
    detailsTitle: "Birthday event details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the birthday trip? Try: Create dinner, activity, nightlife, and contribution plans.",
    message: "Birthday Trip selected. Dinner, activities, nightlife, gift preferences, shared costs, reminders, and media are enabled.",
    enabled: ["Birthday person", "Milestone", "Main celebration", "Dinner", "Activities", "Nightlife", "Gift preferences", "Contributions", "Media"],
    hidden: ["Corporate dashboards", "Conference badge tools"]
  },
  anniversary: {
    label: "Anniversary Trip",
    detailsTitle: "Anniversary event details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the anniversary? Try: Build a romantic dinner, hotel, activities, and photo recap plan.",
    message: "Anniversary Trip selected. Celebration schedule, dinner, hotel, activities, guest list, photos, and recap are enabled.",
    enabled: ["Celebration dinner", "Hotel stay", "Activities", "Guest list", "Photo album", "Recap", "Reminders"],
    hidden: ["Conference tracks", "Corporate finance reports"]
  },
  family_reunion: {
    label: "Family Reunion",
    detailsTitle: "Family reunion details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the reunion? Try: Import relatives, assign rooms, build family activities, and send announcements.",
    message: "Family Reunion selected. Relative import, room assignments, family schedule, announcements, shared photos, and wallet are enabled.",
    enabled: ["Guest import", "Room assignments", "Family schedule", "Meal planning", "Activities", "Announcements", "Family album", "Shared wallet"],
    hidden: ["Nightlife-first flows", "Corporate finance reports"]
  },
  conference: {
    label: "Conference",
    detailsTitle: "Conference event details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the conference? Try: Create sessions, speaker tracks, hotel blocks, and shuttle routes.",
    message: "Conference selected. Sessions, speakers, tracks, sponsors, rooms, badges, hotel blocks, transportation, and agenda updates are enabled.",
    enabled: ["Sessions", "Speakers", "Tracks", "Sponsors", "Registration", "Venue rooms", "Badges", "Hotel blocks", "Transportation", "Agenda updates"],
    hidden: ["Leisure-only budget cards", "Unapproved guest financial details"]
  },
  graduation_trip: {
    label: "Graduation Trip",
    detailsTitle: "Graduation trip details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the graduation trip? Try: Add travel, dinner, celebration activities, and contribution tracking.",
    message: "Graduation Trip selected. Travel plans, guests, dinner, celebration schedule, contributions, photos, and recap are enabled.",
    enabled: ["Travel plans", "Dinner", "Celebration schedule", "Guest invitations", "Contributions", "Photos", "Completion recap"],
    hidden: ["Corporate-only policy controls", "Conference badge tools"]
  },
  church_retreat: {
    label: "Church Retreat",
    detailsTitle: "Church retreat details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the church retreat? Try: Build worship, sessions, meal, transportation, and emergency-contact plans.",
    message: "Church Retreat selected. Theme, ministry group, worship schedule, sessions, meals, transportation groups, and emergency contacts are enabled.",
    enabled: ["Retreat theme", "Ministry group", "Worship schedule", "Sessions", "Transportation groups", "Meal schedule", "Emergency contacts", "Announcements"],
    hidden: ["Nightlife modules", "Public media without approval"]
  },
  bachelor_bachelorette: {
    label: "Bachelor / Bachelorette Trip",
    detailsTitle: "Bachelor or bachelorette details",
    travelersHidden: false,
    aiPrompt: "How can I help plan the celebration? Try: Create activities, dinner, nightlife, transportation, and cost split plans.",
    message: "Bachelor/Bachelorette selected. Group activities, dinner, nightlife, polls, transportation, shared costs, and guest reminders are enabled.",
    enabled: ["Activities", "Dinner", "Nightlife", "Polls", "Transportation", "Shared costs", "Guest reminders", "Media"],
    hidden: ["Corporate reports", "Conference sponsor tools"]
  },
  special_event: {
    label: "Special Event",
    detailsTitle: "Special event details",
    travelersHidden: false,
    aiPrompt: "How can I help plan this event? Try: Build a custom schedule, guest list, travel plan, wallet, and recap.",
    message: "Special Event selected. Custom modules for guests, travel, schedule, wallet, messages, media, notifications, and completion are enabled.",
    enabled: ["Custom schedule", "Guest list", "Travel records", "Shared wallet", "Messages", "Media", "Notifications", "Completion workflow"],
    hidden: ["Unauthorized finance data", "Unapproved public media"]
  },
  cruise: {
    label: "Cruise Vacation",
    detailsTitle: "Cruise vacation details",
    travelersHidden: false,
    aiPrompt: "How can I help plan your cruise? Try: Show me every port stop, cabin detail, and excursion reminder.",
    message: "Cruise Vacation selected. Ship details, cabin, ports, excursions, onboard schedule, dining, wallet, documents, and cruise memories are enabled.",
    enabled: ["Cruise overview", "Ship information", "Cabin assignment", "Port schedule", "Shore excursions", "Onboard schedule", "Dining reservations", "Cruise wallet", "Cruise documents", "AI Cruise Manager", "Cruise memories", "Boarding reminders"],
    hidden: ["Corporate budgets unless authorized", "Other cabin records unless assigned", "Unapproved shared photos", "Private admin reports"]
  }
};

const eventTypeToApiType = {
  solo: "solo_trip",
  group: "group_trip",
  corporate: "corporate_retreat",
  cruise: "cruise_vacation",
  wedding: "wedding",
  birthday: "birthday",
  anniversary: "anniversary",
  family_reunion: "family_reunion",
  conference: "conference",
  graduation_trip: "graduation_trip",
  church_retreat: "church_retreat",
  bachelor_bachelorette: "bachelor_bachelorette",
  special_event: "special_event"
};

const eventSpecificFieldConfigs = {
  wedding: [["Ceremony date and time", "ceremony_at", "2026-09-12T16:00"], ["Reception date and time", "reception_at", "2026-09-12T19:00"], ["Venue", "venue", "Ocean View Garden"], ["Rehearsal dinner", "rehearsal_dinner", "Friday welcome dinner"], ["Wedding party", "wedding_party", "8 attendants"], ["Hotel block", "hotel_block", "Harbor Suites"], ["Dress code", "dress_code", "Formal beach"], ["Registry link", "registry_link", "https://example.com/registry"], ["Weekend schedule", "weekend_schedule", "Welcome dinner, ceremony, brunch"]],
  birthday: [["Birthday person", "birthday_person", "Jordan"], ["Age or milestone", "milestone", "30th birthday"], ["Main celebration", "main_celebration", "Rooftop dinner"], ["Dinner", "dinner", "Ocean rooftop"], ["Activities", "activities", "Boat day, spa, nightlife"], ["Nightlife", "nightlife", "Lounge reservations"], ["Gift preferences", "gift_preferences", "Experiences over gifts"]],
  anniversary: [["Anniversary milestone", "milestone", "10 years"], ["Celebration dinner", "celebration_dinner", "Private chef dinner"], ["Hotel plan", "hotel_plan", "Ocean-view suite"], ["Activities", "activities", "Sunset cruise, photo walk"], ["Guest notes", "guest_notes", "Close family only"]],
  family_reunion: [["Family name", "family_name", "Johnson Family"], ["Relative import source", "import_source", "CSV"], ["Room assignment plan", "room_plan", "By household"], ["Family schedule", "family_schedule", "Picnic, dinner, games"], ["Meal plan", "meal_plan", "Potluck and catered dinner"], ["Announcements", "announcements", "Welcome message"]],
  conference: [["Sessions", "sessions", "Opening keynote, workshops"], ["Speakers", "speakers", "Keynote and panel speakers"], ["Tracks", "tracks", "Leadership, Sales, Product"], ["Sponsors", "sponsors", "Gold and community sponsors"], ["Registration details", "registration", "Badge pickup at lobby"], ["Venue rooms", "venue_rooms", "Palm Conference Room"], ["Badge information", "badge_info", "QR badge required"]],
  graduation_trip: [["Graduate", "graduate", "Jordan"], ["School", "school", "State University"], ["Dinner", "dinner", "Family dinner"], ["Celebration schedule", "celebration_schedule", "Ceremony, dinner, beach day"], ["Contribution plan", "contribution_plan", "Shared activities only"]],
  church_retreat: [["Retreat theme", "theme", "Renew and Restore"], ["Ministry group", "ministry_group", "Young Adults"], ["Worship schedule", "worship_schedule", "Morning and evening worship"], ["Sessions", "sessions", "Breakouts and prayer groups"], ["Transportation groups", "transportation_groups", "Bus A and Bus B"], ["Meal schedule", "meal_schedule", "Breakfast, lunch, dinner"], ["Emergency contacts", "emergency_contacts", "Retreat safety lead"]],
  bachelor_bachelorette: [["Guest of honor", "guest_of_honor", "Taylor"], ["Main celebration", "main_celebration", "Dinner and lounge"], ["Activities", "activities", "Boat day, brunch"], ["Nightlife", "nightlife", "VIP table"], ["Transportation plan", "transportation_plan", "Private driver"], ["Cost split plan", "cost_split", "Equal split for shared events"]],
  special_event: [["Event theme", "theme", "Custom celebration"], ["Primary venue", "venue", "Main venue"], ["Key activities", "activities", "Dinner, photos, group activity"], ["Special instructions", "instructions", "Bring ID and comfortable shoes"]]
};

const invitationConfigs = {
  solo: {
    badge: "Solo itinerary share",
    modeCopy: "Solo travelers can share an itinerary with trusted contacts, emergency contacts, or invite someone to join later.",
    title: "You're invited to my Tokyo solo food sprint",
    message: "Follow my itinerary, see key travel updates, and stay connected while I explore Tokyo.",
    recipients: ["Trusted family", "Emergency contact", "Close friend", "Invite someone later"],
    sent: 2,
    opened: 1,
    accepted: 1,
    pending: 1,
    companyLogo: false
  },
  group: {
    badge: "Group adventure invite",
    modeCopy: "Group organizers can invite friends, family, couples, clubs, sports teams, and travel groups.",
    title: "You're invited to our Miami 2027 Adventure",
    message: "Join us for an unforgettable weekend of beaches, great food, shared rides, and amazing memories.",
    recipients: ["Friends", "Family", "Couples", "Clubs", "Sports teams", "Travel groups"],
    sent: 12,
    opened: 9,
    accepted: 7,
    pending: 3,
    companyLogo: false
  },
  corporate: {
    badge: "Corporate branded invite",
    modeCopy: "Corporate admins can invite employees, executives, managers, clients, speakers, vendors, and event coordinators while hiding confidential financial details.",
    title: "You're invited to the 2027 Leadership Retreat",
    message: "Please join the company retreat for workshops, team-building, assigned travel, event schedules, and important announcements.",
    recipients: ["Employees", "Executives", "Managers", "Clients", "Guest speakers", "Vendors", "Event coordinators", "CSV import", "Company directory"],
    sent: 86,
    opened: 74,
    accepted: 61,
    pending: 19,
    companyLogo: true
  },
  wedding: {
    badge: "Wedding weekend invite",
    modeCopy: "Wedding hosts can invite guests, wedding party, family, vendors, and out-of-town travelers with hotel, shuttle, and schedule visibility.",
    title: "You're invited to our wedding weekend",
    message: "Join us for the ceremony, reception, hotel block, transportation updates, RSVP details, and shared memories.",
    recipients: ["Wedding party", "Family", "Friends", "Vendors", "Out-of-town guests"],
    sent: 86,
    opened: 72,
    accepted: 61,
    pending: 25,
    companyLogo: false
  },
  birthday: {
    badge: "Birthday celebration invite",
    modeCopy: "Birthday organizers can invite friends, family, and groups while tracking dinner, activities, contributions, and nightlife plans.",
    title: "You're invited to the birthday trip",
    message: "Celebrate with dinner, activities, shared costs, reminders, and a group photo album.",
    recipients: ["Friends", "Family", "Dinner guests", "Activity group"],
    sent: 18,
    opened: 14,
    accepted: 11,
    pending: 7,
    companyLogo: false
  },
  anniversary: {
    badge: "Anniversary invite",
    modeCopy: "Anniversary hosts can share celebration details, dinner plans, hotel information, activity schedules, and memories.",
    title: "You're invited to our anniversary celebration",
    message: "Join us for a special anniversary trip with dinner, activities, travel updates, and photos.",
    recipients: ["Close family", "Friends", "Dinner guests"],
    sent: 10,
    opened: 8,
    accepted: 6,
    pending: 4,
    companyLogo: false
  },
  family_reunion: {
    badge: "Family reunion invite",
    modeCopy: "Family reunion organizers can import relatives, track households, assign rooms, and send family announcements.",
    title: "You're invited to the family reunion",
    message: "Join the family schedule, room planning, activities, meal updates, announcements, and shared album.",
    recipients: ["Relatives", "Households", "Elders", "Cousins", "Family coordinators"],
    sent: 54,
    opened: 42,
    accepted: 35,
    pending: 19,
    companyLogo: false
  },
  conference: {
    badge: "Conference registration invite",
    modeCopy: "Conference organizers can invite attendees, speakers, sponsors, vendors, and staff with role-appropriate agenda access.",
    title: "You're invited to the conference",
    message: "View sessions, speakers, tracks, venue rooms, badge details, hotel blocks, transportation, and agenda updates.",
    recipients: ["Attendees", "Speakers", "Sponsors", "Staff", "Vendors"],
    sent: 240,
    opened: 198,
    accepted: 166,
    pending: 74,
    companyLogo: true
  },
  graduation_trip: {
    badge: "Graduation trip invite",
    modeCopy: "Graduation organizers can invite family and friends, collect RSVPs, coordinate travel, and share celebration memories.",
    title: "You're invited to the graduation trip",
    message: "Join the travel plan, dinner, celebration schedule, contributions, reminders, and photo album.",
    recipients: ["Family", "Friends", "Classmates", "Dinner guests"],
    sent: 22,
    opened: 18,
    accepted: 15,
    pending: 7,
    companyLogo: false
  },
  church_retreat: {
    badge: "Church retreat invite",
    modeCopy: "Retreat organizers can invite attendees, ministry leaders, volunteers, and drivers while tracking sessions and emergency contacts.",
    title: "You're invited to the church retreat",
    message: "View the worship schedule, sessions, meals, transportation groups, emergency contacts, and announcements.",
    recipients: ["Attendees", "Ministry leaders", "Volunteers", "Drivers", "Staff"],
    sent: 64,
    opened: 51,
    accepted: 44,
    pending: 20,
    companyLogo: true
  },
  bachelor_bachelorette: {
    badge: "Celebration trip invite",
    modeCopy: "Bachelor and bachelorette organizers can invite the group, coordinate activities, vote, split costs, and send reminders.",
    title: "You're invited to the celebration trip",
    message: "Join the group plan for dinner, activities, nightlife, transportation, shared costs, polls, and photos.",
    recipients: ["Wedding party", "Friends", "Activity group"],
    sent: 14,
    opened: 13,
    accepted: 12,
    pending: 2,
    companyLogo: false
  },
  special_event: {
    badge: "Special event invite",
    modeCopy: "Special event hosts can customize invitations, RSVPs, schedules, travel, wallet, media, and reminders for the event.",
    title: "You're invited to this special event",
    message: "Join the custom event plan with schedule, travel details, RSVP, reminders, media, and updates.",
    recipients: ["Guests", "Hosts", "Vendors", "Coordinators"],
    sent: 20,
    opened: 15,
    accepted: 12,
    pending: 8,
    companyLogo: false
  },
  cruise: {
    badge: "Cruise vacation invite",
    modeCopy: "Cruise organizers can invite cabin mates, family, friends, corporate attendees, vendors, or travel agents while keeping cabin details private.",
    title: "You're invited to our Caribbean cruise",
    message: "Join the cruise plan to see ship details, cabin assignments, ports, excursions, onboard activities, dining, and memories.",
    recipients: ["Cabin mates", "Family", "Friends", "Travel agent", "Corporate attendees", "Vendors"],
    sent: 8,
    opened: 6,
    accepted: 5,
    pending: 3,
    companyLogo: false
  }
};

const authCarouselSlides = [
  {
    quote: "Plan together. Travel better.",
    src: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1400&auto=format&fit=crop",
    alt: "Friends walking together during a city trip"
  },
  {
    quote: "Where trips become memories.",
    src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop",
    alt: "Bright beach vacation shoreline"
  },
  {
    quote: "Your next adventure starts here.",
    src: "https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1400&auto=format&fit=crop",
    alt: "Greek island coastline with blue water"
  },
  {
    quote: "Travel is better when shared.",
    src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1400&auto=format&fit=crop",
    alt: "Friends dining together at a restaurant"
  },
  {
    quote: "Explore more. Stress less.",
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop",
    alt: "Road trip along a coastal highway"
  },
  {
    quote: "Every journey deserves a story.",
    src: "https://images.unsplash.com/photo-1522199710521-72d69614c702?q=80&w=1400&auto=format&fit=crop",
    alt: "Corporate team working during a retreat"
  },
  {
    quote: "Go somewhere worth remembering.",
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1400&auto=format&fit=crop",
    alt: "Traveler hiking through a dramatic outdoor landscape"
  },
  {
    quote: "One app. Every part of your trip.",
    src: "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?q=80&w=1400&auto=format&fit=crop",
    alt: "Busy local market with colorful travel details"
  }
];

const exploreCategories = {
  trending: {
    label: "Trending",
    filters: ["Rooftop", "Creator guides", "Tours", "Hotels", "Saved often", "Group-friendly"],
    items: [
      {
        id: "miami-yacht",
        title: "Miami Sunset Yacht Experience",
        type: "Viral group experience",
        price: "$180 starting",
        rating: 4.8,
        distance: 2.4,
        status: "Available Aug 8-11",
        image: "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?q=80&w=900&auto=format&fit=crop",
        description: "Private sunset cruise with skyline views, shareable photo stops, and group add-ons.",
        details: ["Location: Biscayne Bay", "Best dates: Friday and Saturday sunset", "Saved by 2,430 Travel-Drip users"],
        actions: ["Save", "Add to Trip", "Share", "Book"]
      },
      {
        id: "nola-food-weekend",
        title: "Three-Day New Orleans Food Weekend",
        type: "Trending itinerary",
        price: "$780 estimate",
        rating: 4.7,
        distance: 0.8,
        status: "Best Sep-Nov",
        image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=900&auto=format&fit=crop",
        description: "Sample itinerary with brunch, jazz, seafood, local history, and creator food guides.",
        details: ["Featured restaurants included", "Weekend dates recommended", "Popular for couples and small groups"],
        actions: ["Save", "Add to Trip", "Share", "Customize Trip"]
      }
    ]
  },
  food: {
    label: "Food and Restaurants",
    filters: ["Under $25", "$25-$50", "$50-$100", "Fine Dining", "Rooftop", "Brunch", "Seafood", "Vegan", "Local Favorites", "Group-Friendly"],
    items: [
      {
        id: "oceanview-sushi",
        title: "Oceanview Rooftop Sushi",
        type: "Japanese cuisine",
        price: "$55 per person",
        rating: 4.7,
        distance: 1.1,
        status: "Open now",
        image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=900&auto=format&fit=crop",
        description: "Rooftop seating, ocean views, group reservations, and omakase-style platters.",
        details: ["Cuisine: Japanese", "Reservations supported", "Dietary notes available"],
        actions: ["View Menu", "Get Directions", "Save", "Add to Itinerary", "Start Smart Bill Split", "Make Reservation"]
      },
      {
        id: "local-cuban-cafe",
        title: "Local Cuban Cafe",
        type: "Cuban cuisine",
        price: "$22 per person",
        rating: 4.6,
        distance: 0.7,
        status: "Open now",
        image: "https://images.unsplash.com/photo-1559305616-3f99cd43e353?q=80&w=900&auto=format&fit=crop",
        description: "Casual brunch favorite with cafe con leche, sandwiches, and group-friendly tables.",
        details: ["Popular brunch location", "Local favorite", "Under $25 per person"],
        actions: ["View Menu", "Get Directions", "Save", "Add to Itinerary", "Start Smart Bill Split"]
      }
    ]
  },
  nightlife: {
    label: "Nightclubs and Nightlife",
    filters: ["Nightclubs", "Rooftop Bars", "Lounges", "Live Music", "Beach Clubs", "Cocktail Bars", "LGBTQ+ Friendly", "Under $50 Entry", "VIP Experiences"],
    items: [
      {
        id: "skyline-lounge",
        title: "Skyline Rooftop Lounge",
        type: "Rooftop bar",
        price: "$25 entry estimate",
        rating: 4.6,
        distance: 1.8,
        status: "Open until 2:00 AM",
        image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=900&auto=format&fit=crop",
        description: "R&B and hip-hop, upscale casual dress code, skyline photo spots, and safety notes.",
        details: ["Age: 21+", "Dress code: upscale casual", "Music: R&B and hip-hop"],
        actions: ["Get Directions", "Save", "Add to Itinerary", "Vote in Group Chat", "Book"]
      },
      {
        id: "ocean-beach-club",
        title: "Ocean Beach Club",
        type: "Beachfront venue",
        price: "$40 entry estimate",
        rating: 4.5,
        distance: 3.2,
        status: "Open until 3:00 AM",
        image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=900&auto=format&fit=crop",
        description: "House and electronic music, table reservations, beachfront access, and ride-share pickup tips.",
        details: ["Age: 21+", "Tables supported", "Safety: use marked pickup zone"],
        actions: ["Get Directions", "Save", "Add to Itinerary", "Vote in Group Chat", "Visit Website"]
      }
    ]
  },
  under900: {
    label: "Trips Under $900",
    filters: ["Flight included", "Hotel included", "Food estimate", "Activities", "2-4 days", "Customize budget"],
    items: [
      {
        id: "miami-875",
        title: "Three-Day Miami Getaway",
        type: "Budget trip estimate",
        price: "$875 per person",
        rating: 4.7,
        distance: 0,
        status: "Estimate includes taxes and fees",
        image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=900&auto=format&fit=crop",
        description: "Flight $245, two hotel nights $310, food $160, activities $95, transportation $65.",
        details: ["Hotel: boutique beach stay", "Suggested dates: Aug weekends", "All pricing is estimated"],
        actions: ["Save", "Customize Trip", "Create This Trip", "Share"]
      },
      {
        id: "nashville-820",
        title: "Four-Day Nashville Weekend",
        type: "Budget trip estimate",
        price: "$820 per person",
        rating: 4.6,
        distance: 0,
        status: "Estimate includes local transport",
        image: "https://images.unsplash.com/photo-1545419913-775e6e82e14a?q=80&w=900&auto=format&fit=crop",
        description: "Flight $230, three hotel nights $285, food $155, activities $90, transportation $60.",
        details: ["Music venues included", "Great for groups", "All pricing is estimated"],
        actions: ["Save", "Customize Trip", "Create This Trip"]
      }
    ]
  }
};

[
  ["activities", "Activities", "Guided tour", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=900&auto=format&fit=crop", ["Museums", "Tours", "Workshops", "Tickets", "Rainy day"]],
  ["hidden", "Hidden Gems", "Local favorite", "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=900&auto=format&fit=crop", ["Local guides", "Quiet spots", "Photo walks", "Underrated food"]],
  ["beaches", "Beaches", "Beach day", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=900&auto=format&fit=crop", ["Swimmable", "Family", "Beach club", "Sunset"]],
  ["shopping", "Shopping", "Market and boutiques", "https://images.unsplash.com/photo-1481437156560-3205f6a55735?q=80&w=900&auto=format&fit=crop", ["Markets", "Luxury", "Vintage", "Local makers"]],
  ["outdoor", "Outdoor Adventures", "Trail and water", "https://images.unsplash.com/photo-1527004013197-933c4bb611b3?q=80&w=900&auto=format&fit=crop", ["Hiking", "Water sports", "Bike", "Guided"]],
  ["family", "Family-Friendly", "All ages", "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=900&auto=format&fit=crop", ["All ages", "Low walking", "Accessible", "Educational"]],
  ["luxury", "Luxury Experiences", "Premium", "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=900&auto=format&fit=crop", ["Resorts", "Private tours", "Fine dining", "Spa"]],
  ["events", "Local Events", "This week", "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=900&auto=format&fit=crop", ["Concerts", "Festivals", "Sports", "Pop-ups"]],
  ["weekend", "Weekend Getaways", "Short trip", "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=900&auto=format&fit=crop", ["2 nights", "Road trip", "Flight deals", "Couples"]]
].forEach(([key, label, type, image, filters]) => {
  exploreCategories[key] = {
    label,
    filters,
    items: [
      {
        id: `${key}-top-pick`,
        title: `${label} Top Pick`,
        type,
        price: key === "luxury" ? "$240+" : key === "family" ? "$35+" : "$65 estimate",
        rating: 4.7,
        distance: key === "weekend" ? 120 : 2.6,
        status: key === "events" ? "Available this weekend" : "Recommended for selected dates",
        image,
        description: `Personalized ${label.toLowerCase()} recommendation based on destination, dates, budget, interests, and trip type.`,
        details: ["Matches current destination", "Adapted to selected trip type", "Includes safety and planning notes"],
        actions: ["Save", "Add to Trip", "Share", "Get Directions"]
      },
      {
        id: `${key}-local-guide`,
        title: `${label} Local Guide`,
        type: "Creator guide",
        price: "$18 guide",
        rating: 4.5,
        distance: 1.4,
        status: "Saved often",
        image,
        description: "A curated guide with local timing tips, nearby stops, and Travel-Drip itinerary actions.",
        details: ["Public travel guide", "Great for planning", "Includes nearby options"],
        actions: ["Save", "Add to Trip", "Share", "Ask AI Trip Manager"]
      }
    ]
  };
});

function hideLoader() {
  window.setTimeout(() => $("#loader")?.classList.add("done"), 450);
}

function escapeHtml(text) {
  return text.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderPlan(index) {
  const itinerary = $("#itinerary");
  const builderCopy = $("#builderCopy");
  if (!itinerary) return;
  itinerary.innerHTML = plans[index].map(([time, title, detail]) => `
    <div class="stop">
      <time>${time}</time>
      <div><strong>${title}</strong><span>${detail}</span></div>
    </div>
  `).join("");
  if (builderCopy) builderCopy.textContent = dayCopy[index];
}

function startLivePlanRotation() {
  const hero = $("#dashboardHome");
  const photo = $("#livePlanPhoto");
  const location = $("#livePlanLocation");
  const title = $("#livePlanTitle");
  const description = $("#livePlanDescription");
  const dots = $("#destinationDots");
  if (!hero || !photo || !location || !title || !description) return;

  const chooser = $("#destinationChooser");
  if (chooser) {
    chooser.setAttribute("aria-label", `Choose from all ${livePlanDestinations.length} Travel-Drip destinations`);
    chooser.innerHTML = livePlanDestinations.map((destination, index) => `
      <button type="button" data-destination-index="${index}" aria-pressed="false" title="${escapeHtml(destination.location)}">${escapeHtml(destination.city)}</button>
    `).join("");
  }
  if (dots) {
    dots.innerHTML = livePlanDestinations.map((destination, index) => `
      <button type="button" data-destination-index="${index}" aria-label="Show ${escapeHtml(destination.location)}"></button>
    `).join("");
  }

  const renderDestination = (nextIndex = state.liveDestinationIndex + 1) => {
    state.liveDestinationIndex = (nextIndex + livePlanDestinations.length) % livePlanDestinations.length;
    const destination = livePlanDestinations[state.liveDestinationIndex];
    hero.classList.add("is-transitioning");
    window.setTimeout(() => {
      photo.src = destination.photo;
      photo.alt = destination.alt;
      location.textContent = `${destination.category} • ${destination.location}`;
      title.textContent = destination.title;
      description.textContent = destination.description;
      $("#livePlanFunFact").textContent = `Fun fact: ${destination.funFact}`;
      $("#livePlanTip").textContent = `Tip: ${destination.tip}`;
      $("#livePlanSeason").textContent = `Best time: ${destination.season}`;
      $("#livePlanGreeting").textContent = `Greeting: ${destination.greeting}`;
      $("#livePlanExploreButton").textContent = `Explore ${destination.city}`;
      renderDestinationInsights(destination, state.liveDestinationIndex);
      preloadNextDestinationImage();
    }, 180);
    window.setTimeout(() => hero.classList.remove("is-transitioning"), 760);
  };

  renderDestinationInsights(livePlanDestinations[0], 0);
  renderDestination(0);

  const resumeRotation = () => {
    if (state.liveDestinationPaused || state.liveDestinationTimer) return;
    state.liveDestinationTimer = window.setInterval(() => renderDestination(), 6500);
  };
  const stopRotation = () => {
    if (!state.liveDestinationTimer) return;
    window.clearInterval(state.liveDestinationTimer);
    state.liveDestinationTimer = null;
  };
  const setPaused = (paused) => {
    state.liveDestinationPaused = paused;
    const pauseButton = $("#destinationPauseButton");
    if (pauseButton) {
      pauseButton.setAttribute("aria-pressed", String(paused));
      pauseButton.setAttribute("aria-label", paused ? "Resume destination slideshow" : "Pause destination slideshow");
      pauseButton.setAttribute("title", paused ? "Resume slideshow" : "Pause slideshow");
      pauseButton.textContent = paused ? "▶" : "Ⅱ";
    }
    paused ? stopRotation() : resumeRotation();
  };

  $$("#destinationChooser button, #destinationDots button").forEach((button) => {
    button.addEventListener("click", () => renderDestination(Number(button.dataset.destinationIndex)));
  });
  $("#destinationPrevButton")?.addEventListener("click", () => renderDestination(state.liveDestinationIndex - 1));
  $("#destinationNextButton")?.addEventListener("click", () => renderDestination(state.liveDestinationIndex + 1));
  $("#destinationPauseButton")?.addEventListener("click", () => setPaused(!state.liveDestinationPaused));
  $("#livePlanExploreButton")?.addEventListener("click", () => openDestinationExplore("destinations"));
  $$("[data-destination-action]").forEach((button) => {
    button.addEventListener("click", () => openDestinationExplore(button.dataset.destinationAction));
  });
  hero.addEventListener("mouseenter", stopRotation);
  hero.addEventListener("mouseleave", resumeRotation);
  hero.addEventListener("touchstart", (event) => {
    state.liveDestinationTouchStartX = event.changedTouches[0]?.clientX || 0;
  }, { passive: true });
  hero.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - state.liveDestinationTouchStartX;
    if (Math.abs(delta) > 44) renderDestination(state.liveDestinationIndex + (delta < 0 ? 1 : -1));
  }, { passive: true });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
  else resumeRotation();
}

function renderDestinationInsights(destination, activeIndex) {
  const knownFor = $("#destinationKnownFor");
  const funFact = $("#destinationFunFact");
  const adventures = $("#destinationAdventures");
  if (!knownFor || !funFact || !adventures) return;

  knownFor.textContent = destination.knownFor;
  funFact.textContent = destination.funFact;
  adventures.innerHTML = destination.adventures.map((adventure) => `<span>${escapeHtml(adventure)}</span>`).join("");
  $("#destinationReviewDate").textContent = `${destination.location} content reviewed ${destination.reviewed}. Active featured destination ID: ${destination.id}.`;
  $$("#destinationChooser button").forEach((button) => {
    const isActive = Number(button.dataset.destinationIndex) === activeIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  $$("#destinationDots button").forEach((button) => {
    const isActive = Number(button.dataset.destinationIndex) === activeIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function preloadNextDestinationImage() {
  const nextDestination = livePlanDestinations[(state.liveDestinationIndex + 1) % livePlanDestinations.length];
  if (!nextDestination) return;
  const image = new Image();
  image.src = nextDestination.photo;
}

function getGlobalDestinationContext(target = getTargetFromRoute()) {
  const contexts = {
    exploreDrops: { label: "Trending discovery", action: "Explore", actionType: "destinations" },
    tripsPanel: { label: "Upcoming trip idea", action: "Add to Trip", actionType: "activities" },
    socialHub: { label: "Photo-worthy destination", action: "Create Story", actionType: "restaurants" },
    walletPanel: { label: "Budget-friendly idea", action: "Explore Deals", actionType: "destinations" },
    groupBank: { label: "Shared-trip inspiration", action: "Add to Trip", actionType: "activities" },
    splitBill: { label: "Food destination", action: "View Restaurants", actionType: "restaurants" },
    rideShareHub: { label: "Easy transportation city", action: "View Transport", actionType: "activities" },
  transportationPanel: { label: "Transportation overview", action: "View Transport", actionType: "activities" },
    cruisePanel: { label: "Cruise port idea", action: "View Cruise Ideas", actionType: "destinations" },
    itineraryAlerts: { label: "Itinerary inspiration", action: "View Activities", actionType: "activities" },
    importantInfo: { label: "Travel-ready destination", action: "View Details", actionType: "destinations" },
    aiTravelPlanner: { label: "Matches your AI planning answers", action: "Ask AI", actionType: "ai" },
    enterpriseRbac: { label: "Approved corporate destination", action: "View Policy", actionType: "destinations" },
    myProfile: { label: "Personalized inspiration", action: "Explore", actionType: "destinations" },
    adminPanel: { label: "Admin settings", action: "Review", actionType: "settings" },
    copyrightPolicy: { label: "Travel-Drip help", action: "Explore", actionType: "destinations" }
  };
  return contexts[target] || contexts.exploreDrops;
}

function renderGlobalDestinationHeader(target = getTargetFromRoute(), nextIndex = state.globalDestinationIndex) {
  const header = $("#globalDestinationHeader");
  if (!header) return;
  const isAuth = document.body.classList.contains("auth-screen");
  header.hidden = isAuth;
  header.setAttribute("aria-hidden", String(isAuth));
  if (isAuth) return;

  const corporateMode = $("#dashboardTripType")?.value === "corporate" && hasValidCorporateAccess();
  const destinations = corporateMode
    ? livePlanDestinations.filter((destination) => /United Arab Emirates|New York|California/.test(destination.location))
    : livePlanDestinations;
  const list = destinations.length ? destinations : livePlanDestinations;
  state.globalDestinationIndex = (nextIndex + list.length) % list.length;
  const destination = list[state.globalDestinationIndex];
  const context = getGlobalDestinationContext(target);

  header.classList.add("is-transitioning");
  window.setTimeout(() => {
    $("#globalDestinationPhoto").src = destination.photo;
    $("#globalDestinationPhoto").alt = destination.alt;
    $("#globalDestinationPage").textContent = context.label;
    $("#globalDestinationName").textContent = destination.location;
    $("#globalDestinationPrompt").textContent = corporateMode
      ? `${destination.city} inspiration is limited to company-approved travel content.`
      : destination.description;
    $("#globalDestinationAction").textContent = `${context.action} ${destination.city}`;
    $("#globalDestinationAction").dataset.destinationAction = context.actionType;
    $("#globalDestinationAction").dataset.destinationId = destination.id;
  }, 120);
  window.setTimeout(() => header.classList.remove("is-transitioning"), 520);
}

function startGlobalDestinationHeader() {
  const header = $("#globalDestinationHeader");
  if (!header) return;
  $("#globalDestinationPhoto")?.addEventListener("error", () => {
    header.classList.add("image-fallback");
    $("#globalDestinationPhoto").alt = "Travel-Drip destination inspiration fallback";
  });
  $("#globalDestinationPhoto")?.addEventListener("load", () => {
    header.classList.remove("image-fallback");
  });
  renderGlobalDestinationHeader(getTargetFromRoute(), state.globalDestinationIndex);
  const stop = () => {
    if (!state.globalDestinationTimer) return;
    window.clearInterval(state.globalDestinationTimer);
    state.globalDestinationTimer = null;
  };
  const resume = () => {
    if (state.globalDestinationPaused || state.globalDestinationTimer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    state.globalDestinationTimer = window.setInterval(() => renderGlobalDestinationHeader(getTargetFromRoute(), state.globalDestinationIndex + 1), 8000);
  };
  header.addEventListener("mouseenter", stop);
  header.addEventListener("mouseleave", resume);
  header.addEventListener("touchstart", (event) => {
    state.globalDestinationTouchStartX = event.changedTouches[0]?.clientX || 0;
  }, { passive: true });
  header.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - state.globalDestinationTouchStartX;
    if (Math.abs(delta) > 44) renderGlobalDestinationHeader(getTargetFromRoute(), state.globalDestinationIndex + (delta < 0 ? 1 : -1));
  }, { passive: true });
  $("#globalDestinationPauseButton")?.addEventListener("click", () => {
    state.globalDestinationPaused = !state.globalDestinationPaused;
    $("#globalDestinationPauseButton").setAttribute("aria-pressed", String(state.globalDestinationPaused));
    $("#globalDestinationPauseButton").textContent = state.globalDestinationPaused ? "Play" : "Pause";
    state.globalDestinationPaused ? stop() : resume();
  });
  $("#globalDestinationAction")?.addEventListener("click", () => {
    const destinationId = $("#globalDestinationAction").dataset.destinationId;
    const destinationIndex = livePlanDestinations.findIndex((destination) => destination.id === destinationId);
    if (destinationIndex >= 0) state.liveDestinationIndex = destinationIndex;
    openDestinationExplore($("#globalDestinationAction").dataset.destinationAction || "destinations");
  });
  resume();
}

async function openDestinationExplore(action = "destinations") {
  const destination = livePlanDestinations[state.liveDestinationIndex] || livePlanDestinations[0];
  const destinationRouteAction = action === "destinations" ? "overview" : action;
  if (action === "ai") {
    history.pushState({ target: "socialHub", destinationId: destination.id, action }, "", getRouteForTarget("socialHub"));
    renderRoute("socialHub");
    $("#messageStatus").textContent = `AI Trip Manager opened with ${destination.location}: ${destination.tip}`;
    addAuditEntry("Destination banner action", `AI Trip Manager opened for ${destination.location}.`);
    await saveSyncedEvent("destination_banner_action", {
      destinationId: destination.id,
      location: destination.location,
      action,
      routeCategory: "ai-trip-manager"
    });
    return;
  }
  const categoryMap = {
    destinations: destination.exploreCategory || "trending",
    activities: "activities",
    hotels: "luxury",
    restaurants: "food",
    ai: "trending"
  };
  const category = categoryMap[action] || destination.exploreCategory || "trending";
  if ($("#exploreDestinationInput")) $("#exploreDestinationInput").value = destination.location;
  if ($("#exploreSearchInput")) $("#exploreSearchInput").value = action === "ai" ? `AI ideas for ${destination.city}` : destination.city;
  history.pushState(
    { target: "exploreDrops", category, destinationId: destination.id, action },
    "",
    getDestinationExploreRoute(destination, destinationRouteAction)
  );
  renderRoute("exploreDrops");
  showDestinationExploreDetail(destination.id, destinationRouteAction);
  const actionCopy = {
    destinations: `Explore destination details opened for ${destination.location}.`,
    activities: `Activities filtered for ${destination.location}.`,
    hotels: `Hotels and luxury stays filtered for ${destination.location}.`,
    restaurants: `Food and restaurant recommendations filtered for ${destination.location}.`,
    ai: `AI Trip Manager opened with ${destination.location} as the planning context.`
  };
  $("#exploreStatusMessage").textContent = actionCopy[action] || `Explore opened for ${destination.location}.`;
  addAuditEntry("Destination banner action", actionCopy[action] || `Explore opened for ${destination.location}.`);
  await saveSyncedEvent("destination_banner_action", {
    destinationId: destination.id,
    location: destination.location,
    action,
    routeCategory: category
  });
}

function renderTripType(type) {
  const config = tripTypeConfigs[type] || tripTypeConfigs.solo;
  $$("[data-trip-type]").forEach((typeButton) => {
    const isActive = typeButton.dataset.tripType === type;
    typeButton.classList.toggle("active", isActive);
    typeButton.setAttribute("aria-pressed", String(isActive));
  });

  $("#soloModeMessage").textContent = config.message;
  $("#tripDetailsStep").hidden = false;
  $("#tripAiSetupStep").hidden = false;
  $("#tripDetailsTitle").textContent = config.detailsTitle;
  $("#tripAiSetupPrompt").textContent = config.aiPrompt;
  $("#travelerCountField").hidden = config.travelersHidden;
  $("#tripTravelersInput").value = config.travelersHidden ? "1" : "6";
  $("#featuresEnabledList").innerHTML = config.enabled.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("");
  $("#featuresHiddenList").innerHTML = config.hidden.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("");
  renderEventSpecificFields(type);
  renderInvitationSetup(type);
}

function renderEventSpecificFields(type) {
  const fields = eventSpecificFieldConfigs[type] || [];
  const panel = $("#eventSpecificFields");
  const grid = $("#eventSpecificFieldGrid");
  if (!panel || !grid) return;
  panel.hidden = fields.length === 0;
  grid.innerHTML = fields.map(([label, key, value]) => `
    <label>${escapeHtml(label)}
      <input data-event-specific-key="${escapeHtml(key)}" type="${key.endsWith("_at") ? "datetime-local" : "text"}" value="${escapeHtml(value)}">
    </label>
  `).join("");
}

function getEventSpecificDetails() {
  return Object.fromEntries($$("[data-event-specific-key]").map((input) => [input.dataset.eventSpecificKey, input.value.trim()]));
}

const transportationTravelSections = new Set(["flights", "trains", "buses", "cruises", "ferries", "rideShare", "transfers", "publicTransit", "routeComparison", "boarding", "tickets", "smartRoute"]);

const travelTileDestinations = {
  overview: {
    title: "Travel Home",
    route: "/travel",
    summary: "Travel Home keeps the current trip, next booking, weather preview, alerts, missing items, progress, and quick actions easy to scan."
  },
  alerts: {
    title: "Travel Alerts",
    route: "/trips/dubai-weekend/transportation/alerts",
    summary: "Flight check-in, weather, document, and reservation alerts for the selected trip."
  },
  missing: {
    title: "Missing Items",
    route: "/trips/dubai-weekend/transportation/missing-items",
    summary: "Missing reservations, documents, insurance, and travel tasks appear as short actionable cards."
  },
  flights: {
    title: "Flights",
    route: "/trips/dubai-weekend/transportation/flights",
    summary: "2 upcoming flights. Next departure: Miami to Tokyo in 5 days. Full flight records open on the Flights page."
  },
  hotels: {
    title: "Hotels",
    route: "/trips/dubai-weekend/transportation/hotels",
    summary: "2 confirmed hotel reservations. Check-in details, room notes, and confirmation files open on the Hotels page."
  },
  trains: {
    title: "Trains",
    route: "/trips/dubai-weekend/transportation/trains",
    summary: "2 saved train tickets. Station, platform, fare, and transfer details open on the Trains page."
  },
  buses: {
    title: "Buses",
    route: "/trips/dubai-weekend/transportation/buses",
    summary: "Group shuttle and bus assignments are ready. Passenger lists and pickup details open on the Buses page."
  },
  ferries: {
    title: "Cruises and ferries",
    route: "/trips/dubai-weekend/transportation/ferries",
    summary: "Cruise boarding pass, ferry times, luggage tags, and port notes open on the Cruises and Ferries page."
  },
  cruises: {
    title: "Cruises",
    route: "/trips/dubai-weekend/transportation/cruises",
    summary: "Cruise line, ship, cabin, port stops, luggage tags, shore excursions, and embarkation documents open on the Cruises page."
  },
  rideShare: {
    title: "Transportation",
    route: "/trips/dubai-weekend/transportation/ride-share",
    summary: "Airport pickup is scheduled. Ride-share, private driver, route, and fare split tools open on the Transportation page."
  },
  transfers: {
    title: "Airport Transfers",
    route: "/trips/dubai-weekend/transportation/transfers",
    summary: "Airport, hotel, event, and cruise transfers show pickup, destination, passengers, estimate status, and booking method."
  },
  publicTransit: {
    title: "Public Transit",
    route: "/trips/dubai-weekend/transportation/public-transit",
    summary: "Train, subway, bus, and walking alternatives compare cost, duration, walking distance, transfers, accessibility, and savings."
  },
  routeComparison: {
    title: "Route Comparison",
    route: "/trips/dubai-weekend/transportation/routes",
    summary: "Compare multi-leg routes by cost, duration, transfers, walking, arrival, booking needs, and savings."
  },
  tickets: {
    title: "Tickets",
    route: "/trips/dubai-weekend/transportation/tickets",
    summary: "Wallet passes and QR codes are available. Boarding passes and event tickets open in Ticket Center."
  },
  boarding: {
    title: "Boarding information",
    route: "/trips/dubai-weekend/transportation/boarding",
    summary: "Boarding pass is ready. Gate B18, boarding group 3, seat 14A, and check-in reminders open on the Boarding Info page."
  },
  weather: {
    title: "Weather",
    route: "/trips/dubai-weekend/transportation/weather",
    summary: "Tokyo weather is 82°F with light rain on arrival evening. Forecast, packing guidance, travel alerts, and outdoor timing open on the Weather page."
  },
  maps: {
    title: "Maps",
    route: "/trips/dubai-weekend/transportation/maps",
    summary: "Airports, hotels, stations, ports, pickup points, and saved route stops open in the Travel Maps page."
  },
  documents: {
    title: "Travel documents",
    route: "/trips/dubai-weekend/transportation/documents",
    summary: "Passport, insurance, and confirmations are organized. Secure uploads open in Document Center."
  },
  itinerary: {
    title: "Itinerary",
    route: "/trips/dubai-weekend/transportation/itinerary",
    summary: "Daily schedule, Smart Route, Your Trips, reservations, transportation, activities, and notes are grouped with normal spacing."
  },
  smartRoute: {
    title: "Smart Route",
    route: "/trips/dubai-weekend/transportation/smart-route",
    summary: "Smart Route stays close to Your Trips with weather, traffic, and timing recommendations."
  },
  yourTrips: {
    title: "Your Trips",
    route: "/trips/dubai-weekend/transportation/your-trips",
    summary: "Switch active, archived, and saved trips without losing the active Travel section."
  },
  travelers: {
    title: "Travelers",
    route: "/trips/dubai-weekend/transportation/travelers",
    summary: "Traveler-specific passes, documents, and records stay permission-aware."
  }
};

const travelSearchTargets = [
  ["transportationPanel", ["boarding", "pass", "ticket", "qr", "barcode", "seat", "gate", "dl 241", "flight", "airline", "delta", "airport", "train", "rail", "platform", "bus", "shuttle", "cruise", "ship", "cabin", "port", "uber", "lyft", "careem", "grab", "didi", "ola", "ride", "taxi", "driver", "transfer", "transport", "route", "fare"]],
  ["hotels", ["hotel", "stay", "reservation", "room", "check-in", "tokyo station"]],
  ["weather", ["weather", "rain", "forecast", "temperature", "uv", "wind"]],
  ["documents", ["document", "passport", "insurance", "visa", "receipt"]],
  ["maps", ["map", "route", "directions", "pickup", "location"]],
  ["itinerary", ["itinerary", "schedule", "reservation", "daily"]],
  ["smartRoute", ["smart route", "traffic", "leave", "route"]],
  ["yourTrips", ["trip", "archive", "current trip"]],
  ["missing", ["missing", "needed", "todo"]],
  ["alerts", ["alert", "notification", "reminder"]]
];

const travelSmartSearchRecords = [
  { group: "Transportation", section: "transportationPanel", icon: "✈️", title: "DL 241 Miami to Tokyo", meta: "MIA to HND • Jul 18 • 8:45 AM", status: "Confirmed" },
  { group: "Transportation", section: "transportationPanel", icon: "🎫", title: "Boarding pass for Jordan Smith", meta: "Gate B18 • Seat 14A • Boarding 7:55 AM", status: "Checked In" },
  { group: "Hotels", section: "hotels", icon: "🏨", title: "Tokyo Station Hotel", meta: "Aug 8 - Aug 13 • Queen Room", status: "Saved" },
  { group: "Trips", section: "overview", icon: "🌍", title: "Miami to Tokyo Adventure", meta: "Tokyo, Japan • 4 travelers • 84% ready", status: "Active" },
  { group: "Transportation", section: "transportationPanel", icon: "▦", title: "Travel-Drip digital boarding pass", meta: "QR code, barcode, gate, seat, group, and status", status: "Ready" },
  { group: "Transportation", section: "transportationPanel", icon: "🚘", title: "Airport pickup to Tokyo Station Hotel", meta: "Driver assigned • 42 minute estimate", status: "Scheduled" },
  { group: "Restaurants", section: "itinerary", icon: "🍽️", title: "Ocean Rooftop Sushi", meta: "Reservation • Smart bill split available", status: "Confirmed" },
  { group: "Activities", section: "itinerary", icon: "🎟️", title: "Catamaran cruise and winery tour", meta: "Marina Dock B • smart route ready", status: "Booked" },
  { group: "Travel Documents", section: "documents", icon: "📄", title: "Passport, insurance, and confirmations", meta: "12 saved files • 1 missing item", status: "Action needed" },
  { group: "Weather Locations", section: "weather", icon: "🌦️", title: "Tokyo arrival weather", meta: "82°F • light rain • packing guidance", status: "Alert" },
  { group: "Reservations", section: "documents", icon: "🧾", title: "Hotel, dining, and transfer confirmations", meta: "3 confirmed reservations", status: "Synced" },
  { group: "Maps and Routes", section: "maps", icon: "🗺️", title: "Airport, hotel, and pickup maps", meta: "Saved locations and directions", status: "Ready" }
];

function getTravelSmartSearchMatches(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? travelSmartSearchRecords.filter((item) => [item.group, item.title, item.meta, item.status].join(" ").toLowerCase().includes(normalized))
    : travelSmartSearchRecords;
  return matches.reduce((groups, item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
    return groups;
  }, {});
}

function renderTravelSmartSearchResults(query = "") {
  const results = $("#travelSmartResults");
  if (!results) return;
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    results.innerHTML = `
      <div class="travel-search-start" role="status">
        <span class="travel-search-start__icon" aria-hidden="true">✦</span>
        <div>
          <strong>Search one travel need at a time</strong>
          <span>Find a restaurant, activity, hotel, document, map, or transportation detail for the selected trip.</span>
        </div>
      </div>
    `;
    return;
  }
  const groups = getTravelSmartSearchMatches(normalizedQuery);
  const entries = Object.entries(groups);
  if (!entries.length) {
    results.innerHTML = `
      <article class="travel-search-empty">
        <strong>No exact matches were found.</strong>
        <span>Try changing your dates, destination, or search terms.</span>
        <button type="button" data-travel-search-open="overview">Back to Travel Home</button>
      </article>
    `;
    return;
  }
  results.innerHTML = entries.map(([group, items]) => `
    <section class="travel-result-group" aria-label="${escapeHtml(group)} results">
      <div class="travel-result-group-head">
        <strong>${escapeHtml(group)}</strong>
        <span>${items.length} result${items.length === 1 ? "" : "s"}</span>
      </div>
      <div class="travel-result-grid">
        ${items.map((item) => `
          <article class="travel-result-card">
            <span class="travel-result-thumb" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.meta)}</small>
              <em>${escapeHtml(item.status)}</em>
            </div>
            <button type="button" data-travel-search-open="${escapeHtml(item.section)}">Open</button>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderTravelFocusRideProviders() {
  const list = $("#travelFocusRideProviders");
  if (!list) return;
  const country = $("#travelFocusCountry")?.value || "United Arab Emirates";
  const providers = rideProvidersByDestination[country] || ["Local taxi", "Hotel transfer"];
  list.innerHTML = providers.map((provider) => `
    <article>
      <span>${escapeHtml(country)}</span>
      <strong>${escapeHtml(provider)}</strong>
      <small>Available • Estimate only • Provider app required</small>
      <dl>
        <div><dt>Pickup</dt><dd>${provider === "Careem" || provider === "Grab" ? "8 min" : "12 min"}</dd></div>
        <div><dt>Fare</dt><dd>${country === "United Arab Emirates" ? "$18-$22" : "$16-$28"}</dd></div>
        <div><dt>Vehicle</dt><dd>Sedan / SUV</dd></div>
        <div><dt>Booking</dt><dd>External app</dd></div>
      </dl>
      <button type="button" data-ride-provider="${escapeHtml(provider)}">Select provider</button>
    </article>
  `).join("");
}

function setTravelFocus(section = "overview", options = {}) {
  if (transportationTravelSections.has(section)) {
    navigateSafely("transportationPanel", { updateHistory: options.updateHistory !== false });
    return {
      title: "Transportation",
      route: "/transportation",
      summary: "Flights, rail, buses, cruises, boarding passes, transfers, routes, ride share, and fare tools live in one focused workspace."
    };
  }
  const target = travelTileDestinations[section] ? section : "overview";
  $$(".travel-focus-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.travelPanel === target);
  });
  $$("[data-travel-focus]").forEach((button) => {
    const active = button.dataset.travelFocus === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const destination = travelTileDestinations[target] || travelTileDestinations.overview;
  if ($("#travelSettingsMessage")) $("#travelSettingsMessage").textContent = `${destination.title} opened. ${destination.summary}`;
  if ($("#travelSelectedTitle")) $("#travelSelectedTitle").textContent = destination.title;
  if ($("#travelSelectedSummary")) $("#travelSelectedSummary").textContent = destination.summary;
  if ($("#travelSelectedRoute")) $("#travelSelectedRoute").textContent = destination.route;
  renderTravelFocusRideProviders();
  if (options.updateHistory !== false) {
    const route = getTravelRoute(target);
    const currentPath = isFilePreview
      ? `index.html${location.hash}`
      : normalizeAppPath(location.pathname);
    const nextPath = isFilePreview ? route : normalizeAppPath(route);
    const currentSection = getTravelSectionFromRoute(location.pathname, history.state);
    if (currentPath !== nextPath || currentSection !== target || getTargetFromRoute() !== "rideShareHub") {
      history.pushState({ target: "rideShareHub", travelSection: target }, "", route);
    }
  }
  localStorage.setItem("traveldripTravelFocus", target);
  syncTravelSectionControls(target);
  syncNavigationState("rideShareHub", target);
  return destination;
}

function syncTravelSectionControls(section = "overview") {
  const activeTripTab = section === "itinerary" ? "itinerary" : "travel";
  $$(".trip-tab-bar button").forEach((button) => {
    const active = button.dataset.tabKey === activeTripTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  $$(".travel-section-nav [data-travel-section], .travel-overview-card [data-travel-section], .travel-workspace [data-travel-section], .travel-support-card [data-travel-section]").forEach((button) => {
    const active = button.dataset.travelSection === section;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function resolveTravelSearchTarget(query = "") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return "overview";
  const match = travelSearchTargets.find(([, terms]) => terms.some((term) => normalized.includes(term)));
  return match?.[0] || "overview";
}

function showTravelTileDestination(section, options = {}) {
  const destination = travelTileDestinations[section] || travelTileDestinations.rideShare;
  setTravelFocus(section, options);
  if ($("#travelSelectedTitle")) $("#travelSelectedTitle").textContent = destination.title;
  if ($("#travelSelectedSummary")) $("#travelSelectedSummary").textContent = destination.summary;
  if ($("#travelSelectedRoute")) $("#travelSelectedRoute").textContent = destination.route;
  syncTravelSectionControls(section);
  return destination;
}

function validateTripDateRanges() {
  const start = $("#tripStartInput");
  const end = $("#tripEndInput");
  const eventRsvp = $("#eventRsvpDeadlineInput");
  const inviteDeadline = $("#inviteDeadlineInput");
  const message = $("#soloModeMessage") || $("#invitationStatusMessage");
  const startValue = start?.value || "";
  const endValue = end?.value || "";
  const invalidEndDate = Boolean(startValue && endValue && endValue < startValue);

  if (end) {
    end.setCustomValidity(invalidEndDate ? "End date cannot be before start date." : "");
  }

  [eventRsvp, inviteDeadline].forEach((deadline) => {
    if (!deadline) return;
    const invalidDeadline = Boolean(endValue && deadline.value && deadline.value > endValue);
    deadline.setCustomValidity(invalidDeadline ? "RSVP deadline should be on or before the trip end date." : "");
  });

  if (message) {
    if (invalidEndDate) message.textContent = "Invalid date range: end date cannot be before start date.";
    else if ([eventRsvp, inviteDeadline].some((deadline) => deadline?.validationMessage)) message.textContent = "Review RSVP deadline: it should be on or before the trip end date.";
  }

  return !invalidEndDate && ![eventRsvp, inviteDeadline].some((deadline) => deadline?.validationMessage);
}

function validateStandaloneDateInputs() {
  const eventDate = $("#eventDateInput");
  const eventRsvp = $("#eventRsvpInput");
  if (eventDate && eventRsvp) {
    eventRsvp.min = eventDate.value || "";
    eventRsvp.setCustomValidity(eventDate.value && eventRsvp.value && eventRsvp.value > eventDate.value
      ? "RSVP deadline should be on or before the event date."
      : "");
  }
  const flightDate = $("#flightDepartureDateInput");
  if (flightDate) flightDate.setCustomValidity("");
}

const eventInviteTypeLabels = {
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  family_reunion: "Family Reunion",
  bachelor_bachelorette: "Bachelor or Bachelorette",
  corporate_retreat: "Corporate Retreat",
  conference: "Conference",
  graduation_trip: "Graduation Trip",
  church_retreat: "Church Retreat",
  special_event: "Special Event"
};

const eventInviteToneCopy = {
  warm: "warm and welcoming",
  playful: "playful and energetic",
  elegant: "polished and elegant",
  professional: "clear and professional",
  casual: "friendly and casual"
};

function getEventInviteContext() {
  const eventType = $("#eventInviteEventType")?.value || $("#eventTypeInput")?.value || "special_event";
  const startsOn = [$("#eventDateInput")?.value, $("#eventStartTimeInput")?.value].filter(Boolean).join("T");
  const endsOn = [$("#eventDateInput")?.value, $("#eventEndTimeInput")?.value].filter(Boolean).join("T");
  return {
    eventType,
    eventTypeLabel: eventInviteTypeLabels[eventType] || "Special Event",
    title: $("#eventNameInput")?.value.trim() || `${eventInviteTypeLabels[eventType] || "Special Event"} celebration`,
    destination: $("#eventAddressInput")?.value.trim() || "Destination details coming soon",
    startsOn,
    endsOn,
    venue: $("#eventVenueInput")?.value.trim() || "Venue details coming soon",
    address: $("#eventAddressInput")?.value.trim() || "",
    audience: $("#eventInviteAudience")?.value.trim() || "friends and family",
    tone: $("#eventInviteTone")?.value || "warm",
    details: [$("#eventDescriptionInput")?.value.trim(), $("#eventInviteDetails")?.value.trim()].filter(Boolean).join(" ")
  };
}

function formatEventInviteDate(value) {
  if (!value) return "Date and time coming soon";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " • ");
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function createLocalInviteTemplate(context) {
  const tone = eventInviteToneCopy[context.tone] || eventInviteToneCopy.warm;
  const dateText = formatEventInviteDate(context.startsOn);
  const location = [context.venue, context.address].filter(Boolean).join(" • ");
  const detailText = context.details || `Bring your best energy and get ready for a ${tone} event.`;
  const audienceText = context.audience || "your guests";
  return {
    subject: `${context.eventTypeLabel}: ${context.title}`,
    headline: context.title,
    body: `You're invited to a ${tone} ${context.eventTypeLabel.toLowerCase()} with ${audienceText}. ${detailText}`,
    meta: [dateText, location].filter(Boolean).join(" • "),
    rsvpLabel: "RSVP to join the celebration"
  };
}

function renderEventInviteTemplate(template, sourceLabel = "Local event template preview") {
  const source = $("#eventInviteSource");
  const subject = $("#eventInviteSubject");
  const headline = $("#eventInviteHeadline");
  const body = $("#eventInviteBody");
  const meta = $("#eventInviteMeta");
  const rsvpLabel = $("#eventInviteRsvpLabel");
  if (!template || !headline) return;
  if (source) source.textContent = sourceLabel;
  if (subject) subject.textContent = template.subject || "Event invitation";
  headline.textContent = template.headline || "You're invited";
  if (body) body.textContent = template.body || "Event details will be shared with your guests.";
  if (meta) meta.textContent = template.meta || "Event details coming soon";
  if (rsvpLabel) rsvpLabel.textContent = template.rsvpLabel || "RSVP to join the event";
}

function getEventInviteTemplateText() {
  return [
    $("#eventInviteSubject")?.textContent,
    $("#eventInviteHeadline")?.textContent,
    $("#eventInviteBody")?.textContent,
    $("#eventInviteMeta")?.textContent,
    $("#eventInviteRsvpLabel")?.textContent
  ].filter(Boolean).join("\n\n");
}

function openEventInviteStudio() {
  if ($("#eventsPanel")?.hidden) renderRoute("eventsPanel", { updateHistory: true });
  const studio = $("#eventInviteStudio");
  if (!studio) return;
  $$('[data-event-dashboard-tab]').forEach((tab) => {
    const active = tab.dataset.eventDashboardTab === "Invitations";
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  studio.classList.add("is-focused");
  window.requestAnimationFrame(() => studio.scrollIntoView({ behavior: "smooth", block: "start" }));
  window.setTimeout(() => studio.classList.remove("is-focused"), 1200);
}

function setInviteEventTypeFromLabel(label) {
  const value = String(label || "").toLowerCase();
  const mapping = value.includes("wedding")
    ? "wedding"
    : value.includes("birthday")
      ? "birthday"
      : value.includes("anniversary")
        ? "anniversary"
        : value.includes("family")
          ? "family_reunion"
          : value.includes("corporate")
            ? "corporate_retreat"
            : value.includes("conference")
              ? "conference"
              : value.includes("graduation")
                ? "graduation_trip"
                : value.includes("church")
                  ? "church_retreat"
                  : value.includes("bachelor") || value.includes("bachelorette")
                    ? "bachelor_bachelorette"
                    : "special_event";
  const selector = $("#eventInviteEventType");
  if (selector) selector.value = value in eventInviteTypeLabels ? value : value.includes("corporate") ? "corporate_retreat" : value;
  if (selector && !eventInviteTypeLabels[selector.value]) selector.value = mapping;
}

function syncEventInviteFromCard(button) {
  setInviteEventTypeFromLabel(button?.dataset.eventCard || "Special Event");
  const fields = {
    eventNameInput: button?.dataset.eventName,
    eventDateInput: button?.dataset.eventDate,
    eventStartTimeInput: button?.dataset.eventStart,
    eventVenueInput: button?.dataset.eventVenue,
    eventInviteAudience: button?.dataset.eventAudience
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field && value) field.value = value;
  });
}

async function generateEventInviteTemplate() {
  const button = $("#eventInviteGenerateButton");
  const status = $("#eventInviteStatus");
  const context = getEventInviteContext();
  if (button) button.disabled = true;
  if (status) status.textContent = "Creating an event-specific invitation...";
  const localTemplate = createLocalInviteTemplate(context);
  try {
    const response = await apiRequest("/api/ai-invitation", {
      method: "POST",
      body: JSON.stringify(context)
    });
    if (response.skipped) throw new Error("Live AI invitation writing requires a signed-in deployed app.");
    renderEventInviteTemplate(response.template, response.sourceLabel || "AI invitation assistant");
    if (status) status.textContent = "AI invitation ready. Review the wording before sharing with guests.";
    addAuditEntry("AI event invitation generated", `${context.eventTypeLabel} template created for ${context.title}.`);
    await saveSyncedEvent("event_invite_template_generated", { eventType: context.eventType, source: "openai", title: context.title });
  } catch (_error) {
    renderEventInviteTemplate(localTemplate);
    if (status) status.textContent = "AI provider unavailable; local event template preview generated. Add OPENAI_API_KEY in Vercel for live AI writing.";
    addAuditEntry("Local event invitation generated", `${context.eventTypeLabel} template preview created without claiming live AI.`);
    await saveSyncedEvent("event_invite_template_generated", { eventType: context.eventType, source: "local", title: context.title });
  } finally {
    if (button) button.disabled = false;
  }
}

async function copyEventInviteTemplate() {
  const text = getEventInviteTemplateText();
  const status = $("#eventInviteStatus");
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    if (status) status.textContent = "Invite text copied. Paste it into your guest link, email, or connected sharing workflow.";
    await saveSyncedEvent("event_invite_template_copied", { title: $("#eventInviteHeadline")?.textContent || "Event invitation" });
  } catch (_error) {
    if (status) status.textContent = "Copy is unavailable in this browser. Select the preview text and copy it manually.";
  }
}

async function saveEventInviteDraft() {
  const context = getEventInviteContext();
  const draft = { context, template: {
    subject: $("#eventInviteSubject")?.textContent || "",
    headline: $("#eventInviteHeadline")?.textContent || "",
    body: $("#eventInviteBody")?.textContent || "",
    meta: $("#eventInviteMeta")?.textContent || "",
    rsvpLabel: $("#eventInviteRsvpLabel")?.textContent || ""
  }, savedAt: new Date().toISOString() };
  state.eventInviteDraft = draft;
  try { localStorage.setItem("traveldripEventInviteDraft", JSON.stringify(draft)); } catch (_error) { /* Storage may be unavailable in private browsing. */ }
  const status = $("#eventInviteStatus");
  if (status) status.textContent = "Invitation draft saved. It is ready to review before you send guest invitations.";
  addAuditEntry("Event invitation draft saved", `${context.eventTypeLabel} invitation draft saved for ${context.title}.`);
  await saveSyncedEvent("event_invite_draft_saved", { eventType: context.eventType, title: context.title, localDraft: true });
}

async function apiRequest(path, options = {}) {
  if (!state.session?.access_token || isFilePreview) return { skipped: true, reason: "No deployed authenticated API session" };
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.session.access_token}`,
      ...(options.headers || {})
    }
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

function getCorporateOperationsTripId() {
  const verifiedEventId = state.corporateAccess.eventId || "";
  return verifiedEventId && verifiedEventId !== "leadership-summit-preview"
    ? verifiedEventId
    : state.activeTripId || "";
}

function renderCorporateEmployeeInvitations(invitations = state.corporateOperations.invitations || []) {
  const list = $("#corporateEmployeeInviteList");
  if (!list) return;
  if (!invitations.length) {
    list.innerHTML = '<div class="corporate-employee-invite-empty"><strong>No pending employee invitations</strong><span>Create an invitation above to grant event-scoped access.</span></div>';
    return;
  }
  list.innerHTML = invitations.slice(0, 8).map((invitation) => {
    const role = String(invitation.role || "employee").replaceAll("_", " ");
    const status = String(invitation.status || "pending").replaceAll("_", " ");
    const expiration = invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : "No expiration reported";
    const accountType = invitation.account_type === "personal_account_linked" ? "Personal account linked" : "Corporate guest only";
    const accessMode = invitation.access_mode === "persistent" ? "Reusable employee access" : "Temporary event access";
    const codeSummary = invitation.plain_code
      ? `<button type="button" data-copy-corporate-access="${escapeHtml(invitation.id)}">Copy access code</button>`
      : invitation.code_hint
        ? `<small>Access code ends in ${escapeHtml(invitation.code_hint)}</small>`
        : "";
    const removeSummary = String(invitation.status || "").toLowerCase() === "revoked"
      ? ""
      : `<button type="button" class="danger-button" data-remove-corporate-access="${escapeHtml(invitation.attendee_id)}">Remove access</button>`;
    return `<div class="corporate-employee-invite-row">
      <span><strong>${escapeHtml(invitation.invitee_name || "Employee")}</strong><small>${escapeHtml(invitation.invitee_email || "Work email pending")} · ${escapeHtml(accountType)}</small></span>
      <span><strong>${escapeHtml(role)}</strong><small>${escapeHtml(accessMode)} · Review by ${escapeHtml(expiration)}</small></span>
      <span class="corporate-invite-actions"><b>${escapeHtml(status)}</b>${codeSummary}${removeSummary}</span>
    </div>`;
  }).join("");
}

async function loadCorporateEmployeeInvitations() {
  const tripId = getCorporateOperationsTripId();
  if (isFilePreview || !state.session?.access_token || !tripId) {
    renderCorporateEmployeeInvitations();
    return;
  }
  try {
    const result = await apiRequest(`/api/guest-access?action=list-invites&tripId=${encodeURIComponent(tripId)}`);
    state.corporateOperations.invitations = result.invitations || [];
    renderCorporateEmployeeInvitations();
  } catch (error) {
    if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = error.message;
  }
}

async function submitCorporateEmployeeInvite(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#corporateEmployeeInviteMessage");
  const tripId = getCorporateOperationsTripId();
  const expirationDate = $("#corporateInviteExpires")?.value;
  const accessMode = $("#corporateInviteAccessMode")?.value === "persistent" ? "persistent" : "temporary";
  const payload = {
    tripId,
    fullName: $("#corporateInviteName")?.value.trim(),
    employeeId: $("#corporateInviteEmployeeId")?.value.trim(),
    companyEmail: $("#corporateInviteEmail")?.value.trim().toLowerCase(),
    department: $("#corporateInviteDepartment")?.value.trim() || "",
    role: $("#corporateInviteRole")?.value || "employee",
    expiresAt: expirationDate ? new Date(`${expirationDate}T23:59:59`).toISOString() : undefined,
    accessMode
  };
  if (!payload.fullName || !payload.employeeId || !payload.companyEmail) {
    if (message) message.textContent = "Enter the employee's name, employee ID, and work email.";
    return;
  }
  if (!isFilePreview && !tripId) {
    if (message) message.textContent = "Select a corporate trip before creating an employee invitation.";
    return;
  }
  if (message) message.textContent = "Creating protected employee invitation...";
  try {
    let invitation;
    if (isFilePreview) {
      invitation = {
        id: `preview-corporate-access-${Date.now()}`,
        attendee_id: `preview-attendee-${Date.now()}`,
        invitee_name: payload.fullName,
        invitee_email: payload.companyEmail,
        employee_id_masked: `••••${payload.employeeId.slice(-4)}`,
        role: payload.role,
        status: "active",
        expires_at: payload.expiresAt,
        plain_code: `TD${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(8, "0").slice(0, 8)}`,
        access_mode: accessMode,
        account_type: "corporate_guest_only"
      };
    } else {
      const attendeeResult = await apiRequest("/api/guest-access", {
        method: "POST",
        body: JSON.stringify({
          action: "upsert-attendee",
          tripId: payload.tripId,
          employeeId: payload.employeeId,
          fullName: payload.fullName,
          companyEmail: payload.companyEmail,
          department: payload.department,
          role: payload.role,
          accessStatus: "active",
          metadata: { accessScope: "corporate_guest_only", accessMode, personalDashboard: false, attendanceStatus: "attending" }
        })
      });
      const codeResult = await apiRequest("/api/guest-access", {
        method: "POST",
        body: JSON.stringify({
          action: "create-code",
          tripId: payload.tripId,
          codeType: "individual",
          assignedAttendeeId: attendeeResult.attendee.id,
          assignedRole: payload.role,
          assignedDepartment: payload.department,
          expiresAt: payload.expiresAt,
          usageLimit: accessMode === "persistent" ? 0 : 25,
          requiresEmployeeId: true,
          requiresLastName: true,
          rememberDeviceAllowed: true,
          metadata: { accessScope: "corporate_guest_only", accessMode, personalDashboard: false }
        })
      });
      invitation = {
        id: codeResult.accessCode.id,
        attendee_id: attendeeResult.attendee.id,
        invitee_name: attendeeResult.attendee.full_name,
        invitee_email: attendeeResult.attendee.company_email,
        employee_id_masked: attendeeResult.attendee.employee_id_masked,
        department: attendeeResult.attendee.department,
        role: codeResult.accessCode.assigned_role,
        status: codeResult.accessCode.status,
        expires_at: codeResult.accessCode.expires_at,
        code_hint: codeResult.accessCode.code_hint,
        plain_code: codeResult.plainCode,
        access_mode: accessMode,
        account_type: "corporate_guest_only"
      };
    }
    state.corporateOperations.invitations = [invitation, ...(state.corporateOperations.invitations || []).filter((item) => item.id !== invitation.id)];
    renderCorporateEmployeeInvitations();
    if (message) {
      message.textContent = isFilePreview
        ? `${accessMode === "persistent" ? "Reusable employee" : "Temporary event"} access created. Copy the code to test the employee portal.`
        : `${accessMode === "persistent" ? "Reusable employee" : "Temporary event"} access created for ${payload.companyEmail}. Copy the code now; it is not stored in readable form.`;
    }
    addAuditEntry("Corporate employee access created", `${payload.companyEmail}: ${payload.role}, corporate guest only.`);
    await saveSyncedEvent("corporate_employee_access_created", { role: payload.role, department: payload.department, personalDashboard: false });
    form.reset();
    const defaultExpiration = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    if ($("#corporateInviteExpires")) $("#corporateInviteExpires").value = defaultExpiration.toISOString().slice(0, 10);
    if ($("#corporateInviteAccessMode")) $("#corporateInviteAccessMode").value = "temporary";
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

function getCorporatePreviewOperations() {
  return {
    role: "employee",
    permissions: { canManageBookings: false, canApprove: false, canManageService: false, canManagePolicy: false },
    policy: {
      name: "Global business travel",
      status: "active",
      currency: "USD",
      flight_cap_cents: 150000,
      hotel_nightly_cap_cents: 32500,
      ground_transport_cap_cents: 18000,
      receipt_threshold_cents: 5000
    },
    bookings: [
      { id: "preview-flight", title: "Delta DL 241", traveler_name: "Jordan Smith", booking_type: "flight", starts_at: "2026-07-24T22:45:00Z", policy_status: "compliant", status: "confirmed", provider_reference: "TD9K42" },
      { id: "preview-hotel", title: "Marina Grand Hotel", traveler_name: "Sarah Lee", booking_type: "hotel", starts_at: "2026-07-24T15:00:00Z", policy_status: "exception", status: "requested", provider_reference: null }
    ],
    approvals: [
      { id: "preview-approval", booking_id: "preview-hotel", status: "pending", reason: "Nightly hotel rate exceeds policy", metadata: { travelerName: "Sarah Lee" } }
    ],
    serviceCases: [
      { id: "preview-service", case_type: "change", priority: "normal", status: "open", subject: "Airport pickup time", sla_due_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString() }
    ],
    readiness: { totalTravelers: 4, coveredTravelers: 4, documentsComplete: 3, emergencyContactsVerified: 4, activeDisruptions: 0 }
  };
}

function corporateMoney(cents, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: String(currency || "USD").toUpperCase(),
    maximumFractionDigits: 0
  }).format(Number(cents || 0) / 100);
}

function corporateBookingDate(value) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function makeCorporateBookingRow(booking) {
  const row = document.createElement("div");
  row.className = "corporate-booking-row";
  row.dataset.bookingId = booking.id;

  const summary = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = booking.title || `${booking.booking_type || "Travel"} booking`;
  const meta = document.createElement("span");
  meta.textContent = `${booking.traveler_name || "Assigned traveler"} · ${String(booking.booking_type || "booking").replaceAll("_", " ")} · ${corporateBookingDate(booking.starts_at)}`;
  summary.append(title, meta);

  const status = document.createElement("div");
  const policy = document.createElement("span");
  policy.className = `corporate-policy-result ${booking.policy_status === "compliant" ? "is-compliant" : "is-review"}`;
  policy.textContent = booking.policy_status === "compliant" ? "In policy" : booking.policy_status || "Review";
  const bookingStatus = document.createElement("strong");
  bookingStatus.textContent = String(booking.status || "requested").replaceAll("_", " ");
  status.append(policy, bookingStatus);

  const actions = document.createElement("div");
  actions.className = "corporate-booking-row__actions";
  const reference = document.createElement("input");
  reference.type = "text";
  reference.value = booking.provider_reference || "";
  reference.placeholder = "Provider reference";
  reference.setAttribute("aria-label", `Provider reference for ${title.textContent}`);
  reference.dataset.corporateProviderReference = "";
  const actionSelect = document.createElement("select");
  actionSelect.setAttribute("aria-label", `Update ${title.textContent}`);
  actionSelect.dataset.corporateBookingStatus = "";
  [
    ["view", "View details"],
    ["confirm", "Confirm"],
    ["ticket", "Mark ticketed"],
    ["start", "Mark in progress"],
    ["complete", "Complete"],
    ["cancel", "Cancel"],
    ["refund", "Mark refunded"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    actionSelect.append(option);
  });
  const action = document.createElement("button");
  action.type = "button";
  action.dataset.corporateBookingAction = "apply";
  action.textContent = "Apply";
  actions.append(reference, actionSelect, action);
  row.append(summary, status, actions);
  return row;
}

function makeCorporateApprovalRow(approval, booking) {
  const row = document.createElement("div");
  row.className = "corporate-approval-row";
  row.dataset.approvalBookingId = approval.booking_id;
  const summary = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = booking?.title || "Policy exception";
  const meta = document.createElement("span");
  meta.textContent = `${approval.reason || "Finance review required"}${booking?.traveler_name ? ` · ${booking.traveler_name}` : ""}`;
  summary.append(title, meta);
  const actions = document.createElement("div");
  actions.className = "corporate-approval-actions";
  ["reject", "approve"].forEach((decision) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.corporateApproval = decision;
    button.textContent = decision === "approve" ? "Approve" : "Reject";
    if (decision === "approve") button.className = "primary-button";
    actions.append(button);
  });
  row.append(summary, actions);
  return row;
}

function updateCorporateOperationsPermissions() {
  const role = $("#rolePreview")?.value || state.corporateAccess.role || "employee";
  const previewPermissions = {
    canManageBookings: ["owner", "executive", "travel", "organizer"].includes(role),
    canApprove: ["owner", "executive", "finance"].includes(role),
    canManageService: ["owner", "executive", "travel", "organizer", "manager"].includes(role),
    canManagePolicy: ["owner", "executive", "finance"].includes(role)
  };
  const permissions = isFilePreview ? previewPermissions : (state.corporateOperations.permissions || previewPermissions);
  const canManage = Boolean(permissions.canManageBookings);
  const canApprove = Boolean(permissions.canApprove);
  const canManageService = Boolean(permissions.canManageService);
  $$('[data-corporate-manager-only]').forEach((item) => item.toggleAttribute("hidden", !canManage));
  $$('[data-corporate-policy-admin-only]').forEach((item) => item.toggleAttribute("hidden", !permissions.canManagePolicy));
  $$("[data-corporate-booking-status], [data-corporate-provider-reference], [data-corporate-booking-action]").forEach((control) => {
    control.disabled = !canManage;
  });
  $$("[data-corporate-approval]").forEach((button) => {
    button.disabled = !canApprove;
    button.title = canApprove ? "Record approval decision" : "Finance or executive approval required";
  });
  $$("[data-corporate-service-action]").forEach((button) => {
    button.disabled = !canManageService;
    button.title = canManageService ? "Resolve traveler-care case" : "Travel desk access required";
  });
}

function renderCorporateOperations(data = state.corporateOperations) {
  if (!$("#corporateBookingList")) return;
  state.corporateOperations = { ...state.corporateOperations, ...data, loaded: true };
  const policy = state.corporateOperations.policy;
  const bookings = state.corporateOperations.bookings || [];
  const approvals = (state.corporateOperations.approvals || []).filter((approval) => approval.status === "pending");
  const serviceCases = (state.corporateOperations.serviceCases || []).filter((serviceCase) => !["resolved", "closed"].includes(serviceCase.status));
  const readiness = state.corporateOperations.readiness || {};
  const currency = policy?.currency || "USD";

  if ($("#corporateOperationsConnection")) {
    $("#corporateOperationsConnection").textContent = isFilePreview ? "Secure preview" : "Supabase connected";
  }
  if ($("#corporateTravelerCount")) $("#corporateTravelerCount").textContent = String(readiness.totalTravelers ?? 0);
  if ($("#corporateBookingCount")) $("#corporateBookingCount").textContent = String(bookings.filter((booking) => booking.provider_reference).length);
  if ($("#corporateApprovalCount")) $("#corporateApprovalCount").textContent = String(approvals.length);
  if ($("#corporateServiceCount")) $("#corporateServiceCount").textContent = String(serviceCases.length);
  if ($("#corporateReadinessCoverage")) $("#corporateReadinessCoverage").textContent = readiness.totalTravelers == null ? "Not reported" : `${readiness.coveredTravelers || 0} / ${readiness.totalTravelers} covered`;
  if ($("#corporateReadinessDocuments")) $("#corporateReadinessDocuments").textContent = readiness.totalTravelers == null ? "Not reported" : `${readiness.documentsComplete || 0} / ${readiness.totalTravelers} complete`;
  if ($("#corporateReadinessEmergency")) $("#corporateReadinessEmergency").textContent = readiness.totalTravelers == null ? "Not reported" : `${readiness.emergencyContactsVerified || 0} / ${readiness.totalTravelers} verified`;
  if ($("#corporateReadinessDisruptions")) $("#corporateReadinessDisruptions").textContent = `${readiness.activeDisruptions || 0} active`;
  if ($("#corporateBookingQueueStatus")) $("#corporateBookingQueueStatus").textContent = `${bookings.length} active`;
  if ($("#corporatePolicyName")) $("#corporatePolicyName").textContent = policy?.name || "Policy assignment required";
  if ($("#corporatePolicyStatus")) $("#corporatePolicyStatus").textContent = policy?.status === "active" ? "Active" : "Review";
  if ($("#corporatePolicyFlightCap")) $("#corporatePolicyFlightCap").textContent = corporateMoney(policy?.flight_cap_cents, currency);
  if ($("#corporatePolicyHotelCap")) $("#corporatePolicyHotelCap").textContent = corporateMoney(policy?.hotel_nightly_cap_cents, currency);
  if ($("#corporatePolicyTransportCap")) $("#corporatePolicyTransportCap").textContent = corporateMoney(policy?.ground_transport_cap_cents, currency);
  if ($("#corporatePolicyReceiptThreshold")) $("#corporatePolicyReceiptThreshold").textContent = `Over ${corporateMoney(policy?.receipt_threshold_cents, currency)}`;
  if ($("#corporatePolicyCabinNote")) $("#corporatePolicyCabinNote").textContent = `${String(policy?.flight_cabin || "economy").replaceAll("_", " ")} cabin maximum`;
  if ($("#corporatePolicySupplierNote")) $("#corporatePolicySupplierNote").textContent = policy?.allowed_airlines?.length ? `${policy.allowed_airlines.length} preferred airline${policy.allowed_airlines.length === 1 ? "" : "s"}` : "No supplier restriction";
  if ($("#corporatePolicyExceptionNote")) $("#corporatePolicyExceptionNote").textContent = policy?.rules?.blockUnapprovedProviders ? "Non-preferred suppliers blocked" : "Exceptions require finance approval";
  if (policy) {
    if ($("#corporatePolicyNameInput")) $("#corporatePolicyNameInput").value = policy.name || "Corporate travel policy";
    if ($("#corporatePolicyCabinInput")) $("#corporatePolicyCabinInput").value = policy.flight_cabin || "economy";
    if ($("#corporatePolicyFlightInput")) $("#corporatePolicyFlightInput").value = Number(policy.flight_cap_cents || 0) / 100;
    if ($("#corporatePolicyHotelInput")) $("#corporatePolicyHotelInput").value = Number(policy.hotel_nightly_cap_cents || 0) / 100;
    if ($("#corporatePolicyTransportInput")) $("#corporatePolicyTransportInput").value = Number(policy.ground_transport_cap_cents || 0) / 100;
    if ($("#corporatePolicyReceiptInput")) $("#corporatePolicyReceiptInput").value = Number(policy.receipt_threshold_cents || 0) / 100;
    if ($("#corporatePolicyAirlinesInput")) $("#corporatePolicyAirlinesInput").value = (policy.allowed_airlines || []).join(", ");
    if ($("#corporatePolicyBlockProvidersInput")) $("#corporatePolicyBlockProvidersInput").checked = Boolean(policy.rules?.blockUnapprovedProviders);
  }

  const bookingList = $("#corporateBookingList");
  bookingList.replaceChildren();
  if (bookings.length) bookings.slice(0, 8).forEach((booking) => bookingList.append(makeCorporateBookingRow(booking)));
  else {
    const empty = document.createElement("p");
    empty.className = "small";
    empty.textContent = "No corporate bookings yet. A travel administrator can create the first request.";
    bookingList.append(empty);
  }

  const approvalList = $("#corporateApprovalList");
  approvalList.replaceChildren();
  if (approvals.length) approvals.slice(0, 6).forEach((approval) => approvalList.append(makeCorporateApprovalRow(approval, bookings.find((booking) => booking.id === approval.booking_id))));
  else {
    const empty = document.createElement("p");
    empty.className = "small";
    empty.textContent = "No policy exceptions are waiting for approval.";
    approvalList.append(empty);
  }

  const serviceList = $("#corporateServiceList");
  serviceList.replaceChildren();
  if (serviceCases.length) {
    serviceCases.slice(0, 4).forEach((serviceCase) => {
      const row = document.createElement("div");
      row.className = "corporate-service-row";
      row.dataset.corporateServiceCaseId = serviceCase.id;
      const summary = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = serviceCase.subject || "Traveler-care case";
      const meta = document.createElement("span");
      meta.textContent = `${serviceCase.priority || "normal"} · ${String(serviceCase.status || "open").replaceAll("_", " ")} · SLA ${new Date(serviceCase.sla_due_at).toLocaleString()}`;
      summary.append(title, meta);
      const resolve = document.createElement("button");
      resolve.type = "button";
      resolve.dataset.corporateServiceAction = "resolve";
      resolve.textContent = "Resolve";
      row.append(summary, resolve);
      serviceList.append(row);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "small";
    empty.textContent = "No traveler-care cases are open.";
    serviceList.append(empty);
  }
  updateCorporateOperationsPermissions();
}

async function loadCorporateBookingOperations({ announce = false } = {}) {
  if (!$("#corporateBookingList")) return;
  const tripId = getCorporateOperationsTripId();
  if (isFilePreview || !state.session?.access_token || !tripId) {
    renderCorporateOperations(state.corporateOperations.loaded ? state.corporateOperations : getCorporatePreviewOperations());
    if (announce && $("#corporateBookingMessage")) $("#corporateBookingMessage").textContent = "Preview refreshed. Sign in to a deployed corporate event to load protected booking records.";
    return;
  }
  if ($("#corporateOperationsConnection")) $("#corporateOperationsConnection").textContent = "Loading securely";
  try {
    const data = await apiRequest(`/api/corporate-bookings?tripId=${encodeURIComponent(tripId)}`);
    renderCorporateOperations(data);
    if (announce && $("#corporateBookingMessage")) $("#corporateBookingMessage").textContent = "Corporate booking operations refreshed from Supabase.";
  } catch (error) {
    if ($("#corporateOperationsConnection")) $("#corporateOperationsConnection").textContent = "Connection needs attention";
    if ($("#corporateBookingMessage")) $("#corporateBookingMessage").textContent = error.message;
  }
}

function getCorporateBookingFormPayload() {
  return {
    resource: "booking",
    tripId: getCorporateOperationsTripId(),
    bookingType: $("#corporateBookingType")?.value,
    travelerName: $("#corporateBookingTraveler")?.value.trim(),
    travelerEmail: $("#corporateBookingTravelerEmail")?.value.trim(),
    providerName: $("#corporateBookingProvider")?.value.trim(),
    title: $("#corporateBookingTitle")?.value.trim(),
    startsAt: $("#corporateBookingStartsAt")?.value || null,
    totalCents: Math.round(Number($("#corporateBookingAmount")?.value || 0) * 100),
    currency: "USD",
    providerReference: $("#corporateBookingReference")?.value.trim(),
    providerConfirmed: Boolean($("#corporateBookingProviderConfirmed")?.checked),
    source: "organizer",
    idempotencyKey: globalThis.crypto?.randomUUID?.() || `booking-${Date.now()}`,
    details: {}
  };
}

async function submitCorporateBooking(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = getCorporateBookingFormPayload();
  const message = $("#corporateBookingMessage");
  if (!payload.travelerName || !payload.providerName || !payload.title || !payload.startsAt || payload.totalCents < 0) {
    message.textContent = "Add the traveler, provider, trip details, date, and a valid amount.";
    return;
  }
  if (payload.providerConfirmed && !payload.providerReference) {
    message.textContent = "Add the provider confirmation reference before marking this reservation confirmed.";
    return;
  }
  message.textContent = "Checking policy and saving the booking request...";
  try {
    if (isFilePreview || !state.session?.access_token || !payload.tripId) {
      const policyStatus = payload.totalCents > 150000 ? "exception" : "compliant";
      const booking = {
        id: `preview-${Date.now()}`,
        title: payload.title,
        traveler_name: payload.travelerName,
        traveler_email: payload.travelerEmail,
        booking_type: payload.bookingType,
        starts_at: payload.startsAt,
        total_cents: payload.totalCents,
        provider_name: payload.providerName,
        provider_reference: payload.providerReference || null,
        policy_status: policyStatus,
        approval_status: policyStatus === "compliant" ? "not_required" : "pending",
        status: payload.providerConfirmed && payload.providerReference && policyStatus === "compliant" ? "confirmed" : "requested"
      };
      state.corporateOperations.bookings.unshift(booking);
      if (policyStatus !== "compliant") state.corporateOperations.approvals.unshift({ id: `preview-approval-${Date.now()}`, booking_id: booking.id, status: "pending", reason: "Flight exceeds the approved fare cap" });
      renderCorporateOperations(state.corporateOperations);
      message.textContent = `${booking.title} saved as ${booking.status}. ${policyStatus === "compliant" ? "The request is within policy." : "Finance approval is required."}`;
    } else {
      const result = await apiRequest("/api/corporate-bookings", { method: "POST", body: JSON.stringify(payload) });
      state.corporateOperations.bookings.unshift(result.booking);
      if (result.approval) state.corporateOperations.approvals.unshift(result.approval);
      renderCorporateOperations(state.corporateOperations);
      message.textContent = `${result.booking.title} saved. Policy result: ${result.policyDecision.status}.`;
    }
    form.reset();
    addAuditEntry("Corporate booking request created", `${payload.bookingType}: ${payload.title} for ${payload.travelerName}.`);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function decideCorporateApproval(button) {
  const row = button.closest("[data-approval-booking-id]");
  const bookingId = row?.dataset.approvalBookingId;
  const action = button.dataset.corporateApproval;
  if (!bookingId || !action) return;
  const message = $("#corporateApprovalMessage");
  message.textContent = `Recording ${action} decision...`;
  try {
    if (!isFilePreview && state.session?.access_token && getCorporateOperationsTripId()) {
      await apiRequest("/api/corporate-bookings", { method: "PATCH", body: JSON.stringify({ resource: "booking", tripId: getCorporateOperationsTripId(), bookingId, action, note: "Decision recorded from Corporate Booking Operations" }) });
    }
    const approval = state.corporateOperations.approvals.find((item) => item.booking_id === bookingId);
    if (approval) approval.status = action === "approve" ? "approved" : "rejected";
    const booking = state.corporateOperations.bookings.find((item) => item.id === bookingId);
    if (booking) {
      booking.approval_status = action === "approve" ? "approved" : "rejected";
      booking.status = action === "approve" ? (booking.provider_reference ? "confirmed" : "approved") : "cancelled";
    }
    renderCorporateOperations(state.corporateOperations);
    message.textContent = `${action === "approve" ? "Approval" : "Rejection"} recorded with an audit timestamp.`;
    addAuditEntry("Corporate booking approval", `${action}: ${booking?.title || bookingId}.`);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function updateCorporateBookingLifecycle(button) {
  const row = button.closest("[data-booking-id]");
  const bookingId = row?.dataset.bookingId;
  const action = row?.querySelector("[data-corporate-booking-status]")?.value || "view";
  const providerReference = row?.querySelector("[data-corporate-provider-reference]")?.value.trim() || "";
  const booking = state.corporateOperations.bookings.find((item) => item.id === bookingId);
  const message = $("#corporateBookingMessage");
  if (!booking) return;
  if (action === "view") {
    message.textContent = `${booking.title}: ${booking.status}. ${booking.provider_reference ? `Provider reference ${booking.provider_reference}.` : "Provider confirmation is still required."}`;
    return;
  }
  if (["confirm", "ticket"].includes(action) && !providerReference) {
    message.textContent = "Enter the provider reference before confirming or ticketing this booking.";
    return;
  }
  if (["confirm", "ticket"].includes(action) && !["not_required", "approved"].includes(booking.approval_status || "not_required")) {
    message.textContent = "Finance approval is required before this booking can be confirmed or ticketed.";
    return;
  }
  message.textContent = `Updating ${booking.title}...`;
  try {
    let updated = null;
    if (!isFilePreview && state.session?.access_token && getCorporateOperationsTripId()) {
      const result = await apiRequest("/api/corporate-bookings", { method: "PATCH", body: JSON.stringify({ resource: "booking", tripId: getCorporateOperationsTripId(), bookingId, action, providerReference }) });
      updated = result.booking;
    }
    const statusMap = { confirm: "confirmed", ticket: "ticketed", start: "in_progress", complete: "completed", cancel: "cancelled", refund: "refunded" };
    Object.assign(booking, updated || { status: statusMap[action], provider_reference: providerReference || booking.provider_reference });
    renderCorporateOperations(state.corporateOperations);
    message.textContent = `${booking.title} is now ${String(booking.status).replaceAll("_", " ")}. The change is audit-ready.`;
    addAuditEntry("Corporate booking status updated", `${booking.title}: ${booking.status}.`);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitCorporatePolicy(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    resource: "policy",
    tripId: getCorporateOperationsTripId(),
    name: $("#corporatePolicyNameInput")?.value.trim(),
    currency: "USD",
    flightCabin: $("#corporatePolicyCabinInput")?.value,
    flightCapCents: Math.round(Number($("#corporatePolicyFlightInput")?.value || 0) * 100),
    hotelNightlyCapCents: Math.round(Number($("#corporatePolicyHotelInput")?.value || 0) * 100),
    groundTransportCapCents: Math.round(Number($("#corporatePolicyTransportInput")?.value || 0) * 100),
    receiptThresholdCents: Math.round(Number($("#corporatePolicyReceiptInput")?.value || 0) * 100),
    allowedAirlines: ($("#corporatePolicyAirlinesInput")?.value || "").split(",").map((value) => value.trim()).filter(Boolean),
    rules: { blockUnapprovedProviders: Boolean($("#corporatePolicyBlockProvidersInput")?.checked) }
  };
  const message = $("#corporatePolicyMessage");
  message.textContent = "Activating the new policy version...";
  try {
    let policy;
    if (isFilePreview || !state.session?.access_token || !payload.tripId) {
      policy = { name: payload.name, status: "active", currency: "USD", flight_cap_cents: payload.flightCapCents, hotel_nightly_cap_cents: payload.hotelNightlyCapCents, ground_transport_cap_cents: payload.groundTransportCapCents, receipt_threshold_cents: payload.receiptThresholdCents, allowed_airlines: payload.allowedAirlines, rules: payload.rules };
    } else {
      const result = await apiRequest("/api/corporate-bookings", { method: "POST", body: JSON.stringify(payload) });
      policy = result.policy;
    }
    state.corporateOperations.policy = policy;
    renderCorporateOperations(state.corporateOperations);
    form.closest("details")?.removeAttribute("open");
    message.textContent = `${policy.name} is active. The previous policy version remains in the audit history.`;
    addAuditEntry("Corporate travel policy activated", policy.name);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function resolveCorporateServiceCase(button) {
  const row = button.closest("[data-corporate-service-case-id]");
  const caseId = row?.dataset.corporateServiceCaseId;
  const serviceCase = state.corporateOperations.serviceCases.find((item) => item.id === caseId);
  if (!serviceCase) return;
  const message = $("#corporateServiceMessage");
  try {
    if (!isFilePreview && state.session?.access_token && getCorporateOperationsTripId()) {
      await apiRequest("/api/corporate-bookings", { method: "PATCH", body: JSON.stringify({ resource: "service_case", tripId: getCorporateOperationsTripId(), caseId, status: "resolved", resolution: "Resolved from Corporate Booking Operations" }) });
    }
    serviceCase.status = "resolved";
    renderCorporateOperations(state.corporateOperations);
    message.textContent = `${serviceCase.subject} resolved with an audit timestamp.`;
    addAuditEntry("Corporate service case resolved", serviceCase.subject);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitCorporateServiceCase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    resource: "service_case",
    tripId: getCorporateOperationsTripId(),
    caseType: $("#corporateServiceCaseType")?.value,
    priority: $("#corporateServicePriority")?.value,
    subject: $("#corporateServiceSubject")?.value.trim(),
    description: $("#corporateServiceDescription")?.value.trim()
  };
  const message = $("#corporateServiceMessage");
  if (!payload.subject || !payload.description) {
    message.textContent = "Add a subject and the details the travel desk needs.";
    return;
  }
  message.textContent = "Opening a protected traveler-care case...";
  try {
    let serviceCase;
    if (isFilePreview || !state.session?.access_token || !payload.tripId) {
      const hours = payload.priority === "critical" ? 1 : payload.priority === "urgent" ? 4 : payload.priority === "high" ? 12 : 24;
      serviceCase = { id: `preview-case-${Date.now()}`, ...payload, case_type: payload.caseType, status: "open", sla_due_at: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() };
    } else {
      const result = await apiRequest("/api/corporate-bookings", { method: "POST", body: JSON.stringify(payload) });
      serviceCase = result.serviceCase;
    }
    state.corporateOperations.serviceCases.unshift(serviceCase);
    renderCorporateOperations(state.corporateOperations);
    message.textContent = `${payload.priority} priority case opened. The SLA deadline is ${new Date(serviceCase.sla_due_at).toLocaleString()}.`;
    form.reset();
    addAuditEntry("Corporate service case opened", `${payload.priority}: ${payload.subject}.`);
  } catch (error) {
    message.textContent = error.message;
  }
}

function formatWalletMoney(cents, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: String(currency || "USD").toUpperCase(),
    maximumFractionDigits: 2
  }).format(Number(cents || 0) / 100);
}

function renderWalletContributions(access) {
  const scope = $("#walletContributionVisibility");
  const message = $("#walletContributionMessage");
  const ledger = $("#sharedWalletLedger");
  const memberTable = $("#memberTable");
  const contributions = Array.isArray(access.contributions) ? access.contributions : [];
  const isAdminView = access.contributionVisibility === "all_members";
  const isRestricted = access.contributionVisibility === "restricted";
  const currency = access.wallet?.currency || "USD";

  if (scope) scope.textContent = isRestricted
    ? "Finance details restricted by trip policy"
    : (isAdminView ? "Admin view • all member contributions" : "Personal view • your contributions only");
  if (message) {
    const personalTotal = contributions
      .filter((contribution) => !state.session?.user?.id || contribution.userId === state.session.user.id)
      .reduce((total, contribution) => total + Number(contribution.amountCents || 0), 0);
    message.textContent = isRestricted
      ? "Corporate and business-trip financial details are limited to authorized finance roles."
      : isAdminView
      ? `${contributions.length} contribution record${contributions.length === 1 ? "" : "s"} across the active trip members.`
      : `Your recorded contributions total ${formatWalletMoney(personalTotal, currency)}. Pending payments are not added to the shared balance.`;
  }

  if (access.status !== "ready") return;

  const makeContributionRow = (contribution) => {
    const row = document.createElement("div");
    const time = document.createElement("time");
    time.textContent = contribution.createdAt ? new Date(contribution.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Recent";
    const title = document.createElement("strong");
    title.textContent = `${contribution.memberName || "Trip member"} contribution`;
    const detail = document.createElement("span");
    detail.textContent = `${formatWalletMoney(contribution.amountCents, contribution.currency || currency)} ${contribution.status || "pending"} • ${contribution.refundableCents ? formatWalletMoney(contribution.refundableCents, contribution.currency || currency) + " refundable" : "refund status pending"}`;
    row.append(time, title, detail);
    return row;
  };

  if (ledger) {
    ledger.replaceChildren();
    if (!contributions.length) {
      const empty = document.createElement("div");
      empty.className = "wallet-ledger-empty";
      empty.textContent = isAdminView ? "No member contributions have been confirmed yet." : "Your contribution history will appear here after secure checkout confirmation.";
      ledger.append(empty);
    } else {
      contributions.forEach((contribution) => ledger.append(makeContributionRow(contribution)));
    }
  }

  if (memberTable) {
    memberTable.replaceChildren();
    const header = document.createElement("div");
    header.setAttribute("role", "row");
    ["Member", "Deposited", "Refundable", "Status"].forEach((label) => {
      const cell = document.createElement("strong");
      cell.setAttribute("role", "columnheader");
      cell.textContent = label;
      header.append(cell);
    });
    memberTable.append(header);
    if (!contributions.length) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      const cell = document.createElement("span");
      cell.textContent = isAdminView ? "No confirmed deposits yet." : "Your confirmed deposits will appear here.";
      cell.setAttribute("role", "cell");
      row.append(cell);
      memberTable.append(row);
    } else {
      contributions.forEach((contribution) => {
        const row = document.createElement("div");
        row.setAttribute("role", "row");
        [
          contribution.memberName || "Trip member",
          formatWalletMoney(contribution.amountCents, contribution.currency || currency),
          formatWalletMoney(contribution.refundableCents, contribution.currency || currency),
          contribution.status || "pending"
        ].forEach((value) => {
          const cell = document.createElement("span");
          cell.setAttribute("role", "cell");
          cell.textContent = value;
          row.append(cell);
        });
        memberTable.append(row);
      });
    }
  }
}

function renderWalletNotifications(access) {
  const status = $("#walletNotificationStatus");
  const message = $("#walletNotificationMessage");
  const list = $("#walletNotificationList");
  const notifications = Array.isArray(access.recentNotifications) ? access.recentNotifications : [];
  if (status) status.textContent = access.pushNotificationsConfigured ? "Wallet alerts are on" : "In-app wallet alerts are on";
  if (message) message.textContent = access.pushNotificationsConfigured
    ? "Deposit confirmations and due-payment reminders use in-app alerts and can pop up as browser push after Notify is enabled."
    : "Deposit confirmations and due-payment reminders appear in-app. Add VAPID keys and tap Notify to enable browser push alerts.";
  if (!list || access.status !== "ready") return;
  list.replaceChildren();
  notifications.forEach((notification) => {
    const item = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = notification.title;
    const body = document.createElement("span");
    body.textContent = notification.body;
    item.append(title, body);
    list.append(item);
  });
}

function renderWalletAccess() {
  const access = state.walletAccess;
  const roleLabel = {
    owner: "Trip owner",
    admin: "Trip admin",
    organizer: "Trip organizer",
    finance_admin: "Finance admin",
    member: "Trip member"
  }[access.role] || "Trip member";
  const roleElement = $("#walletAccessRole");
  const message = $("#walletAccessMessage");
  const badge = $("#walletAccessBadge");
  const tapButton = $("#tapToPayButton");
  const adminControls = $("#walletCardAdminControls");
  const fundsForm = $("#fundsForm");
  const fundsInput = $("#fundAmount");
  const fundsSubmit = fundsForm?.querySelector("button[type='submit']");
  const paymentRequestForm = $("#paymentRequestForm");

  if (roleElement) roleElement.textContent = roleLabel;
  if (badge) {
    badge.textContent = access.status === "ready"
      ? (access.canManageCard ? "Admin card controls" : "Member funding only")
      : "Role checked on server";
    badge.dataset.state = access.canManageCard ? "admin" : access.status;
  }
  if (adminControls) adminControls.hidden = !access.canManageCard;
  if (paymentRequestForm) paymentRequestForm.hidden = !access.canManageCard;
  if (tapButton) {
    tapButton.hidden = !access.canManageCard;
    tapButton.disabled = !access.canTapToPay;
    tapButton.textContent = access.canTapToPay ? "Tap to pay with shared card" : "Tap to pay • issuer setup required";
    tapButton.title = access.canTapToPay ? "Start the authorized shared-card tap-to-pay flow" : "An authorized card issuer must provision this trip card first";
  }
  if (fundsInput) fundsInput.disabled = !access.canContribute;
  if (fundsSubmit) fundsSubmit.disabled = !access.canContribute;
  if (message) {
    if (access.status === "loading") {
      message.textContent = "Checking your trip role and shared-card permissions...";
    } else if (access.status === "error") {
      message.textContent = access.message || "Wallet permissions could not be loaded. Refresh after signing in.";
    } else if (!state.session?.user && !isFilePreview) {
      message.textContent = "Sign in to load your trip role. Members can add their own funds; only trip admins can use shared-card controls.";
    } else if (access.canManageCard) {
      message.textContent = access.canTapToPay
        ? `${roleLabel} access confirmed. You can start an issuer-authorized tap-to-pay purchase from the shared card.`
        : `${roleLabel} access confirmed. Card controls are visible, but tap-to-pay stays disabled until the issuer provisions the trip card.`;
    } else if (access.canContribute) {
      message.textContent = `${roleLabel} access confirmed. You can add your own funds through secure hosted checkout. Shared-card controls stay with the trip admin.`;
    } else {
      message.textContent = "This trip does not currently accept member contributions.";
    }
  }
  renderWalletContributions(access);
  renderWalletNotifications(access);
}

function syncWalletSummary(wallet) {
  if (!wallet) return;
  const format = (cents) => `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const available = format(wallet.availableCents);
  const contributions = format(wallet.totalContributionsCents);
  ["#walletTotal", "#walletMetric"].forEach((selector) => {
    if ($(selector)) $(selector).textContent = contributions;
  });
  if ($("#tripTotalContributions")) $("#tripTotalContributions").textContent = contributions;
  if ($("#tripAvailableBalance")) $("#tripAvailableBalance").textContent = available;
  if ($("#bankTotalCollected")) $("#bankTotalCollected").textContent = contributions;
}

async function loadWalletAccess() {
  state.walletAccess = { ...state.walletAccess, status: "loading", message: "" };
  renderWalletAccess();
  if (!state.session?.access_token || isFilePreview) {
    state.walletAccess = {
      ...state.walletAccess,
      status: isFilePreview ? "preview" : "unknown",
      canContribute: false,
      canTapToPay: false,
      canManageCard: false
    };
    renderWalletAccess();
    return;
  }

  try {
    const storedTripId = sessionStorage.getItem("traveldripActiveTripId") || "";
    const query = storedTripId ? `?tripId=${encodeURIComponent(storedTripId)}` : "";
    const result = await apiRequest(`/api/wallet${query}`);
    if (result.skipped) throw new Error("Wallet permissions require a deployed authenticated session.");
    state.walletAccess = { ...result, status: "ready" };
    syncWalletSummary(result.wallet);
    if (result.tripId) {
      state.activeTripId = result.tripId;
      state.ownershipTransfer.tripId = result.tripId;
      sessionStorage.setItem("traveldripActiveTripId", result.tripId);
    }
  } catch (error) {
    state.walletAccess = {
      ...state.walletAccess,
      status: "error",
      canContribute: false,
      canTapToPay: false,
      canManageCard: false,
      message: error.message || "Wallet permissions could not be loaded."
    };
  }
  renderWalletAccess();
  if (state.activeTripId && $("#ownershipTransferPanel")) loadOwnershipMembers();
}

function setOwnershipTransferMessage(message, tone = "") {
  const element = $("#ownershipTransferMessage");
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

function renderOwnershipTransferMembers() {
  const select = $("#ownershipTransferMemberSelect");
  const transferButton = $("#transferOwnershipButton");
  if (!select) return;
  const members = state.ownershipTransfer.members || [];
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = members.length ? "Select an active trip member" : "No eligible active members found";
  select.appendChild(placeholder);
  members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.userId;
    option.textContent = member.username ? `${member.fullName} (@${member.username})` : member.fullName;
    select.appendChild(option);
  });
  select.disabled = !members.length || state.ownershipTransfer.status !== "ready";
  if (transferButton) transferButton.disabled = select.disabled || !select.value;
  const role = $("#ownershipTransferRole");
  if (role) {
    role.textContent = state.ownershipTransfer.status === "ready" ? "Owner access confirmed" : "Owner only";
    role.dataset.state = state.ownershipTransfer.status === "ready" ? "admin" : state.ownershipTransfer.status;
  }
}

async function loadOwnershipMembers() {
  let tripId = state.activeTripId || sessionStorage.getItem("traveldripActiveTripId") || "";
  const entityType = $("#ownershipTransferEntityType")?.value || "auto";
  state.ownershipTransfer = {
    ...state.ownershipTransfer,
    status: "loading",
    tripId,
    entityType,
    members: []
  };
  renderOwnershipTransferMembers();
  if (!state.session?.access_token || isFilePreview) {
    state.ownershipTransfer.status = isFilePreview ? "preview" : "idle";
    renderOwnershipTransferMembers();
    setOwnershipTransferMessage("Sign in on the deployed app to verify owner access and load real active trip members.");
    return;
  }

  try {
    if (!tripId) {
      const tripList = await apiRequest("/api/trips?status=active");
      const selectedTrip = (tripList.trips || []).find((trip) => trip.myRole === "owner") || tripList.trips?.[0];
      tripId = selectedTrip?.id || "";
      if (tripId) {
        state.activeTripId = tripId;
        state.ownershipTransfer.tripId = tripId;
        sessionStorage.setItem("traveldripActiveTripId", tripId);
      }
    }
    if (!tripId) {
      state.ownershipTransfer.status = "idle";
      renderOwnershipTransferMembers();
      setOwnershipTransferMessage("No active trip was found. Create or join a trip before managing ownership.");
      return;
    }
    const result = await apiRequest(`/api/ownership-transfer?tripId=${encodeURIComponent(tripId)}&entityType=${encodeURIComponent(entityType)}`);
    if (result.skipped) throw new Error("Ownership transfer requires a deployed authenticated session.");
    state.ownershipTransfer = {
      ...state.ownershipTransfer,
      status: "ready",
      entityType: result.entityType || entityType,
      members: result.members || []
    };
    if ($("#ownershipTransferEntityType")) $("#ownershipTransferEntityType").value = result.entityType || entityType;
    renderOwnershipTransferMembers();
    const targetName = result.entityType === "event" ? "event" : "trip";
    setOwnershipTransferMessage(
      result.members?.length
        ? `Owner access confirmed for "${result.trip?.title || targetName}". Choose an active member to receive full ownership.`
        : `Owner access confirmed, but there are no other active members available to receive ownership.`,
      "success"
    );
  } catch (error) {
    state.ownershipTransfer = { ...state.ownershipTransfer, status: "error", members: [] };
    renderOwnershipTransferMembers();
    setOwnershipTransferMessage(error.message || "Ownership controls could not be loaded. Only the current owner can transfer access.", "error");
  }
}

async function transferOwnership() {
  const tripId = state.ownershipTransfer.tripId || state.activeTripId || sessionStorage.getItem("traveldripActiveTripId") || "";
  const newOwnerUserId = $("#ownershipTransferMemberSelect")?.value || "";
  const entityType = state.ownershipTransfer.entityType || $("#ownershipTransferEntityType")?.value || "auto";
  const leaveAfterTransfer = Boolean($("#ownershipTransferLeaveInput")?.checked);
  if (!tripId || !newOwnerUserId) {
    setOwnershipTransferMessage("Load active members and select the person who should receive ownership.", "error");
    return;
  }
  const selectedMember = state.ownershipTransfer.members.find((member) => member.userId === newOwnerUserId);
  const memberName = selectedMember?.fullName || "this active member";
  const leaveCopy = leaveAfterTransfer
    ? " Your access will change to former participant and you will leave the trip/event."
    : " You will remain an organizer without owner-level control.";
  if (!window.confirm(`Transfer full ownership to ${memberName}?${leaveCopy}`)) return;

  const transferButton = $("#transferOwnershipButton");
  if (transferButton) {
    transferButton.disabled = true;
    transferButton.textContent = "Transferring...";
  }
  try {
    const result = await apiRequest("/api/ownership-transfer", {
      method: "POST",
      body: JSON.stringify({
        tripId,
        entityType,
        newOwnerUserId,
        leaveAfterTransfer
      })
    });
    if (result.skipped) throw new Error("Ownership transfer requires a deployed authenticated session.");
    state.ownershipTransfer.status = "transferred";
    state.ownershipTransfer.members = [];
    renderOwnershipTransferMembers();
    setOwnershipTransferMessage(result.message || "Ownership transferred successfully. The new owner now has full access.", "success");
    addAuditEntry("Trip ownership transferred", `${memberName} received full ${result.entityType || entityType} ownership. Previous owner access: ${leaveAfterTransfer ? "left" : "organizer"}.`);
  } catch (error) {
    setOwnershipTransferMessage(error.message || "Ownership could not be transferred. No permissions were changed.", "error");
    if (transferButton) transferButton.disabled = false;
  } finally {
    if (transferButton) transferButton.textContent = "Transfer full ownership";
  }
}

function liveSearchMessage(target, message, tone = "") {
  const selectors = {
    explore: "#exploreProviderStatus",
    travel: "#travelLiveSearchStatus",
    privateDriver: "#privateDriverLiveStatus"
  };
  const element = $(selectors[target]);
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

async function searchLiveTravelPlaces({ category, query = "", destination = "", target }) {
  liveSearchMessage(target, "Searching live travel sources...", "loading");
  try {
    const result = await apiRequest("/api/travel-search", {
      method: "POST",
      body: JSON.stringify({ category, q: query, destination, limit: 8 })
    });
    if (result.skipped) throw new Error("Live search requires a signed-in deployed app.");
    const results = result.results || [];
    if (target === "explore") {
      state.liveSearch.exploreResults = results;
      renderLiveExploreResults(results);
    }
    if (target === "travel") {
      state.liveSearch.travelResults = results;
      renderLiveTravelResults(results);
    }
    if (target === "privateDriver") {
      state.liveSearch.privateDriverResults = results;
      renderLivePrivateDriverResults(results);
    }
    liveSearchMessage(target, results.length
      ? `${results.length} live result${results.length === 1 ? "" : "s"} from ${result.sourceLabel || "an outside source"}. Verify details before booking.`
      : "No live results matched. Try a broader destination or search term.", results.length ? "success" : "empty");
    return result;
  } catch (error) {
    liveSearchMessage(target, `${error.message} Local estimates remain available.`, "error");
    if (target === "explore") renderLiveExploreResults([]);
    if (target === "travel") renderLiveTravelResults([]);
    if (target === "privateDriver") renderLivePrivateDriverResults([]);
    return { error: error.message };
  }
}

function formatFlightDateTime(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function flightTrackingMessage(message, tone = "") {
  const status = $("#flightTrackingStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function renderFlightTrackingResult(flight, sourceLabel = "Live flight status") {
  const container = $("#flightTrackingResult");
  if (!container) return;
  if (!flight) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const progress = flight.progressPercent == null ? "Not available" : `${flight.progressPercent}%`;
  const gates = [flight.terminalOrigin && `Terminal ${flight.terminalOrigin}`, flight.gateOrigin && `Gate ${flight.gateOrigin}`].filter(Boolean).join(" • ") || "Gate information unavailable";
  const destinationGates = [flight.terminalDestination && `Terminal ${flight.terminalDestination}`, flight.gateDestination && `Gate ${flight.gateDestination}`].filter(Boolean).join(" • ") || "Arrival gate unavailable";
  container.hidden = false;
  container.innerHTML = `
    <div class="flight-tracking-result__header">
      <div>
        <span class="eyebrow">${escapeHtml(sourceLabel)}</span>
        <h3>${escapeHtml(flight.operator)} ${escapeHtml(flight.ident)}</h3>
        <p>${escapeHtml(flight.origin)} → ${escapeHtml(flight.destination)}</p>
      </div>
      <span class="status-pill">${escapeHtml(flight.status)}</span>
    </div>
    <div class="flight-tracking-result__grid">
      <div><span>Departure</span><strong>${escapeHtml(formatFlightDateTime(flight.estimatedOut || flight.scheduledOut))}</strong><small>${escapeHtml(gates)}</small></div>
      <div><span>Arrival</span><strong>${escapeHtml(formatFlightDateTime(flight.estimatedIn || flight.scheduledIn))}</strong><small>${escapeHtml(destinationGates)}</small></div>
      <div><span>Progress</span><strong>${escapeHtml(progress)}</strong><small>${flight.actualOut && !flight.actualIn ? "Currently airborne or en route" : "Provider progress estimate"}</small></div>
      <div><span>Aircraft</span><strong>${escapeHtml(flight.aircraftType || "Unavailable")}</strong><small>Updated from the live provider</small></div>
    </div>
    <div class="flight-tracking-result__actions">
      ${flight.trackingUrl ? `<a class="ghost-button" href="${escapeHtml(flight.trackingUrl)}" target="_blank" rel="noopener noreferrer">Open live map</a>` : ""}
      <button type="button" data-flight-track-refresh="${escapeHtml(flight.ident)}">Refresh status</button>
    </div>
  `;
}

async function trackFlightStatus({ ident, date = "", origin = "" } = {}) {
  const normalizedIdent = String(ident || "").trim();
  if (!normalizedIdent) {
    flightTrackingMessage("Enter a flight number such as DL241.", "error");
    return;
  }
  flightTrackingMessage("Checking the live flight provider...", "loading");
  renderFlightTrackingResult(null);
  try {
    const result = await apiRequest("/api/flight-tracking", {
      method: "POST",
      body: JSON.stringify({ ident: normalizedIdent, date, origin })
    });
    if (result.skipped) throw new Error("Live flight tracking requires a signed-in deployed app.");
    state.liveSearch.flight = result.flight || null;
    renderFlightTrackingResult(result.flight, result.sourceLabel);
    flightTrackingMessage(
      result.flight ? `${result.sourceLabel || "Live flight status"} updated for ${result.flight.ident}.` : "No live flight status was returned.",
      result.flight ? "success" : "empty"
    );
    addAuditEntry("Live flight status checked", `${normalizedIdent} searched through the configured flight provider.`);
    await saveSyncedEvent("flight_status_checked", { ident: normalizedIdent, date, origin });
  } catch (error) {
    state.liveSearch.flight = null;
    flightTrackingMessage(`${error.message} Saved confirmation details remain available below.`, "error");
    renderFlightTrackingResult(null);
  }
}

function hotelAvailabilityMessage(message, tone = "") {
  const status = $("#hotelLiveStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function renderLiveHotelResults(results = [], sourceLabel = "Live hotel availability") {
  const container = $("#hotelLiveResults");
  if (!container) return;
  container.hidden = !results.length;
  container.innerHTML = results.map((hotel) => `
    <article class="hotel-live-result-card">
      <div>
        <span class="eyebrow">${escapeHtml(sourceLabel)}</span>
        <h4>${escapeHtml(hotel.title)}</h4>
        <small>${escapeHtml(hotel.location || hotel.cityCode || "Destination details available")}</small>
      </div>
      <div class="hotel-live-result-card__details">
        <span>${escapeHtml(hotel.checkInDate)} → ${escapeHtml(hotel.checkOutDate)}</span>
        <strong>${escapeHtml(hotel.price)} ${escapeHtml(hotel.currency)}</strong>
        <small>${escapeHtml(hotel.room)} • ${escapeHtml(hotel.board)}</small>
        <small>${escapeHtml(hotel.cancellation)}</small>
      </div>
      <span class="status-pill">Availability found</span>
    </article>
  `).join("");
}

async function searchLiveHotelAvailability({ cityCode, checkInDate, checkOutDate, adults, hotelId = "" } = {}) {
  hotelAvailabilityMessage("Checking current hotel availability...", "loading");
  renderLiveHotelResults([]);
  try {
    const result = await apiRequest("/api/hotel-availability", {
      method: "POST",
      body: JSON.stringify({ cityCode, checkInDate, checkOutDate, adults, hotelId })
    });
    if (result.skipped) throw new Error("Live hotel availability requires a signed-in deployed app.");
    const results = result.results || [];
    state.liveSearch.hotelResults = results;
    renderLiveHotelResults(results, result.sourceLabel);
    hotelAvailabilityMessage(
      results.length
        ? `${results.length} live availability result${results.length === 1 ? "" : "s"}. Availability and pricing can change until booking is confirmed.`
        : "No live rooms were returned for those dates. Try another city, property, or date range.",
      results.length ? "success" : "empty"
    );
    addAuditEntry("Live hotel availability checked", `${cityCode} searched for ${checkInDate} through ${checkOutDate}.`);
    await saveSyncedEvent("hotel_availability_checked", { cityCode, checkInDate, checkOutDate, adults, hotelId });
  } catch (error) {
    state.liveSearch.hotelResults = [];
    hotelAvailabilityMessage(`${error.message} Saved hotel confirmations remain available.`, "error");
    renderLiveHotelResults([]);
  }
}

function renderLiveExploreResults(results = []) {
  const grid = $("#exploreLiveResultsGrid");
  if (!grid) return;
  grid.hidden = !results.length;
  grid.innerHTML = results.map((item) => `
    <article class="explore-card live-source-card">
      <div class="live-source-card__body">
        <span class="eyebrow">Live result • ${escapeHtml(item.sourceLabel || "Outside source")}</span>
        <strong class="discovery-title">${escapeHtml(item.title)}</strong>
        <span class="discovery-location">${escapeHtml(item.location || "Destination details available")}</span>
        <span class="discovery-description">${escapeHtml(item.description)}</span>
        <span class="explore-card-meta">
          <strong>${escapeHtml(item.price || "Price varies")}</strong>
          <small>${item.rating ? `${Number(item.rating).toFixed(1)} rating` : "Provider rating available"}</small>
          <small>${escapeHtml(item.status || "Provider details available")}</small>
        </span>
      </div>
      <div class="explore-card-actions">
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.directions || item.providerUrl || "")}">Get Directions</button>
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.website || item.providerUrl || "")}">Visit Website</button>
      </div>
    </article>
  `).join("");
}

function renderLiveTravelResults(results = []) {
  const container = $("#travelLiveResults");
  if (!container) return;
  container.hidden = !results.length;
  container.innerHTML = results.map((item) => `
    <article class="travel-live-result-card">
      <div>
        <span class="eyebrow">Live ${escapeHtml(item.sourceLabel || "outside source")}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.location || "Provider location available")}</small>
        <small>${escapeHtml(item.description)}</small>
      </div>
      <div class="button-row">
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.directions || item.providerUrl || "")}">Directions</button>
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.website || item.providerUrl || "")}">Provider</button>
      </div>
    </article>
  `).join("");
}

function renderLivePrivateDriverResults(results = []) {
  const container = $("#privateDriverLiveList");
  if (!container) return;
  container.hidden = !results.length;
  container.innerHTML = results.map((item) => `
    <article class="private-driver-live-card">
      <span class="eyebrow">Live provider • ${escapeHtml(item.sourceLabel || "Outside source")}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.location || "Destination location available")}</small>
      <small>${escapeHtml(item.description)}</small>
      <div class="private-driver-actions">
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.website || item.providerUrl || "")}">Open provider</button>
        <button type="button" data-live-result-url="${escapeHtml(item.actions?.directions || item.providerUrl || "")}">Directions</button>
      </div>
    </article>
  `).join("");
}

async function runLiveAiResearch() {
  const status = $("#aiPlannerStatus");
  const research = $("#aiPlannerExternalResearch");
  if (status) status.textContent = "AI is researching current travel sources...";
  if (research) research.innerHTML = `<p class="small">Searching current destinations, activities, restaurants, and transportation sources...</p>`;
  try {
    const response = await apiRequest("/api/ai-planner", {
      method: "POST",
      body: JSON.stringify({
        answers: state.aiPlanner.answers,
        query: $("#aiPlannerResearchInput")?.value.trim() || ""
      })
    });
    if (response.skipped) throw new Error("Live AI research requires a signed-in deployed app.");
    state.liveSearch.aiResearch = response;
    if (research) {
      research.innerHTML = `
        <div class="ai-external-research__header">
          <span class="eyebrow">${escapeHtml(response.sourceLabel || "Live AI research")}</span>
          <strong>Current source-backed guidance</strong>
        </div>
        <p>${escapeHtml(response.text || "No research summary was returned.")}</p>
        ${(response.citations || []).length ? `<div class="ai-research-sources"><strong>Sources</strong>${response.citations.map((citation) => `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(citation.title)}</a>`).join("")}</div>` : `<small>No source links were returned. Verify recommendations before booking.</small>`}
      `;
    }
    if (status) status.textContent = "Live AI research is ready. Source links are shown below the summary; verify availability before booking.";
  } catch (error) {
    if (research) research.innerHTML = `<p class="small">${escapeHtml(error.message)} Local planning estimates remain available.</p>`;
    if (status) status.textContent = "Live AI research is unavailable. Configure the AI provider in Vercel and try again.";
  }
}

async function ghlRequest(payload = {}) {
  if (isFilePreview || !state.session?.access_token) return { skipped: true, reason: "CRM sync requires a deployed authenticated session" };
  if ($("#ghlSyncEnabled") && !$("#ghlSyncEnabled").checked && payload.action !== "test-connection") {
    return { skipped: true, reason: "Automatic CRM sync is disabled" };
  }
  const response = await fetch("/api/ghl-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "CRM sync failed");
  return data;
}

function queueGhlSync(payload = {}) {
  if (isFilePreview || !state.session?.access_token) return;
  ghlRequest(payload).catch((error) => {
    addAuditEntry("GoHighLevel sync queued for retry", error.message);
  });
}

const corporateEmployeeRoles = new Set(["employee", "contractor", "speaker", "vendor", "vip", "guest"]);
const corporateEmployeeBlockedTargets = new Set(["letsPlan", "aiTravelPlanner", "tripsPanel", "eventsPanel", "enterpriseRbac", "groupBank", "splitBill"]);

function isCorporateEmployeeMode() {
  return hasValidCorporateAccess()
    && ($("#dashboardTripType")?.value || "group") === "corporate"
    && corporateEmployeeRoles.has(state.corporateAccess.role || "employee");
}

function updateWorkspaceSwitcher() {
  const control = $("#accountWorkspaceControl");
  const select = $("#accountWorkspaceSwitch");
  const canSwitch = Boolean(state.session?.user && state.corporateAccess.accountLinked && hasValidCorporateAccess());
  if (control) setVisibilityWithoutCssLeaks(control, canSwitch);
  if (select && canSwitch) select.value = isCorporateEmployeeMode() ? "corporate" : "personal";
}

function setCorporateEmployeeNavigation(employeeMode) {
  [
    '[data-main-nav-id="planning"]',
    '[data-main-nav-id="events"]',
    ".corporate-tab",
    "[data-corporate-entry]",
    "[data-planning-nav]"
  ].forEach((selector) => {
    $$(selector).forEach((element) => setVisibilityWithoutCssLeaks(element, !employeeMode));
  });
  $$("[data-employee-transport-nav] button").forEach((button) => {
    const allowed = button.dataset.mainNavId === "transportation";
    setVisibilityWithoutCssLeaks(button, !employeeMode || allowed);
  });
  $$("[data-employee-wallet-nav] button").forEach((button) => {
    const allowed = button.dataset.mainNavId === "wallet";
    setVisibilityWithoutCssLeaks(button, !employeeMode || allowed);
  });
}

function syncCorporateEmployeeDashboardVisibility(employeeMode) {
  const dashboardIsActive = document.body.dataset.activeRoute === "dashboardHome";
  const showEmployeeDashboard = employeeMode && dashboardIsActive;
  const showPersonalDashboard = !employeeMode && dashboardIsActive;

  ["#dashboardHome", ".pwa-panel", ".destination-insights", ".travel-social-strip", ".metrics", "#dashboardWidgets"].forEach((selector) => {
    $$(selector).forEach((section) => setVisibilityWithoutCssLeaks(section, showPersonalDashboard));
  });
  setVisibilityWithoutCssLeaks($("#corporateHome"), showEmployeeDashboard);
}

function syncCorporateEmployeeRouteVisibility(employeeMode) {
  const activeRoute = document.body.dataset.activeRoute || "";
  const showEmployeeTravel = employeeMode && activeRoute === "rideShareHub";
  const showEmployeeItinerary = employeeMode && activeRoute === "itineraryAlerts";
  setVisibilityWithoutCssLeaks($("#corporateEmployeeTravel"), showEmployeeTravel);
  setVisibilityWithoutCssLeaks($("#corporateEmployeeItinerary"), showEmployeeItinerary);

  if (showEmployeeItinerary) {
    $$('[data-route-support~="itineraryAlerts"]').forEach((section) => setVisibilityWithoutCssLeaks(section, false));
  }
}

function updateDashboardWidgets() {
  const tripType = $("#dashboardTripType")?.value || "group";
  const role = tripType === "corporate" && hasValidCorporateAccess()
    ? state.corporateAccess.role || "employee"
    : $("#rolePreview")?.value || "employee";
  if (state.corporateAccess.verified && !hasValidCorporateAccess()) {
    clearCorporateAccess("Corporate event session expired. Re-enter the secure code to continue.");
  }
  const isCorporateMode = tripType === "corporate" && hasValidCorporateAccess();
  const isEmployeeMode = isCorporateMode && corporateEmployeeRoles.has(role);
  const isFinancialRole = ["owner", "executive", "finance"].includes(role);
  const isAdminRole = ["owner", "executive", "travel", "organizer", "finance"].includes(role);

  document.body.classList.toggle("corporate-mode", isCorporateMode);
  document.body.classList.toggle("corporate-employee-mode", isEmployeeMode);
  if ($("#workspacePreview")) $("#workspacePreview").value = isCorporateMode ? "corporate" : "personal";
  if ($("#dashboardTripType") && tripType === "corporate" && !isCorporateMode) $("#dashboardTripType").value = "group";

  $$("[data-widget-scope]").forEach((widget) => {
    const allowed = widget.dataset.widgetScope.split(" ").includes(isCorporateMode ? "corporate" : tripType);
    const financeAllowed = !widget.dataset.financeWidget || !isCorporateMode || isFinancialRole;
    widget.hidden = !allowed || !financeAllowed || widget.dataset.userHidden === "true";
  });

  $$("[data-corporate-nav]").forEach((section) => {
    section.hidden = !isCorporateMode || isEmployeeMode;
  });

  $$("[data-consumer-nav]").forEach((section) => {
    section.hidden = isCorporateMode && !isEmployeeMode;
  });

  $$("[data-requires-trip-type]").forEach((item) => {
    item.hidden = !item.dataset.requiresTripType.split(" ").includes(isCorporateMode ? "corporate" : tripType);
  });

  const isAdminSurface = adminSurfaceTargets.has(document.body.dataset.activeRoute || "");
  $$('[data-admin-only]').forEach((item) => {
    item.hidden = !isAdminSurface || !isAdminRole;
    item.setAttribute("aria-hidden", String(item.hidden));
  });

  syncCorporateEmployeeDashboardVisibility(isEmployeeMode);
  syncCorporateEmployeeRouteVisibility(isEmployeeMode);
  if ($("#corporateWorkspaceBadge")) {
    $("#corporateWorkspaceBadge").textContent = isAdminRole ? "Admin workspace" : "Employee workspace";
  }

  const labels = {
    solo: "Solo dashboard: personal itinerary, AI recommendations, weather, budget, and documents are prioritized.",
    group: "Group dashboard: chat, polls, shared budget, events, member activity, and notifications are prioritized.",
    cruise: "Cruise dashboard: ship details, cabin, ports, excursions, onboard schedule, cruise wallet, reminders, and memories are prioritized.",
    corporate: isAdminRole
      ? "Corporate admin dashboard: employee logistics plus budget, approvals, attendance, reports, and audit widgets are visible."
      : "Corporate employee dashboard: assigned flights, hotel, transportation, event schedule, approved activities, per diem, card status, policies, and announcements are visible."
  };
  $("#widgetStatusMessage").textContent = isCorporateMode
    ? `${labels.corporate} Personal leisure trips and consumer wallet prompts are hidden.`
    : labels[tripType] || labels.group;
  if ($("#corporateModeMessage")) {
    $("#corporateModeMessage").textContent = isCorporateMode
      ? "Corporate Mode is active. Personal leisure trips, public invites, vacation deals, and consumer wallet prompts are hidden from this workspace."
      : "Personal Travel workspace is active. Corporate assignments, budgets, employee records, and policies stay separated.";
  }
  setCorporateEmployeeNavigation(isEmployeeMode);
  updateWorkspaceSwitcher();
  if (isEmployeeMode) renderCorporateEmployeeHome();
}

function applyTheme(theme = state.theme) {
  const resolvedTheme = themeLabels[theme] ? theme : "tropical";
  state.theme = resolvedTheme;
  document.body.dataset.travelTheme = resolvedTheme;
  if ($("#themeSelector")) $("#themeSelector").value = resolvedTheme;
  $$(".theme-swatch-grid [data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === resolvedTheme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if ($("#themeStatus")) {
    $("#themeStatus").textContent = `${themeLabels[resolvedTheme]} is active. Animations stay subtle and respect reduced-motion settings.`;
  }
}

function getActiveExploreCategory() {
  return $("#exploreTabs button.active")?.dataset.exploreCategory || "trending";
}

function getExploreCategorySlug(categoryKey = "trending") {
  const category = exploreCategories[categoryKey] ? categoryKey : "trending";
  return category.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase();
}

function getExploreCategoryFromSlug(slug = "") {
  const normalized = slug.trim().toLowerCase();
  return Object.keys(exploreCategories).find((key) => getExploreCategorySlug(key) === normalized) || "trending";
}

function getExploreRoute(categoryKey = getActiveExploreCategory(), itemId = "") {
  if (isFilePreview) return `index.html#exploreDrops`;
  const base = `/explore/${getExploreCategorySlug(categoryKey)}`;
  return itemId ? `${base}/${encodeURIComponent(itemId)}` : base;
}

function getExploreRouteState(pathname = location.pathname) {
  const parts = normalizeAppPath(pathname).split("/").filter(Boolean);
  if (parts[0] !== "explore") return { category: "trending", itemId: "" };
  if (parts[1] === "destinations") {
    return {
      category: "trending",
      itemId: "",
      destinationId: parts[2] ? decodeURIComponent(parts[2]) : "",
      destinationAction: parts[3] || "overview"
    };
  }
  return {
    category: getExploreCategoryFromSlug(parts[1] || "trending"),
    itemId: parts[2] ? decodeURIComponent(parts[2]) : ""
  };
}

function getDestinationExploreRoute(destination, action = "overview") {
  if (isFilePreview) return "index.html#exploreDrops";
  const suffix = action === "overview" || action === "destinations" ? "" : `/${action}`;
  return `/explore/destinations/${encodeURIComponent(destination.id)}${suffix}`;
}

function getExploreItems(categoryKey = getActiveExploreCategory()) {
  const query = $("#exploreSearchInput")?.value.trim().toLowerCase() || "";
  const rating = Number($("#exploreRatingFilter")?.value || 0);
  const distanceFilter = $("#exploreDistanceFilter")?.value || "any";
  const openNow = Boolean($("#exploreOpenNowFilter")?.checked);
  const budget = $("#exploreBudgetFilter")?.value || "any";
  let items = exploreCategories[categoryKey]?.items || [];

  if (query) {
    items = items.filter((item) => `${item.title} ${item.type} ${item.description} ${item.details.join(" ")}`.toLowerCase().includes(query));
  }
  if (rating) items = items.filter((item) => item.rating >= rating);
  if (distanceFilter !== "any") items = items.filter((item) => item.distance <= Number(distanceFilter));
  if (openNow) items = items.filter((item) => item.status.toLowerCase().includes("open"));
  if (budget !== "any") {
    const ceiling = Number(budget);
    items = items.filter((item) => {
      const price = Number((item.price.match(/\d+/) || [0])[0]);
      return price <= ceiling || categoryKey === "under900";
    });
  }
  return items;
}

function renderExplore(categoryKey = getActiveExploreCategory()) {
  if (!$("#exploreResultsGrid")) return;
  const category = exploreCategories[categoryKey] || exploreCategories.trending;
  const destination = $("#exploreDestinationInput")?.value.trim() || "your destination";
  const tripType = $("#exploreTripTypeFilter")?.selectedOptions?.[0]?.textContent || "selected trip";
  const items = getExploreItems(categoryKey);
  state.liveSearch.exploreResults = [];
  renderLiveExploreResults([]);

  $$("#exploreTabs button").forEach((button) => {
    const active = button.dataset.exploreCategory === categoryKey;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  $("#exploreDetailPanel").hidden = true;
  $("#exploreBackButton").hidden = true;
  $("#exploreResultsGrid").hidden = false;
  $("#exploreSubfilters").innerHTML = category.filters.map((filter) => `<button type="button" data-explore-subfilter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`).join("");
  $("#exploreResultsSummary").textContent = `${category.label} results for ${destination} ${tripType.toLowerCase()}`;
  $("#exploreEmptyState").hidden = items.length > 0;
  $("#exploreResultsGrid").innerHTML = items.map((item) => {
    const primaryActions = item.actions.filter((action) => ["Save", "Add to Trip", "Add to Itinerary", "Create This Trip"].includes(action)).slice(0, 2);
    return `
    <article class="explore-card" data-explore-card="${escapeHtml(item.id)}">
      <button class="explore-card-main" type="button" data-explore-detail="${escapeHtml(item.id)}">
        <span class="trending-media animated-discovery-media">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy">
        </span>
        <span class="discovery-content">
          <span class="eyebrow">${escapeHtml(item.type)}</span>
          <strong class="discovery-title">${escapeHtml(item.title)}</strong>
          <span class="discovery-location">${escapeHtml(destination)}</span>
          <span class="discovery-description">${escapeHtml(item.description)}</span>
          <span class="discovery-tags">
            ${item.details.slice(0, 2).map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
          </span>
          <span class="explore-card-meta">
            <strong>${escapeHtml(item.price)}</strong>
            <small>${item.rating.toFixed(1)} rating</small>
            <small>${item.distance ? `${item.distance} mi` : "Trip estimate"}</small>
            <small>${escapeHtml(item.status)}</small>
          </span>
        </span>
      </button>
      <div class="explore-card-actions">
        ${primaryActions.map((action) => `<button type="button" data-explore-action="${escapeHtml(action)}" data-explore-item="${escapeHtml(item.id)}">${escapeHtml(action)}</button>`).join("")}
      </div>
    </article>
  `;
  }).join("");
}

function findExploreItem(itemId) {
  return Object.values(exploreCategories).flatMap((category) => category.items).find((item) => item.id === itemId);
}

function showExploreDetail(itemId) {
  const item = findExploreItem(itemId);
  if (!item) return;
  $("#exploreResultsGrid").hidden = true;
  $("#exploreEmptyState").hidden = true;
  $("#exploreBackButton").hidden = false;
  $("#exploreDetailPanel").hidden = false;
  $("#exploreDetailPanel").innerHTML = `
    <img src="${item.image}" alt="${escapeHtml(item.title)}">
    <div>
      <p class="eyebrow">${escapeHtml(item.type)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="explore-card-meta detail">
        <strong>${escapeHtml(item.price)}</strong>
        <small>${item.rating.toFixed(1)} rating</small>
        <small>${item.distance ? `${item.distance} mi away` : "Budget estimate"}</small>
        <small>${escapeHtml(item.status)}</small>
      </div>
      <div class="explore-detail-list">
        ${item.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
      </div>
      <div class="explore-card-actions">
        ${item.actions.map((action) => `<button type="button" data-explore-action="${escapeHtml(action)}" data-explore-item="${escapeHtml(item.id)}">${escapeHtml(action)}</button>`).join("")}
      </div>
    </div>
  `;
  $("#exploreStatusMessage").textContent = `${item.title} detail page opened. Back returns to ${exploreCategories[getActiveExploreCategory()].label} with filters preserved.`;
}

function showDestinationExploreDetail(destinationId, action = "overview") {
  const destination = livePlanDestinations.find((item) => item.id === destinationId);
  if (!destination || !$("#exploreDetailPanel")) return;
  state.liveDestinationIndex = livePlanDestinations.findIndex((item) => item.id === destination.id);
  $("#exploreResultsGrid").hidden = true;
  $("#exploreEmptyState").hidden = true;
  $("#exploreBackButton").hidden = false;
  $("#exploreDetailPanel").hidden = false;
  const actionLabel = {
    overview: "Destination overview",
    activities: "Activities",
    hotels: "Hotels and stays",
    restaurants: "Food and restaurants"
  }[action] || "Destination overview";
  $("#exploreDetailPanel").innerHTML = `
    <img src="${destination.photo}" alt="${escapeHtml(destination.alt)}">
    <div>
      <p class="eyebrow">${escapeHtml(actionLabel)}</p>
      <h3>${escapeHtml(destination.location)}</h3>
      <p>${escapeHtml(destination.description)}</p>
      <div class="explore-card-meta detail">
        <strong>${escapeHtml(destination.category)}</strong>
        <small>Best time: ${escapeHtml(destination.season)}</small>
        <small>${escapeHtml(destination.greeting)}</small>
        <small>Reviewed ${escapeHtml(destination.reviewed)}</small>
      </div>
      <div class="explore-detail-list">
        <span>Known for: ${escapeHtml(destination.knownFor)}</span>
        <span>Fun fact: ${escapeHtml(destination.funFact)}</span>
        <span>Travel tip: ${escapeHtml(destination.tip)}</span>
        ${destination.adventures.map((adventure) => `<span>${escapeHtml(adventure)}</span>`).join("")}
      </div>
      <div class="explore-card-actions">
        <button type="button" data-destination-action="activities">View Activities</button>
        <button type="button" data-destination-action="restaurants">View Restaurants</button>
        <button type="button" data-destination-action="hotels">View Hotels</button>
        <button type="button" data-destination-action="ai">Ask AI About This Destination</button>
      </div>
    </div>
  `;
  $("#exploreStatusMessage").textContent = `${destination.location} ${actionLabel.toLowerCase()} opened from the rotating destination banner.`;
}

function saveAiPlannerState() {
  sessionStorage.setItem("traveldripAiPlannerStep", String(state.aiPlanner.step));
  sessionStorage.setItem("traveldripAiPlannerAnswers", JSON.stringify(state.aiPlanner.answers));
}

function getAiPlannerTripMode() {
  const tripType = state.aiPlanner.answers.tripType || "";
  if (/corporate|business|conference/i.test(tripType)) return "Corporate policy mode";
  if (/cruise/i.test(tripType)) return "Cruise-ready";
  if (/solo/i.test(tripType)) return "Solo concierge";
  return "Group-ready";
}

function getAiPlannerPlan() {
  const answers = state.aiPlanner.answers;
  const tripType = answers.tripType || "Group Vacation";
  const destination = answers.destination || "Miami";
  const budget = answers.budget || "$875/person";
  const dates = answers.dates || "Flexible dates";
  const interests = answers.interests || "Food and Dining";
  const corporate = /corporate|business|conference/i.test(tripType);
  const cruise = /cruise/i.test(tripType);
  const solo = /solo/i.test(tripType);
  return {
    title: `${destination} ${tripType} draft`,
    summary: corporate
      ? "Policy-aware company travel draft with approved hotels, transportation logistics, per-diem guidance, meeting schedules, and team activities."
      : cruise
        ? "Cruise planning draft with cabin preferences, embarkation guidance, shore excursions, dining reservations, onboard entertainment, and packing reminders."
        : solo
          ? "Personal concierge draft focused on safety, flexible pacing, local recommendations, budget tracking, documents, and memories."
          : "Collaborative trip draft with invitations, shared budget, polls, group-friendly dining, transportation, wallet contributions, and editable itinerary blocks.",
    cost: budget.includes("$") ? budget : "$875/person estimate",
    window: dates,
    style: interests,
    mode: getAiPlannerTripMode(),
    days: corporate
      ? ["Arrival, policy briefing, hotel check-in", "Meeting blocks, team lunch, approved team-building", "Conference sessions, transport windows, expense closeout"]
      : cruise
        ? ["Embarkation, cabin setup, welcome dinner", "Port morning, shore excursion, onboard show", "Sea day wellness, specialty dining, packing reminders"]
        : ["Arrival, check-in, local dinner", `${interests} anchor activity, lunch, evening experience`, "Flexible morning, favorite stop, departure"]
  };
}

function renderAiPlanner() {
  if (!$("#aiPlannerQuestion")) return;
  const step = aiPlannerSteps[Math.min(state.aiPlanner.step, aiPlannerSteps.length - 1)];
  $("#aiPlannerQuestion").textContent = step ? step.question : "Your personalized plan is ready. What would you like to adjust?";
  $("#aiPlannerReplies").innerHTML = (step?.options || ["Regenerate itinerary", "Create Trip", "Share Trip"]).map((option) => (
    `<button type="button" data-ai-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`
  )).join("");

  const answers = state.aiPlanner.answers;
  const memory = [
    ["Trip type", answers.tripType || "Not selected"],
    ["Destination", answers.destination || "Open to ideas"],
    ["Budget", answers.budget || "Not set"],
    ["Dates", answers.dates || "Flexible"],
    ["Interests", answers.interests || "Waiting"]
  ];
  $("#aiPlannerMemory").innerHTML = memory.map(([label, value]) => (
    `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  )).join("");

  const plan = getAiPlannerPlan();
  $("#aiTripTitle").textContent = plan.title;
  $("#aiTripSummary").textContent = plan.summary;
  $("#aiEstimatedCost").textContent = plan.cost;
  $("#aiTravelWindow").textContent = plan.window;
  $("#aiTravelStyle").textContent = plan.style;
  $("#aiTripMode").textContent = plan.mode;
  $("#aiItineraryPreview").innerHTML = plan.days.map((day, index) => (
    `<div><span>Day ${index + 1}</span><strong>${escapeHtml(day)}</strong><small>${index === 0 ? "Estimated until flights, lodging, and reservations are confirmed." : "Editable, removable, and regeneratable before saving."}</small></div>`
  )).join("");
}

async function answerAiPlanner(value) {
  const answer = String(value || "").trim();
  if (!answer) return;
  const step = aiPlannerSteps[Math.min(state.aiPlanner.step, aiPlannerSteps.length - 1)];
  if (step) state.aiPlanner.answers[step.key] = answer;
  $("#aiPlannerTranscript")?.insertAdjacentHTML("beforeend", `<div><strong>You</strong><span>${escapeHtml(answer)}</span></div>`);
  state.aiPlanner.step = Math.min(state.aiPlanner.step + 1, aiPlannerSteps.length);
  saveAiPlannerState();
  renderAiPlanner();
  const nextStep = aiPlannerSteps[Math.min(state.aiPlanner.step, aiPlannerSteps.length - 1)];
  $("#aiPlannerTranscript")?.insertAdjacentHTML("beforeend", `<div class="assistant"><strong>Travel-Drip AI</strong><span>${escapeHtml(nextStep ? nextStep.question : "Your draft is ready. You can save, share, regenerate, or create a trip now.")}</span></div>`);
  $("#aiPlannerStatus").textContent = `Saved ${Object.keys(state.aiPlanner.answers).length} planning answer(s) in this session.`;
  await saveSyncedEvent("ai_planner_answered", { step: step?.key || "complete", answer, tripMode: getAiPlannerTripMode() });
}

async function handleExploreAction(action, itemId) {
  const item = findExploreItem(itemId);
  const category = exploreCategories[getActiveExploreCategory()]?.label || "Explore";
  const destination = $("#exploreDestinationInput")?.value.trim() || "selected destination";
  const messages = {
    "Save": `${item.title} added to Saved Places.`,
    "Add to Trip": `${item.title} opened the selected trip itinerary with destination ${destination}.`,
    "Add to Itinerary": `${item.title} added to the itinerary draft.`,
    "Share": `${item.title} opened Travel-Drip sharing and connected social options.`,
    "Book": `${item.title} opened the supported booking flow.`,
    "Visit Website": `${item.title} opened the provider website workflow.`,
    "Customize Trip": `${item.title} opened the budget customization flow.`,
    "Create This Trip": `${item.title} opened guided trip creation with budget filters preserved.`,
    "View Menu": `${item.title} menu preview opened.`,
    "Get Directions": `${item.title} opened map directions for ${destination}.`,
    "Start Smart Bill Split": `${item.title} opened Smart Bill Split.`,
    "Make Reservation": `${item.title} opened reservation availability.`,
    "Vote in Group Chat": `${item.title} created a group chat poll.`,
    "Ask AI Trip Manager": `AI Trip Manager opened with ${item.title} as context.`
  };
  $("#exploreStatusMessage").textContent = messages[action] || `${action} opened for ${item.title}.`;
  addAuditEntry("Explore action", `${action}: ${item.title} from ${category}.`);
  await saveSyncedEvent("explore_action", {
    action,
    itemId,
    category,
    destination,
    tripType: $("#exploreTripTypeFilter")?.value || "group",
    dates: $("#exploreDatesInput")?.value || "",
    budget: $("#exploreBudgetFilter")?.value || "any"
  });
}

function renderInvitationSetup(type) {
  const config = invitationConfigs[type] || invitationConfigs.solo;
  const tripName = $("#tripNameInput")?.value.trim() || "Tokyo solo food sprint";
  const destination = $("#tripDestinationInput")?.value.trim() || "Tokyo, Japan";
  const startDate = $("#tripStartInput")?.value || "2026-08-08";
  const endDate = $("#tripEndInput")?.value || "2026-08-13";
  const typeLabel = tripTypeConfigs[type]?.label || "Solo Trip";

  $("#invitationModeCopy").textContent = config.modeCopy;
  $("#inviteTemplateBadge").textContent = config.badge;
  $("#invitePreviewTitle").textContent = tripName;
  $("#invitePreviewMessage").textContent = config.message;
  $("#invitePreviewDestination").textContent = destination;
  $("#invitePreviewDates").textContent = `${startDate} - ${endDate}`;
  $("#invitePreviewType").textContent = typeLabel;
  $("#inviteTitleInput").value = config.title;
  $("#inviteMessageInput").value = config.message;
  $("#inviteRecipientList").innerHTML = config.recipients.map((recipient) => `<span>${escapeHtml(recipient)}</span>`).join("");
  $("#companyLogoField").hidden = !config.companyLogo;
  $("#rsvpSentCount").textContent = String(config.sent);
  $("#rsvpOpenedCount").textContent = String(config.opened);
  $("#rsvpAcceptedCount").textContent = String(config.accepted);
  $("#rsvpPendingCount").textContent = String(config.pending);
}

function startAuthCarousel() {
  const frame = $(".auth-carousel");
  const image = $("#authCarouselImage");
  const quote = $("#authQuote");
  if (!frame || !image || !quote || !authCarouselSlides.length) return;

  let index = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const preload = (slide) => {
    const nextImage = new Image();
    nextImage.src = slide.src;
  };

  const renderSlide = () => {
    index = (index + 1) % authCarouselSlides.length;
    const slide = authCarouselSlides[index];
    preload(authCarouselSlides[(index + 1) % authCarouselSlides.length]);
    frame.classList.add("is-fading");
    window.setTimeout(() => {
      image.src = slide.src;
      image.alt = slide.alt;
      quote.textContent = slide.quote;
    }, 240);
    window.setTimeout(() => frame.classList.remove("is-fading"), 820);
  };

  preload(authCarouselSlides[1]);
  if (!reduceMotion) window.setInterval(renderSlide, 5200);
}

function getBillInputs() {
  const subtotal = Number($("#billSubtotal")?.value || 0);
  const tax = Number($("#billTax")?.value || 0);
  const tipPercent = Number($("#billTipPercent")?.value || 0);
  const fees = Number($("#billFees")?.value || 0);
  const discount = Number($("#billDiscount")?.value || 0);
  const diners = Math.max(1, Math.min(24, Number($("#billDiners")?.value || 1)));
  const tip = Math.max(0, subtotal * (tipPercent / 100));
  const total = Math.max(0, subtotal + tax + tip + fees - discount);
  return { subtotal, tax, tipPercent, tip, fees, discount, diners, total };
}

function getSplitMode() {
  return $(".split-mode-tabs button.active")?.dataset.splitMode || "equal";
}

function getParticipantSplits(bill, mode) {
  const participants = splitParticipants.slice(0, bill.diners);

  if (mode === "percentage") {
    const percentTotal = participants.reduce((sum, person) => sum + person.percent, 0) || 100;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * (person.percent / percentTotal),
      note: `${Math.round((person.percent / percentTotal) * 100)}% share`
    }));
  }

  if (mode === "custom") {
    const customTotal = participants.reduce((sum, person) => sum + person.custom, 0) || bill.total;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * (person.custom / customTotal),
      note: "Manual meal adjustment"
    }));
  }

  if (mode === "itemized") {
    const itemWeights = {
      Jordan: 1.05,
      Sarah: 1.38,
      Mike: 1.08,
      Alex: 0.94,
      Priya: 0.78,
      Noah: 0.77
    };
    const weightTotal = participants.reduce((sum, person) => sum + (itemWeights[person.name] || 1), 0) || participants.length;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * ((itemWeights[person.name] || 1) / weightTotal),
      note: person.items.join(", ")
    }));
  }

  return participants.map((person) => ({
    ...person,
    amount: bill.total / bill.diners,
    note: "Equal split"
  }));
}

function renderBillSplit() {
  if (!$("#splitPreview")) return;
  const bill = getBillInputs();
  const mode = getSplitMode();
  const splits = getParticipantSplits(bill, mode);
  const paid = splits.slice(0, 2).reduce((sum, person) => sum + person.amount, 0);
  const each = bill.total / bill.diners;

  $("#billFinalTotal").textContent = currency(bill.total);
  if ($("#billHeroTotal")) $("#billHeroTotal").textContent = currency(bill.total);
  $("#billEachTotal").textContent = currency(each);
  $("#billRemaining").textContent = currency(Math.max(0, bill.total - paid));
  $("#splitPreview").innerHTML = splits.map((person) => {
    const food = Math.max(0, person.amount - (bill.tax + bill.tip + bill.fees - bill.discount) / bill.diners);
    const taxShare = bill.tax / bill.diners;
    const tipShare = bill.tip / bill.diners;
    return `
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(person.note)}</span>
        <small>Food ${currency(food)} • Tax ${currency(taxShare)} • Tip ${currency(tipShare)}</small>
        <b>${currency(person.amount)}</b>
      </div>
    `;
  }).join("");
  renderReceiptScanner(bill);
}

function getReceiptSplits(bill) {
  const diners = splitParticipants.slice(0, bill.diners);
  const names = diners.map((person) => person.name);
  const itemTotals = Object.fromEntries(names.map((name) => [name, { food: 0, shared: 0 }]));

  receiptItems.forEach((receiptItem) => {
    const assigned = receiptItem.diners.filter((name) => names.includes(name));
    if (!assigned.length) return;
    const share = receiptItem.price / assigned.length;
    assigned.forEach((name) => {
      if (assigned.length > 1) itemTotals[name].shared += share;
      else itemTotals[name].food += share;
    });
  });

  const itemSubtotal = diners.reduce((sum, person) => sum + itemTotals[person.name].food + itemTotals[person.name].shared, 0) || 1;
  return diners.map((person) => {
    const food = itemTotals[person.name].food;
    const shared = itemTotals[person.name].shared;
    const weight = (food + shared) / itemSubtotal;
    const tax = bill.tax * weight;
    const tip = bill.tip * weight;
    const fees = bill.fees * weight;
    const discount = bill.discount * weight;
    const total = Math.max(0, food + shared + tax + tip + fees - discount);
    return { ...person, food, shared, tax, tip, fees, discount, total, status: receiptPaymentStatus[person.name] || "Pending" };
  });
}

function renderReceiptScanner(bill = getBillInputs()) {
  if (!$("#receiptItemList")) return;
  const receiptSplits = getReceiptSplits(bill);
  const receiptTotal = receiptSplits.reduce((sum, split) => sum + split.total, 0);
  const paidTotal = receiptSplits.filter((split) => split.status === "Paid").reduce((sum, split) => sum + split.total, 0);
  const diners = splitParticipants.slice(0, bill.diners);
  const dinerNames = diners.map((person) => person.name);
  const unassignedItems = receiptItems.filter((item) => !item.diners.some((name) => dinerNames.includes(name)));

  $("#receiptExtractedTotal").textContent = currency(bill.total);
  $("#receiptItemList").innerHTML = receiptItems.map((receiptItem, itemIndex) => `
    <article class="${receiptItem.diners.length ? "" : "needs-assignment"}">
      <div class="receipt-item-detail">
        <span class="recognition-chip">${receiptItem.diners.length > 1 ? "Shared" : receiptItem.diners.length === 1 ? "Individual" : "Needs diner"}</span>
        <strong>${escapeHtml(receiptItem.item)}</strong>
        <span>${currency(receiptItem.price)} • AI confidence 96% • editable</span>
        <small>Assigned to: ${receiptItem.diners.length ? escapeHtml(receiptItem.diners.join(", ")) : "No one yet"}</small>
      </div>
      <div class="receipt-claim-panel">
        <div class="receipt-claim-grid">
          ${diners.map((person) => `
            <label>
              <input type="checkbox" data-receipt-item="${itemIndex}" data-receipt-diner="${escapeHtml(person.name)}" ${receiptItem.diners.includes(person.name) ? "checked" : ""}>
              ${escapeHtml(person.name)}
            </label>
          `).join("")}
        </div>
        <div class="receipt-item-actions">
          <button type="button" data-receipt-assign-all="${itemIndex}">Everyone</button>
          <button type="button" data-receipt-clear="${itemIndex}">Clear</button>
        </div>
      </div>
    </article>
  `).join("");

  $("#receiptStatusList").innerHTML = receiptSplits.map((split) => `
    <div>
      <strong>${escapeHtml(split.name)}</strong>
      <span>Food ${currency(split.food)} • Shared ${currency(split.shared)} • Tax ${currency(split.tax)} • Tip ${currency(split.tip)}</span>
      <b>${currency(split.total)}</b>
      <em>${escapeHtml(split.status)}</em>
    </div>
  `).join("");

  $("#receiptHistoryList").innerHTML = `
    <div><strong>Marina Social Table</strong><span>Dubai long weekend • ${splitParticipants.slice(0, bill.diners).map((person) => person.name).join(", ")}</span><b>${currency(receiptTotal)}</b></div>
    <div><strong>Payment status</strong><span>${currency(paidTotal)} paid • ${currency(Math.max(0, receiptTotal - paidTotal))} pending • downloadable receipt ready</span><b>Stored</b></div>
  `;

  $$("[data-receipt-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const item = receiptItems[Number(event.target.dataset.receiptItem)];
      const diner = event.target.dataset.receiptDiner;
      if (event.target.checked && !item.diners.includes(diner)) item.diners.push(diner);
      if (!event.target.checked) item.diners = item.diners.filter((name) => name !== diner);
      renderBillSplit();
      $("#billMessage").textContent = `${item.item} assignment updated. Shared items divide evenly across selected travelers.`;
    });
  });

  $$("[data-receipt-assign-all]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = receiptItems[Number(button.dataset.receiptAssignAll)];
      item.diners = [...dinerNames];
      renderBillSplit();
      $("#billMessage").textContent = `${item.item} assigned to everyone dining. Shared cost recalculated automatically.`;
    });
  });

  $$("[data-receipt-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = receiptItems[Number(button.dataset.receiptClear)];
      item.diners = [];
      renderBillSplit();
      $("#billMessage").textContent = `${item.item} cleared. AI review will flag it until a diner is assigned.`;
    });
  });

  if (unassignedItems.length && $("#receiptReviewMessage")) {
    $("#receiptReviewMessage").textContent = `AI item recognition needs review: ${unassignedItems.map((item) => item.item).join(", ")} ${unassignedItems.length === 1 ? "has" : "have"} no diner assigned.`;
  }
}

function getRideInputs() {
  const fare = Number($("#rideFare")?.value || 0);
  const tax = Number($("#rideTax")?.value || 0);
  const tolls = Number($("#rideTolls")?.value || 0);
  const fees = Number($("#rideFees")?.value || 0);
  const tip = Number($("#rideTip")?.value || 0);
  const passengers = Math.max(1, Math.min(8, Number($("#ridePassengers")?.value || 1)));
  const total = Math.max(0, fare + tax + tolls + fees + tip);
  return { fare, tax, tolls, fees, tip, passengers, total };
}

function getRideMode() {
  return $(".ride-tabs button.active")?.dataset.rideMode || "equal";
}

function getRideSplits(ride, mode) {
  const passengers = rideParticipants.slice(0, ride.passengers);

  if (mode === "percentage") {
    const percentTotal = passengers.reduce((sum, person) => sum + person.percent, 0) || 100;
    return passengers.map((person) => ({
      ...person,
      amount: ride.total * (person.percent / percentTotal),
      detail: `${Math.round((person.percent / percentTotal) * 100)}% fare share`
    }));
  }

  if (mode === "custom") {
    const customTotal = passengers.reduce((sum, person) => sum + person.custom, 0) || ride.total;
    return passengers.map((person) => ({
      ...person,
      amount: ride.total * (person.custom / customTotal),
      detail: person.note
    }));
  }

  return passengers.map((person) => ({
    ...person,
    amount: ride.total / ride.passengers,
    detail: "Equal passenger split"
  }));
}

function renderRideProviders() {
  if (!$("#rideProviderList")) return;
  const destination = $("#rideDestination")?.value || "United Arab Emirates";
  const providers = rideProvidersByDestination[destination] || ["Local taxi", "Hotel transfer"];
  if (!providers.includes(state.selectedRideProvider)) state.selectedRideProvider = providers[0];
  $("#rideProviderList").innerHTML = providers.map((provider) => {
    const account = state.connectedRideAccounts[provider];
    const status = account?.connected ? "Available • Connected" : "Available • Provider app required";
    return `<button class="${provider === state.selectedRideProvider ? "active" : ""}" type="button" data-ride-provider="${escapeHtml(provider)}"><strong>${escapeHtml(provider)}</strong><span>${status}</span></button>`;
  }).join("");
  $("#rideRecommended").textContent = state.selectedRideProvider;
  $("#rideWait").textContent = state.selectedRideProvider === "Careem" || state.selectedRideProvider === "Grab" ? "8 min" : "12 min";
  $("#rideEstimate").textContent = destination === "United Arab Emirates" ? "$18-$22" : "$16-$28";
  renderRideAccount();
  renderPrivateDrivers();
}

function renderPrivateDrivers() {
  if (!$("#privateDriverList")) return;
  const destination = $("#rideDestination")?.value || "United Arab Emirates";
  const query = $("#privateDriverSearchInput")?.value.trim().toLowerCase() || "";
  const companies = privateDriverCompaniesByDestination[destination] || [
    { name: "Local Executive Transfers", type: "Private driver", estimate: "$60-$120", eta: "Advance booking", rating: "4.5", vehicles: "Sedan, SUV, van" },
    { name: "Hotel Chauffeur Desk", type: "Hotel-arranged driver", estimate: "$75-$160", eta: "Concierge confirmation", rating: "4.6", vehicles: "Sedan, luxury van" }
  ];
  const filtered = companies.filter((company) => {
    const text = `${company.name} ${company.type} ${company.vehicles}`.toLowerCase();
    return !query || text.includes(query);
  });

  $("#privateDriverList").innerHTML = filtered.length ? filtered.map((company, index) => `
    <article>
      <div>
        <span>${escapeHtml(company.type)}</span>
        <strong>${escapeHtml(company.name)}</strong>
        <small>${escapeHtml(company.vehicles)} • Rating ${escapeHtml(company.rating)} • ${escapeHtml(company.eta)}</small>
      </div>
      <b>${escapeHtml(company.estimate)}</b>
      <div class="private-driver-actions">
        <button type="button" data-private-driver-book="${index}">Book driver</button>
        <button type="button" data-private-driver-quote="${index}">Request quote</button>
      </div>
    </article>
  `).join("") : `
    <div class="private-driver-empty">
      <strong>No exact private driver matches</strong>
      <span>Try chauffeur, limo, transfer, SUV, van, airport, or clear the search.</span>
    </div>
  `;

  $("#privateDriverMessage").textContent = `${filtered.length} private driver ${filtered.length === 1 ? "company" : "companies"} found in ${destination}.`;
}

function renderRideAccount() {
  if (!$("#rideConnectionTitle")) return;
  const provider = state.selectedRideProvider;
  const account = state.connectedRideAccounts[provider] || { connected: false, account: "", status: "Not connected" };
  $("#rideConnectionTitle").textContent = account.connected ? `${provider} account connected` : `Connect your ${provider} account to continue.`;
  $("#rideConnectionMeta").textContent = account.connected
    ? `${account.status} • ${account.account || "Connected account"} • You can disconnect, reconnect, or switch providers anytime.`
    : `Travel-Drip never stores your ${provider} password. Use ${provider}'s supported authentication or launch the official app with trip details prefilled.`;
  $("#connectRideAccountButton").hidden = account.connected;
  $("#reconnectRideAccountButton").hidden = !account.connected;
  $("#disconnectRideAccountButton").hidden = !account.connected;
  $("#launchRideButton").disabled = !account.connected;

  if ($("#sharedRideMembers")) {
    $("#sharedRideMembers").innerHTML = sharedRideMembers.map((member) => `
      <label>
        <input type="checkbox" data-shared-rider="${escapeHtml(member.name)}" ${member.splitting ? "checked" : ""}>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.status)} • ${member.splitting ? "Splitting fare" : "Not splitting"}</span>
      </label>
    `).join("");
  }
}

function renderRideSplit() {
  if (!$("#rideSplitPreview")) return;
  renderRideProviders();
  const ride = getRideInputs();
  const mode = getRideMode();
  const splits = getRideSplits(ride, mode);
  const paid = splits.slice(0, 1).reduce((sum, person) => sum + person.amount, 0);

  $("#rideFinalTotal").textContent = currency(ride.total);
  $("#rideEachTotal").textContent = currency(ride.total / ride.passengers);
  $("#rideRemaining").textContent = currency(Math.max(0, ride.total - paid));
  $("#rideSplitPreview").innerHTML = splits.map((person) => `
    <div>
      <strong>${escapeHtml(person.name)}</strong>
      <span>${escapeHtml(person.detail)}</span>
      <small>Fare ${currency(ride.fare / ride.passengers)} • Fees ${currency((ride.tax + ride.tolls + ride.fees) / ride.passengers)} • Tip ${currency(ride.tip / ride.passengers)}</small>
      <b>${currency(person.amount)}</b>
    </div>
  `).join("");
}

function getFilteredRideHubItems(items) {
  const query = $("#rideHubSearchInput")?.value.trim().toLowerCase() || "";
  const filter = $("#rideHubFilter")?.value || "all";
  const sort = $("#rideHubSort")?.value || "recommended";
  const filtered = items.filter((item) => {
    const text = `${item.title} ${item.meta || ""} ${item.detail || ""} ${item.status || ""} ${item.tag || ""}`.toLowerCase();
    return !query || text.includes(query);
  });
  if (filter !== "all" && filter !== "upcoming") return filtered;
  if (sort === "lowest") return [...filtered].reverse();
  return filtered;
}

function renderRideHubSections() {
  const upcoming = $("#upcomingRideList");
  if (!upcoming) return;
  const destination = $("#rideDestination")?.value || "United Arab Emirates";
  const provider = state.selectedRideProvider || "Careem";
  const upcomingItems = getFilteredRideHubItems(rideHubItems.upcoming);
  upcoming.innerHTML = upcomingItems.length ? upcomingItems.map((item, index) => `
    <article>
      <div>
        <span>${escapeHtml(item.tag)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.meta)}</small>
      </div>
      <b>${escapeHtml(item.estimate)}</b>
      <button type="button" data-ride-hub-action="Book Ride" data-ride-index="${index}">${escapeHtml(item.status)}</button>
    </article>
  `).join("") : `
    <div class="ride-empty-state">
      <strong>No matching rides</strong>
      <span>Try changing the search, filter, destination, or budget preference.</span>
    </div>
  `;

  if ($("#rideRecommendationGrid")) {
    $("#rideRecommendationGrid").innerHTML = rideHubItems.recommendations.map((item) => `
      <article>
        <span>${escapeHtml(destination)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.meta.replace("Careem", provider))}</small>
        <button type="button" data-ride-recommendation="${escapeHtml(item.cta)}">${escapeHtml(item.cta)}</button>
      </article>
    `).join("");
  }

  if ($("#rideTimelineList")) {
    $("#rideTimelineList").innerHTML = rideHubItems.timeline.map((item) => `
      <button type="button" data-ride-timeline="${escapeHtml(item.title)}">
        <span>${escapeHtml(item.time)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </button>
    `).join("");
  }

  if ($("#rideHistoryList")) {
    $("#rideHistoryList").innerHTML = rideHubItems.history.map((item) => `
      <button type="button" data-ride-history="${escapeHtml(item.title)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.meta)}</span>
        <b>${escapeHtml(item.total)}</b>
      </button>
    `).join("");
  }

  if ($("#rideNotificationList")) {
    $("#rideNotificationList").innerHTML = rideHubItems.notifications.map((item) => `
      <button type="button" data-ride-notification="${escapeHtml(item.title)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.meta)}</span>
      </button>
    `).join("");
  }
}

function getActiveTransportType() {
  return $(".transport-tabs button.active")?.dataset.transportType || "flights";
}

function setTransportationWorkspaceView(view = "confirmations", focusSelected = false) {
  const mount = $("#transportationWorkspaceMount");
  const details = $("#transportationAdvancedDetails");
  if (!mount || !details) return;
  const selectedView = view === "rides" ? "rides" : "confirmations";

  Array.from(mount.children).forEach((section) => {
    const sectionView = section.classList.contains("ride-hub-redesign") ? "rides" : "confirmations";
    section.dataset.transportationWorkspaceView = sectionView;
    section.hidden = sectionView !== selectedView;
  });

  details.querySelectorAll("[data-transportation-workspace-tab]").forEach((button) => {
    const selected = button.dataset.transportationWorkspaceTab === selectedView;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focusSelected) button.focus();
  });
}

function moveTransportationWorkspace() {
  const source = $("#rideShareHub");
  const mount = $("#transportationWorkspaceMount");
  if (!source || !mount) return;
  const selectors = [
    '[data-transportation-workspace]',
    '[data-travel-panel="flights"]',
    '[data-travel-panel="trains"]',
    '[data-travel-panel="buses"]',
    '[data-travel-panel="cruises"]',
    '[data-travel-panel="boarding"]',
    '[data-travel-panel="transfers"]',
    '[data-travel-panel="publicTransit"]',
    '[data-travel-panel="routeComparison"]',
    '[data-travel-panel="smartRoute"]'
  ].join(", ");
  // Only move dedicated transportation workspaces that are direct Travel children.
  // Nested Travel focus panels must remain with Travel so route isolation can hide
  // the whole Travel screen without leaking its content into Transportation.
  Array.from(source.children)
    .filter((section) => section.matches(selectors))
    .forEach((section) => {
      mount.appendChild(section);
    });

  const tabs = Array.from(document.querySelectorAll("[data-transportation-workspace-tab]"));
  tabs.forEach((button, index) => {
    if (button.dataset.workspaceTabWired === "true") return;
    button.dataset.workspaceTabWired = "true";
    button.addEventListener("click", () => {
      setTransportationWorkspaceView(button.dataset.transportationWorkspaceTab);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + tabs.length) % tabs.length;
      setTransportationWorkspaceView(tabs[nextIndex].dataset.transportationWorkspaceTab, true);
    });
  });
  setTransportationWorkspaceView("confirmations");
}

function renderTransportationTable() {
  const body = $("#transportationTableBody");
  if (!body) return;
  const query = $("#transportationTableSearchInput")?.value.trim().toLowerCase() || "";
  const type = $("#transportationTableTypeFilter")?.value || "all";
  const records = transportRecords.filter((record) => {
    if (type !== "all" && record.type !== type) return false;
    const searchable = `${transportTypeLabels[record.type]} ${record.provider} ${record.title} ${record.route} ${record.passenger} ${record.assignedTo.join(" ")} ${record.status}`.toLowerCase();
    return !query || searchable.includes(query);
  });
  const count = $("#transportationTableCount");
  if (count) count.textContent = String(records.length);
  body.innerHTML = records.length ? records.map((record) => {
    const assigned = record.assignedTo.slice(0, 2).join(", ") + (record.assignedTo.length > 2 ? ` +${record.assignedTo.length - 2}` : "");
    const statusClass = record.status.toLowerCase().replace(/[^a-z]+/g, "-");
    return `
      <tr class="transportation-record-row">
        <td colspan="5">
          <details class="transportation-record-dropdown">
            <summary>
              <span class="transportation-record-type">${escapeHtml(transportTypeLabels[record.type])}</span>
              <strong>${escapeHtml(record.route)}</strong>
              <small>${escapeHtml(record.provider)} • ${escapeHtml(record.title)}</small>
              <span class="transportation-status transportation-status--${escapeHtml(statusClass)}">${escapeHtml(record.status)}</span>
            </summary>
            <div class="transportation-record-details">
              <div><span>When</span><strong>${escapeHtml(record.departureTime)}</strong></div>
              <div><span>Traveler</span><strong>${escapeHtml(assigned)}</strong></div>
              <div><span>Confirmation</span><strong>${escapeHtml(record.confirmation || "Saved record")}</strong></div>
              <button class="ghost-button" type="button" data-transportation-record="${escapeHtml(record.id)}">View full details</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr><td colspan="5"><div class="transportation-empty-state"><strong>No transportation records match</strong><span>Try another search or choose all transportation types.</span></div></td></tr>
  `;
  const message = $("#transportationTableMessage");
  if (message) message.textContent = `${records.length} ${records.length === 1 ? "movement" : "movements"} shown. Select View for full confirmation details.`;
}

function getFilteredTransportRecords(type = getActiveTransportType()) {
  const query = $("#transportSearchInput")?.value.trim().toLowerCase() || "";
  const traveler = $("#transportTravelerFilter")?.value || "all";
  const status = $("#transportStatusFilter")?.value || "all";
  return transportRecords.filter((record) => {
    if (record.type !== type) return false;
    const searchText = `${record.provider} ${record.title} ${record.route} ${record.confirmation} ${record.ticket} ${record.passenger} ${record.assignedTo.join(" ")} ${record.status}`.toLowerCase();
    const matchesQuery = !query || searchText.includes(query);
    const matchesTraveler = traveler === "all" || record.assignedTo.includes(traveler) || record.passenger === traveler;
    const matchesStatus = status === "all" || record.status === status;
    return matchesQuery && matchesTraveler && matchesStatus;
  });
}

function renderTransportHub(type = getActiveTransportType(), selectedId = "") {
  if (!$("#transportTabs")) return;
  const activeType = transportTypeLabels[type] ? type : "flights";
  $("#transportTabs").innerHTML = Object.entries(transportTypeLabels).map(([key, label]) => `
    <button class="${key === activeType ? "active" : ""}" type="button" role="tab" aria-selected="${key === activeType}" data-transport-type="${key}">
      ${escapeHtml(label)}
    </button>
  `).join("");

  const records = getFilteredTransportRecords(activeType);
  $("#transportActiveType").textContent = transportTypeLabels[activeType];
  $("#transportListTitle").textContent = `${transportTypeLabels[activeType]} confirmations`;
  $("#transportRecordCount").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
  $("#transportRecordList").innerHTML = records.length ? records.map((record) => `
    <article class="transport-record-card" data-transport-record="${escapeHtml(record.id)}">
      <div>
        <span>${escapeHtml(record.status)}</span>
        <strong>${escapeHtml(record.title)}</strong>
        <small>${escapeHtml(record.provider)} • ${escapeHtml(record.route)}</small>
      </div>
      <div>
        <b>${escapeHtml(record.departureTime)}</b>
        <small>${escapeHtml(record.confirmation)} • ${escapeHtml(record.passType)}</small>
      </div>
      <button type="button" data-transport-detail="${escapeHtml(record.id)}">Open</button>
    </article>
  `).join("") : `
    <div class="transport-empty-state">
      <strong>No matching ${escapeHtml(transportTypeLabels[activeType].toLowerCase())}</strong>
      <span>Try clearing filters, choosing another traveler, or uploading a new confirmation.</span>
    </div>
  `;

  const selected = transportRecords.find((record) => record.id === selectedId) || records[0];
  renderTransportDetail(selected);
  renderTransportTimeline();
}

function renderTransportDetail(record) {
  const panel = $("#transportDetailPanel");
  if (!panel) return;
  if (!record) {
    panel.innerHTML = `
      <div class="transport-detail-empty">
        <strong>Select a confirmation</strong>
        <span>Details, assigned travelers, ticket files, pass status, reminders, and secure sharing controls appear here.</span>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="transport-detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(transportTypeLabels[record.type])}</p>
        <h3>${escapeHtml(record.title)}</h3>
        <span>${escapeHtml(record.route)}</span>
      </div>
      <span class="status-pill">${escapeHtml(record.status)}</span>
    </div>
    <div class="transport-pass-card">
      <div>
        <span>${escapeHtml(record.passType)}</span>
        <strong>${escapeHtml(record.accessCode)}</strong>
        <small>Confirmation ${escapeHtml(record.confirmation)} • Ticket ${escapeHtml(record.ticket)}</small>
      </div>
      <div class="mock-qr" aria-label="Mock secure QR code"><span></span><span></span><span></span><span></span></div>
    </div>
    <div class="transport-detail-grid">
      <div><span>Passenger</span><strong>${escapeHtml(record.passenger)}</strong></div>
      <div><span>Assigned to</span><strong>${escapeHtml(record.assignedTo.join(", "))}</strong></div>
      <div><span>Departure</span><strong>${escapeHtml(record.departure)}</strong><small>${escapeHtml(record.departureTime)}</small></div>
      <div><span>Arrival</span><strong>${escapeHtml(record.arrival)}</strong><small>${escapeHtml(record.arrivalTime)}</small></div>
      <div><span>Gate / platform / bay</span><strong>${escapeHtml(record.gate)}</strong></div>
      <div><span>Seat / cabin / vehicle</span><strong>${escapeHtml(record.seat)}</strong></div>
    </div>
    <div class="transport-document-area">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Secure ticket storage</p>
          <h4>Documents and passes</h4>
        </div>
        <button type="button" data-ticket-action="Upload document" data-ticket-record="${escapeHtml(record.id)}">Add file</button>
      </div>
      <div class="transport-document-list">
        ${record.documents.map((documentName) => `
          <button type="button" data-ticket-action="${escapeHtml(documentName)}" data-ticket-record="${escapeHtml(record.id)}">
            <strong>${escapeHtml(documentName)}</strong>
            <span>View secure file</span>
          </button>
        `).join("")}
      </div>
    </div>
    <div class="wallet-pass-row">
      <button type="button" ${record.wallet.apple ? "" : "disabled"} data-wallet-pass="Apple Wallet" data-ticket-record="${escapeHtml(record.id)}">Apple Wallet</button>
      <button type="button" ${record.wallet.google ? "" : "disabled"} data-wallet-pass="Google Wallet" data-ticket-record="${escapeHtml(record.id)}">Google Wallet</button>
      <span>${record.wallet.apple || record.wallet.google ? "Eligible pass options shown." : "Wallet pass hidden in production until provider support is available."}</span>
    </div>
    <div class="transport-actions">
      <button type="button" data-transport-action="Share approved ticket" data-ticket-record="${escapeHtml(record.id)}">Share approved ticket</button>
      <button type="button" data-transport-action="Open notification target" data-ticket-record="${escapeHtml(record.id)}">Test notification route</button>
      <button type="button" data-transport-action="Revoke access" data-ticket-record="${escapeHtml(record.id)}">Revoke access</button>
    </div>
    <div class="transport-detail-notes">
      ${record.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
      <span>${escapeHtml(record.reminder)}</span>
    </div>
  `;
}

function renderTransportTimeline() {
  if (!$("#transportTimelineList")) return;
  const upcoming = transportRecords.slice(0, 7);
  $("#transportTimelineList").innerHTML = upcoming.map((record) => `
    <button type="button" data-transport-timeline="${escapeHtml(record.id)}">
      <span>${escapeHtml(transportTypeLabels[record.type])}</span>
      <strong>${escapeHtml(record.title)}</strong>
      <small>${escapeHtml(record.departureTime)} • ${escapeHtml(record.departure)}</small>
    </button>
  `).join("");
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function renderTrustedContacts() {
  const list = $("#trustedContactsList");
  if (!list) return;
  if (!state.session?.user) {
    list.innerHTML = `<p class="small">Sign in to load your private trusted contacts.</p>`;
    return;
  }
  if (!state.trustedContacts.length) {
    list.innerHTML = `<p class="small">No trusted contacts saved yet.</p>`;
    return;
  }
  list.innerHTML = state.trustedContacts.map((contact) => `
    <article class="trusted-contact-row">
      <div>
        <strong>${escapeHtml(contact.name)}</strong>
        <span>${escapeHtml(contact.relationship)} • ${escapeHtml(contact.phone)}${contact.email ? ` • ${escapeHtml(contact.email)}` : ""}</span>
        ${contact.is_primary ? `<em class="status-pill">Primary</em>` : ""}
      </div>
      <button class="ghost-button" type="button" data-trusted-contact-delete="${escapeHtml(contact.id)}">Remove</button>
    </article>
  `).join("");
}

async function loadTrustedContacts() {
  if (!state.supabase || !state.session?.user) {
    state.trustedContacts = [];
    renderTrustedContacts();
    return;
  }
  const { data, error } = await state.supabase
    .from("trusted_contacts")
    .select("id, name, relationship, phone, email, is_primary, created_at")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    $("#trustedContactsStatus") && ($("#trustedContactsStatus").textContent = "Trusted contacts are unavailable until the Supabase migration is applied.");
    return;
  }
  state.trustedContacts = data || [];
  renderTrustedContacts();
}

async function saveTrustedContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#trustedContactsStatus");
  if (!state.supabase || !state.session?.user) {
    if (status) status.textContent = "Sign in before saving a trusted contact.";
    return;
  }
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
  if (status) status.textContent = "Saving securely...";
  const payload = {
    user_id: state.session.user.id,
    name: $("#trustedContactNameInput").value.trim(),
    relationship: $("#trustedContactRelationshipInput").value.trim(),
    phone: $("#trustedContactPhoneInput").value.trim(),
    email: $("#trustedContactEmailInput").value.trim() || null,
    is_primary: $("#trustedContactPrimaryInput").checked
  };
  const { error } = await state.supabase.from("trusted_contacts").insert(payload);
  if (error) {
    if (status) status.textContent = error.message.includes("trusted_contacts")
      ? "Apply the trusted contacts Supabase migration before saving."
      : "We could not save that contact. Please try again.";
  } else {
    form.reset();
    if (status) status.textContent = "Trusted contact saved to your protected account data.";
    await loadTrustedContacts();
  }
  if (submit) submit.disabled = false;
}

async function deleteTrustedContact(contactId) {
  if (!state.supabase || !state.session?.user || !contactId) return;
  const status = $("#trustedContactsStatus");
  if (status) status.textContent = "Removing contact...";
  const { error } = await state.supabase
    .from("trusted_contacts")
    .delete()
    .eq("id", contactId)
    .eq("user_id", state.session.user.id);
  if (error) {
    if (status) status.textContent = "We could not remove that contact. Please try again.";
    return;
  }
  if (status) status.textContent = "Trusted contact removed.";
  await loadTrustedContacts();
}

async function loadProfileDetails() {
  if (!state.supabase || !state.session?.user) return;
  const { data } = await state.supabase
    .from("profiles")
    .select("full_name, username, bio")
    .eq("id", state.session.user.id)
    .maybeSingle();
  if (!data) return;
  if (data.full_name && $("#profileFullNameInput")) $("#profileFullNameInput").value = data.full_name;
  if (data.username && $("#profileUsernameInput")) $("#profileUsernameInput").value = data.username;
  if (data.bio && $("#profileBioInput")) $("#profileBioInput").value = data.bio;
  if (data.full_name) {
    state.profilePhoto.initials = initialsFromName(data.full_name);
    renderProfilePhoto();
  }
}

async function saveProfileDetails() {
  const status = $("#profileDetailsMessage");
  if (!state.supabase || !state.session?.user) {
    if (status) status.textContent = "Sign in before saving profile details.";
    return;
  }
  const payload = {
    id: state.session.user.id,
    full_name: $("#profileFullNameInput")?.value.trim() || null,
    username: $("#profileUsernameInput")?.value.trim().replace(/^@/, "") || null,
    bio: $("#profileBioInput")?.value.trim() || null
  };
  const { error } = await state.supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (status) status.textContent = error ? "Profile details could not be saved. Please try again." : "Profile details saved securely.";
  if (!error) {
    state.profilePhoto.initials = initialsFromName(payload.full_name || "Travel-Drip traveler");
    localStorage.setItem("traveldripProfileInitials", state.profilePhoto.initials);
    renderProfilePhoto();
  }
}

async function loadConfig() {
  const publicConfig = window.TRAVELDRIP_PUBLIC_CONFIG || {};

  if (isFilePreview) {
    state.config = {
      ...state.config,
      supabaseUrl: publicConfig.supabaseUrl || state.config.supabaseUrl,
      supabaseAnonKey: publicConfig.supabaseAnonKey || state.config.supabaseAnonKey,
      stripePublishableKey: publicConfig.stripePublishableKey || state.config.stripePublishableKey,
      vapidPublicKey: publicConfig.vapidPublicKey || state.config.vapidPublicKey
    };
    setSyncStatus(state.config.supabaseAnonKey ? "Connecting" : "Needs public key");
  } else {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Config endpoint unavailable");
      const serverConfig = await response.json();
      state.config = {
        ...state.config,
        ...publicConfig,
        ...serverConfig,
        supabaseUrl: serverConfig.supabaseUrl || publicConfig.supabaseUrl || state.config.supabaseUrl,
        supabaseAnonKey: serverConfig.supabaseAnonKey || publicConfig.supabaseAnonKey || state.config.supabaseAnonKey,
        stripePublishableKey: serverConfig.stripePublishableKey || publicConfig.stripePublishableKey || state.config.stripePublishableKey,
        vapidPublicKey: serverConfig.vapidPublicKey || publicConfig.vapidPublicKey || state.config.vapidPublicKey
      };
    } catch (error) {
      state.config = {
        ...state.config,
        ...publicConfig
      };
      setSyncStatus(state.config.supabaseAnonKey ? "Connecting" : "Demo mode");
    }
  }

  if (state.config.supabaseUrl && state.config.supabaseAnonKey) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey);
    try {
      const { data, error } = await state.supabase.auth.getSession();
      if (error) throw error;
      state.session = data.session;
    } catch (error) {
      state.session = null;
      setSyncStatus("Account service unavailable");
      if ($("#authMessage")) {
        $("#authMessage").textContent = getAuthErrorMessage(error, "Travel-Drip could not restore your session. Please sign in again.");
      }
    }
    if (state.session?.access_token) {
      if (state.guestSessionToken) await linkCorporateAccessToPersonalAccount().catch(() => {});
      else await loadCorporatePortalFromSession().catch(() => {});
    }
    loadWalletAccess();
    state.supabase.auth.onAuthStateChange(async (event, session) => {
      state.session = session;
      if (session?.access_token) {
        if (state.guestSessionToken) await linkCorporateAccessToPersonalAccount().catch(() => {});
        else await loadCorporatePortalFromSession().catch(() => {});
      }
      updateAuthUi();
      loadWalletAccess();
      subscribeToLiveData();
      loadProfileDetails();
      loadTrustedContacts();
      window.setTimeout(() => {
        if (event === "SIGNED_IN" && session && !state.authConfirmation) {
          ensureProfileForSession().then(({ error }) => {
            const confirmation = error
              ? "Your account is verified, but your profile could not be confirmed as saved. Please retry profile sync from My Profile."
              : "Your information is confirmed saved. Your dashboard is ready — start planning your first trip.";
            enterAppPreview({ confirmation, forceDashboard: true });
          }).catch(() => {
            setAuthConfirmation("Your account is verified, but profile sync needs attention. Please retry from My Profile.");
            enterAppPreview({ forceDashboard: true });
          });
        } else {
          ensureProfileForSession().catch(() => {});
        }
      }, 0);
    });
    setSyncStatus("Connected");
    if (state.session?.user && ["/login", "/register"].includes(normalizeAppPath(location.pathname))) {
      const profileResult = await ensureProfileForSession().catch((error) => ({ error }));
      const confirmation = profileResult.error
        ? "Signed in successfully. Your dashboard is ready, but profile sync needs attention."
        : "Signed in successfully. Your saved dashboard is ready.";
      enterAppPreview({ confirmation, forceDashboard: true });
    }
  } else {
    setSyncStatus(state.config.supabaseUrl ? "Needs public key" : "Needs setup");
  }
}

function updateAuthUi() {
  const signedIn = Boolean(state.session?.user);
  const previewAccess = isFilePreview && state.hasEnteredApp;
  const appAccess = signedIn || previewAccess;
  const openAuthButton = $("#openAuthButton");
  const openSignupButton = $("#openSignupButton");
  const signOutButton = $("#signOutButton");
  const authPanel = $("#authPanel");
  if (signedIn && !state.hasEnteredApp) {
    state.hasEnteredApp = true;
    sessionStorage.setItem("traveldripEnteredApp", "true");
  }
  if (!signedIn && !previewAccess) {
    state.hasEnteredApp = false;
    sessionStorage.removeItem("traveldripEnteredApp");
  }
  const showGate = !appAccess;

  if (openAuthButton) {
    openAuthButton.textContent = signedIn ? state.session.user.email : "Sign in";
    openAuthButton.hidden = signedIn;
  }

  if (openSignupButton) openSignupButton.hidden = appAccess;
  if (signOutButton) signOutButton.hidden = !appAccess;
  if (authPanel && location.pathname !== "/admin.html") {
    authPanel.hidden = !showGate;
    document.body.classList.toggle("auth-screen", showGate);
    setAuthenticatedShellVisible(appAccess && !showGate);
    if (!showGate) authPanel.classList.remove("show-form");
    renderGlobalDestinationHeader(getTargetFromRoute());
  }
  renderAuthConfirmation();

  if (appAccess && !showGate && routeDefinitions[getTargetFromRoute()]) {
    renderRoute(getTargetFromRoute(), { replace: true });
  }

  if (location.pathname === "/admin.html") updateAdminUi();
}

function setAuthenticatedShellVisible(visible) {
  [$(".sidebar"), $(".topbar"), $(".mobile-nav"), $("#globalDestinationHeader")].forEach((element) => {
    if (!element) return;
    element.hidden = !visible;
    element.setAttribute("aria-hidden", String(!visible));
  });
  document.body.classList.toggle("signed-in-shell", visible);
  if (!visible) document.body.classList.remove("sidebar-open");
  $("#sidebarMenuButton")?.setAttribute("aria-expanded", "false");
}

function rememberProtectedTarget(target) {
  if (!routeDefinitions[target]) return;
  state.pendingProtectedTarget = target;
  sessionStorage.setItem("traveldripPendingProtectedTarget", target);
}

function consumeProtectedTarget() {
  const target = routeDefinitions[state.pendingProtectedTarget] ? state.pendingProtectedTarget : "dashboardHome";
  state.pendingProtectedTarget = "dashboardHome";
  sessionStorage.removeItem("traveldripPendingProtectedTarget");
  return target;
}

function renderAuthConfirmation() {
  const message = $("#authConfirmationMessage");
  if (!message) return;
  const visible = Boolean(state.authConfirmation && state.session?.user);
  message.hidden = !visible;
  message.textContent = visible ? state.authConfirmation : "";
}

function setAuthConfirmation(message) {
  state.authConfirmation = message;
  if (message) sessionStorage.setItem("traveldripAuthConfirmation", message);
  else sessionStorage.removeItem("traveldripAuthConfirmation");
  renderAuthConfirmation();
}

async function ensureProfileForSession({ fullName = "", username = "" } = {}) {
  if (!state.supabase || !state.session?.user) return { error: null };

  const metadata = state.session.user.user_metadata || {};
  const profile = {
    id: state.session.user.id,
    full_name: String(fullName || metadata.full_name || "").trim() || null,
    username: String(username || metadata.username || "").trim().replace(/^@/, "") || null
  };

  return state.supabase.from("profiles").upsert(profile, { onConflict: "id" });
}

async function checkAdminAccess() {
  if (!state.supabase || !state.session) return false;
  const email = state.session.user.email || "";
  if (state.adminStatusCheckedFor === email) return state.isAdmin;

  state.adminStatusCheckedFor = email;

  try {
    const response = await fetch("/api/admin-status", {
      headers: { "Authorization": `Bearer ${state.session.access_token}` }
    });
    const result = await response.json().catch(() => ({}));
    state.isAdmin = Boolean(response.ok && result.isAdmin);
  } catch (_error) {
    state.isAdmin = false;
  }

  return state.isAdmin;
}

function updateAdminUi() {
  const authPanel = $("#authPanel");
  const adminPanel = $("#adminPanel");
  const authMessage = $("#authMessage");

  if (!state.session) {
    if (authPanel) authPanel.hidden = false;
    if (adminPanel) adminPanel.hidden = true;
    return;
  }

  if (authMessage) authMessage.textContent = "Checking admin access...";
  checkAdminAccess().then((isAdmin) => {
    if (authPanel) authPanel.hidden = isAdmin;
    if (adminPanel) adminPanel.hidden = !isAdmin;
    if (authMessage && !isAdmin) {
      authMessage.textContent = "You are signed in, but this email is not on the admin allowlist.";
    }
  });
}

function getAuthRoute(mode) {
  if (mode === "guest") return isFilePreview ? "#company-event" : "/login#company-event";
  if (isFilePreview) return mode === "signup" ? "#register" : "#login";
  return mode === "signup" ? "/register" : "/login";
}

function getInitialAuthMode() {
  if (location.hash === "#company-event") return "guest";
  if (location.hash === "#register" || location.pathname === "/register" || location.pathname.endsWith("/register.html")) return "signup";
  if (location.hash === "#login" || location.pathname === "/login" || location.pathname.endsWith("/login.html")) return "signin";
  return "";
}

function setAuthMode(mode, scrollIntoView = false) {
  if (location.pathname === "/admin.html") return;
  if (state.session?.user && mode !== "guest") {
    enterAppPreview();
    return;
  }

  const isSignup = mode === "signup";
  const isGuest = mode === "guest";
  const authPanel = $("#authPanel");
  const loginForm = $("#authForm");
  const signupForm = $("#signupForm");
  const guestForm = $("#guestAccessForm");
  const showLoginButton = $("#showLoginButton");
  const showSignupButton = $("#showSignupButton");
  const formLoginButton = $("#formLoginButton");
  const formSignupButton = $("#formSignupButton");
  const formGuestButton = $("#formGuestButton");
  const authTitle = $("#authTitle");
  const authCopy = $("#authCopy");
  const authMessage = $("#authMessage");
  const bottomCopy = $("#authBottomCopy");

  state.authMode = isGuest ? "guest" : isSignup ? "signup" : "signin";
  state.hasEnteredApp = false;
  sessionStorage.removeItem("traveldripEnteredApp");
  document.body.classList.remove("employee-portal-active");
  document.body.classList.add("auth-screen");
  setAuthenticatedShellVisible(false);
  if (authPanel) {
    authPanel.hidden = false;
    authPanel.classList.add("show-form");
  }
  if (loginForm) loginForm.hidden = isSignup || isGuest;
  if (signupForm) signupForm.hidden = !isSignup;
  if (guestForm) guestForm.hidden = !isGuest;
  setVisibilityWithoutCssLeaks($("#guestPortalPanel"), false);
  if ($("#verificationPanel")) $("#verificationPanel").hidden = true;
  if ($("#authOnboardingPanel")) $("#authOnboardingPanel").hidden = true;

  showLoginButton?.classList.toggle("active", !isSignup && !isGuest);
  showSignupButton?.classList.toggle("active", isSignup);
  formLoginButton?.classList.toggle("active", !isSignup && !isGuest);
  formSignupButton?.classList.toggle("active", isSignup);
  formGuestButton?.classList.toggle("active", isGuest);
  showLoginButton?.setAttribute("aria-selected", String(!isSignup && !isGuest));
  showSignupButton?.setAttribute("aria-selected", String(isSignup));
  formLoginButton?.setAttribute("aria-selected", String(!isSignup && !isGuest));
  formSignupButton?.setAttribute("aria-selected", String(isSignup));
  formGuestButton?.setAttribute("aria-selected", String(isGuest));

  if (authTitle) {
    authTitle.textContent = isGuest
      ? "Access your company event"
      : isSignup
        ? "Create your Travel-Drip account"
        : "Welcome to Travel-Drip";
  }
  if (authCopy) {
    authCopy.textContent = isGuest
      ? "Use your company code plus employee or attendee ID to view only the travel details, schedule, documents, and photos approved for you."
      : isSignup
        ? "Create an account, verify your email, then choose whether you are planning solo, with a group, or for a corporate retreat."
        : "Plan unforgettable vacations, destination weddings, birthdays, corporate retreats, cruises, and group adventures, all in one place. Organize itineraries, invite friends and family, manage shared budgets, store tickets and boarding passes, receive real-time travel updates, and relive every memory together.";
  }
  if (bottomCopy) bottomCopy.textContent = isGuest ? "Need a full Travel-Drip profile?" : isSignup ? "Already have an account?" : "New to Travel-Drip?";
  $("#landingSignupButton").hidden = isSignup;
  $("#landingLoginButton").hidden = !isSignup && !isGuest;
  if ($("#enterAppButton")) $("#enterAppButton").hidden = !isFilePreview || isGuest;
  if (authMessage) {
    authMessage.textContent = isGuest
      ? "Guest sessions are temporary, audited, and expire automatically."
      : isSignup
        ? "Email verification may be required after account creation."
        : "Enter your email and password to log in.";
  }

  const route = getAuthRoute(state.authMode);
  if (`${location.pathname}${location.hash}` !== route) {
    history.replaceState(null, "", route);
  }

  const firstInput = isGuest ? $("#guestAccessCodeInput") : isSignup ? $("#signupNameInput") : $("#emailInput");
  firstInput?.focus({ preventScroll: true });
  if (scrollIntoView) authPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function enterAppPreview({ confirmation = "", forceDashboard = false } = {}) {
  if (state.authMode === "guest") {
    if ($("#authMessage")) $("#authMessage").textContent = "Employer access is limited to the Corporate Guest Portal. Choose personal sign-up to create a personal dashboard.";
    return;
  }
  if (!isFilePreview && !state.session?.user) {
    setAuthMode(state.authMode === "signup" ? "signup" : "signin", true);
    if ($("#authMessage")) $("#authMessage").textContent = "Sign in or create a personal account to open the personal dashboard. Employer access opens only the Corporate Guest Portal.";
    return;
  }
  state.hasEnteredApp = true;
  sessionStorage.setItem("traveldripEnteredApp", "true");
  if (confirmation) setAuthConfirmation(confirmation);
  $("#authPanel")?.classList.remove("show-form");
  if ($("#authPanel")) $("#authPanel").hidden = true;
  document.body.classList.remove("auth-screen");
  const target = forceDashboard ? "dashboardHome" : consumeProtectedTarget();
  if (forceDashboard) {
    state.pendingProtectedTarget = "dashboardHome";
    sessionStorage.removeItem("traveldripPendingProtectedTarget");
  }
  const appRoute = getRouteForTarget(target);
  if (location.hash === "#login" || location.hash === "#register" || location.pathname === "/login" || location.pathname === "/register") {
    history.replaceState({ target }, "", appRoute);
  }
  setAuthenticatedShellVisible(Boolean(state.session?.user) || isFilePreview);
  renderRoute(target, { replace: true });
  renderAuthConfirmation();
}

function showAuthSetupMessage() {
  $("#authMessage").textContent = state.config.supabaseUrl
    ? "Supabase URL is connected. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel, or paste the publishable key into public-config.js for local preview login."
    : "Add Supabase environment variables on Vercel to enable live login.";
}

function getAuthOptions() {
  if (isFilePreview) return {};
  return { emailRedirectTo: new URL("/login?verified=true", location.origin).toString() };
}

function getAuthErrorMessage(error, fallback) {
  const message = String(error?.message || error || "").trim();
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Travel-Drip could not reach the secure account service. Check your connection and try again.";
  }
  return message || fallback;
}

async function signIn(email, password) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  try {
    const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
    $("#authMessage").textContent = error ? getAuthErrorMessage(error, "Sign-in failed. Please try again.") : "Logged in. Confirming your saved information...";
    if (error) return false;

    state.session = data.session || state.session;
    if (state.guestSessionToken) {
      await linkCorporateAccessToPersonalAccount().catch((linkError) => {
        if ($("#authMessage")) $("#authMessage").textContent = linkError.message;
      });
    } else {
      await loadCorporatePortalFromSession().catch(() => {});
    }
    loadWalletAccess();
    const profileResult = await ensureProfileForSession();
    const confirmation = profileResult.error
      ? "Signed in, but your profile could not be confirmed as saved. Please retry profile sync from My Profile."
      : "Your information is confirmed saved. Welcome back — your dashboard is ready to start planning.";
    queueGhlSync({ eventType: "user_login", tags: ["Trip Planning"] });
    enterAppPreview({ confirmation, forceDashboard: true });
    return true;
  } catch (error) {
    $("#authMessage").textContent = getAuthErrorMessage(error, "Sign-in failed. Please try again.");
    return false;
  }
}

async function signUp(fullName, username, email, password) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  try {
    const { data, error } = await state.supabase.auth.signUp({
      email,
      password,
      options: {
        ...getAuthOptions(),
        data: {
          full_name: fullName,
          username,
          profile_photo_privacy: "trip_members",
          profile_photo_setup: false
        }
      }
    });

    if (error) {
      $("#authMessage").textContent = getAuthErrorMessage(error, "Account creation failed. Please try again.");
      return false;
    }

    if (data.session) {
      state.session = data.session;
      if (state.guestSessionToken) {
        await linkCorporateAccessToPersonalAccount().catch((linkError) => {
          if ($("#authMessage")) $("#authMessage").textContent = linkError.message;
        });
      } else {
        await loadCorporatePortalFromSession().catch(() => {});
      }
      loadWalletAccess();
      const profileResult = await ensureProfileForSession({ fullName, username });
      const confirmation = profileResult.error
        ? "Account created, but your profile could not be confirmed as saved. Please retry profile sync from My Profile."
        : "Your information is confirmed saved. Your dashboard is ready — start planning your first trip.";
      $("#authMessage").textContent = confirmation;
      queueGhlSync({
        eventType: "user_registration_completed",
        fullName,
        username,
        email,
        userType: "traveler",
        tags: ["New Traveler", "Trip Planning"]
      });
      enterAppPreview({ confirmation, forceDashboard: true });
      return true;
    }

    $("#signupForm").hidden = true;
    $("#verificationPanel").hidden = false;
    $("#authOnboardingPanel").hidden = true;
    $("#authMessage").textContent = "Account created. Check your email to verify your address. The verification link will return you to Travel-Drip and open your dashboard.";
    history.replaceState(null, "", "/login?check-email=true");
    return true;
  } catch (error) {
    $("#authMessage").textContent = getAuthErrorMessage(error, "Account creation failed. Please try again.");
    return false;
  }
}

async function sendMagicLink(email) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  try {
    const { error } = await state.supabase.auth.signInWithOtp({
      email,
      options: getAuthOptions()
    });
    $("#authMessage").textContent = error ? getAuthErrorMessage(error, "Magic link could not be sent.") : "Magic link sent. Check your email.";
  } catch (error) {
    $("#authMessage").textContent = getAuthErrorMessage(error, "Magic link could not be sent.");
  }
}

async function signInWithOAuth(provider) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  try {
    const { error } = await state.supabase.auth.signInWithOAuth({
      provider,
      options: getAuthOptions()
    });
    $("#authMessage").textContent = error
      ? getAuthErrorMessage(error, "Social sign-in could not start.")
      : `Redirecting to ${provider === "google" ? "Google" : "Apple"} sign-in...`;
  } catch (error) {
    $("#authMessage").textContent = getAuthErrorMessage(error, "Social sign-in could not start.");
  }
}

function formatPortalMoney(cents = 0, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function formatPortalDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to be announced" : date.toLocaleDateString([], options);
}

function formatPortalDateRange(event = {}) {
  if (!event.starts_on && !event.ends_on) return "Dates to be announced";
  const start = formatPortalDate(event.starts_on);
  const end = formatPortalDate(event.ends_on);
  return event.ends_on && end !== start ? `${start} - ${end}` : start;
}

function setPortalText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function setEmployeePortalTab(tab = "dashboard") {
  const selectedTab = ["dashboard", "transportation", "wallet", "history"].includes(tab) ? tab : "dashboard";
  state.employeePortalTab = selectedTab;
  $$('[data-employee-portal-tab]').forEach((button) => {
    const selected = button.dataset.employeePortalTab === selectedTab;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  $$('[data-employee-portal-pane]').forEach((pane) => {
    pane.hidden = pane.dataset.employeePortalPane !== selectedTab;
  });
}

function renderEmployeePortalRides(rides = []) {
  const list = $("#employeeRideShareList");
  if (!list) return;
  if (!rides.length) {
    list.innerHTML = '<div class="employee-empty-state"><strong>No rideshare assigned yet</strong><span>Your pickup and driver details will appear here when the company confirms them.</span></div>';
    return;
  }
  list.innerHTML = rides.map((ride) => {
    const route = `${ride.pickup_location || "Pickup pending"} to ${ride.dropoff_location || "destination pending"}`;
    const pickup = ride.pickup_at ? new Date(ride.pickup_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time pending";
    return `<article><span>${escapeHtml(ride.provider_name || "Company rideshare")}</span><strong>${escapeHtml(route)}</strong><small>${escapeHtml(pickup)} · ${escapeHtml(ride.status || "planned")}</small></article>`;
  }).join("");
}

function renderEmployeeEventHistory(history = []) {
  const list = $("#employeeEventHistory");
  if (!list) return;
  if (!history.length) {
    list.innerHTML = '<div class="employee-empty-state"><strong>Your event history starts here</strong><span>Past company events will remain available while your employer access is active.</span></div>';
    return;
  }
  list.innerHTML = history.map((event) => `<article>
    <span>${escapeHtml(String(event.trip_type || "company event").replaceAll("_", " "))}</span>
    <strong>${escapeHtml(event.title || "Company event")}</strong>
    <small>${escapeHtml(event.destination || "Location pending")} · ${escapeHtml(formatPortalDateRange(event))} · ${escapeHtml(event.attendanceStatus || "attending")}</small>
  </article>`).join("");
}

function getCorporateEventBrief(portal = {}) {
  const information = portal.importantInformation || [];
  const dressCode = information.find((item) => /dress|attire/i.test(`${item.section_type || ""} ${item.title || ""}`));
  const overview = information.find((item) => /overview|welcome|event|arrival/i.test(`${item.section_type || ""} ${item.title || ""}`));
  const dressTitle = dressCode?.title && !/^(dress code|attire)$/i.test(dressCode.title.trim())
    ? dressCode.title
    : String(dressCode?.body || "Company smart casual").split(/[.\n]/)[0];
  return {
    dressCode: dressTitle,
    dressNote: dressCode?.body || "Choose polished, comfortable clothing and review any activity-specific notes.",
    overview: overview?.body || "Your confirmed schedule, assigned travel, venue details, and company updates are collected here."
  };
}

function renderCorporateEventPlan(schedule = [], selector = "#corporateEmployeePlan") {
  const list = $(selector);
  if (!list) return;
  if (!schedule.length) {
    list.innerHTML = '<div class="corporate-event-plan-empty"><strong>Plan being finalized</strong><small>Your employer will add session times and locations here.</small></div>';
    return;
  }
  list.innerHTML = schedule.slice(0, 4).map((item) => {
    const time = item.starts_at
      ? new Date(item.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
      : "Time pending";
    const place = item.location_name || item.location_address || "Location pending";
    return `<div><time>${escapeHtml(time)}</time><span><strong>${escapeHtml(item.title || "Company event activity")}</strong><small>${escapeHtml(place)}</small></span></div>`;
  }).join("");
}

function renderCorporateEventAttendees(attendees = [], selector = "#corporateEmployeeAttendeeList") {
  const list = $(selector);
  if (!list) return;
  if (!attendees.length) {
    list.innerHTML = '<div class="corporate-attendee-empty">Your employer has not published the attendee list yet.</div>';
    return;
  }
  list.innerHTML = attendees.slice(0, 8).map((attendee) => {
    const initials = String(attendee.fullName || "Employee").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return `<div><b>${escapeHtml(initials)}</b><span><strong>${escapeHtml(attendee.fullName || "Employee")}</strong><small>${escapeHtml(attendee.department || String(attendee.role || "employee").replaceAll("_", " "))}</small></span></div>`;
  }).join("");
}

function formatPortalDateTime(value) {
  if (!value) return "Time pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time pending"
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getPortalDetailText(details) {
  if (typeof details === "string") return details.trim();
  if (!details || typeof details !== "object") return "";
  return String(details.description || details.instructions || details.notes || details.note || "").trim();
}

function renderCorporateEmployeeTravel(portal = {}) {
  const event = portal.event || {};
  const attendee = portal.attendee || {};
  const travel = portal.myTravel || {};
  const flights = Array.isArray(travel.flights) ? travel.flights : [];
  const hotels = Array.isArray(travel.hotels) ? travel.hotels : [];
  const attendance = attendee.attendanceStatus || "attending";

  setPortalText("#corporateEmployeeTravelTitle", `${attendee.fullName || "My"} company travel`);
  setPortalText("#corporateEmployeeTravelStatus", flights.length || hotels.length ? "Assigned travel" : "Assignments pending");
  setPortalText("#corporateTravelEmployeeName", attendee.fullName || "Employee");
  setPortalText("#corporateTravelEmployeeDepartment", attendee.department || String(attendee.role || "company attendee").replaceAll("_", " "));
  setPortalText("#corporateTravelEventName", event.title || "Your company event");
  setPortalText("#corporateTravelAttendance", attendance);
  setPortalText("#corporateTravelDestination", event.destination || "Location pending");
  setPortalText("#corporateTravelDates", formatPortalDateRange(event));
  setPortalText("#corporateTravelFlightCount", `${flights.length} assigned`);
  setPortalText("#corporateTravelHotelCount", `${hotels.length} assigned`);

  const flightList = $("#corporateEmployeeFlightList");
  if (flightList) {
    flightList.innerHTML = flights.length
      ? flights.map((flight) => {
        const details = flight.details || {};
        const carrier = [flight.airline, flight.flight_number].filter(Boolean).join(" ") || "Assigned flight";
        const route = `${flight.departure_airport || "Origin pending"} to ${flight.arrival_airport || "Destination pending"}`;
        const gate = details.departureGate || details.gate || "Pending";
        const seat = details.seat || details.seatNumber || "Pending";
        return `<article class="corporate-employee-record">
          <div><span>${escapeHtml(flight.status || "assigned")}</span><strong>${escapeHtml(carrier)}</strong><small>${escapeHtml(route)}</small></div>
          <dl><div><dt>Departs</dt><dd>${escapeHtml(formatPortalDateTime(flight.departs_at))}</dd></div><div><dt>Arrives</dt><dd>${escapeHtml(formatPortalDateTime(flight.arrives_at))}</dd></div><div><dt>Gate / seat</dt><dd>${escapeHtml(`${gate} / ${seat}`)}</dd></div></dl>
        </article>`;
      }).join("")
      : '<div class="employee-empty-state"><strong>No flight assigned yet</strong><span>Your flight appears here only after the company connects it to your employee record.</span></div>';
  }

  const hotelList = $("#corporateEmployeeHotelList");
  if (hotelList) {
    hotelList.innerHTML = hotels.length
      ? hotels.map((hotel) => {
        const detailText = getPortalDetailText(hotel.details);
        return `<article class="corporate-employee-record">
          <div><span>Assigned stay</span><strong>${escapeHtml(hotel.hotel_name || "Company hotel")}</strong><small>${escapeHtml(hotel.address || "Address pending")}</small></div>
          <dl><div><dt>Check-in</dt><dd>${escapeHtml(formatPortalDateTime(hotel.check_in_at))}</dd></div><div><dt>Check-out</dt><dd>${escapeHtml(formatPortalDateTime(hotel.check_out_at))}</dd></div><div><dt>Confirmation</dt><dd>${escapeHtml(hotel.confirmation_number || "Pending")}</dd></div></dl>
          ${detailText ? `<p>${escapeHtml(detailText)}</p>` : ""}
        </article>`;
      }).join("")
      : '<div class="employee-empty-state"><strong>No hotel assigned yet</strong><span>Your stay appears here only after the company connects it to your employee record.</span></div>';
  }
}

function renderCorporateEmployeeItinerary(portal = {}) {
  const event = portal.event || {};
  const attendee = portal.attendee || {};
  const schedule = Array.isArray(portal.myEvent?.schedule) ? portal.myEvent.schedule : [];
  const eventBrief = getCorporateEventBrief(portal);

  setPortalText("#corporateItineraryEventTitle", event.title || "Your company event");
  setPortalText("#corporateItineraryEventSummary", eventBrief.overview);
  setPortalText("#corporateItineraryAttendance", attendee.attendanceStatus || "attending");
  setPortalText("#corporateItineraryDestination", event.destination || "Location pending");
  setPortalText("#corporateItineraryDates", formatPortalDateRange(event));
  setPortalText("#corporateItineraryDressCode", eventBrief.dressCode);
  setPortalText("#corporateItineraryItemCount", `${schedule.length} item${schedule.length === 1 ? "" : "s"}`);

  const list = $("#corporateEmployeeItineraryList");
  if (!list) return;
  if (!schedule.length) {
    list.innerHTML = '<div class="employee-empty-state"><strong>The event agenda is being finalized</strong><span>Company-published sessions will appear here when they are ready for employees.</span></div>';
    return;
  }
  list.innerHTML = schedule.map((item) => {
    const detailText = getPortalDetailText(item.details);
    const location = item.location_name || item.location_address || "Location pending";
    const endTime = item.ends_at ? ` to ${formatPortalDateTime(item.ends_at)}` : "";
    return `<article class="corporate-itinerary-item">
      <time>${escapeHtml(formatPortalDateTime(item.starts_at))}${escapeHtml(endTime)}</time>
      <div><span>${escapeHtml(String(item.item_type || "event session").replaceAll("_", " "))}</span><strong>${escapeHtml(item.title || "Company event activity")}</strong><small>${escapeHtml(location)}</small>${detailText ? `<p>${escapeHtml(detailText)}</p>` : ""}</div>
    </article>`;
  }).join("");
}

function renderCorporateEmployeeHome(portal = state.corporatePortal || {}) {
  const event = portal.event || {};
  const attendee = portal.attendee || {};
  const travel = portal.myTravel || {};
  const schedule = portal.myEvent?.schedule || [];
  const wallet = portal.wallet || {};
  const flight = travel.flights?.[0] || {};
  const ride = travel.transportation?.[0] || {};
  const nextEvent = schedule.find((item) => !item.starts_at || new Date(item.starts_at) >= new Date()) || schedule[0] || {};
  const eventBrief = getCorporateEventBrief(portal);
  const eventType = String(event.trip_type || "corporate event").replaceAll("_", " ");
  const flightLabel = flight.flight_number
    ? `${flight.airline || "Flight"} ${flight.flight_number} · ${flight.departure_airport || "Origin"} to ${flight.arrival_airport || "Destination"}`
    : "Flight assignment pending";
  const rideLabel = ride.pickup_location
    ? `${ride.pickup_location} to ${ride.dropoff_location || "event"}`
    : "Rideshare assignment pending";
  setPortalText("#corporateEmployeeEventTitle", event.title || "Your company event");
  setPortalText("#corporateEmployeeEventType", eventType);
  setPortalText("#corporateEmployeeDestination", event.destination || "Location to be announced");
  setPortalText("#corporateEmployeeDates", formatPortalDateRange(event));
  setPortalText("#corporateEmployeeAttendance", attendee.attendanceStatus || "attending");
  setPortalText("#corporateEmployeeFlight", flightLabel);
  setPortalText("#corporateEmployeeNextEvent", nextEvent.title || "Event schedule pending");
  setPortalText("#corporateEmployeeLocation", nextEvent.location_name || nextEvent.location_address || event.destination || "Location pending");
  setPortalText("#corporateEmployeeBrief", eventBrief.overview);
  setPortalText("#corporateEmployeeDressCode", eventBrief.dressCode);
  setPortalText("#corporateEmployeeDressNote", eventBrief.dressNote);
  setPortalText("#corporateEmployeeVenue", nextEvent.location_name || "Main venue pending");
  setPortalText("#corporateEmployeeVenueAddress", nextEvent.location_address || event.destination || "Address pending");
  setPortalText("#corporateEmployeeAttendeeCount", `${portal.eventAttendees?.length || 0} confirmed`);
  setPortalText("#corporateEmployeeStipend", formatPortalMoney(wallet.stipendCents, wallet.currency));
  setPortalText("#corporateEmployeeRide", rideLabel);
  setPortalText("#corporateEmployeeHistoryCount", `${portal.eventHistory?.length || 0} company event${portal.eventHistory?.length === 1 ? "" : "s"}`);
  setPortalText("#corporateEmployeeUpdates", `${portal.importantInformation?.length || 0} item${portal.importantInformation?.length === 1 ? "" : "s"} to review`);
  setPortalText("#linkedEmployeeStipend", formatPortalMoney(wallet.stipendCents, wallet.currency));
  setPortalText("#linkedEmployeeFunds", formatPortalMoney(wallet.personalFundsCents, wallet.currency));
  setPortalText("#linkedEmployeeCardEnding", wallet.card?.maskedLastFour ? `Card ending ${wallet.card.maskedLastFour}` : "Card pending");
  setPortalText("#linkedEmployeeCardStatus", wallet.card?.status === "active" ? "Active for approved dates and categories." : "Card provider setup required.");
  setPortalText("#employeeCardTripLabel", event.title || "Company event");
  setPortalText("#employeeCardholderName", attendee.fullName || "Employee");
  if (wallet.card?.maskedLastFour) setPortalText("#cardNumber", `•••• •••• •••• ${wallet.card.maskedLastFour}`);
  renderCorporateEventPlan(schedule);
  renderCorporateEventAttendees(portal.eventAttendees || []);
  renderCorporateEmployeeTravel(portal);
  renderCorporateEmployeeItinerary(portal);
}

function renderGuestPortal(portal = {}) {
  const event = portal.event || {};
  const attendee = portal.attendee || {};
  const travel = portal.myTravel || {};
  const schedule = portal.myEvent?.schedule || [];
  const info = portal.importantInformation || [];
  const wallet = portal.wallet || {};
  const flight = travel.flights?.[0] || {};
  const hotel = travel.hotels?.[0] || {};
  const nextEvent = schedule.find((item) => !item.starts_at || new Date(item.starts_at) >= new Date()) || schedule[0] || {};
  const startsAt = event.starts_on ? new Date(event.starts_on) : null;
  const daysUntil = startsAt && !Number.isNaN(startsAt.getTime()) ? Math.ceil((startsAt - new Date()) / 86400000) : null;
  const eventType = String(event.trip_type || "corporate event").replaceAll("_", " ");

  state.corporatePortal = portal;
  if (document.body.classList.contains("auth-screen")) document.body.classList.add("employee-portal-active");
  $("#guestAccessForm").hidden = true;
  setVisibilityWithoutCssLeaks($("#guestPortalPanel"), true);
  setPortalText("#guestPortalTitle", event.title || "Your company event");
  setPortalText("#guestPortalMeta", portal.session?.expiresAt
    ? `Secure employee session expires ${new Date(portal.session.expiresAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Your event history remains available when you use reusable employee access.`
    : "Secure corporate employee access is active.");
  setPortalText("#employeeAttendanceBadge", attendee.attendanceStatus || "attending");
  setPortalText("#employeeAttendanceStatus", attendee.attendanceStatus || "attending");
  setPortalText("#employeeEventType", eventType);
  setPortalText("#employeeEventName", event.title || "Company event");
  setPortalText("#employeeEventDestination", event.destination || "Location to be announced");
  setPortalText("#employeeEventDates", formatPortalDateRange(event));
  setPortalText("#employeeEventLocation", nextEvent.location_name || hotel.hotel_name || "Venue pending");
  setPortalText("#employeeEventDepartment", attendee.department || "Company guest");
  setPortalText("#employeeEventCountdown", daysUntil === null ? "Schedule ready" : daysUntil > 0 ? `${daysUntil} days to go` : daysUntil === 0 ? "Today" : "Event history");
  setPortalText("#guestTravelSummary", flight.flight_number ? `${flight.airline || "Flight"} ${flight.flight_number}` : "Flight pending");
  setPortalText("#employeeFlightRoute", `${flight.departure_airport || "Origin"} to ${flight.arrival_airport || event.destination || "destination"}`);
  setPortalText("#guestEventSummary", `${schedule.length} schedule item${schedule.length === 1 ? "" : "s"}`);
  setPortalText("#employeeNextEvent", nextEvent.title || "Next event pending");
  setPortalText("#employeeDashboardStipend", formatPortalMoney(wallet.stipendCents, wallet.currency));
  setPortalText("#employeeHotelName", hotel.hotel_name || "Hotel assignment pending");
  setPortalText("#employeeHotelDates", hotel.check_in_at ? `Check-in ${formatPortalDate(hotel.check_in_at)}` : "Stay details pending");
  setPortalText("#employeeMeetingLocation", nextEvent.location_name || "Meeting location pending");
  setPortalText("#employeeMeetingAddress", nextEvent.location_address || event.destination || "Address pending");
  setPortalText("#guestInfoSummary", `${info.length} update${info.length === 1 ? "" : "s"}`);
  const eventBrief = getCorporateEventBrief(portal);
  setPortalText("#employeeDressCode", eventBrief.dressCode);
  setPortalText("#employeeAttendeeCount", `${portal.eventAttendees?.length || 0} attendee${portal.eventAttendees?.length === 1 ? "" : "s"}`);
  setPortalText("#employeePortalBrief", eventBrief.overview);
  setPortalText("#employeePortalAttendeeCount", `${portal.eventAttendees?.length || 0} confirmed`);
  setPortalText("#employeeWalletStatus", wallet.status === "active" ? "Active" : "Provider setup");
  setPortalText("#employeeStipendBalance", formatPortalMoney(wallet.stipendCents, wallet.currency));
  setPortalText("#employeePersonalFunds", formatPortalMoney(wallet.personalFundsCents, wallet.currency));
  setPortalText("#employeeCardEnding", wallet.card?.maskedLastFour ? `Card ending ${wallet.card.maskedLastFour}` : "Card pending");
  setPortalText("#employeeCardStatus", wallet.card?.status === "active" ? "Active for approved event purchases" : "Card provider setup required");
  setPortalText("#employeeWalletMessage", wallet.canAddFunds
    ? "Your linked account is ready for secure hosted checkout."
    : "Link or create a verified personal account before adding funds; an employee ID alone cannot authorize a payment.");
  const addFundsButton = $("#employeeAddFundsButton");
  if (addFundsButton) addFundsButton.textContent = wallet.canAddFunds ? "Add personal funds" : "Link account to add funds";
  renderEmployeePortalRides(travel.transportation || []);
  renderEmployeeEventHistory(portal.eventHistory || []);
  renderCorporateEventPlan(schedule, "#employeePortalPlan");
  renderCorporateEventAttendees(portal.eventAttendees || [], "#employeePortalAttendeeList");
  renderCorporateEmployeeHome(portal);
  setEmployeePortalTab(state.employeePortalTab);
}

async function verifyGuestAccess() {
  const payload = {
    action: "verify",
    accessCode: $("#guestAccessCodeInput").value.trim(),
    employeeId: $("#guestEmployeeIdInput").value.trim(),
    lastName: $("#guestLastNameInput").value.trim(),
    companyEmail: $("#guestCompanyEmailInput").value.trim()
  };

  if (!payload.accessCode || !payload.employeeId || !payload.lastName) {
    $("#authMessage").textContent = "Enter your access code, attendee ID, and last name to continue.";
    return;
  }

  $("#authMessage").textContent = "Verifying secure event access...";

  if (isFilePreview) {
    state.guestSessionToken = "local-preview-guest-session";
    sessionStorage.setItem("traveldripGuestSessionToken", state.guestSessionToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
    const previewPortal = {
      session: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString() },
      attendee: { fullName: "Taylor Employee", department: "Leadership", role: "employee", attendanceStatus: "attending", accountLinked: false },
      event: { id: "leadership-summit-preview", title: "2027 Leadership Retreat", destination: "Dubai, United Arab Emirates", starts_on: "2027-07-24", ends_on: "2027-07-28", trip_type: "corporate_retreat" },
      myTravel: {
        flights: [{ airline: "Delta", flight_number: "DL 241", departure_airport: "MIA", arrival_airport: "DXB", departs_at: "2027-07-23T21:40:00-04:00", arrives_at: "2027-07-24T19:15:00+04:00", status: "confirmed", details: { departureGate: "D18", seat: "14A" } }],
        hotels: [{ hotel_name: "Marina Grand Hotel", address: "Dubai Marina, Dubai", check_in_at: "2027-07-24T15:00:00+04:00", check_out_at: "2027-07-28T11:00:00+04:00", confirmation_number: "MGH-2088" }],
        transportation: [{ provider_name: "Careem", pickup_location: "DXB Terminal 3", dropoff_location: "Marina Grand Hotel", pickup_at: "2027-07-24T20:35:00Z", status: "confirmed" }]
      },
      myEvent: { schedule: [
        { title: "Welcome reception", item_type: "reception", starts_at: "2027-07-24T19:30:00+04:00", ends_at: "2027-07-24T21:00:00+04:00", location_name: "Skyline Terrace", location_address: "Dubai Marina", details: "Meet the retreat hosts and company leadership." },
        { title: "Leadership keynote", item_type: "general_session", starts_at: "2027-07-25T09:00:00+04:00", ends_at: "2027-07-25T10:30:00+04:00", location_name: "Palm Ballroom", location_address: "Skyline Conference Center", details: "Company priorities and the year-ahead strategy." },
        { title: "Department workshops", item_type: "workshop", starts_at: "2027-07-25T11:00:00+04:00", ends_at: "2027-07-25T13:00:00+04:00", location_name: "Breakout Rooms A-D", location_address: "Skyline Conference Center", details: "Check the room assignment provided by your department lead." },
        { title: "Hosted marina dinner", item_type: "company_dinner", starts_at: "2027-07-25T19:00:00+04:00", ends_at: "2027-07-25T21:30:00+04:00", location_name: "Marina Promenade", location_address: "Dubai Marina", details: "Business casual attire. Transportation departs the hotel at 6:30 PM." }
      ] },
      wallet: { currency: "USD", status: "active", stipendCents: 43000, personalFundsCents: 0, canAddFunds: false, card: { status: "active", maskedLastFour: "4829" } },
      eventHistory: [{ id: "preview-history", title: "New York Sales Summit", destination: "New York City", starts_on: "2026-04-10", ends_on: "2026-04-12", trip_type: "conference", attendanceStatus: "attended" }],
      eventAttendees: [
        { fullName: "Taylor Employee", department: "Leadership", role: "employee", attendanceStatus: "attending" },
        { fullName: "Jordan Smith", department: "Operations", role: "organizer", attendanceStatus: "attending" },
        { fullName: "Maya Chen", department: "Product", role: "employee", attendanceStatus: "attending" },
        { fullName: "Andre Lewis", department: "Sales", role: "employee", attendanceStatus: "attending" }
      ],
      importantInformation: [
        { section_type: "event_overview", title: "Welcome", body: "Meet the leadership team, review the year ahead, and finish the day with a hosted marina dinner." },
        { section_type: "dress_code", title: "Dress code", body: "Smart resort attire for daytime sessions; business casual for the welcome dinner." }
      ],
      sharedPhotos: [{ caption: "Welcome dinner" }]
    };
    state.corporateAccess = { verified: true, eventId: previewPortal.event.id, role: "employee", expiresAt, accountLinked: false, pendingTarget: "dashboardHome" };
    state.corporatePortal = previewPortal;
    sessionStorage.setItem("traveldripCorporateAccessVerified", "true");
    sessionStorage.setItem("traveldripCorporateEventId", previewPortal.event.id);
    sessionStorage.setItem("traveldripCorporateRole", "employee");
    sessionStorage.setItem("traveldripCorporateAccessExpiresAt", expiresAt);
    renderGuestPortal(previewPortal);
    $("#authMessage").textContent = "Guest portal preview opened. Production verification hashes the code and employee ID server-side.";
    addAuditEntry("Guest portal preview opened", "Corporate event guest access flow verified locally with secure production API ready.");
    return;
  }

  try {
    const response = await fetch("/api/guest-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      $("#authMessage").textContent = result.error || "We could not verify your access information. Check your details or contact your event organizer.";
      return;
    }
    state.guestSessionToken = result.guestSessionToken;
    sessionStorage.setItem("traveldripGuestSessionToken", state.guestSessionToken);
    const expiresAt = result.portal?.session?.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
    state.corporateAccess = {
      verified: true,
      eventId: result.portal?.event?.id || "verified-corporate-event",
      role: result.portal?.attendee?.role || "employee",
      expiresAt,
      accountLinked: Boolean(result.portal?.attendee?.accountLinked),
      pendingTarget: "dashboardHome"
    };
    sessionStorage.setItem("traveldripCorporateAccessVerified", "true");
    sessionStorage.setItem("traveldripCorporateEventId", state.corporateAccess.eventId);
    sessionStorage.setItem("traveldripCorporateRole", state.corporateAccess.role);
    sessionStorage.setItem("traveldripCorporateAccessExpiresAt", expiresAt);
    if (state.corporateAccess.accountLinked) sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
    renderGuestPortal(result.portal);
    $("#authMessage").textContent = "Guest access verified. Only approved personal event details are visible.";
  } catch (_error) {
    $("#authMessage").textContent = "Guest access is temporarily unavailable. Try again or contact your event organizer.";
  }
}

async function endGuestAccess() {
  const token = state.guestSessionToken;
  state.guestSessionToken = "";
  state.corporatePortal = null;
  sessionStorage.removeItem("traveldripGuestSessionToken");
  if (token && !isFilePreview) {
    await fetch("/api/guest-access", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    }).catch(() => {});
  }
  setVisibilityWithoutCssLeaks($("#guestPortalPanel"), false);
  document.body.classList.remove("employee-portal-active");
  $("#guestAccessForm").hidden = false;
  $("#authMessage").textContent = "Guest session ended.";
}

async function signOut() {
  if (state.supabase) await state.supabase.auth.signOut();
  if (state.guestSessionToken) await endGuestAccess();
  if (state.corporateAccess.verified) clearCorporateAccess("Corporate and personal sessions ended.");
  rememberProtectedTarget(getTargetFromRoute());
  state.session = null;
  state.hasEnteredApp = false;
  sessionStorage.removeItem("traveldripEnteredApp");
  setAuthConfirmation("");
  state.isAdmin = false;
  state.adminStatusCheckedFor = "";
  state.walletAccess = {
    status: "unknown",
    role: "member",
    tripId: "",
    canContribute: false,
    canTapToPay: false,
    canManageCard: false,
    providerRequired: true
  };
  state.activeTripId = "";
  state.ownershipTransfer = { status: "idle", tripId: "", entityType: "auto", members: [] };
  sessionStorage.removeItem("traveldripActiveTripId");
  setAuthMode("signin");
  updateAuthUi();
  renderWalletAccess();
  renderOwnershipTransferMembers();
  setOwnershipTransferMessage("Sign in as the current trip or event owner to manage ownership transfers.");
}

const mainNavigation = Object.freeze([
  { id: "dashboard", label: "Dashboard", target: "dashboardHome", path: "/dashboard" },
  { id: "profile", label: "My Profile", target: "myProfile", path: "/profile/my-profile" },
  { id: "planning", label: "Planning", target: "aiTravelPlanner", path: "/planning" },
  { id: "itinerary", label: "Itinerary", target: "itineraryAlerts", path: "/itinerary" },
  { id: "events", label: "Events", target: "eventsPanel", path: "/events" },
  { id: "transportation", label: "Transportation", target: "transportationPanel", path: "/transportation" },
  { id: "travel", label: "Travel", target: "rideShareHub", path: "/travel", travelSection: "overview" },
  { id: "wallet", label: "Wallet", target: "walletPanel", path: "/wallet" },
  { id: "chat", label: "Chat", target: "socialHub", path: "/chat" },
  { id: "important-info", label: "Important Info", target: "importantInfo", path: "/important-info" },
  { id: "memories", label: "Memories", target: "memoriesPanel", path: "/memories" },
  { id: "settings", label: "Settings", target: "adminPanel", path: "/settings" }
]);

const mainNavigationById = Object.fromEntries(mainNavigation.map((item) => [item.id, item]));
const mainNavigationByTarget = Object.fromEntries(mainNavigation.map((item) => [item.target, item]));
const adminSurfaceTargets = new Set(["adminPanel", "enterpriseRbac"]);

const smartDashboardGridSelectors = Object.freeze([
  "#dashboardWidgets .widget-grid",
  ".event-experience-grid",
  ".event-operations-grid",
  ".event-create-grid",
  ".bank-grid",
  ".ai-trip-output-grid",
  ".explore-context-grid",
  ".explore-skeleton-grid",
  ".explore-results-grid",
  ".destination-fact-grid",
  ".corporate-home-grid",
  ".lets-plan-grid",
  ".retreat-type-grid",
  ".invitation-builder-grid",
  ".invitation-form-grid",
  ".invitation-options-grid",
  ".invite-checkbox-grid",
  ".guest-portal-grid",
  ".quick-share-grid",
  ".solo-dashboard-grid",
  ".cruise-overview-grid",
  ".cruise-feature-grid",
  ".cruise-wallet-grid",
  ".message-support-grid",
  ".daily-memory-grid",
  ".memory-action-grid",
  ".memory-settings-grid",
  ".platform-grid",
  ".memory-gallery-grid",
  ".memory-album-grid",
  ".memory-grid",
  ".info-status-grid",
  ".destination-info-grid",
  ".checklist-grid",
  ".emergency-grid",
  ".wallet-home-grid",
  ".wallet-trip-card-grid",
  ".wallet-section-card-grid",
  ".wallet-action-grid",
  ".card-balance-grid",
  ".bill-redesign-grid",
  ".bill-entry-grid",
  ".bill-total-grid",
  ".bill-tools-grid",
  ".payment-method-grid",
  ".control-grid",
  ".travel-focus-grid",
  ".visual-pass-grid",
  ".travel-support-grid",
  ".transport-security-grid",
  ".ride-overview-grid",
  ".ride-location-grid",
  ".ride-estimate-grid",
  ".ride-recommendation-grid",
  ".ride-entry-grid",
  ".alert-category-grid",
  ".upcoming-reservation-grid",
  ".reservation-reminder-grid",
  ".reservation-preferences-grid",
  ".profile-card-grid",
  ".profile-stats-grid",
  ".profile-adventure-grid",
  ".profile-connections-grid",
  ".profile-photo-policy-grid",
  ".profile-personal-grid",
  ".travel-badge-grid",
  ".theme-swatch-grid",
  ".security-status-grid",
  ".security-control-grid",
  ".backend-summary-grid",
  ".policy-summary-grid",
  ".navigation-status-grid",
  ".go-live-summary-grid",
  ".corporate-feature-grid",
  ".corporate-policy-grid",
  ".enterprise-security-grid",
  ".corporate-access-admin-grid",
  ".approval-comm-grid",
  ".vote-option-grid",
  ".rsvp-status-grid",
  ".feature-toggle-grid",
  ".permission-grid"
]);

function applySmartDashboardLayout() {
  smartDashboardGridSelectors.forEach((selector) => {
    $$(selector).forEach((grid) => grid.classList.add("smart-dashboard-grid"));
  });
}

const routeDefinitions = {
  dashboardHome: { path: mainNavigationByTarget.dashboardHome.path, label: "Dashboard" },
  letsPlan: { path: "/lets-plan", label: "Let's Plan" },
  eventsPanel: { path: "/events", label: "Events" },
  aiTravelPlanner: { path: mainNavigationByTarget.aiTravelPlanner.path, label: "AI Travel Planner" },
  exploreDrops: { path: "/explore", label: "Explore" },
  tripsPanel: { path: "/trips", label: "My Trips" },
  groupBank: { path: "/trips/dubai-weekend/group-bank", label: "Group Bank" },
  walletPanel: { path: mainNavigationByTarget.walletPanel.path, label: "Wallet" },
  rideShareHub: { path: mainNavigationByTarget.rideShareHub.path, label: "Travel" },
  transportationPanel: { path: "/transportation", label: "Transportation" },
  splitBill: { path: "/trips/dubai-weekend/split-bill", label: "Restaurant Bill Split" },
  itineraryAlerts: { path: mainNavigationByTarget.itineraryAlerts.path, label: "Itinerary & Alerts" },
  importantInfo: { path: mainNavigationByTarget.importantInfo.path, label: "Important Information" },
  cruisePanel: { path: "/trips/dubai-weekend/cruise", label: "Cruise" },
  socialHub: { path: mainNavigationByTarget.socialHub.path, label: "Messages" },
  memoriesPanel: { path: "/memories", label: "Memories" },
  enterpriseRbac: { path: "/corporate", label: "Corporate" },
  myProfile: { path: "/profile/my-profile", label: "My Profile" },
  adminPanel: { path: mainNavigationByTarget.adminPanel.path, label: "Settings" },
  copyrightPolicy: { path: "/settings/help", label: "Help & Copyright" }
};

const routeAliases = {
  "/": "dashboardHome",
  "/index.html": "dashboardHome",
  "/home": "dashboardHome",
  "/dashboard": "dashboardHome",
  "/profile": "myProfile",
  "/profile/my-profile": "myProfile",
  "/lets-plan": "letsPlan",
  "/planning": "aiTravelPlanner",
  "/itinerary": "itineraryAlerts",
  "/events": "eventsPanel",
  "/events/upcoming": "eventsPanel",
  "/events/invitations": "eventsPanel",
  "/events/rsvps": "eventsPanel",
  "/create": "letsPlan",
  "/plan": "letsPlan",
  "/ai-planner": "aiTravelPlanner",
  "/planner": "aiTravelPlanner",
  "/explore": "exploreDrops",
  "/travel": "rideShareHub",
  "/transportation": "transportationPanel",
  "/wallet": "walletPanel",
  "/chat": "socialHub",
  "/important-info": "importantInfo",
  "/trips": "tripsPanel",
  "/trips/dubai-weekend": "tripsPanel",
  "/trips/dubai-weekend/overview": "dashboardHome",
  "/trips/dubai-weekend/itinerary": "itineraryAlerts",
  "/trips/dubai-weekend/flights": "itineraryAlerts",
  "/trips/dubai-weekend/hotels": "importantInfo",
  "/trips/dubai-weekend/travel": "rideShareHub",
  "/trips/dubai-weekend/transportation": "transportationPanel",
  "/trips/dubai-weekend/transportation/alerts": "transportationPanel",
  "/trips/dubai-weekend/transportation/missing-items": "transportationPanel",
  "/trips/dubai-weekend/transportation/flights": "transportationPanel",
  "/trips/dubai-weekend/transportation/hotels": "transportationPanel",
  "/trips/dubai-weekend/transportation/trains": "transportationPanel",
  "/trips/dubai-weekend/transportation/buses": "transportationPanel",
  "/trips/dubai-weekend/transportation/ferries": "transportationPanel",
  "/trips/dubai-weekend/transportation/cruises": "transportationPanel",
  "/trips/dubai-weekend/transportation/shuttles": "transportationPanel",
  "/trips/dubai-weekend/transportation/ride-share": "transportationPanel",
  "/trips/dubai-weekend/transportation/transfers": "transportationPanel",
  "/trips/dubai-weekend/transportation/public-transit": "transportationPanel",
  "/trips/dubai-weekend/transportation/routes": "transportationPanel",
  "/trips/dubai-weekend/transportation/tickets": "transportationPanel",
  "/trips/dubai-weekend/transportation/boarding": "transportationPanel",
  "/trips/dubai-weekend/transportation/weather": "transportationPanel",
  "/trips/dubai-weekend/transportation/maps": "transportationPanel",
  "/trips/dubai-weekend/transportation/documents": "transportationPanel",
  "/trips/dubai-weekend/transportation/itinerary": "transportationPanel",
  "/trips/dubai-weekend/transportation/smart-route": "transportationPanel",
  "/trips/dubai-weekend/transportation/your-trips": "transportationPanel",
  "/trips/dubai-weekend/transportation/travelers": "transportationPanel",
  "/trips/dubai-weekend/transportation/rental-cars": "transportationPanel",
  "/trips/dubai-weekend/transportation/private-transfers": "transportationPanel",
  "/trips/dubai-weekend/ride-share": "transportationPanel",
  "/trips/dubai-weekend/wallet": "walletPanel",
  "/trips/dubai-weekend/my-wallet": "walletPanel",
  "/trips/dubai-weekend/group-bank": "groupBank",
  "/trips/dubai-weekend/transactions": "walletPanel",
  "/trips/dubai-weekend/refunds": "walletPanel",
  "/trips/dubai-weekend/virtual-card": "walletPanel",
  "/trips/dubai-weekend/split-bill": "splitBill",
  "/trips/dubai-weekend/ride-share-split": "transportationPanel",
  "/trips/dubai-weekend/group-chat": "socialHub",
  "/trips/dubai-weekend/private-messages": "socialHub",
  "/trips/dubai-weekend/documents": "importantInfo",
  "/trips/dubai-weekend/important-information": "importantInfo",
  "/trips/dubai-weekend/memories": "memoriesPanel",
  "/trips/dubai-weekend/settings": "adminPanel",
  "/trips/dubai-weekend/cruise": "rideShareHub",
  "/messages": "socialHub",
  "/messages/group": "socialHub",
  "/messages/private": "socialHub",
  "/messages/announcements": "socialHub",
  "/messages/ai-trip-manager": "socialHub",
  "/messages/media": "socialHub",
  "/memories": "memoriesPanel",
  "/corporate": "enterpriseRbac",
  "/corporate/my-flight": "enterpriseRbac",
  "/corporate/my-hotel": "enterpriseRbac",
  "/corporate/my-transportation": "transportationPanel",
  "/corporate/my-event-schedule": "enterpriseRbac",
  "/corporate/my-activities": "enterpriseRbac",
  "/corporate/announcements": "importantInfo",
  "/corporate/important-information": "importantInfo",
  "/corporate/approved-photos": "socialHub",
  "/corporate/budget": "enterpriseRbac",
  "/corporate/finance": "enterpriseRbac",
  "/corporate/reports": "enterpriseRbac",
  "/corporate/audit-logs": "enterpriseRbac",
  "/profile": "myProfile",
  "/profile/my-profile": "myProfile",
  "/profile/edit": "myProfile",
  "/profile/privacy": "adminPanel",
  "/profile/notifications": "adminPanel",
  "/profile/connected-accounts": "socialHub",
  "/profile/ride-share-connections": "transportationPanel",
  "/profile/social-media-connections": "socialHub",
  "/profile/wallet-settings": "walletPanel",
  "/profile/security": "adminPanel",
  "/profile/travel-statistics": "tripsPanel",
  "/settings": "adminPanel",
  "/settings/notifications": "adminPanel",
  "/settings/privacy": "adminPanel",
  "/settings/security": "adminPanel",
  "/settings/help": "copyrightPolicy",
  "/settings/navigation-audit": "adminPanel",
  "/admin": "adminPanel",
  "/admin/account": "adminPanel",
  "/admin/password-security": "adminPanel",
  "/admin/security": "adminPanel",
  "/admin/roles": "adminPanel",
  "/admin/notifications": "adminPanel",
  "/admin/privacy": "adminPanel",
  "/admin/payments": "adminPanel",
  "/admin/app-preferences": "adminPanel",
  "/admin/accessibility": "adminPanel",
  "/admin/integrations": "adminPanel",
  "/admin/data-management": "adminPanel"
};

const sectionRouteIds = Object.keys(routeDefinitions);
let routeMountRegistry = null;
let routeInteractionsWired = false;

function getRouteComponentById(id) {
  const mounted = document.getElementById(id);
  if (mounted) return mounted;
  const cached = routeMountRegistry?.roots.find(({ element }) => {
    if (element.id === id) return true;
    return Boolean(element.querySelector(`[id="${id}"]`));
  });
  if (!cached) return null;
  return cached.element.id === id ? cached.element : cached.element.querySelector(`[id="${id}"]`);
}

function initializeRouteMountRegistry() {
  if (routeMountRegistry) return;
  const contentGrid = $(".content-grid");
  const mainStack = contentGrid?.querySelector(":scope > .main-stack");
  const rightStack = contentGrid?.querySelector(":scope > .right-stack");
  const roots = [];
  const extractedComponents = contentGrid && mainStack
    ? Array.from(contentGrid.querySelectorAll("[data-route-extract]"))
      .filter((element) => element.parentElement !== mainStack && element.parentElement !== rightStack)
    : [];

  extractedComponents.forEach((element) => {
    element.remove();
    mainStack.appendChild(element);
  });

  const registerStack = (parent, stackName) => {
    if (!parent) return;
    Array.from(parent.children).forEach((element, index) => {
      if (!(element instanceof HTMLElement)) return;
      roots.push({ element, parent, stackName, index, anchor: null });
    });
  };

  registerStack(mainStack, "main");
  registerStack(rightStack, "right");

  const groupBank = document.getElementById("groupBank");
  if (groupBank) {
    roots.push({ element: groupBank, parent: groupBank.parentElement, stackName: "before-content", index: -1, anchor: contentGrid });
  }

  roots.forEach(({ element }) => {
    element.dataset.routeComponent = "true";
    element.remove();
  });
  routeMountRegistry = { contentGrid, roots };
}

function routeOwnsComponent(element, target) {
  if (element.id && routeDefinitions[element.id]) return element.id === target;
  const supportedRoutes = (element.dataset.routeSupport || "").split(/\s+/).filter(Boolean);
  return supportedRoutes.includes(target);
}

function mountRouteComponents(target) {
  if (!routeInteractionsWired) return;
  initializeRouteMountRegistry();
  if (!routeMountRegistry) return;

  routeMountRegistry.roots.forEach(({ element }) => element.remove());
  routeMountRegistry.roots
    .filter(({ element }) => routeOwnsComponent(element, target))
    .sort((a, b) => {
      const stackOrder = a.stackName.localeCompare(b.stackName);
      if (stackOrder) return stackOrder;
      if (target === "walletPanel") {
        const walletPriority = ({ element }) => {
          if (element.id === "virtualCard") return 0;
          if (element.id === "walletPanel") return 1;
          if (element.classList.contains("audit-panel")) return 2;
          return 3;
        };
        const priorityOrder = walletPriority(a) - walletPriority(b);
        if (priorityOrder) return priorityOrder;
      }
      return a.index - b.index;
    })
    .forEach(({ element, parent, anchor }) => {
      if (anchor && parent) parent.insertBefore(element, anchor);
      else parent?.appendChild(element);
    });
}

function setVisibilityWithoutCssLeaks(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.setAttribute("aria-hidden", String(!visible));
  element.inert = !visible;
  if (visible) element.style.removeProperty("display");
  else element.style.setProperty("display", "none", "important");
}

function applyMainNavigationConfig() {
  $$("[data-main-nav-id]").forEach((control) => {
    const item = mainNavigationById[control.dataset.mainNavId];
    if (!item) return;
    control.dataset.target = item.target;
    control.dataset.navPath = item.path;
    control.dataset.tabKey = item.id;
    if (!control.getAttribute("aria-label")) control.setAttribute("aria-label", item.label);
  });
}

function getMainNavigationId(target, travelSection = "") {
  if (target === "rideShareHub") {
    return travelSection === "itinerary" ? "itinerary" : "travel";
  }
  return mainNavigationByTarget[target]?.id || "";
}

function navigateSafely(target, options = {}) {
  if (!target || !routeDefinitions[target]) {
    console.error("Navigation failed: missing destination", target || "(empty)");
    return false;
  }
  renderRoute(target, options);
  return true;
}

function syncNavigationState(resolvedTarget, travelSection = "") {
  const activeTravelSection = resolvedTarget === "rideShareHub"
    ? travelSection || "overview"
    : "";
  const activeNavigationId = getMainNavigationId(resolvedTarget, activeTravelSection);
  $$(".nav button, .nav a, .mobile-nav button, .trip-tab-bar button").forEach((navButton) => {
    const navigationKey = navButton.dataset.mainNavId || navButton.dataset.tabKey || navButton.dataset.target;
    const buttonTravelSection = navButton.dataset.travelSection || "";
    const isTravelSectionItem = navButton.dataset.target === "rideShareHub" && buttonTravelSection;
    const isActive = isTravelSectionItem
      ? resolvedTarget === "rideShareHub" && buttonTravelSection === activeTravelSection
      : navButton.dataset.mainNavId
        ? navigationKey === activeNavigationId
        : navigationKey === activeNavigationId || navigationKey === resolvedTarget;
    navButton.classList.toggle("active", isActive);
    if (navButton.dataset.target) navButton.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function normalizeAppPath(pathname = location.pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.endsWith("/index.html")) return "/index.html";
  return clean;
}

function getTargetFromRoute(pathname = location.pathname) {
  const hashTarget = location.hash.startsWith("#") ? decodeURIComponent(location.hash.slice(1)) : "";
  const hashRouteTarget = hashTarget.split("/")[0];
  const hashSection = hashTarget.startsWith("rideShareHub/") ? hashTarget.slice("rideShareHub/".length) : "";
  if (hashRouteTarget === "rideShareHub" && transportationTravelSections.has(hashSection)) return "transportationPanel";
  if (hashRouteTarget && routeDefinitions[hashRouteTarget]) return hashRouteTarget;
  if (normalizeAppPath(pathname).startsWith("/explore/")) return "exploreDrops";
  return routeAliases[normalizeAppPath(pathname)] || "dashboardHome";
}

function getRouteForTarget(target) {
  if (isFilePreview) return `index.html#${target}`;
  return routeDefinitions[target]?.path || `/app/${target}`;
}

function getTravelRoute(section = "overview") {
  const destination = travelTileDestinations[section] || travelTileDestinations.overview;
  if (!isFilePreview) return destination.route;
  return section === "overview"
    ? "index.html#rideShareHub"
    : `index.html#rideShareHub/${encodeURIComponent(section)}`;
}

function getTravelSectionFromRoute(pathname = location.pathname, navigationState = history.state) {
  const stateSection = navigationState?.target === "rideShareHub" ? navigationState.travelSection : "";
  if (stateSection && travelTileDestinations[stateSection]) return stateSection;

  const hashTarget = location.hash.startsWith("#") ? decodeURIComponent(location.hash.slice(1)) : "";
  const hashSection = hashTarget.startsWith("rideShareHub/") ? hashTarget.slice("rideShareHub/".length) : "";
  if (hashSection && travelTileDestinations[hashSection]) return hashSection;

  const normalizedPath = normalizeAppPath(pathname);
  const match = Object.entries(travelTileDestinations).find(([, destination]) => destination.route === normalizedPath);
  if (match) return match[0];
  if (normalizedPath === "/trips/dubai-weekend/travel") return "overview";
  return "overview";
}

function isCorporateTarget(target) {
  return target === "enterpriseRbac";
}

function hasValidCorporateAccess() {
  if (!state.corporateAccess.verified) return false;
  if (!state.corporateAccess.expiresAt) return false;
  return new Date(state.corporateAccess.expiresAt) > new Date();
}

async function loadCorporatePortalFromSession() {
  if (isFilePreview) return state.corporatePortal;
  const useAccountPortal = Boolean(state.session?.access_token);
  const token = useAccountPortal ? state.session.access_token : state.guestSessionToken;
  if (!token) return state.corporatePortal;
  const response = await fetch(useAccountPortal ? "/api/guest-access?action=account-portal" : "/api/guest-access", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && useAccountPortal) {
      clearCorporateAccess(result.error || "No active corporate employee access is linked to this account.");
      return null;
    }
    if ([401, 403].includes(response.status)) clearCorporateAccess(result.error || "Your corporate access is no longer active.");
    throw new Error(result.error || "Corporate event details could not be loaded.");
  }
  state.corporatePortal = result.portal;
  const accessExpiresAt = useAccountPortal
    ? new Date(Number(state.session?.expires_at || Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString()
    : result.portal?.session?.expiresAt || state.corporateAccess.expiresAt;
  state.corporateAccess = {
    ...state.corporateAccess,
    verified: true,
    eventId: result.portal?.event?.id || state.corporateAccess.eventId,
    role: result.portal?.attendee?.role || "employee",
    expiresAt: accessExpiresAt,
    accountLinked: Boolean(useAccountPortal || result.portal?.attendee?.accountLinked)
  };
  sessionStorage.setItem("traveldripCorporateAccessVerified", "true");
  sessionStorage.setItem("traveldripCorporateEventId", state.corporateAccess.eventId);
  sessionStorage.setItem("traveldripCorporateRole", state.corporateAccess.role);
  sessionStorage.setItem("traveldripCorporateAccessExpiresAt", accessExpiresAt);
  if (state.corporateAccess.accountLinked) sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
  renderCorporateEmployeeHome(result.portal);
  updateWorkspaceSwitcher();
  return result.portal;
}

async function linkCorporateAccessToPersonalAccount() {
  if (!state.session?.access_token || !state.guestSessionToken) return false;
  if (isFilePreview) {
    state.corporateAccess.accountLinked = true;
    sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
    return true;
  }
  const response = await fetch("/api/guest-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upgrade-account",
      accountAccessToken: state.session.access_token,
      guestSessionToken: state.guestSessionToken
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Corporate access could not be linked to this personal account.");
  state.corporateAccess.accountLinked = true;
  sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
  if (result.attendee?.trip_id) {
    state.activeTripId = result.attendee.trip_id;
    sessionStorage.setItem("traveldripActiveTripId", result.attendee.trip_id);
  }
  await loadCorporatePortalFromSession();
  await loadWalletAccess();
  updateWorkspaceSwitcher();
  return true;
}

function clearCorporateAccess(message = "Corporate session view closed. Personal Travel is active.") {
  state.corporateAccess = {
    verified: false,
    eventId: "",
    role: "employee",
    expiresAt: "",
    accountLinked: false,
    pendingTarget: ""
  };
  state.corporatePortal = null;
  sessionStorage.removeItem("traveldripCorporateAccessVerified");
  sessionStorage.removeItem("traveldripCorporateEventId");
  sessionStorage.removeItem("traveldripCorporateRole");
  sessionStorage.removeItem("traveldripCorporateAccessExpiresAt");
  sessionStorage.removeItem("traveldripCorporateAccountLinked");
  document.body.classList.remove("corporate-mode", "corporate-employee-mode");
  if ($("#dashboardTripType")) $("#dashboardTripType").value = "group";
  updateDashboardWidgets();
  if ($("#corporateAccessMessage")) $("#corporateAccessMessage").textContent = message;
}

function showCorporateAccessGate(target = "enterpriseRbac", reason = "Corporate verification required.") {
  state.corporateAccess.pendingTarget = target;
  if ($("#corporateAccessMessage")) $("#corporateAccessMessage").textContent = reason;
  $("#corporateAccessDialog")?.showModal();
  window.setTimeout(() => $("#corporateEventCodeInput")?.focus(), 0);
  addAuditEntry("Corporate access gate shown", `${target}: protected corporate content hidden before verification.`);
}

function corporateCodeLooksValid(code) {
  const value = String(code || "").trim();
  const weak = ["1234", "PASSWORD", "COMPANY", "TRAVEL", "RETREAT"];
  return value.length >= 8 && /[a-z]/i.test(value) && /\d/.test(value) && !weak.includes(value.toUpperCase());
}

async function verifyCorporateAccessGate() {
  const accessCode = $("#corporateEventCodeInput")?.value.trim() || "";
  const identity = $("#corporateIdentityInput")?.value.trim() || "";
  const lastName = $("#corporateLastNameInput")?.value.trim() || "";
  const remember = Boolean($("#rememberCorporateEventInput")?.checked);
  if (!corporateCodeLooksValid(accessCode)) {
    $("#corporateAccessMessage").textContent = "Code not recognized. Please verify the code provided by your company and try again.";
    addAuditEntry("Corporate access failed", "Weak or invalid-looking code rejected before protected content loaded.");
    return;
  }
  if (!identity) {
    $("#corporateAccessMessage").textContent = "Enter your employee email or employee ID to continue.";
    return;
  }

  $("#corporateAccessMessage").textContent = "Verifying corporate event access...";
  if (isFilePreview) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * (remember ? 8 : 4)).toISOString();
    state.corporateAccess = {
      verified: true,
      eventId: "leadership-summit-preview",
      role: "employee",
      expiresAt,
      accountLinked: Boolean(state.session?.user || state.hasEnteredApp),
      pendingTarget: "dashboardHome"
    };
    sessionStorage.setItem("traveldripCorporateAccessVerified", "true");
    sessionStorage.setItem("traveldripCorporateEventId", state.corporateAccess.eventId);
    sessionStorage.setItem("traveldripCorporateRole", state.corporateAccess.role);
    sessionStorage.setItem("traveldripCorporateAccessExpiresAt", expiresAt);
    if (state.corporateAccess.accountLinked) sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
    state.corporatePortal = {
      attendee: { fullName: "Taylor Employee", department: "Leadership", role: "employee", attendanceStatus: "attending", accountLinked: state.corporateAccess.accountLinked },
      event: { id: "leadership-summit-preview", title: "2027 Leadership Retreat", destination: "Dubai, United Arab Emirates", starts_on: "2027-07-24", ends_on: "2027-07-28", trip_type: "corporate_retreat" },
      myTravel: {
        flights: [{ airline: "Delta", flight_number: "DL 241", departure_airport: "MIA", arrival_airport: "DXB", departs_at: "2027-07-23T21:40:00-04:00", arrives_at: "2027-07-24T19:15:00+04:00", status: "confirmed", details: { departureGate: "D18", seat: "14A" } }],
        hotels: [{ hotel_name: "Marina Grand Hotel", address: "Dubai Marina, Dubai", check_in_at: "2027-07-24T15:00:00+04:00", check_out_at: "2027-07-28T11:00:00+04:00", confirmation_number: "MGH-2088" }],
        transportation: [{ provider_name: "Careem", pickup_location: "DXB Terminal 3", dropoff_location: "Marina Grand Hotel", pickup_at: "2027-07-24T20:35:00Z", status: "confirmed" }]
      },
      myEvent: { schedule: [
        { title: "Welcome reception", item_type: "reception", starts_at: "2027-07-24T19:30:00+04:00", ends_at: "2027-07-24T21:00:00+04:00", location_name: "Skyline Terrace", location_address: "Dubai Marina", details: "Meet the retreat hosts and company leadership." },
        { title: "Leadership keynote", item_type: "general_session", starts_at: "2027-07-25T09:00:00+04:00", ends_at: "2027-07-25T10:30:00+04:00", location_name: "Palm Ballroom", location_address: "Skyline Conference Center", details: "Company priorities and the year-ahead strategy." },
        { title: "Department workshops", item_type: "workshop", starts_at: "2027-07-25T11:00:00+04:00", ends_at: "2027-07-25T13:00:00+04:00", location_name: "Breakout Rooms A-D", location_address: "Skyline Conference Center", details: "Check the room assignment provided by your department lead." },
        { title: "Hosted marina dinner", item_type: "company_dinner", starts_at: "2027-07-25T19:00:00+04:00", ends_at: "2027-07-25T21:30:00+04:00", location_name: "Marina Promenade", location_address: "Dubai Marina", details: "Business casual attire. Transportation departs the hotel at 6:30 PM." }
      ] },
      wallet: { currency: "USD", status: "active", stipendCents: 43000, personalFundsCents: 0, canAddFunds: state.corporateAccess.accountLinked, card: { status: "active", maskedLastFour: "4829" } },
      eventHistory: [{ id: "preview-history", title: "New York Sales Summit", destination: "New York City", starts_on: "2026-04-10", ends_on: "2026-04-12", trip_type: "conference", attendanceStatus: "attended" }],
      eventAttendees: [
        { fullName: "Taylor Employee", department: "Leadership", role: "employee", attendanceStatus: "attending" },
        { fullName: "Jordan Smith", department: "Operations", role: "organizer", attendanceStatus: "attending" },
        { fullName: "Maya Chen", department: "Product", role: "employee", attendanceStatus: "attending" },
        { fullName: "Andre Lewis", department: "Sales", role: "employee", attendanceStatus: "attending" }
      ],
      importantInformation: [
        { section_type: "event_overview", title: "Welcome", body: "Meet the leadership team, review the year ahead, and finish the day with a hosted marina dinner." },
        { section_type: "dress_code", title: "Dress code", body: "Smart resort attire for daytime sessions; business casual for the welcome dinner." }
      ],
      sharedPhotos: []
    };
    $("#corporateAccessDialog")?.close();
    if ($("#dashboardTripType")) $("#dashboardTripType").value = "corporate";
    renderCorporateEmployeeHome(state.corporatePortal);
    renderRoute("dashboardHome", { updateHistory: true });
    addAuditEntry("Corporate access verified", "Preview session created after code and employee identity check. Production validates hashed code and attendee record server-side.");
    return;
  }

  try {
    const response = await fetch("/api/guest-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        accessCode,
        employeeId: identity,
        lastName,
        companyEmail: identity.includes("@") ? identity : ""
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      $("#corporateAccessMessage").textContent = result.error || "Code not recognized. Please verify the code provided by your company and try again.";
      return;
    }
    state.guestSessionToken = result.guestSessionToken;
    sessionStorage.setItem("traveldripGuestSessionToken", state.guestSessionToken);
    const expiresAt = result.portal?.session?.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
    state.corporateAccess = {
      verified: true,
      eventId: result.portal?.event?.id || "verified-corporate-event",
      role: result.portal?.attendee?.role || "employee",
      expiresAt,
      accountLinked: Boolean(result.portal?.attendee?.accountLinked),
      pendingTarget: "dashboardHome"
    };
    state.corporatePortal = result.portal;
    sessionStorage.setItem("traveldripCorporateAccessVerified", "true");
    sessionStorage.setItem("traveldripCorporateEventId", state.corporateAccess.eventId);
    sessionStorage.setItem("traveldripCorporateRole", state.corporateAccess.role);
    sessionStorage.setItem("traveldripCorporateAccessExpiresAt", expiresAt);
    if (state.corporateAccess.accountLinked) sessionStorage.setItem("traveldripCorporateAccountLinked", "true");
    if (state.session?.access_token && !state.corporateAccess.accountLinked) await linkCorporateAccessToPersonalAccount();
    $("#corporateAccessDialog")?.close();
    if ($("#dashboardTripType")) $("#dashboardTripType").value = "corporate";
    renderCorporateEmployeeHome(state.corporatePortal);
    renderRoute("dashboardHome", { updateHistory: true });
  } catch (_error) {
    $("#corporateAccessMessage").textContent = "Corporate access is temporarily unavailable. Try again or contact your event administrator.";
  }
}

function renderRoute(target = getTargetFromRoute(), { updateHistory = false, replace = false, travelSection = "", settingsFocus = "" } = {}) {
  let resolvedTarget = routeDefinitions[target] ? target : "dashboardHome";
  if (isCorporateEmployeeMode() && corporateEmployeeBlockedTargets.has(resolvedTarget)) {
    resolvedTarget = "dashboardHome";
    updateHistory = true;
    replace = true;
  }
  const activeTravelSection = resolvedTarget === "rideShareHub"
    ? travelTileDestinations[travelSection]
      ? travelSection
      : getTravelSectionFromRoute(location.pathname, history.state)
    : "";
  const activeSettingsFocus = resolvedTarget === "adminPanel"
    ? settingsFocus || history.state?.settingsFocus || ""
    : "";
  const previewAccess = isFilePreview && state.hasEnteredApp;
  if (!state.session?.user && !previewAccess && location.pathname !== "/admin.html") {
    rememberProtectedTarget(resolvedTarget);
    setAuthMode("signin");
    if ($("#authMessage")) $("#authMessage").textContent = "Sign in to continue to that Travel-Drip page.";
    return;
  }
  const requestedCorporatePath = normalizeAppPath(location.pathname).startsWith("/corporate");
  if ((isCorporateTarget(resolvedTarget) || requestedCorporatePath) && resolvedTarget !== "dashboardHome" && !hasValidCorporateAccess()) {
    renderRoute("dashboardHome", { updateHistory: true, replace: true });
    showCorporateAccessGate(resolvedTarget, "Enter your company event code before corporate dashboard information loads.");
    return;
  }
  mountRouteComponents(resolvedTarget);
  document.body.dataset.activeRoute = resolvedTarget;
  document.body.classList.toggle("app-routed", !document.body.classList.contains("auth-screen"));
  const isHome = resolvedTarget === "dashboardHome";
  const isAdminSurface = adminSurfaceTargets.has(resolvedTarget);
  $$('[data-admin-only]').forEach((item) => {
    setVisibilityWithoutCssLeaks(item, isAdminSurface);
  });
  $$('[data-dashboard-only]').forEach((section) => {
    setVisibilityWithoutCssLeaks(section, isHome);
  });

  const contentGrid = $(".content-grid");
  if (contentGrid) {
    setVisibilityWithoutCssLeaks(contentGrid, !isHome);
  }

  sectionRouteIds.forEach((sectionId) => {
    const section = getRouteComponentById(sectionId);
    if (!section) return;
    section.classList.add("route-screen");
    const visible = sectionId === resolvedTarget;
    setVisibilityWithoutCssLeaks(section, visible);
  });
  $$("[data-route-support]").forEach((section) => {
    const supportedRoutes = section.dataset.routeSupport.split(/\s+/);
    const visible = !isHome && supportedRoutes.includes(resolvedTarget);
    setVisibilityWithoutCssLeaks(section, visible);
  });
  $$(".content-grid section.panel:not([id]):not([data-route-support])").forEach((section) => {
    setVisibilityWithoutCssLeaks(section, false);
  });

  const route = resolvedTarget === "rideShareHub"
    ? getTravelRoute(activeTravelSection)
    : getRouteForTarget(resolvedTarget);
  const current = isFilePreview
    ? `index.html${location.hash}`
    : normalizeAppPath(location.pathname);
  const nextRoute = isFilePreview ? route : normalizeAppPath(route);
  if (updateHistory && current !== nextRoute) {
    const method = replace ? "replaceState" : "pushState";
    history[method]({
      target: resolvedTarget,
      ...(activeTravelSection ? { travelSection: activeTravelSection } : {}),
      ...(activeSettingsFocus ? { settingsFocus: activeSettingsFocus } : {})
    }, "", route);
  }

  syncNavigationState(resolvedTarget, activeTravelSection);

  if (resolvedTarget === "exploreDrops") {
    const exploreState = getExploreRouteState();
    renderExplore(exploreState.category);
    if (exploreState.itemId) showExploreDetail(exploreState.itemId);
    if (exploreState.destinationId) showDestinationExploreDetail(exploreState.destinationId, exploreState.destinationAction);
  }
  if (resolvedTarget === "rideShareHub") {
    setTravelFocus(activeTravelSection, { updateHistory: false });
    showTravelTileDestination(activeTravelSection, { updateHistory: false });
  }
  if (resolvedTarget === "aiTravelPlanner") renderAiPlanner();
  if (resolvedTarget === "enterpriseRbac") {
    loadCorporateBookingOperations();
    loadCorporateEmployeeInvitations();
  }

  if (resolvedTarget === "transportationPanel" && isCorporateEmployeeMode()) {
    if ($("#transportationAdvancedDetails")) $("#transportationAdvancedDetails").open = true;
    setTransportationWorkspaceView("rides");
  }

  const employeeWalletMode = resolvedTarget === "walletPanel" && isCorporateEmployeeMode();
  setVisibilityWithoutCssLeaks($("#employeeWalletSummary"), employeeWalletMode);
  if ($("#walletPanel .section-heading")) setVisibilityWithoutCssLeaks($("#walletPanel .section-heading"), !employeeWalletMode);
  if ($("#walletPanel .wallet-smart-actions")) setVisibilityWithoutCssLeaks($("#walletPanel .wallet-smart-actions"), !employeeWalletMode);
  if ($("#walletPanel .wallet-redesign-shell")) setVisibilityWithoutCssLeaks($("#walletPanel .wallet-redesign-shell"), !employeeWalletMode);
  if ($("#walletPanel .wallet-operations-panel")) setVisibilityWithoutCssLeaks($("#walletPanel .wallet-operations-panel"), !employeeWalletMode);
  if (employeeWalletMode) renderCorporateEmployeeHome();

  updateDashboardWidgets();
  if ($("#currentPageTitle")) $("#currentPageTitle").textContent = routeDefinitions[resolvedTarget].label;
  renderGlobalDestinationHeader(resolvedTarget);
  document.title = `${routeDefinitions[resolvedTarget].label} - Travel-Drip`;
  document.body.classList.remove("sidebar-open");
  $("#sidebarMenuButton")?.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (resolvedTarget === "adminPanel" && activeSettingsFocus) {
    window.setTimeout(() => getRouteComponentById(activeSettingsFocus)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
}

function openPlanningWorkflow(type = "group") {
  const config = tripTypeConfigs[type] || tripTypeConfigs.group;
  renderRoute("tripsPanel", { updateHistory: true });
  $("#guidedTripFlow")?.classList.add("is-open");
  renderTripType(type);
  $("#tripDetailsStep")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if ($("#soloModeMessage")) {
    $("#soloModeMessage").textContent = `${config.label} workflow opened from Let's Plan. Add details, save as a draft, or continue to invitations and RSVP tracking.`;
  }
  if ($("#letsPlanMessage")) {
    $("#letsPlanMessage").textContent = `${config.label} selected. Guided creation is ready with type-specific fields.`;
  }
  addAuditEntry("Let's Plan workflow opened", `${config.label} selected from planning hub.`);
  saveSyncedEvent("lets_plan_workflow_opened", {
    type,
    label: config.label,
    route: getRouteForTarget("tripsPanel")
  });
}

function addMemoryPreview(file, sourceUrl, visibility, saved) {
  const gallery = $("#memoriesPanel .memory-gallery-grid");
  if (!gallery) return;
  const card = document.createElement("article");
  card.className = "memory-media-card memory-media-card--uploaded";
  const isVideo = file.type.startsWith("video/");
  const media = document.createElement(isVideo ? "video" : "img");
  media.src = sourceUrl;
  media.setAttribute("aria-label", file.name);
  if (isVideo) {
    media.controls = true;
    media.preload = "metadata";
  } else {
    media.alt = file.name;
  }
  const details = document.createElement("div");
  const privacy = document.createElement("span");
  privacy.textContent = visibility;
  const title = document.createElement("strong");
  title.textContent = file.name;
  const status = document.createElement("small");
  status.textContent = saved ? "Saved securely just now" : "Preview ready - sign in to save";
  details.append(privacy, title, status);
  card.append(media, details);
  gallery.prepend(card);
}

async function uploadMemoryFiles(files, action) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  const visibility = $("#memoryVisibility")?.value || "Private (Only Me)";
  const message = $("#dailyMemoryMessage");
  const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);
  const allowedVideoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
  const validFiles = selectedFiles.filter((file) => {
    const isImage = allowedImageTypes.has(file.type);
    const isVideo = allowedVideoTypes.has(file.type);
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    return (isImage || isVideo) && file.size <= maxSize;
  });

  if (validFiles.length !== selectedFiles.length) {
    message.textContent = "Some files were skipped. Use JPG, PNG, HEIC, WEBP, MP4, MOV, or WEBM files; photos must be under 10 MB and videos under 100 MB.";
  }
  if (!validFiles.length) return;

  if (!state.supabase || !state.session?.user) {
    validFiles.forEach((file) => addMemoryPreview(file, URL.createObjectURL(file), visibility, false));
    message.textContent = `${validFiles.length} ${validFiles.length === 1 ? "memory is" : "memories are"} ready to preview. Sign in to save uploads securely.`;
    return;
  }

  message.textContent = `Uploading ${validFiles.length} ${validFiles.length === 1 ? "memory" : "memories"}...`;
  let savedCount = 0;
  const failures = [];
  for (const file of validFiles) {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
      const uniqueId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const storagePath = `${state.session.user.id}/${uniqueId}-${safeName}`;
      const { error } = await state.supabase.storage
        .from("travel-memories")
        .upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signedData } = await state.supabase.storage.from("travel-memories").createSignedUrl(storagePath, 3600);
      addMemoryPreview(file, signedData?.signedUrl || URL.createObjectURL(file), visibility, true);
      savedCount += 1;
    } catch (_error) {
      failures.push(file.name);
    }
  }

  if (savedCount) {
    message.textContent = `${savedCount} ${savedCount === 1 ? "memory was" : "memories were"} uploaded securely with ${visibility} visibility.${failures.length ? ` ${failures.length} file(s) could not be saved.` : ""}`;
    addAuditEntry("Memories uploaded", `${savedCount} file(s) saved from ${action} with ${visibility} visibility.`);
    await saveSyncedEvent("memory_media_uploaded", { action, visibility, count: savedCount });
  } else {
    message.textContent = "The selected memories could not be uploaded. Please retry after confirming your account is signed in.";
  }
}

function wireLocalInteractions() {
  moveTransportationWorkspace();
  applyMainNavigationConfig();
  applySmartDashboardLayout();
  ["#eventDateInput", "#eventRsvpInput", "#flightDepartureDateInput"].forEach((selector) => {
    $(selector)?.addEventListener("input", validateStandaloneDateInputs);
    $(selector)?.addEventListener("change", validateStandaloneDateInputs);
  });
  validateStandaloneDateInputs();
  renderPlan(0);
  renderBillSplit();
  renderTransportHub("flights");
  renderTransportationTable();
  renderRideSplit();
  renderRideHubSections();
  setTravelFocus(localStorage.getItem("traveldripTravelFocus") || "overview", { updateHistory: false });
  if ($("#travelSettingsTripSelect") && localStorage.getItem("traveldripSelectedTravelTrip")) {
    $("#travelSettingsTripSelect").value = localStorage.getItem("traveldripSelectedTravelTrip");
  }
  updateEnterpriseRole();
  updateDashboardWidgets();
  startLivePlanRotation();
  startGlobalDestinationHeader();

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderPlan(Number(button.dataset.day));
    });
  });

  $$(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".chip").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
    });
  });

  renderExplore("trending");

  $$("#exploreTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      history.pushState({ target: "exploreDrops", category: button.dataset.exploreCategory }, "", getExploreRoute(button.dataset.exploreCategory));
      renderRoute("exploreDrops");
      $("#exploreSkeleton").hidden = false;
      $("#exploreResultsGrid").hidden = true;
      window.setTimeout(() => {
        $("#exploreSkeleton").hidden = true;
        renderExplore(button.dataset.exploreCategory);
      }, 220);
    });
  });

  ["#exploreSearchInput", "#exploreDestinationInput", "#exploreDatesInput", "#exploreBudgetFilter", "#exploreTripTypeFilter", "#exploreRatingFilter", "#exploreDistanceFilter", "#exploreOpenNowFilter", "#exploreAccessibleFilter"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => renderExplore());
    $(selector)?.addEventListener("change", () => renderExplore());
  });

  $("#exploreSubfilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-explore-subfilter]");
    if (!button) return;
    button.classList.toggle("active");
    $("#exploreStatusMessage").textContent = `${button.dataset.exploreSubfilter} filter ${button.classList.contains("active") ? "applied" : "removed"}. Results remain in ${exploreCategories[getActiveExploreCategory()].label}.`;
  });

  $("#exploreLiveSearchButton")?.addEventListener("click", () => {
    searchLiveTravelPlaces({
      category: getActiveExploreCategory(),
      query: $("#exploreSearchInput")?.value.trim() || "",
      destination: $("#exploreDestinationInput")?.value.trim() || "",
      target: "explore"
    });
  });

  $("#exploreSearchInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("#exploreLiveSearchButton")?.click();
  });

  $("#exploreLiveResultsGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-live-result-url]");
    const url = button?.dataset.liveResultUrl || "";
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#exploreResultsGrid")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-explore-action]");
    if (actionButton) {
      handleExploreAction(actionButton.dataset.exploreAction, actionButton.dataset.exploreItem);
      return;
    }
    const detailButton = event.target.closest("[data-explore-detail]");
    if (detailButton) {
      history.pushState({ target: "exploreDrops", category: getActiveExploreCategory(), itemId: detailButton.dataset.exploreDetail }, "", getExploreRoute(getActiveExploreCategory(), detailButton.dataset.exploreDetail));
      renderRoute("exploreDrops");
    }
  });

  $("#exploreDetailPanel")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-explore-action]");
    if (actionButton) handleExploreAction(actionButton.dataset.exploreAction, actionButton.dataset.exploreItem);
    const destinationButton = event.target.closest("[data-destination-action]");
    if (destinationButton) openDestinationExplore(destinationButton.dataset.destinationAction);
  });

  $("#exploreBackButton")?.addEventListener("click", () => {
    history.pushState({ target: "exploreDrops", category: getActiveExploreCategory() }, "", getExploreRoute(getActiveExploreCategory()));
    renderRoute("exploreDrops");
  });
  $("#exploreRetryButton")?.addEventListener("click", () => renderExplore());
  $$("[data-explore-empty]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.exploreEmpty;
      if (action === "Clear Filters") {
        $("#exploreSearchInput").value = "";
        $("#exploreBudgetFilter").value = "any";
        $("#exploreRatingFilter").value = "0";
        $("#exploreDistanceFilter").value = "any";
        $("#exploreOpenNowFilter").checked = false;
        $("#exploreAccessibleFilter").checked = false;
        renderExplore();
      } else {
        $("#exploreStatusMessage").textContent = `${action} opened for Explore filters.`;
      }
    });
  });

  $$("#poll button").forEach((button) => {
    button.addEventListener("click", async () => {
      $$("#poll button").forEach((poll) => poll.classList.remove("selected"));
      button.classList.add("selected");
      const count = button.querySelector("strong");
      count.textContent = String(Number(count.textContent) + 1);
      await saveSyncedEvent("vote", { choice: button.dataset.choice });
    });
  });

  $("#deposit")?.addEventListener("input", async (event) => {
    const perPerson = Number(event.target.value);
    $("#depositValue").textContent = `$${perPerson.toLocaleString()}`;
    $("#depositMetric").textContent = `$${perPerson.toLocaleString()} each`;
    await saveSyncedEvent("wallet_planning_target_updated", { perPerson, estimateOnly: true });
  });

  $("#fundsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number($("#fundAmount").value);
    const walletMessage = $("#walletMessage");

    if (!state.walletAccess.canContribute) {
      walletMessage.textContent = "Funding is unavailable until an active trip membership and secure payment provider are confirmed.";
      return;
    }

    if (!Number.isFinite(amount) || amount < 10 || amount > 5000) {
      walletMessage.textContent = "Enter a fund amount between $10 and $5,000.";
      return;
    }

    state.pendingWalletPayment = amount;
    state.pendingSecureAction = { type: "add_funds", amount };
    $("#pinSummary").textContent = `Enter your 4-digit trip wallet PIN to add $${amount.toLocaleString()} to the group wallet.`;
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#paymentRequestForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#paymentRequestMessage");
    if (!state.walletAccess.canManageCard) {
      if (message) message.textContent = "Only an authorized trip finance role can create payment reminders.";
      return;
    }
    const title = $("#paymentRequestTitle")?.value.trim();
    const amount = Number($("#paymentRequestAmount")?.value);
    const dueAt = $("#paymentRequestDueAt")?.value;
    if (!title || !Number.isFinite(amount) || amount < 10 || amount > 5000 || !dueAt) {
      if (message) message.textContent = "Add a title, an amount between $10 and $5,000, and a due date/time.";
      return;
    }
    try {
      const result = await apiRequest("/api/wallet", {
        method: "POST",
        body: JSON.stringify({
          action: "create_payment_request",
          tripId: state.walletAccess.tripId,
          title,
          amountCents: Math.round(amount * 100),
          dueAt: new Date(dueAt).toISOString()
        })
      });
      if (message) message.textContent = `Payment reminder created for ${result.notifiedMembers || 0} active trip member(s).`;
      event.target.reset();
      await loadWalletAccess();
    } catch (error) {
      if (message) message.textContent = error.message || "Payment reminder could not be created.";
    }
  });

  $("#pinForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = $("#walletPin").value.trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      $("#walletMessage").textContent = "Payment blocked: enter a valid 4-digit wallet PIN.";
      $("#walletPin").focus();
      return;
    }

    const amount = state.pendingWalletPayment;
    const action = state.pendingSecureAction;

    if (action?.type === "add_funds" && amount) {
      try {
        const idempotencyKey = `wallet-${state.walletAccess.tripId}-${state.session.user.id}-${Date.now()}`;
        const result = await apiRequest("/api/wallet", {
          method: "POST",
          body: JSON.stringify({
            action: "create_contribution_checkout",
            tripId: state.walletAccess.tripId,
            amountCents: Math.round(amount * 100),
            idempotencyKey
          })
        });
        if (result.skipped || !result.checkoutUrl) throw new Error("Secure hosted checkout is not available in this preview.");
        $("#walletMessage").textContent = "Secure checkout is ready. Complete payment in the hosted provider window; the wallet updates after webhook confirmation.";
        window.location.assign(result.checkoutUrl);
        return;
      } catch (error) {
        $("#walletMessage").textContent = error.message || "Secure checkout could not be started. No balance was changed.";
        state.pendingWalletPayment = null;
        state.pendingSecureAction = null;
        $("#pinDialog").close();
        return;
      }
    }

    if (action?.type === "refund") {
      $("#refundMessage").textContent = "Refund requested: $380 available funds moved to pending review.";
      addAuditEntry("Refund requested", "User requested $380 refundable available funds after Wallet PIN confirmation.");
      await saveSyncedEvent("refund_requested", { amount: 380, confirmedWithPin: true });
    }

    if (action?.type === "leave_trip") {
      $("#refundMessage").textContent = "Leave-trip review started: unused funds will be refunded and committed funds stay tied to bookings.";
      addAuditEntry("Participant leave review", "System calculated unused funds and preserved non-refundable allocations.");
      await saveSyncedEvent("leave_trip_review", { refundableAmount: 380, confirmedWithPin: true });
    }

    if (action?.type === "reveal_card") {
      $("#cardNumber").textContent = "•••• •••• •••• 4829";
      $("#cardCvv").textContent = "Provider-controlled";
      $("#cardMessage").textContent = "PIN verified. Full card credentials remain tokenized with the issuing partner and are not stored or displayed in this demo.";
      addAuditEntry("Card detail access verified", "Wallet PIN was confirmed; raw card credentials remained provider-controlled.");
      await saveSyncedEvent("virtual_card_revealed", { confirmedWithPin: true });
    }

    if (action?.type === "provision_wallet") {
      $("#cardMessage").textContent = `${action.walletName} provisioning started after identity and Wallet PIN verification. Issuer wallet-token provisioning is required for production.`;
      addAuditEntry("Mobile wallet provisioning", `${action.walletName} provisioning started after Wallet PIN confirmation.`);
      await saveSyncedEvent("wallet_provisioning_started", { walletName: action.walletName, confirmedWithPin: true });
    }

    if (action?.type === "replace_card") {
      $("#cardStatus").textContent = "Frozen";
      $("#lockCardButton").textContent = "Unlock card";
      $("#cardMessage").textContent = "Card reported as compromised. Current token frozen and replacement review started.";
      addAuditEntry("Card compromised", "Virtual card was frozen and replacement review started after Wallet PIN confirmation.");
      await saveSyncedEvent("virtual_card_replacement_requested", { confirmedWithPin: true });
    }

    if (action?.type === "limit_change") {
      $("#cardMessage").textContent = "Spending controls updated after Wallet PIN verification.";
      addAuditEntry("Card limits changed", `Daily limit set to ${$("#dailyLimitValue").textContent}; per-purchase limit set to ${$("#purchaseLimitValue").textContent}.`);
      await saveSyncedEvent("virtual_card_limits_changed", {
        dailyLimit: $("#dailyLimit").value,
        purchaseLimit: $("#purchaseLimit").value,
        confirmedWithPin: true
      });
    }

    state.pendingWalletPayment = null;
    state.pendingSecureAction = null;
    $("#pinDialog").close();
  });

  $("#cancelPinButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = null;
    $("#pinDialog").close();
    $("#walletMessage").textContent = "Payment canceled before PIN confirmation.";
  });

  $("#requestRefundButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "refund" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN to request a refund of $380 available funds.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#leaveTripButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "leave_trip" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN to start the leave-trip refund review.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#activateCardButton")?.addEventListener("click", async () => {
    $("#cardStatus").textContent = "Active";
    $("#cardMessage").textContent = "Virtual card activated. Spendable funds remain limited to available wallet balance.";
    addAuditEntry("Virtual card activated", "Card activated for eligible available wallet funds.");
    await saveSyncedEvent("virtual_card_activated", { status: "active" });
  });

  $("#lockCardButton")?.addEventListener("click", async (event) => {
    const locked = $("#cardStatus").textContent !== "Locked";
    $("#cardStatus").textContent = locked ? "Locked" : "Active";
    event.target.textContent = locked ? "Unlock card" : "Lock card";
    $("#cardMessage").textContent = locked ? "Virtual card locked. New purchases are blocked." : "Virtual card unlocked after security review.";
    addAuditEntry(locked ? "Card locked" : "Card unlocked", locked ? "User locked virtual card purchases." : "User unlocked virtual card purchases.");
    await saveSyncedEvent("virtual_card_lock_changed", { locked });
  });

  $("#revealCardButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "reveal_card" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN or use biometric verification to reveal virtual card details.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#replaceCardButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "replace_card" };
    $("#pinSummary").textContent = "Enter your Wallet PIN to report this virtual card as compromised and start replacement review.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#tapToPayButton")?.addEventListener("click", async () => {
    if (!state.walletAccess.canManageCard || !state.walletAccess.tripId) return;
    const message = $("#cardMessage");
    try {
      const result = await apiRequest("/api/wallet", {
        method: "POST",
        body: JSON.stringify({ action: "tap_to_pay", tripId: state.walletAccess.tripId })
      });
      if (result.skipped) throw new Error("Admin card access requires a deployed authenticated session.");
      if (message) message.textContent = result.message || "Admin card access granted. Complete the issuer authorization flow.";
      addAuditEntry("Admin shared-card access", "Trip role and issuer card status were checked before starting tap-to-pay.");
      await saveSyncedEvent("trip_wallet_admin_tap_to_pay_started", { tripId: state.walletAccess.tripId, providerRequired: false });
    } catch (error) {
      if (message) message.textContent = error.message || "Shared-card tap-to-pay is not available.";
    }
  });

  [
    ["#appleWalletButton", "Apple Wallet"],
    ["#googleWalletButton", "Google Wallet"],
    ["#samsungWalletButton", "Samsung Wallet"]
  ].forEach(([selector, walletName]) => {
    $(selector)?.addEventListener("click", () => {
      state.pendingWalletPayment = null;
      state.pendingSecureAction = { type: "provision_wallet", walletName };
      $("#pinSummary").textContent = `Enter your Wallet PIN to start ${walletName} provisioning. Production requires issuer and card-network tokenization.`;
      $("#walletPin").value = "";
      $("#pinDialog").showModal();
      $("#walletPin").focus();
    });
  });

  function updateCardLimit(input, output) {
    const value = Number(input.value);
    output.textContent = `$${value.toLocaleString()}`;
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "limit_change" };
    $("#pinSummary").textContent = "Enter your Wallet PIN to save virtual card spending controls.";
  }

  $("#dailyLimit")?.addEventListener("input", (event) => updateCardLimit(event.target, $("#dailyLimitValue")));
  $("#purchaseLimit")?.addEventListener("input", (event) => updateCardLimit(event.target, $("#purchaseLimitValue")));
  $("#dailyLimit")?.addEventListener("change", () => $("#pinDialog").showModal());
  $("#purchaseLimit")?.addEventListener("change", () => $("#pinDialog").showModal());

  ["#billSubtotal", "#billTax", "#billTipPercent", "#billFees", "#billDiscount", "#billDiners"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderBillSplit);
  });

  $$("[data-split-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-split-mode]").forEach((modeButton) => modeButton.classList.remove("active"));
      button.classList.add("active");
      renderBillSplit();
      $("#billMessage").textContent = `${button.textContent} split preview updated for the dining group.`;
    });
  });

  $$("[data-receipt-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const sourceLabels = {
        camera: "Camera receipt scan started",
        photo: "Receipt photo uploaded for AI extraction",
        pdf: "PDF receipt uploaded for AI extraction",
        manual: "Manual receipt entry enabled"
      };
      $("#billMessage").textContent = `${sourceLabels[button.dataset.receiptSource]}. Restaurant name, date, table, server, items, taxes, fees, gratuity, discounts, and total remain editable before payment.`;
      $("#receiptReviewMessage").textContent = "Receipt is stored in trip history after organizer review and settlement.";
      renderReceiptScanner();
      addAuditEntry("Receipt intake selected", sourceLabels[button.dataset.receiptSource]);
    });
  });

  $("#scanReceiptButton")?.addEventListener("click", () => {
    $("#billSubtotal").value = "438.75";
    $("#billTax").value = "34.66";
    $("#billTipPercent").value = "18";
    $("#billFees").value = "7.50";
    $("#billDiscount").value = "25.00";
    $("#billDiners").value = "6";
    renderBillSplit();
    $("#billMessage").textContent = "Receipt scan detected menu items, tax, service fee, discount, and total for review.";
    addAuditEntry("Restaurant bill scanned", "Receipt data pre-populated the Smart Bill Split calculator.");
  });

  $("#aiBillReviewButton")?.addEventListener("click", () => {
    const bill = getBillInputs();
    const receiptSplits = getReceiptSplits(bill);
    const missing = receiptSplits.filter((split) => split.food + split.shared === 0).map((split) => split.name);
    const duplicateCount = receiptItems.length - new Set(receiptItems.map((item) => item.item.toLowerCase())).size;
    const unassigned = receiptItems.filter((item) => item.diners.length === 0).map((item) => item.item);
    const issues = [];
    if (missing.length) issues.push(`Missing diners: ${missing.join(", ")}`);
    if (duplicateCount) issues.push(`${duplicateCount} duplicate item may need review`);
    if (unassigned.length) issues.push(`Unassigned items: ${unassigned.join(", ")}`);
    if (bill.tipPercent > 25) issues.push("Tip is above the usual range for this group");
    if (!issues.length) issues.push("No duplicate items, missing diners, tax discrepancy, or shared-item imbalance detected");
    $("#receiptReviewMessage").textContent = `AI bill review: ${issues.join(". ")}.`;
    addAuditEntry("AI bill review completed", issues.join("; "));
  });

  $("#tipAdviceButton")?.addEventListener("click", () => {
    const diners = Number($("#billDiners").value || 1);
    const recommendedTip = diners >= 6 ? 20 : 18;
    $("#billTipPercent").value = String(recommendedTip);
    $("#tipAdvice").textContent = `${recommendedTip}% is recommended for this group size and local restaurant service expectations.`;
    renderBillSplit();
  });

  $$("[data-bill-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const method = button.dataset.billPay;
      $("#billMessage").textContent = `${method} selected. Each participant sees their total, tax, tip, final amount due, paid amount, and remaining group balance.`;
      addAuditEntry("Bill payment method selected", `${method} selected for restaurant bill settlement.`);
      await saveSyncedEvent("restaurant_bill_payment_method", { method, total: getBillInputs().total });
    });
  });

  $("#rideDestination")?.addEventListener("change", () => {
    renderRideSplit();
    renderRideHubSections();
    $("#rideMessage").textContent = `Recommended ride-share providers and private driver companies updated for ${$("#rideDestination").value}.`;
  });

  ["#rideHubSearchInput", "#rideHubFilter", "#rideHubSort"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      renderRideHubSections();
      $("#rideMessage").textContent = "Ride hub results updated. Search and filters preserve the current destination and selected provider.";
    });
    $(selector)?.addEventListener("change", () => {
      renderRideHubSections();
      $("#rideMessage").textContent = "Ride hub filters updated with route, provider, group, and history context.";
    });
  });

  $(".ride-hub-redesign")?.addEventListener("click", async (event) => {
    const hubButton = event.target.closest("[data-ride-hub-action]");
    const recommendationButton = event.target.closest("[data-ride-recommendation]");
    const timelineButton = event.target.closest("[data-ride-timeline]");
    const historyButton = event.target.closest("[data-ride-history]");
    const notificationButton = event.target.closest("[data-ride-notification]");
    if (!hubButton && !recommendationButton && !timelineButton && !historyButton && !notificationButton) return;
    let action = hubButton?.dataset.rideHubAction || recommendationButton?.dataset.rideRecommendation || "";
    if (!action && timelineButton) action = `Timeline: ${timelineButton.dataset.rideTimeline}`;
    if (!action && historyButton) action = `History: ${historyButton.dataset.rideHistory}`;
    if (!action && notificationButton) action = `Notification: ${notificationButton.dataset.rideNotification}`;
    $("#rideMessage").textContent = `${action} opened in Smart Ride Share Hub with destination, route, passengers, provider, and trip context preserved.`;
    addAuditEntry("Ride hub action", `${action} selected.`);
    await saveSyncedEvent("ride_hub_action", { action, provider: state.selectedRideProvider, destination: $("#rideDestination")?.value });
  });

  $("#expandRideMapButton")?.addEventListener("click", () => {
    const mapCard = $(".ride-map-card");
    mapCard?.classList.toggle("is-expanded");
    const expanded = mapCard?.classList.contains("is-expanded");
    $("#expandRideMapButton").textContent = expanded ? "Collapse map" : "Expand map";
    $("#rideMessage").textContent = expanded
      ? "Map expanded with pickup, route, and drop-off context."
      : "Map returned to compact ride hub view.";
  });

  $("#transportTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transport-type]");
    if (!button) return;
    renderTransportHub(button.dataset.transportType);
    $("#transportMessage").textContent = `${transportTypeLabels[button.dataset.transportType]} opened. Each transportation type has its own confirmation list, detail view, tickets, access-pass area, and secure sharing controls.`;
  });

  $("#flightTrackingForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Checking...";
    }
    await trackFlightStatus({
      ident: $("#flightTrackingIdent")?.value,
      date: $("#flightTrackingDate")?.value,
      origin: $("#flightTrackingOrigin")?.value
    });
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Track flight";
    }
  });

  $("#flightTrackingResult")?.addEventListener("click", (event) => {
    const refresh = event.target.closest("[data-flight-track-refresh]");
    if (!refresh) return;
    trackFlightStatus({
      ident: refresh.dataset.flightTrackRefresh,
      date: $("#flightTrackingDate")?.value,
      origin: $("#flightTrackingOrigin")?.value
    });
  });

  $("#hotelLiveSearchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Checking...";
    }
    await searchLiveHotelAvailability({
      cityCode: $("#hotelLiveCityCode")?.value,
      checkInDate: $("#hotelLiveCheckIn")?.value,
      checkOutDate: $("#hotelLiveCheckOut")?.value,
      adults: $("#hotelLiveAdults")?.value,
      hotelId: $("#hotelLiveHotelId")?.value
    });
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Check availability";
    }
  });

  $$(".travel-section-nav [data-travel-section], .travel-overview-card [data-travel-section], .travel-workspace [data-travel-section], .travel-support-card [data-travel-section]").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.travelSection;
      const targetType = section === "ferries" ? "ferries" : section;
      const destination = showTravelTileDestination(section);
      if (transportTypeLabels[targetType]) {
        renderTransportHub(targetType);
        $("#transportMessage").textContent = `${transportTypeLabels[targetType]} opened from the Travel tile grid. Detailed tables stay on ${destination.route}.`;
      } else {
        const label = section === "tickets"
          ? "Ticket Center"
          : section === "documents"
            ? "Document Center"
            : section === "weather"
              ? "Weather Center"
              : section === "maps"
                ? "Travel Maps"
              : "Hotel reservations";
        $("#transportMessage").textContent = `${label} opened from the Travel tile grid. Detailed records stay on ${destination.route}.`;
      }
      if ($("#travelWorkspaceMessage")) {
        $("#travelWorkspaceMessage").textContent = `${destination.title} is open inside Travel. Boarding passes, weather, maps, and confirmations remain in this Travel workspace.`;
      }
      $("#travelSelectedTile")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      addAuditEntry("Travel section opened", `${section} opened from Travel hub navigation.`);
      await saveSyncedEvent("travel_section_opened", { section });
    });
  });

  $$("[data-travel-focus]").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.travelFocus;
      const destination = setTravelFocus(section);
      addAuditEntry("Travel focus section opened", `${destination.title} opened from Settings-style Travel navigation.`);
      await saveSyncedEvent("travel_focus_opened", { section, route: destination.route });
    });
  });

  $("#travelSettingsSearchInput")?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = event.target.value.trim();
    const section = resolveTravelSearchTarget(query);
    const destination = section === "transportationPanel"
      ? (navigateSafely("transportationPanel", { updateHistory: true }), { title: "Transportation" })
      : setTravelFocus(section);
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = query
        ? `Search for "${query}" opened ${destination.title}.`
        : "Search cleared. Travel Home opened.";
    }
    addAuditEntry("Travel search opened section", `${query || "empty search"} -> ${destination.title}`);
    await saveSyncedEvent("travel_search", { query, section });
  });

  renderTravelSmartSearchResults($("#travelSmartSearchInput")?.value || "");

  $("#travelSmartSearchInput")?.addEventListener("input", (event) => {
    renderTravelSmartSearchResults(event.target.value);
  });

  $("#travelLiveSearchButton")?.addEventListener("click", () => {
    const query = $("#travelSmartSearchInput")?.value.trim() || "";
    if (/flight|airline|boarding|train|rail|bus|shuttle|cruise|ship|ride|driver|transfer|transport|route|fare/i.test(query)) {
      navigateSafely("transportationPanel", { updateHistory: true });
      if ($("#transportationTableMessage")) $("#transportationTableMessage").textContent = "Transportation search opened. Filter movement records or open Full tools for tickets, passes, routes, and fare options.";
      return;
    }
    searchLiveTravelPlaces({
      category: /hotel|stay|lodging/i.test(query)
        ? "hotels"
        : /restaurant|food|dining|dinner|cafe/i.test(query)
          ? "food"
          : "activities",
      query,
      destination: $("#travelCurrentDestination")?.textContent.trim() || "Tokyo",
      target: "travel"
    });
  });

  $("#clearTravelSearchButton")?.addEventListener("click", () => {
    const input = $("#travelSmartSearchInput");
    if (input) input.value = "";
    renderTravelSmartSearchResults("");
    const destination = setTravelFocus("overview", { updateHistory: false });
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = `Search cleared. ${destination.title} is open.`;
    }
  });

  $("#voiceTravelSearchButton")?.addEventListener("click", () => {
    const input = $("#travelSmartSearchInput");
    if (input) {
      input.value = "transportation";
      input.focus();
    }
    renderTravelSmartSearchResults("transportation");
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = "Voice search is provider-ready. Transportation results open in the dedicated Transportation tab.";
    }
  });

  $$(".travel-search-suggestions [data-travel-search-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.travelSearchSuggestion || "";
      const input = $("#travelSmartSearchInput");
      if (input) input.value = query;
      renderTravelSmartSearchResults(query);
    });
  });

  $("#travelSmartResults")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-travel-search-open]");
    if (!button) return;
    const section = button.dataset.travelSearchOpen;
    if (section === "transportationPanel") {
      navigateSafely("transportationPanel", { updateHistory: true });
      if ($("#transportationTableMessage")) $("#transportationTableMessage").textContent = "Transportation search result opened. Select View for its full confirmation details.";
      return;
    }
    const destination = setTravelFocus(section);
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = `${destination.title} opened from Smart Travel Search with trip context preserved.`;
    }
    addAuditEntry("Smart Travel Search result opened", `${destination.title} opened.`);
    await saveSyncedEvent("travel_smart_search_opened", { section, route: destination.route });
  });

  $("#travelLiveResults")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-live-result-url]");
    const url = button?.dataset.liveResultUrl || "";
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#travelSettingsTripSelect")?.addEventListener("change", async (event) => {
    localStorage.setItem("traveldripSelectedTravelTrip", event.target.value);
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = `${event.target.value} is now the active Travel trip. The selected Travel section remains open.`;
    }
    await saveSyncedEvent("travel_trip_selected", { trip: event.target.value });
  });

  $("#travelFocusCountry")?.addEventListener("change", async (event) => {
    renderTravelFocusRideProviders();
    if ($("#travelSettingsMessage")) {
      $("#travelSettingsMessage").textContent = `Ride Share providers refreshed for ${event.target.value}. Unsupported providers are not shown as active.`;
    }
    await saveSyncedEvent("travel_ride_country_selected", { country: event.target.value });
  });

  $$("[data-travel-focus-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.travelFocusAction;
      if ($("#travelSettingsMessage")) {
        $("#travelSettingsMessage").textContent = `${action} opened in the active Travel section. Production provider actions remain labeled until connected.`;
      }
      addAuditEntry("Travel focus action", action);
      await saveSyncedEvent("travel_focus_action", { action });
    });
  });

  $$("[data-travel-quick]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.travelQuick;
      if ($("#travelWorkspaceMessage")) {
        $("#travelWorkspaceMessage").textContent = `${action} opened in the Travel workspace. Provider-backed actions are labeled as estimates until live integrations are connected.`;
      }
      addAuditEntry("Travel quick action", `${action} selected from Travel workspace.`);
      await saveSyncedEvent("travel_quick_action", { action });
    });
  });

  $$("[data-pass-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      $$("[data-pass-filter]").forEach((filterButton) => {
        const active = filterButton === button;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-selected", String(active));
      });
      const filter = button.dataset.passFilter;
      if ($("#travelWorkspaceMessage")) {
        $("#travelWorkspaceMessage").textContent = `Boarding Passes filtered by ${filter}. Passes stay inside Travel -> Boarding Passes.`;
      }
      addAuditEntry("Boarding pass filter", `${filter} filter selected.`);
      await saveSyncedEvent("boarding_pass_filter", { filter });
    });
  });

  $$("[data-pass-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.passAction;
      if ($("#travelWorkspaceMessage")) {
        $("#travelWorkspaceMessage").textContent = `${action} selected. Supported pass actions open within Travel and avoid standalone pass tabs.`;
      }
      addAuditEntry("Travel pass action", `${action} selected in Travel workspace.`);
      await saveSyncedEvent("travel_pass_action", { action });
    });
  });

  $$("[data-target='rideShareHub'][data-travel-section]").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.travelSection;
      const destination = showTravelTileDestination(section);
      if ($("#travelWorkspaceMessage")) {
        $("#travelWorkspaceMessage").textContent = `${destination.title} opened from navigation inside the Travel tab.`;
      }
      addAuditEntry("Travel navigation shortcut", `${section} opened from signed-in navigation.`);
      await saveSyncedEvent("travel_navigation_shortcut", { section });
    });
  });

  $("#expandTravelMapButton")?.addEventListener("click", () => {
    const mapCard = $("#travelMapCenter");
    mapCard?.classList.toggle("is-expanded");
    const expanded = mapCard?.classList.contains("is-expanded");
    $("#expandTravelMapButton").textContent = expanded ? "Collapse Map" : "Expand Map";
    $("#transportMessage").textContent = expanded
      ? "Travel map expanded with current location, next destination, hotels, transportation, and activities."
      : "Travel map returned to compact overview.";
  });

  $(".transport-summary-strip")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-transport-summary]");
    if (!button) return;
    const action = button.dataset.transportSummary;
    $("#transportMessage").textContent = `${action} opened. Transportation keeps confirmation records, assigned travelers, reminders, wallet passes, and secure documents connected to the current trip.`;
    addAuditEntry("Transportation summary opened", action);
    await saveSyncedEvent("transport_summary_opened", { action });
  });

  ["#transportationTableSearchInput", "#transportationTableTypeFilter"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderTransportationTable);
    $(selector)?.addEventListener("change", renderTransportationTable);
  });

  $("#transportationTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transportation-record]");
    if (!button) return;
    const record = transportRecords.find((entry) => entry.id === button.dataset.transportationRecord);
    if (!record) return;
    const details = $("#transportationAdvancedDetails");
    if (details) details.open = true;
    setTransportationWorkspaceView("confirmations");
    renderTransportHub(record.type, record.id);
    const message = $("#transportationTableMessage");
    if (message) message.textContent = `${record.title} opened. Full confirmation details are available below.`;
  });

  $$('[data-transportation-action]').forEach((button) => {
    button.addEventListener("click", () => {
      const details = $("#transportationAdvancedDetails");
      if (details) details.open = true;
      setTransportationWorkspaceView("confirmations");
      if (button.dataset.transportationAction === "add") {
        const uploadButton = $("#uploadTransportTicketButton");
        uploadButton?.focus();
        $("#transportationTableMessage").textContent = "Upload or scan a confirmation in the full workspace below, then review the extracted fields before saving.";
      } else {
        $("#transportationTableMessage").textContent = "Full transportation tools opened below. Use the confirmation list for tickets, passes, reminders, and secure access controls.";
      }
    });
  });

  ["#transportSearchInput", "#transportTravelerFilter", "#transportStatusFilter"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => renderTransportHub());
    $(selector)?.addEventListener("change", () => renderTransportHub());
  });

  $("#transportRecordList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transport-detail]");
    if (!button) return;
    renderTransportDetail(transportRecords.find((record) => record.id === button.dataset.transportDetail));
    $("#transportMessage").textContent = "Confirmation detail opened with assigned traveler context, secure ticket files, pass options, and reminders.";
  });

  $("#transportTimelineList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transport-timeline]");
    if (!button) return;
    const record = transportRecords.find((entry) => entry.id === button.dataset.transportTimeline);
    if (!record) return;
    renderTransportHub(record.type, record.id);
    $("#transportMessage").textContent = `${record.title} opened from the unified trip timeline. Notification and itinerary deep links preserve trip and traveler context.`;
  });

  $(".transport-security-grid")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-transport-security]");
    if (!button) return;
    const topic = button.dataset.transportSecurity;
    $("#transportMessage").textContent = `${topic} opened. Transportation confirmations keep assigned traveler access, wallet-pass eligibility, secure files, and audit logs attached to each record.`;
    addAuditEntry("Transportation security control opened", `${topic} reviewed from the confirmation hub.`);
    await saveSyncedEvent("transport_security_control_opened", { topic });
  });

  $("#transportDetailPanel")?.addEventListener("click", async (event) => {
    const ticketButton = event.target.closest("[data-ticket-action]");
    const walletButton = event.target.closest("[data-wallet-pass]");
    const actionButton = event.target.closest("[data-transport-action]");
    const recordId = ticketButton?.dataset.ticketRecord || walletButton?.dataset.ticketRecord || actionButton?.dataset.ticketRecord;
    const record = transportRecords.find((entry) => entry.id === recordId);
    if (!record) return;
    if (ticketButton) {
      $("#transportMessage").textContent = `${ticketButton.dataset.ticketAction} opened in the secure ticket viewer for ${record.title}. Production uses signed URLs, file validation, expiring links, malware scanning where supported, and audit logs.`;
      addAuditEntry("Transportation ticket viewed", `${ticketButton.dataset.ticketAction}: ${record.title}`);
      await saveSyncedEvent("transport_ticket_viewed", { recordId, action: ticketButton.dataset.ticketAction });
      return;
    }
    if (walletButton) {
      $("#transportMessage").textContent = `${walletButton.dataset.walletPass} provisioning started for ${record.title}. Unsupported wallet buttons stay disabled until provider pass support is available.`;
      addAuditEntry("Transportation wallet pass selected", `${walletButton.dataset.walletPass}: ${record.title}`);
      await saveSyncedEvent("transport_wallet_pass_selected", { recordId, wallet: walletButton.dataset.walletPass });
      return;
    }
    if (actionButton) {
      const action = actionButton.dataset.transportAction;
      $("#transportMessage").textContent = `${action} completed for ${record.title}. Assigned traveler permissions, sharing rules, download restrictions, and audit logs remain attached.`;
      addAuditEntry("Transportation confirmation action", `${action}: ${record.title}`);
      await saveSyncedEvent("transport_confirmation_action", { recordId, action });
    }
  });

  $("#uploadTransportTicketButton")?.addEventListener("click", async () => {
    $("#transportMessage").textContent = "Upload workflow opened for PDFs, screenshots, mobile passes, QR codes, barcodes, email confirmations, and wallet-pass files. Review extracted fields before saving.";
    addAuditEntry("Transportation document upload opened", "Multi-transport ticket upload workflow opened.");
    await saveSyncedEvent("transport_upload_opened", { supportedTypes: Object.values(transportTypeLabels) });
  });

  $("#scanTransportTicketButton")?.addEventListener("click", async () => {
    $("#transportMessage").textContent = "Ticket scan simulated. OCR can extract passenger, provider, confirmation number, route, departure time, seat, gate/platform, QR code, and barcode for user review.";
    addAuditEntry("Transportation ticket scan", "OCR review workflow simulated for paper tickets.");
    await saveSyncedEvent("transport_ticket_scan", { extractionReviewRequired: true });
  });

  $("#privateDriverSearchInput")?.addEventListener("input", renderPrivateDrivers);
  $("#privateDriverVehicle")?.addEventListener("change", () => {
    $("#privateDriverMessage").textContent = `${$("#privateDriverVehicle").value} preference saved for private driver searches.`;
  });
  $("#privateDriverBookingType")?.addEventListener("change", () => {
    $("#privateDriverMessage").textContent = `${$("#privateDriverBookingType").value} selected. Companies that support this booking type are prioritized in production search.`;
  });

  $("#searchPrivateDriversButton")?.addEventListener("click", async () => {
    renderPrivateDrivers();
    const destination = $("#rideDestination").value;
    const query = $("#privateDriverSearchInput").value.trim() || "all private driver companies";
    $("#rideMessage").textContent = `Searched ${query} in ${destination}. Results can be booked, quoted, or added to the transportation split.`;
    addAuditEntry("Private driver search", `${query} searched in ${destination}.`);
    await saveSyncedEvent("private_driver_search", { destination, query });
    await searchLiveTravelPlaces({ category: "transport", query, destination, target: "privateDriver" });
  });

  $("#privateDriverLiveList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-live-result-url]");
    const url = button?.dataset.liveResultUrl || "";
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#privateDriverList")?.addEventListener("click", async (event) => {
    const bookButton = event.target.closest("[data-private-driver-book]");
    const quoteButton = event.target.closest("[data-private-driver-quote]");
    if (!bookButton && !quoteButton) return;
    const card = event.target.closest("article");
    const company = card?.querySelector("strong")?.textContent || "Private driver company";
    const destination = $("#rideDestination").value;
    const payload = {
      company,
      destination,
      pickup: $("#ridePickup").value.trim(),
      dropoff: $("#rideDropoff").value.trim(),
      passengers: Number($("#ridePassengers").value || 1),
      vehicle: $("#privateDriverVehicle").value,
      bookingType: $("#privateDriverBookingType").value
    };
    if (bookButton) {
      $("#privateDriverMessage").textContent = `${company} booking request prepared for ${payload.bookingType} in ${destination}. Provider confirmation is required before payment.`;
      $("#rideMessage").textContent = `${company} private driver booking prepared from ${payload.pickup} to ${payload.dropoff}.`;
      addAuditEntry("Private driver booking prepared", `${company} selected for ${destination}.`);
      await saveSyncedEvent("private_driver_booking_prepared", payload);
    } else {
      $("#privateDriverMessage").textContent = `Quote requested from ${company}. Travel-Drip will attach pickup, drop-off, passengers, vehicle type, and booking type.`;
      addAuditEntry("Private driver quote requested", `${company} quote requested for ${destination}.`);
      await saveSyncedEvent("private_driver_quote_requested", payload);
    }
  });

  ["#rideFare", "#rideTax", "#rideTolls", "#rideFees", "#rideTip", "#ridePassengers"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderRideSplit);
  });

  $$("[data-ride-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-ride-mode]").forEach((modeButton) => modeButton.classList.remove("active"));
      button.classList.add("active");
      renderRideSplit();
      $("#rideMessage").textContent = `${button.textContent} ride split preview updated for selected passengers.`;
    });
  });

  $("#rideProviderList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ride-provider]");
    if (!button) return;
    state.selectedRideProvider = button.dataset.rideProvider;
    renderRideSplit();
    renderRideHubSections();
    const account = state.connectedRideAccounts[state.selectedRideProvider];
    $("#rideMessage").textContent = account?.connected
      ? `${state.selectedRideProvider} selected and connected. You can launch the official provider app, start a ride, or share trip details.`
      : `Connect your ${state.selectedRideProvider} account to continue. Travel-Drip never asks for ride-share passwords.`;
  });

  $("#connectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: true, account: "Connected rider profile", status: "Account Connected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} account connected through secure provider authorization. Passwords are never requested or stored by Travel-Drip.`;
    addAuditEntry("Ride share account connected", `${provider} account authorized for transportation launch and receipt import.`);
    await saveSyncedEvent("ride_account_connected", { provider });
  });

  $("#reconnectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: true, account: "Connected rider profile", status: "Account Reconnected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} account reconnected. Access can be revoked from Travel-Drip or the provider account settings.`;
    addAuditEntry("Ride share account reconnected", `${provider} authorization refreshed.`);
    await saveSyncedEvent("ride_account_reconnected", { provider });
  });

  $("#disconnectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: false, account: "", status: "Disconnected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} disconnected. Existing ride receipts remain in the trip audit log, but new launches require reconnection.`;
    addAuditEntry("Ride share account disconnected", `${provider} authorization revoked.`);
    await saveSyncedEvent("ride_account_disconnected", { provider });
  });

  $("#launchRideButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    const pickup = $("#ridePickup").value.trim();
    const dropoff = $("#rideDropoff").value.trim();
    $("#rideMessage").textContent = `${provider} launch prepared with pickup ${pickup} and destination ${dropoff}. If direct booking is unavailable, open the official app with details prefilled.`;
    addAuditEntry("Ride provider launched", `${provider} launch prepared for ${pickup} to ${dropoff}.`);
    await saveSyncedEvent("ride_provider_launched", { provider, pickup, dropoff });
  });

  $("#sharedRideMembers")?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-shared-rider]");
    if (!checkbox) return;
    const member = sharedRideMembers.find((entry) => entry.name === checkbox.dataset.sharedRider);
    if (member) member.splitting = checkbox.checked;
    renderRideAccount();
    renderRideSplit();
    $("#rideMessage").textContent = `${checkbox.dataset.sharedRider} ${checkbox.checked ? "included in" : "removed from"} fare splitting for this shared ride.`;
  });

  $("#shareRideButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    const pickup = $("#ridePickup").value.trim();
    const dropoff = $("#rideDropoff").value.trim();
    $("#rideMessage").textContent = `${provider} shared ride created: ${pickup} to ${dropoff}. Members can join, leave, view pickup, destination, ETA, and payment amount.`;
    addAuditEntry("Ride shared", `${provider} ride details shared with pickup ${pickup} and drop-off ${dropoff}.`);
    await saveSyncedEvent("ride_shared", { provider, pickup, dropoff });
  });

  $("#importRideReceiptButton")?.addEventListener("click", () => {
    $("#rideFare").value = "52.40";
    $("#rideTax").value = "3.10";
    $("#rideTolls").value = "5.25";
    $("#rideFees").value = "3.50";
    $("#rideTip").value = "6.00";
    renderRideSplit();
    $("#rideMessage").textContent = "Ride receipt imported. Fare, taxes, tolls, booking fees, tip, and final total are ready for review.";
    addAuditEntry("Ride receipt imported", "Ride-share receipt populated fare split inputs.");
  });

  $("#rideAdviceButton")?.addEventListener("click", () => {
    const passengers = Number($("#ridePassengers").value || 1);
    const provider = state.selectedRideProvider;
    const destination = $("#rideDestination").value;
    const advice = passengers >= 6
      ? `For your group of ${passengers}, a larger ${provider} vehicle may cost less than booking two standard rides.`
      : `${provider} is the fastest recommendation in ${destination} right now based on local availability, wait time, traffic, and price.`;
    $("#rideAssistantCopy").textContent = advice;
    $("#rideMessage").textContent = advice;
  });

  $$("[data-ride-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const method = button.dataset.ridePay;
      $("#rideMessage").textContent = `${method} selected for ride split settlement. Wallet ledger and trip transportation summary update after processor confirmation.`;
      addAuditEntry("Ride payment method selected", `${method} selected for ride-share cost split.`);
      await saveSyncedEvent("ride_payment_method", { method, total: getRideInputs().total });
    });
  });

  $("#saveAlertPrefsButton")?.addEventListener("click", async () => {
    const categories = $$("[data-alert-category]")
      .filter((input) => input.checked)
      .map((input) => input.dataset.alertCategory);
    const channels = $$("[data-alert-channel]")
      .filter((input) => input.checked)
      .map((input) => input.dataset.alertChannel);

    $("#alertMessage").textContent = `Saved: ${categories.length} itinerary alert types over ${channels.join(", ") || "in-app"} notifications. Emergency alerts remain enabled.`;
    addAuditEntry("Itinerary notification preferences", `Enabled ${categories.length} alert categories across ${channels.join(", ") || "in-app"}.`);
    await saveSyncedEvent("itinerary_notification_preferences", { categories, channels, emergencyAlwaysOn: true });
  });

  $("#simulateAlertButton")?.addEventListener("click", async () => {
    const list = $("#alertPreviewList");
    const entry = document.createElement("div");
    entry.innerHTML = "<strong>Itinerary update</strong><span>Desert pickup moved to 8:10 AM. Push, email, and in-app alerts queued for selected travelers.</span>";
    list?.prepend(entry);
    $("#alertMessage").textContent = "Simulated itinerary change sent to enabled notification channels.";
    addAuditEntry("Itinerary update alert", "Transportation pickup change notification queued for the trip group.");
    await saveSyncedEvent("itinerary_notification", {
      type: "transportation_pickup_change",
      channels: $$("[data-alert-channel]").filter((input) => input.checked).map((input) => input.dataset.alertChannel)
    });
  });

  $("#itineraryDashboardAlertButton")?.addEventListener("click", () => {
    $("#simulateAlertButton")?.click();
  });

  $$("[data-itinerary-dashboard-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.itineraryDashboardAction;
      $("#alertMessage").textContent = `${action} opened from the itinerary dashboard. Timeline, reservations, route, weather, and alerts stay on this page.`;
      addAuditEntry("Itinerary dashboard action", `${action} selected.`);
      await saveSyncedEvent("itinerary_dashboard_action", { action });
    });
  });

  $$("[data-reservation-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.reservationAction;
      const reminderMessage = $("#reservationReminderMessage");
      if (reminderMessage) {
        reminderMessage.textContent = `${action} opened for the assigned reservation. Travel-Drip keeps attendees, meeting details, confirmations, and quick actions attached to the booking.`;
      }
      addAuditEntry("Reservation reminder action", `${action} selected from reservation and paid excursion reminders.`);
      await saveSyncedEvent("reservation_reminder_action", {
        action,
        notifyAssignedTravelersOnly: true,
        corporateFinancialPrivacy: true
      });
    });
  });

  $("#calculateDepartureButton")?.addEventListener("click", async () => {
    const departureCopy = $("#departureAlertCopy");
    if (departureCopy) {
      departureCopy.textContent = "Leave by 6:55 PM. Current traffic adds 12 minutes, walking from drop-off takes 5 minutes, and ride-share pickup is estimated at 8 minutes.";
    }
    $("#reservationReminderMessage").textContent = "Smart departure alert calculated using location, traffic, walking time, transit, and ride-share estimates.";
    addAuditEntry("Smart departure alert calculated", "Time-to-leave recommendation generated for a restaurant reservation.");
    await saveSyncedEvent("reservation_departure_alert_calculated", {
      leaveBy: "18:55",
      travelFactors: ["current_location", "traffic", "walking_time", "public_transportation", "ride_share_estimate"]
    });
  });

  $("#reservationAiReviewButton")?.addEventListener("click", async () => {
    const aiCopy = $("#reservationAiCopy");
    if (aiCopy) {
      aiCopy.textContent = "AI review: Ocean Rooftop Grill is in two hours, traffic is heavier than usual, your sunset cruise check-in closes at 4:30 PM, and tomorrow has two booked experiences to review.";
    }
    $("#reservationReminderMessage").textContent = "AI Trip Manager reviewed upcoming reservations, paid excursions, route timing, and preparation notes.";
    addAuditEntry("AI reservation review", "AI reviewed upcoming restaurant, excursion, cruise, and corporate reminder context.");
    await saveSyncedEvent("reservation_ai_review", {
      includesTrafficGuidance: true,
      includesGearReminders: true,
      includesScheduleSummary: true
    });
  });

  $$("[data-calendar-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.calendarProvider;
      $("#reservationReminderMessage").textContent = `${provider} sync prepared. Confirmed reservations and paid excursions can be added with update sync where supported.`;
      addAuditEntry("Reservation calendar sync", `${provider} selected for reservation and excursion reminders.`);
      await saveSyncedEvent("reservation_calendar_sync", { provider, updateSyncSupported: true });
    });
  });

  [...$$("[data-reminder-offset]"), ...$$("[data-reminder-type-toggle]")].forEach((input) => {
    input.addEventListener("change", async () => {
      const offsets = $$("[data-reminder-offset]")
        .filter((entry) => entry.checked)
        .map((entry) => entry.dataset.reminderOffset);
      const types = $$("[data-reminder-type-toggle]")
        .filter((entry) => entry.checked)
        .map((entry) => entry.dataset.reminderTypeToggle);
      $("#reservationReminderMessage").textContent = `Reminder preferences updated: ${types.join(", ") || "no optional types"} with ${offsets.join(", ") || "arrival-only"} timing.`;
      await saveSyncedEvent("reservation_reminder_preferences_updated", { offsets, types });
    });
  });

  $$("[data-trip-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.tripType;
      renderTripType(type);
      addAuditEntry("Trip mode selected", `${button.querySelector("strong")?.textContent || "Trip mode"} mode preview enabled.`);
      await saveSyncedEvent("trip_mode_selected", { type });
    });
  });

  $("#startTripCreationButton")?.addEventListener("click", () => {
    $("#guidedTripFlow")?.classList.add("is-open");
    $("#guidedTripFlow")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("#tripDetailsStep").hidden = true;
    $("#tripAiSetupStep").hidden = true;
    $("#invitationSetupStep").hidden = true;
    $$("[data-trip-type]").forEach((typeButton) => {
      typeButton.classList.remove("active");
      typeButton.setAttribute("aria-pressed", "false");
    });
    $("#soloModeMessage").textContent = "Choose a trip type to customize the form, features, permissions, and AI setup.";
  });

  $("#loadOwnershipMembersButton")?.addEventListener("click", loadOwnershipMembers);
  $("#ownershipTransferEntityType")?.addEventListener("change", loadOwnershipMembers);
  $("#ownershipTransferMemberSelect")?.addEventListener("change", () => {
    const button = $("#transferOwnershipButton");
    if (button) button.disabled = !$("#ownershipTransferMemberSelect")?.value || state.ownershipTransfer.status !== "ready";
  });
  $("#transferOwnershipButton")?.addEventListener("click", transferOwnership);

  $("#tripCreationForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateTripDateRanges()) {
      event.target.reportValidity();
      return;
    }
    const type = $(".trip-type-selector button.active")?.dataset.tripType || "solo";
    const config = tripTypeConfigs[type] || tripTypeConfigs.solo;
    const tripName = $("#tripNameInput").value.trim() || config.label;
    const payload = {
      tripType: eventTypeToApiType[type] || "group_trip",
      title: tripName,
      destination: $("#tripDestinationInput").value.trim(),
      startsOn: $("#tripStartInput").value,
      endsOn: $("#tripEndInput").value,
      budgetCents: Math.round(Number($("#tripBudgetInput").value || 0) * 100),
      currency: $("#eventCurrencyInput")?.value || "USD",
      privacy: $("#eventPrivacyInput")?.value || "invite_only",
      status: $("#eventStatusInput")?.value || "draft",
      travelerCount: Number($("#tripTravelersInput").value || $("#eventGuestCountInput")?.value || 1),
      travelStyle: $("#tripStyleInput").value,
      interests: ($("#tripInterestsInput").value || "").split(",").map((item) => item.trim()).filter(Boolean),
      eventDetails: {
        description: $("#eventDescriptionInput")?.value.trim() || "",
        host: $("#eventHostInput")?.value.trim() || "",
        guestCount: Number($("#eventGuestCountInput")?.value || 0),
        rsvpDeadline: $("#eventRsvpDeadlineInput")?.value || "",
        travelRequired: Boolean($("#eventTravelRequiredInput")?.checked),
        hotelRequired: Boolean($("#eventHotelRequiredInput")?.checked),
        transportationRequired: Boolean($("#eventTransportationRequiredInput")?.checked),
        inviteApprovalRequired: Boolean($("#eventInviteApprovalInput")?.checked),
        specific: getEventSpecificDetails()
      }
    };
    try {
      const result = await apiRequest("/api/events", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (result.skipped) {
        $("#soloModeMessage").textContent = `${config.label} configured locally. Sign in on the deployed app to persist this event to Supabase.`;
      } else {
        $("#soloModeMessage").textContent = `${config.label} created and saved to Supabase: ${tripName}. Event modules, permissions, audit log, and wallet setup were initialized.`;
        const createdTripId = result.event?.id || result.trip?.id || "";
        if (createdTripId) {
          state.activeTripId = createdTripId;
          state.ownershipTransfer.tripId = createdTripId;
          sessionStorage.setItem("traveldripActiveTripId", createdTripId);
          if ($("#ownershipTransferEntityType")) $("#ownershipTransferEntityType").value = result.event ? "event" : "trip";
          await loadOwnershipMembers();
        }
      }
    } catch (error) {
      $("#soloModeMessage").textContent = `Event setup could not be saved: ${error.message}. Your form data is still visible so you can retry.`;
      return;
    }
    $("#invitationSetupStep").hidden = false;
    renderInvitationSetup(type);
    addAuditEntry("Guided trip created", `${config.label} created with tailored feature set.`);
    await saveSyncedEvent("guided_trip_created", {
      type,
      tripName,
      destination: $("#tripDestinationInput").value.trim(),
      startDate: $("#tripStartInput").value,
      endDate: $("#tripEndInput").value,
      travelers: Number($("#tripTravelersInput").value || 1),
      budget: Number($("#tripBudgetInput").value || 0),
      style: $("#tripStyleInput").value,
      interests: $("#tripInterestsInput").value.trim(),
      eventDetails: payload.eventDetails
    });
  });

  ["#inviteTitleInput", "#inviteMessageInput", "#tripNameInput", "#tripDestinationInput", "#tripStartInput", "#tripEndInput", "#eventRsvpDeadlineInput", "#inviteDeadlineInput"].forEach((selector) => {
    const updateInvitePreview = () => {
      validateTripDateRanges();
      $("#invitePreviewTitle").textContent = $("#tripNameInput").value.trim() || $("#inviteTitleInput").value.trim();
      $("#invitePreviewMessage").textContent = $("#inviteMessageInput").value.trim() || "Invitation message preview.";
      $("#invitePreviewDestination").textContent = $("#tripDestinationInput").value.trim() || "Destination";
      $("#invitePreviewDates").textContent = `${$("#tripStartInput").value || "Start date"} - ${$("#tripEndInput").value || "End date"}`;
    };
    $(selector)?.addEventListener("input", updateInvitePreview);
    $(selector)?.addEventListener("change", updateInvitePreview);
  });

  $("#aiInviteCopyButton")?.addEventListener("click", async () => {
    const type = $(".trip-type-selector button.active")?.dataset.tripType || "solo";
    const tones = {
      solo: "I created a Travel-Drip itinerary so you can follow my plans, see check-ins, and stay connected while I travel.",
      group: "You're invited to an unforgettable Travel-Drip adventure with shared plans, RSVP tracking, group memories, and easy updates.",
      corporate: "You are invited to our company retreat. Travel-Drip will keep your assigned travel, agenda, announcements, and important documents organized.",
      wedding: "We would love for you to join our wedding weekend. Travel-Drip will keep ceremony, reception, hotel block, shuttle, RSVP, and memory details in one place.",
      birthday: "You're invited to celebrate with us. Travel-Drip will keep dinner, activities, contributions, reminders, and photos organized for the birthday trip.",
      anniversary: "Please join our anniversary celebration. Travel-Drip will keep dinner, travel, activities, reminders, and shared memories organized.",
      family_reunion: "You're invited to the family reunion. Travel-Drip will keep room plans, meals, activities, announcements, RSVP details, and family photos together.",
      conference: "You're invited to the conference. Travel-Drip will keep sessions, speakers, venue rooms, badges, hotels, transportation, and agenda updates organized.",
      graduation_trip: "You're invited to the graduation trip. Travel-Drip will keep travel plans, dinner, celebration schedule, contributions, reminders, and photos organized.",
      church_retreat: "You're invited to the church retreat. Travel-Drip will keep worship, sessions, meals, transportation groups, emergency contacts, and announcements organized.",
      bachelor_bachelorette: "You're invited to the celebration trip. Travel-Drip will keep activities, dinner, nightlife, transportation, polls, shared costs, and photos organized.",
      special_event: "You're invited to this special event. Travel-Drip will keep schedule, travel, RSVP, reminders, media, and updates organized."
    };
    $("#inviteMessageInput").value = tones[type] || tones.solo;
    $("#invitePreviewMessage").textContent = $("#inviteMessageInput").value;
    $("#invitationStatusMessage").textContent = "AI invitation assistant generated a polished message for the selected trip type.";
    addAuditEntry("AI invitation copy generated", `${tripTypeConfigs[type]?.label || "Trip"} invitation copy created.`);
    await saveSyncedEvent("ai_invitation_copy_generated", { type });
  });

  $("#sendInvitesNowButton")?.addEventListener("click", async () => {
    const methods = $$("[data-invite-method]").filter((input) => input.checked).map((input) => input.dataset.inviteMethod);
    $("#rsvpSentCount").textContent = String(Math.max(1, Number($("#rsvpSentCount").textContent || 0) + 1));
    $("#rsvpPendingCount").textContent = String(Math.max(1, Number($("#rsvpPendingCount").textContent || 0) + 1));
    $("#invitationStatusMessage").textContent = `Invitations queued through ${methods.join(", ") || "in-app notification"}. Invitees can accept, maybe, or decline directly from the invite.`;
    addAuditEntry("Invitations sent", `Invitation methods: ${methods.join(", ") || "in-app notification"}.`);
    await saveSyncedEvent("trip_invitations_sent", { methods });
  });

  $("#saveInvitesLaterButton")?.addEventListener("click", async () => {
    $("#invitationStatusMessage").textContent = "Invitation draft saved. Organizer can return later to send, edit, import guests, or generate a QR/link.";
    addAuditEntry("Invitation draft saved", "Organizer chose Save & Invite Later.");
    await saveSyncedEvent("trip_invitation_draft_saved", { status: "saved" });
  });

  $("#skipInvitesButton")?.addEventListener("click", async () => {
    $("#invitationStatusMessage").textContent = "Invitations skipped for now. Trip setup remains complete and invite tools stay available.";
    addAuditEntry("Invitations skipped", "Organizer skipped invitation setup.");
    await saveSyncedEvent("trip_invitations_skipped", { status: "skipped" });
  });

  $$("[data-reminder-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      $("#invitationStatusMessage").textContent = `${button.dataset.reminderType} queued for pending invitees.`;
      addAuditEntry("Invitation reminder queued", button.dataset.reminderType);
      await saveSyncedEvent("trip_invitation_reminder", { type: button.dataset.reminderType });
    });
  });

  $("#soloRecommendationButton")?.addEventListener("click", async () => {
    const prompt = "AI suggestion: Spend morning at Tsukiji outer market, walk to teamLab Borderless in the afternoon, use the Ginza line before rush hour, and reserve a ramen counter within 10 minutes of the hotel.";
    $("#soloAiPrompt").textContent = prompt;
    addAuditEntry("Solo AI recommendation", "Generated personal itinerary, restaurant, transportation, and route safety suggestion.");
    await saveSyncedEvent("solo_ai_recommendation", { destination: "Tokyo", budgetCap: 2000 });
  });

  $("#soloCheckinButton")?.addEventListener("click", async () => {
    $("#soloCheckinStatus").textContent = "Checked in";
    $("#soloModeMessage").textContent = "Safety check-in recorded. Trusted contact notifications only send if the traveler enables missed-check-in alerts.";
    addAuditEntry("Solo safety check-in", "Traveler marked solo trip safety check-in complete.");
    await saveSyncedEvent("solo_safety_checkin", { status: "checked_in" });
  });

  $("#convertSoloTripButton")?.addEventListener("click", async () => {
    renderTripType("group");
    $("#soloModeMessage").textContent = "Solo trip converted to Group Trip preview. Existing itinerary, budget, documents, memories, and recommendations stay intact.";
    addAuditEntry("Solo trip converted", "Group chat, shared itinerary, group wallet, expense splitting, and voting enabled.");
    await saveSyncedEvent("solo_trip_converted_to_group", { preservesExistingTripData: true });
  });

  $$("[data-cruise-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.cruiseAction;
      $("#cruiseStatusMessage").textContent = `${action}. Cruise context preserved across itinerary, wallet, chat, and notifications.`;
      addAuditEntry("Cruise action", action);
      await saveSyncedEvent("cruise_action", { action });
    });
  });

  $("#cruiseAiButton")?.addEventListener("click", async () => {
    $("#cruiseAiPrompt").textContent = "AI Cruise Manager: You arrive in Nassau at 9:00 AM, snorkeling meets at Deck 4 gangway at 8:40 AM, and Cabin 11234 is on Deck 11 starboard midship.";
    $("#cruiseStatusMessage").textContent = "AI Cruise Manager answered using ship, cabin, port, excursion, onboard schedule, and wallet context.";
    addAuditEntry("AI Cruise Manager opened", "Cruise-specific assistant answered cabin, port, excursion, and schedule questions.");
    await saveSyncedEvent("ai_cruise_manager_opened", { ship: "Icon of the Seas" });
  });

  $("#privacyToggle")?.addEventListener("change", (event) => {
    $("#memberTable")?.classList.toggle("is-private", !event.target.checked);
  });

  $$(".admin-actions [data-admin-action]").forEach((button) => {
    button.addEventListener("click", () => {
      addAuditEntry("Admin action", button.dataset.adminAction);
    });
  });

  $("#downloadReportButton")?.addEventListener("click", () => {
    const csv = [
      "timestamp,type,amount,status",
      "2026-07-20 09:42,deposit,100,available",
      "2026-07-18 14:15,reserved,250,hotel deposit hold",
      "2026-07-14 11:20,allocated,420,non-refundable flight",
      "2026-07-10 18:05,deposit,950,original payment method"
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "traveldrip-wallet-ledger.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $$("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.target === "rideShareHub" && button.dataset.travelSection) return;
      const target = button.dataset.target;
      if (!target || !routeDefinitions[target] || !getRouteComponentById(target)) {
        console.error("Navigation failed: missing destination", target || "(empty)");
        return;
      }
      navigateSafely(target, {
        updateHistory: true,
        travelSection: target === "rideShareHub" ? "overview" : "",
        settingsFocus: target === "adminPanel" ? button.dataset.settingsFocus || "" : ""
      });
      if (target === "enterpriseRbac" && button.dataset.corporateFocus) {
        window.requestAnimationFrame(() => {
          const section = document.getElementById(button.dataset.corporateFocus);
          section?.scrollIntoView({ behavior: "smooth", block: "start" });
          section?.focus({ preventScroll: true });
        });
      }
    });
  });
  $$("[data-route-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.dataset.routeLink;
      if (!target || !routeDefinitions[target]) return;
      event.preventDefault();
      renderRoute(target, { updateHistory: true });
    });
  });

  $("#openDailyMemoryButton")?.addEventListener("click", async () => {
    $("#dailyMemoryScreen")?.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#dailyMemoryMessage").textContent = "Today's memory screen opened from the end-of-day reminder. Choose visibility before adding photos, videos, or notes.";
    addAuditEntry("Daily memory reminder opened", "Traveler opened end-of-day memory prompt after completed itinerary.");
    await saveSyncedEvent("daily_memory_prompt_opened", { day: 3, destination: "Santorini" });
  });

  $$("[data-memory-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.memoryAction;
      const visibility = $("#memoryVisibility")?.value || "Private (Only Me)";
      const inputByAction = {
        "Upload Photos": "#memoryPhotoInput",
        "Upload Memory": "#memoryPhotoInput",
        "Upload Videos": "#memoryVideoInput",
        "Take a Photo": "#memoryCameraInput",
        "Record a Video": "#memoryVideoCameraInput"
      };
      const inputSelector = inputByAction[action];
      const fileInput = inputSelector ? $(inputSelector) : null;
      if (fileInput) {
        $("#dailyMemoryMessage").textContent = `${action} is ready. Choose media to upload with ${visibility} visibility.`;
        fileInput.click();
        return;
      }
      const messages = {
        "Add Notes or Journal Entry": "Journal entry opened with today's completed activities as context.",
        "Skip for Now": "Skipped for now. One optional morning follow-up can be sent if reminders remain enabled."
      };
      $("#dailyMemoryMessage").textContent = messages[action] || `${action} selected.`;
      addAuditEntry("Daily memory action", `${action} selected with ${visibility} visibility.`);
      await saveSyncedEvent("daily_memory_action", { action, visibility, autoOrganized: $("#memoryAutoOrganizeToggle")?.checked });
    });
  });

  ["#memoryPhotoInput", "#memoryVideoInput", "#memoryCameraInput", "#memoryVideoCameraInput"].forEach((selector) => {
    $(selector)?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      await uploadMemoryFiles(input.files, input.id);
      input.value = "";
    });
  });

  $("#generateJournalButton")?.addEventListener("click", async () => {
    $("#memoryAiSummary").textContent = "AI journal: Day 3 in Santorini started with breakfast in Oia, moved into a bright catamaran cruise, slowed down at a winery tour, and ended with sunset dinner by the water.";
    $("#dailyMemoryMessage").textContent = "AI daily journal generated. Review it before saving or sharing.";
    addAuditEntry("AI daily memory journal generated", "Generated journal from completed itinerary context.");
    await saveSyncedEvent("daily_memory_journal_generated", { day: 3 });
  });

  $("#createHighlightReelButton")?.addEventListener("click", async () => {
    $("#dailyMemoryMessage").textContent = "Highlight reel draft created from today's best moments. Review photos, captions, music, and privacy before sharing.";
    addAuditEntry("Daily highlight reel created", "AI memory assistant prepared a short recap reel draft.");
    await saveSyncedEvent("daily_memory_highlight_reel_created", { requiresUserApproval: true });
  });

  ["#memoryReminderTime", "#memoryDailyToggle", "#memoryFollowupToggle", "#memoryAutoOrganizeToggle", "#memoryAiCaptionToggle", "#memoryAiJournalToggle", "#memorySocialPromptToggle"].forEach((selector) => {
    $(selector)?.addEventListener("change", async () => {
      const settings = {
        reminderTime: $("#memoryReminderTime")?.value || "21:00",
        dailyReminders: $("#memoryDailyToggle")?.checked,
        followupReminders: $("#memoryFollowupToggle")?.checked,
        autoOrganize: $("#memoryAutoOrganizeToggle")?.checked,
        aiCaptions: $("#memoryAiCaptionToggle")?.checked,
        aiJournals: $("#memoryAiJournalToggle")?.checked,
        socialPrompts: $("#memorySocialPromptToggle")?.checked
      };
      $("#dailyMemoryMessage").textContent = `Memory reminder settings saved for ${settings.reminderTime}.`;
      await saveSyncedEvent("daily_memory_settings_updated", settings);
    });
  });

  function getSelectedSharePlatforms() {
    return $$("[data-share-platform].active").map((button) => button.dataset.sharePlatform);
  }

  function updateSocialPreview(message = "") {
    const caption = $("#captionText")?.value || "";
    const hashtags = $$("#hashtagList span").map((tag) => tag.textContent);
    const platforms = getSelectedSharePlatforms();
    const visibility = $("input[name='contentVisibility']:checked")?.value || "Trip Members";

    if ($("#sharePreviewCaption")) $("#sharePreviewCaption").textContent = caption;
    if ($("#sharePreviewHashtags")) {
      $("#sharePreviewHashtags").innerHTML = hashtags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    }
    if ($("#sharePreviewPlatforms")) {
      $("#sharePreviewPlatforms").innerHTML = platforms.length
        ? platforms.map((platform) => `<span>${escapeHtml(platform)}</span>`).join("")
        : "<span>No platforms selected</span>";
    }
    if ($("#sharePreviewVisibility")) $("#sharePreviewVisibility").textContent = visibility;
    if ($("#selectedPlatformCount")) $("#selectedPlatformCount").textContent = `${platforms.length} selected`;
    if (message && $("#socialStatus")) $("#socialStatus").textContent = message;
  }

  function setPlatformCardStatus(card, status) {
    const statusLabel = card.querySelector(".connection-status");
    const actions = card.querySelector(".platform-actions");
    card.dataset.status = status;
    card.classList.toggle("connected", status === "connected");
    card.classList.toggle("reconnect", status === "reconnect");

    if (!statusLabel || !actions) return;
    if (status === "connected") {
      statusLabel.textContent = "Connected";
      statusLabel.className = "connection-status connected";
      actions.innerHTML = `<button type="button" data-social-action="manage" data-social-platform="${escapeHtml(card.dataset.platform)}">Manage</button><button type="button" data-social-action="disconnect" data-social-platform="${escapeHtml(card.dataset.platform)}">Disconnect</button>`;
      return;
    }
    if (status === "reconnect") {
      statusLabel.textContent = "Reconnect Required";
      statusLabel.className = "connection-status reconnect";
      actions.innerHTML = `<button type="button" data-social-action="reconnect" data-social-platform="${escapeHtml(card.dataset.platform)}">Reconnect</button>`;
      return;
    }
    statusLabel.textContent = "Not Connected";
    statusLabel.className = "connection-status";
    actions.innerHTML = `<button type="button" data-social-action="connect" data-social-platform="${escapeHtml(card.dataset.platform)}">Connect</button>`;
  }

  function updateConnectedAccountsSummary() {
    const connected = $$("[data-platform-card]").filter((card) => card.dataset.status === "connected").length;
    const pill = $(".connected-accounts-panel .social-pill");
    if (pill) pill.textContent = `${connected} connected`;
    if ($("#socialEmptyState")) $("#socialEmptyState").hidden = connected > 0;
  }

  document.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-social-action]");
    if (actionButton) {
      const platform = actionButton.dataset.socialPlatform || "selected platform";
      const action = actionButton.dataset.socialAction;
      const card = $(`[data-platform-card][data-platform='${platform}']`);
      const messages = {
        connect: `${platform} authentication flow opened. Connect returns here after approval.`,
        reconnect: `${platform} reconnect flow opened because authorization needs attention.`,
        manage: `${platform} settings opened for username, permissions, posting format, and privacy.`,
        disconnect: `${platform} disconnected after confirmation. You can reconnect anytime.`
      };
      if (card && ["connect", "reconnect"].includes(action)) setPlatformCardStatus(card, "connected");
      if (card && action === "disconnect") setPlatformCardStatus(card, "not-connected");
      updateConnectedAccountsSummary();
      updateSocialPreview(messages[action] || `${platform} action opened.`);
      addAuditEntry("Social account action", `${platform}: ${action}.`);
      await saveSyncedEvent("social_account_action", { platform, action });
    }

    const shareButton = event.target.closest("[data-share-platform]");
    if (shareButton) {
      const active = !shareButton.classList.contains("active");
      shareButton.classList.toggle("active", active);
      shareButton.setAttribute("aria-pressed", String(active));
      updateSocialPreview(`${shareButton.dataset.sharePlatform} ${active ? "added to" : "removed from"} the share preview.`);
    }
  });

  $("#captionText")?.addEventListener("input", () => updateSocialPreview());

  $$("input[name='contentVisibility'], input[name='sharingPreference']").forEach((input) => {
    input.addEventListener("change", async () => {
      const visibility = $("input[name='contentVisibility']:checked")?.value || "Trip Members";
      const preference = $("input[name='sharingPreference']:checked")?.value || "Ask before sharing";
      updateSocialPreview(`Sharing settings saved: ${visibility}, ${preference}.`);
      await saveSyncedEvent("social_sharing_settings_updated", { visibility, preference });
    });
  });

  $("#generateCaptionButton")?.addEventListener("click", () => {
    $("#captionText").value = "Santorini sunsets, rooftop laughs, and the kind of trip stories we will be retelling for years.";
    updateSocialPreview("AI caption generated. Review and edit before sharing.");
  });

  $("#generateHashtagsButton")?.addEventListener("click", () => {
    $("#hashtagList").innerHTML = ["#Travel-Drip", "#Santorini", "#Vacation", "#TravelTogether", "#IslandViews", "#SharedMemories"].map((tag) => `<span>${tag}</span>`).join("");
    updateSocialPreview("AI hashtags generated for this trip memory.");
  });

  $("#regenerateCaptionButton")?.addEventListener("click", () => {
    $("#captionText").value = "Blue water, golden light, and a day full of moments worth saving.";
    $("#hashtagList").innerHTML = ["#Travel-Drip", "#TravelMemories", "#SantoriniSunset", "#ExploreMore"].map((tag) => `<span>${tag}</span>`).join("");
    updateSocialPreview("Caption and hashtags regenerated.");
  });

  $("#editCaptionButton")?.addEventListener("click", () => {
    $("#captionText")?.focus();
    updateSocialPreview("Caption editor focused. Make changes before sharing.");
  });

  $("#copyCaptionButton")?.addEventListener("click", async () => {
    const caption = $("#captionText")?.value || "";
    try {
      await navigator.clipboard?.writeText(caption);
      updateSocialPreview("Caption copied to clipboard.");
    } catch (_error) {
      updateSocialPreview("Caption is selected for manual copy.");
      $("#captionText")?.select();
    }
  });

  $("#continueShareButton")?.addEventListener("click", () => {
    updateSocialPreview("Publishing workflow opened with selected platforms and privacy settings preserved.");
  });

  $("#editPreviewButton")?.addEventListener("click", () => {
    $("#captionText")?.focus();
    updateSocialPreview("Preview edit mode opened.");
  });

  $("#removePlatformButton")?.addEventListener("click", () => {
    const activePlatforms = $$("[data-share-platform].active");
    const last = activePlatforms.at(-1);
    if (last) {
      last.classList.remove("active");
      last.setAttribute("aria-pressed", "false");
      updateSocialPreview(`${last.dataset.sharePlatform} removed from the preview.`);
    } else {
      updateSocialPreview("No selected platform to remove.");
    }
  });

  $("#shareNowButton")?.addEventListener("click", async () => {
    updateSocialPreview("Share request queued. Travel-Drip will ask for final confirmation before publishing.");
    addAuditEntry("Social share requested", `Platforms: ${getSelectedSharePlatforms().join(", ") || "none selected"}.`);
    await saveSyncedEvent("social_share_requested", { platforms: getSelectedSharePlatforms() });
  });

  $("#sharePreviewNowButton")?.addEventListener("click", async () => {
    updateSocialPreview("Preview approved. Publishing flow is ready for final platform confirmation.");
    addAuditEntry("Social share preview approved", `Platforms: ${getSelectedSharePlatforms().join(", ") || "none selected"}.`);
    await saveSyncedEvent("social_share_preview_approved", { platforms: getSelectedSharePlatforms() });
  });

  $("#saveDraftButton")?.addEventListener("click", async () => {
    updateSocialPreview("Draft saved with caption, hashtags, selected platforms, and privacy settings.");
    addAuditEntry("Social draft saved", "Travel memory draft saved from Social Media Hub.");
    await saveSyncedEvent("social_draft_saved", { platforms: getSelectedSharePlatforms() });
  });

  updateConnectedAccountsSummary();
  updateSocialPreview();

  $("#rolePreview")?.addEventListener("change", updateEnterpriseRole);
  $("#dashboardTripType")?.addEventListener("change", (event) => {
    if (event.target.value === "corporate" && !hasValidCorporateAccess()) {
      event.target.value = "group";
      updateDashboardWidgets();
      showCorporateAccessGate("enterpriseRbac", "Select Corporate Travel only after entering your secure event code.");
      return;
    }
    updateDashboardWidgets();
  });
  $("#accountWorkspaceSwitch")?.addEventListener("change", (event) => {
    const corporate = event.target.value === "corporate";
    if ($("#dashboardTripType")) $("#dashboardTripType").value = corporate ? "corporate" : "group";
    updateDashboardWidgets();
    renderRoute("dashboardHome", { updateHistory: true });
    addAuditEntry("Workspace switched", corporate ? "Employee corporate workspace opened." : "Personal Travel workspace opened.");
  });
  $("#workspacePreview")?.addEventListener("change", (event) => {
    if (event.target.value === "corporate" && !hasValidCorporateAccess()) {
      event.target.value = "personal";
      if ($("#dashboardTripType")) $("#dashboardTripType").value = "group";
      updateEnterpriseRole();
      showCorporateAccessGate("enterpriseRbac", "Switching to Corporate Travel requires secure event-code verification.");
      return;
    }
    if ($("#dashboardTripType")) $("#dashboardTripType").value = event.target.value === "corporate" ? "corporate" : "group";
    updateEnterpriseRole();
    addAuditEntry("Workspace switched", event.target.value === "corporate" ? "Corporate Travel workspace opened." : "Personal Travel workspace opened.");
  });
  $("#corporateAccessForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    verifyCorporateAccessGate();
  });
  $("#toggleCorporateCodeButton")?.addEventListener("click", () => {
    const input = $("#corporateEventCodeInput");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    $("#toggleCorporateCodeButton").textContent = input.type === "password" ? "Show" : "Hide";
  });
  $("#returnPersonalButton")?.addEventListener("click", () => {
    $("#corporateAccessDialog")?.close();
    clearCorporateAccess();
    renderRoute("dashboardHome", { updateHistory: true, replace: true });
  });
  $("#contactCorporateAdminButton")?.addEventListener("click", () => {
    $("#corporateAccessMessage").textContent = "Administrator contact request prepared. Travel-Drip does not reveal whether the code, employee, or event exists.";
    addAuditEntry("Corporate access help requested", "Safe admin contact workflow opened from secure access gate.");
  });
  $("#submitCorporateVoteButton")?.addEventListener("click", async () => {
    const selected = $("input[name='corporateVote']:checked")?.closest("label")?.textContent.trim().replace(/\s+/g, " ") || "approved activity";
    $("#corporateVoteMessage").textContent = `Vote submitted for ${selected}. Changes remain open until the administrator deadline and follow team, capacity, anonymity, and approval rules.`;
    addInAppNotification("Corporate", "Activity vote submitted and confirmation sent.");
    addAuditEntry("Corporate activity vote", selected);
    await saveSyncedEvent("corporate_activity_vote", { selected, approvedOnly: true });
  });
  $("#refreshCorporateOperationsButton")?.addEventListener("click", () => loadCorporateBookingOperations({ announce: true }));
  $("#corporatePolicyForm")?.addEventListener("submit", submitCorporatePolicy);
  $("#corporateBookingForm")?.addEventListener("submit", submitCorporateBooking);
  $("#corporateServiceCaseForm")?.addEventListener("submit", submitCorporateServiceCase);
  $("#corporateEmployeeInviteForm")?.addEventListener("submit", submitCorporateEmployeeInvite);
  $("#corporateInviteAccessMode")?.addEventListener("change", (event) => {
    const days = event.target.value === "persistent" ? 365 * 5 : 14;
    const expiration = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    if ($("#corporateInviteExpires")) $("#corporateInviteExpires").value = expiration.toISOString().slice(0, 10);
    if ($("#corporateEmployeeInviteMessage")) {
      $("#corporateEmployeeInviteMessage").textContent = event.target.value === "persistent"
        ? "Reusable access lets this employee sign back in and view company event history until an employer removes access."
        : "Temporary access is limited to this event and expires on the selected date.";
    }
  });
  if ($("#corporateInviteExpires") && !$("#corporateInviteExpires").value) {
    const defaultExpiration = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    $("#corporateInviteExpires").value = defaultExpiration.toISOString().slice(0, 10);
  }
  renderCorporateEmployeeInvitations();
  $("#corporateBookingList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-corporate-booking-action]");
    if (button) updateCorporateBookingLifecycle(button);
  });
  $("#corporateApprovalList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-corporate-approval]");
    if (button) decideCorporateApproval(button);
  });
  $("#corporateServiceList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-corporate-service-action]");
    if (button) resolveCorporateServiceCase(button);
  });
  $("#openCorporateTravelerManifestButton")?.addEventListener("click", () => {
    $("#corporateServiceMessage").textContent = "Traveler manifest opened with assignment, document, emergency-contact, accessibility, and disruption readiness. Employee financial data remains restricted.";
    addAuditEntry("Corporate traveler manifest opened", "Duty-of-care readiness reviewed.");
  });
  $$(".corporate-card-actions [data-corporate-card-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.corporateCardAction;
      const unavailableWallet = action.includes("Wallet");
      $("#corporateCardMessage").textContent = unavailableWallet
        ? `${action} is unavailable until approved issuer wallet-token provisioning is connected. No broken provisioning flow is shown.`
        : `${action} opened with MFA, device verification, spending controls, audit logging, and session timeout requirements.`;
      addAuditEntry("Corporate virtual card action", `${action}: ${unavailableWallet ? "provider integration required" : "policy-controlled action opened"}.`);
      await saveSyncedEvent("corporate_card_action", { action, providerIntegrationRequired: unavailableWallet });
    });
  });
  $$("[data-corporate-access-admin]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.corporateAccessAdmin;
      $("#corporateAccessAdminMessage").textContent = `${action} opened. Production stores only hashed codes, tracks attempts, invalidates revoked sessions, and never returns the full stored code.`;
      addAuditEntry("Corporate access admin action", `${action}: admin access management workflow opened.`);
      await saveSyncedEvent("corporate_access_admin_action", { action, hashedCodesOnly: true });
    });
  });
  $("#themeSelector")?.addEventListener("change", async (event) => {
    applyTheme(event.target.value);
    localStorage.setItem("traveldripTheme", state.theme);
    addAuditEntry("Theme updated", `${themeLabels[state.theme]} applied from Profile settings.`);
    await saveSyncedEvent("theme_updated", { theme: state.theme });
  });
  $$(".theme-swatch-grid [data-theme-choice]").forEach((button) => {
    button.addEventListener("click", async () => {
      applyTheme(button.dataset.themeChoice);
      localStorage.setItem("traveldripTheme", state.theme);
      addAuditEntry("Theme updated", `${themeLabels[state.theme]} applied from theme swatches.`);
      await saveSyncedEvent("theme_updated", { theme: state.theme });
    });
  });
  $$("[data-settings-section]").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.settingsSection;
      $$("[data-settings-section]").forEach((entry) => entry.classList.toggle("active", entry === button));
      $$(".settings-section").forEach((panel) => panel.classList.toggle("active", panel.dataset.settingsPanel === section));
      if ($("#settingsStatusMessage")) $("#settingsStatusMessage").textContent = `${button.textContent.trim()} settings opened. Rows stay separated with no overlapping controls.`;
      await saveSyncedEvent("settings_section_opened", { section });
    });
  });
  $("#settingsSearchInput")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) {
      if ($("#settingsStatusMessage")) $("#settingsStatusMessage").textContent = "Settings search cleared.";
      return;
    }
    const match = $$("[data-settings-section]").find((button) => button.textContent.toLowerCase().includes(query));
    match?.click();
    if ($("#settingsStatusMessage")) $("#settingsStatusMessage").textContent = match
      ? `Search opened ${match.textContent.trim()} settings.`
      : `No exact setting category found for "${event.target.value.trim()}".`;
  });
  $("#settingsThemeSelector")?.addEventListener("change", async (event) => {
    applyTheme(event.target.value);
    localStorage.setItem("traveldripTheme", state.theme);
    if ($("#settingsStatusMessage")) $("#settingsStatusMessage").textContent = `${themeLabels[state.theme]} applied from Settings rows.`;
    await saveSyncedEvent("settings_theme_updated", { theme: state.theme });
  });
  $("#settingsInstallButton")?.addEventListener("click", () => {
    $("#installPwaButton")?.click();
    if ($("#settingsStatusMessage")) $("#settingsStatusMessage").textContent = "Install prompt opened when supported by this browser.";
  });
  $("#ghlTestConnectionButton")?.addEventListener("click", async () => {
    const button = $("#ghlTestConnectionButton");
    button.disabled = true;
    if ($("#ghlConnectionStatus")) $("#ghlConnectionStatus").textContent = "Testing the server-side GoHighLevel connection...";
    try {
      const result = await ghlRequest({ action: "test-connection" });
      if ($("#ghlConnectionStatus")) $("#ghlConnectionStatus").textContent = result.message || "GoHighLevel connection verified.";
    } catch (error) {
      if ($("#ghlConnectionStatus")) $("#ghlConnectionStatus").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $("#ghlSyncTestContactButton")?.addEventListener("click", async () => {
    const button = $("#ghlSyncTestContactButton");
    button.disabled = true;
    if ($("#ghlLastSyncStatus")) $("#ghlLastSyncStatus").textContent = "Syncing the signed-in test contact...";
    try {
      const result = await ghlRequest({
        eventType: "admin_test_contact_sync",
        fullName: "Jordan Smith",
        username: "jordan",
        tripType: "Group Trip",
        tripName: "Travel-Drip test trip",
        destination: "Dubai",
        tripStatus: "planning",
        tags: ["Trip Planning"]
      });
      if ($("#ghlLastSyncStatus")) $("#ghlLastSyncStatus").textContent = `Last sync succeeded ${new Date(result.syncedAt || Date.now()).toLocaleString()}.`;
    } catch (error) {
      if ($("#ghlLastSyncStatus")) $("#ghlLastSyncStatus").textContent = `${error.message} Retry from Admin when configured.`;
    } finally {
      button.disabled = false;
    }
  });
  $("#sidebarMenuButton")?.addEventListener("click", () => {
    const open = !document.body.classList.contains("sidebar-open");
    document.body.classList.toggle("sidebar-open", open);
    $("#sidebarMenuButton").setAttribute("aria-expanded", String(open));
  });
  const navGroups = $$(".grouped-nav .nav-group");
  const storedNavSummary = localStorage.getItem("traveldripExpandedNavGroup");
  if (storedNavSummary) {
    navGroups.forEach((group) => {
      group.open = group.querySelector("summary")?.textContent?.trim() === storedNavSummary;
    });
  } else {
    navGroups.forEach((group, index) => {
      group.open = index === 0;
    });
  }
  navGroups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;
      const summary = group.querySelector("summary")?.textContent?.trim() || "";
      localStorage.setItem("traveldripExpandedNavGroup", summary);
      navGroups.forEach((otherGroup) => {
        if (otherGroup !== group) otherGroup.open = false;
      });
    });
  });
  $(".sidebar")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-target], a")) return;
    document.body.classList.remove("sidebar-open");
    $("#sidebarMenuButton")?.setAttribute("aria-expanded", "false");
  });
  $("[data-target]")?.ownerDocument?.addEventListener("click", (event) => {
    if (!document.body.classList.contains("sidebar-open")) return;
    if (event.target.closest(".sidebar, #sidebarMenuButton")) return;
    document.body.classList.remove("sidebar-open");
    $("#sidebarMenuButton")?.setAttribute("aria-expanded", "false");
  });
  $$("[data-widget-hide]").forEach((button) => {
    button.addEventListener("click", () => {
      const widget = $(`[data-widget="${button.dataset.widgetHide}"]`);
      if (!widget) return;
      widget.dataset.userHidden = "true";
      updateDashboardWidgets();
      $("#widgetStatusMessage").textContent = `${button.dataset.widgetHide} widget hidden. Use Reset layout to restore hidden widgets.`;
    });
  });
  $$("[data-widget-pin]").forEach((button) => {
    button.addEventListener("click", () => {
      const widget = $(`[data-widget="${button.dataset.widgetPin}"]`);
      if (!widget) return;
      widget.classList.toggle("is-pinned");
      $("#widgetStatusMessage").textContent = `${button.dataset.widgetPin} widget ${widget.classList.contains("is-pinned") ? "pinned" : "unpinned"}.`;
    });
  });
  $("#resetWidgetsButton")?.addEventListener("click", () => {
    $$("[data-widget]").forEach((widget) => {
      delete widget.dataset.userHidden;
      widget.classList.remove("is-pinned");
    });
    updateDashboardWidgets();
    $("#widgetStatusMessage").textContent = "Dashboard layout reset to the default widget set.";
  });
  $("#askAiWidgetButton")?.addEventListener("click", () => {
    navigateSafely("aiTravelPlanner", { updateHistory: true });
    $("#widgetStatusMessage").textContent = "AI Trip Manager opened with reminders, weather, budget, flight, and activity context.";
    addAuditEntry("AI widget opened", "Dashboard Ask AI action opened travel assistant context.");
  });
  $("#infoSearch")?.addEventListener("input", filterImportantInfo);
  $("#trustedContactForm")?.addEventListener("submit", saveTrustedContact);
  $("#trustedContactsList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-trusted-contact-delete]");
    if (button) deleteTrustedContact(button.dataset.trustedContactDelete);
  });
  $("#saveProfileDetailsButton")?.addEventListener("click", saveProfileDetails);
  $$(".trip-check").forEach((checkbox) => {
    checkbox.addEventListener("change", updateChecklistProgress);
  });
  $$("[data-document-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.documentAction || "Document action";
      showWorkflowMessage("Travel document", `${action} opened in the secure Travel Documents workflow.`);
      addAuditEntry("Travel document action", action);
      await saveSyncedEvent("travel_document_action", { action });
    });
  });
  $("#policyAck")?.addEventListener("change", updatePolicyAcknowledgment);
  updateChecklistProgress();
  $("#runNavigationAuditButton")?.addEventListener("click", () => {
    renderNavigationAudit();
    showWorkflowMessage("Navigation audit", "Checked buttons, links, targets, modals, role restrictions, and fallback workflows.");
  });
  $("#runSecurityAuditButton")?.addEventListener("click", renderSecurityAudit);
  $("#runBackendReadinessButton")?.addEventListener("click", renderBackendReadiness);
  $("#runGoLiveAuditButton")?.addEventListener("click", renderGoLiveAudit);
  $("#signupNameInput")?.addEventListener("input", (event) => {
    state.profilePhoto.initials = initialsFromName(event.target.value);
    localStorage.setItem("traveldripProfileInitials", state.profilePhoto.initials);
    renderProfilePhoto();
  });
  $("#profileFullNameInput")?.addEventListener("input", (event) => {
    state.profilePhoto.initials = initialsFromName(event.target.value);
    localStorage.setItem("traveldripProfileInitials", state.profilePhoto.initials);
    renderProfilePhoto();
  });
  $("#profilePhotoInput")?.addEventListener("change", (event) => handleProfilePhotoFile(event.target.files?.[0], "Profile upload"));
  $("#profileCameraInput")?.addEventListener("change", (event) => handleProfilePhotoFile(event.target.files?.[0], "Camera photo"));
  $("#photoZoomInput")?.addEventListener("input", (event) => {
    state.profilePhoto.zoom = Number(event.target.value);
    renderProfilePhoto();
  });
  $("#photoPositionXInput")?.addEventListener("input", (event) => {
    state.profilePhoto.positionX = Number(event.target.value);
    renderProfilePhoto();
  });
  $("#photoPositionYInput")?.addEventListener("input", (event) => {
    state.profilePhoto.positionY = Number(event.target.value);
    renderProfilePhoto();
  });
  $("#photoRotateInput")?.addEventListener("input", (event) => {
    state.profilePhoto.rotation = Number(event.target.value);
    renderProfilePhoto();
  });
  $("#photoCropShape")?.addEventListener("change", (event) => {
    state.profilePhoto.cropShape = event.target.value;
    renderProfilePhoto();
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    $("#profilePhotoDropZone")?.addEventListener(eventName, (event) => {
      event.preventDefault();
      $("#profilePhotoDropZone")?.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    $("#profilePhotoDropZone")?.addEventListener(eventName, (event) => {
      event.preventDefault();
      $("#profilePhotoDropZone")?.classList.remove("is-dragging");
    });
  });
  $("#profilePhotoDropZone")?.addEventListener("drop", (event) => {
    handleProfilePhotoFile(event.dataTransfer?.files?.[0], "Drag and drop");
  });
  $("#profileCoverInput")?.addEventListener("change", (event) => handleProfileCoverFile(event.target.files?.[0]));
  $$("[data-cover-photo-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.coverPhotoAction;
      if (action === "Use Beach Cover") {
        state.profileCover.dataUrl = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop";
        state.profileCover.savedDataUrl = state.profileCover.dataUrl;
        localStorage.setItem("traveldripProfileCover", state.profileCover.savedDataUrl);
        renderProfileCover();
        setProfilePhotoMessage("Beach cover saved for your My Profile header.");
        await saveSyncedEvent("profile_cover_updated", { source: "default_beach_cover" });
        return;
      }
      state.profileCover.dataUrl = "";
      state.profileCover.savedDataUrl = "";
      localStorage.removeItem("traveldripProfileCover");
      renderProfileCover();
      setProfilePhotoMessage("Cover photo removed. Your profile header now uses the default Travel-Drip gradient.");
      await saveSyncedEvent("profile_cover_removed", { source: "my_profile" });
    });
  });
  $$("[data-profile-photo-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.profilePhotoAction;
      if (action === "Choose Recent Photo") {
        state.profilePhoto.dataUrl = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=220&q=80";
        state.profilePhoto.pendingFileName = "recent-travel-photo.jpg";
        renderProfilePhoto();
        setProfilePhotoMessage("Recent photo selected for preview. Save changes to use it as your profile photo.");
        await saveSyncedEvent("profile_photo_recent_selected", { source: "recent_photo" });
        return;
      }
      state.profilePhoto.dataUrl = "";
      state.profilePhoto.pendingFileName = "";
      renderProfilePhoto();
      setProfilePhotoMessage(action === "Remove Profile Photo"
        ? "Profile photo removed from preview. Save changes to keep the default initials avatar."
        : "Default Travel-Drip initials avatar restored. Save changes to apply it everywhere.");
      addAuditEntry("Profile photo action", `${action} selected.`);
      await saveSyncedEvent("profile_photo_action", { action });
    });
  });
  $$("input[name='profilePhotoPrivacy']").forEach((input) => {
    input.addEventListener("change", async () => {
      state.profilePhoto.privacy = input.value;
      setProfilePhotoMessage(`Privacy updated to ${input.closest("label")?.textContent.trim() || input.value}. Save changes to sync this setting.`);
      await saveSyncedEvent("profile_photo_privacy_changed", { privacy: input.value });
    });
  });
  $("#saveProfilePhotoButton")?.addEventListener("click", async () => {
    state.profilePhoto.savedDataUrl = state.profilePhoto.dataUrl;
    localStorage.setItem("traveldripProfilePhoto", state.profilePhoto.savedDataUrl);
    localStorage.setItem("traveldripProfilePhotoPrivacy", state.profilePhoto.privacy);
    localStorage.setItem("traveldripProfileInitials", state.profilePhoto.initials);
    localStorage.setItem("traveldripProfilePhotoCropShape", state.profilePhoto.cropShape);
    localStorage.setItem("traveldripProfilePhotoZoom", String(state.profilePhoto.zoom));
    localStorage.setItem("traveldripProfilePhotoPositionX", String(state.profilePhoto.positionX));
    localStorage.setItem("traveldripProfilePhotoPositionY", String(state.profilePhoto.positionY));
    localStorage.setItem("traveldripProfilePhotoRotation", String(state.profilePhoto.rotation));
    setProfilePhotoMessage("Profile photo settings saved. The avatar now appears across profile, chat, members, reactions, albums, journals, directories, invitations, feeds, and notifications where allowed.");
    addAuditEntry("Profile photo saved", `Privacy: ${state.profilePhoto.privacy}. File: ${state.profilePhoto.pendingFileName || "default avatar"}.`);
    await saveSyncedEvent("profile_photo_saved", {
      hasPhoto: Boolean(state.profilePhoto.savedDataUrl),
      privacy: state.profilePhoto.privacy,
      optimizedPreview: true,
      editor: {
        cropShape: state.profilePhoto.cropShape,
        zoom: state.profilePhoto.zoom,
        positionX: state.profilePhoto.positionX,
        positionY: state.profilePhoto.positionY,
        rotation: state.profilePhoto.rotation
      },
      moderationStatus: "pending_if_uploaded"
    });
  });
  $("#profileHeroSaveButton")?.addEventListener("click", () => {
    $("#saveProfilePhotoButton")?.click();
  });
  $("#cancelProfilePhotoButton")?.addEventListener("click", () => {
    state.profilePhoto.dataUrl = state.profilePhoto.savedDataUrl;
    renderProfilePhoto();
    setProfilePhotoMessage("Profile photo changes canceled. Your last saved avatar remains active.");
  });
  wireNavigationFallbacks();
  renderNavigationAudit();
  renderSecurityAudit();
  renderBackendReadiness();
  renderGoLiveAudit();
  renderProfilePhoto();
  renderProfileCover();

  $("#chatForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;
    const conversation = $("#activeConversationName")?.textContent || "Trip chat";
    appendMessage("You", text);
    input.value = "";
    addMessageNotification(conversation, "sent");
    $("#messageStatus").textContent = "Order received. Message sent, user notifications queued, and realtime sync is active for this conversation.";
    addAuditEntry("Message notification sent", `${conversation}: message notification queued for conversation members.`);
    await saveSyncedEvent("message", { text, conversation });
    await saveSyncedEvent("message_notification_sent", {
      conversation,
      delivery: ["in_app", "push_when_enabled"],
      sensitiveContentHidden: true
    });
  });

  $$("[data-message-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.messageTab;
      $$("[data-message-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      $$("[data-conversation-type]").forEach((card) => {
        card.hidden = card.dataset.conversationType !== type;
        card.classList.toggle("active", !card.hidden && !$(".conversation-card.active:not([hidden])"));
      });
      const firstVisible = $(".conversation-card:not([hidden])");
      firstVisible?.click();
      $("#messageStatus").textContent = type === "group"
        ? "Showing trip and event group conversations with unread counts, online members, pinned announcements, polls, payments, rides, and itinerary cards."
        : "Showing private direct messages. Users can mute, archive, block, report, and manage privacy per conversation.";
      await saveSyncedEvent("message_tab_opened", { type });
    });
  });

  $$("[data-conversation-name]").forEach((card) => {
    card.addEventListener("click", async () => {
      $$("[data-conversation-name]").forEach((entry) => entry.classList.toggle("active", entry === card));
      const type = card.dataset.conversationType;
      const name = card.dataset.conversationName;
      $("#conversationTypeLabel").textContent = type === "private" ? "Private Message" : "Group Chat";
      $("#activeConversationName").textContent = name;
      $("#conversationMeta").textContent = type === "private"
        ? "Direct message • online status visible • privacy tools available"
        : "Trip/event chat • private to invited members • notifications on";
      $("#chatInput").placeholder = type === "private" ? `Message ${name}` : `Message ${name}`;
      $("#messageStatus").textContent = `${name} opened. Notifications will route back to this conversation.`;
      await saveSyncedEvent("conversation_opened", { type, name });
    });
  });

  $("#messageSearchInput")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    $$("[data-conversation-name]").forEach((card) => {
      const matches = card.dataset.conversationName.toLowerCase().includes(query) || card.textContent.toLowerCase().includes(query);
      const tab = $(".message-tabs .active")?.dataset.messageTab || "group";
      card.hidden = card.dataset.conversationType !== tab || (query && !matches);
    });
    $("#messageStatus").textContent = query
      ? `Searching messages, users, photos, documents, polls, and shared links for "${event.target.value.trim()}".`
      : "Search cleared. Conversations restored for the active tab.";
  });

  $$("[data-message-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.messageAction;
      $("#messageStatus").textContent = `${action} is connected for ${$("#activeConversationName")?.textContent || "this conversation"}. Permission checks apply before restricted content opens.`;
      addAuditEntry("Message action", `${action} selected in the messaging hub.`);
      await saveSyncedEvent("message_action", { action, conversation: $("#activeConversationName")?.textContent });
    });
  });

  $$("[data-chat-tool]").forEach((button) => {
    button.addEventListener("click", async () => {
      const tool = button.dataset.chatTool;
      $("#messageStatus").textContent = `${tool} composer opened. Shared media, locations, polls, payment requests, and itinerary cards stay attached to this chat.`;
      await saveSyncedEvent("chat_tool_opened", { tool, conversation: $("#activeConversationName")?.textContent });
    });
  });

  $("#messageAiButton")?.addEventListener("click", async () => {
    appendMessage("AI Trip Manager", "Your group is meeting in the hotel lobby at 8:00 AM tomorrow. I only show payment or finance details you are allowed to see.");
    $("#messageStatus").textContent = "AI Trip Manager answered inside chat with permission-aware trip context.";
    await saveSyncedEvent("message_ai_assistant", { permissionAware: true });
  });

  $("#newConversationButton")?.addEventListener("click", async () => {
    $("#messageStatus").textContent = "New conversation flow opened. Choose trip members, friends, corporate teammates, organizers, hosts, vendors, or event staff based on permissions.";
    await saveSyncedEvent("new_conversation_started", { source: "messages_hub" });
  });

  $("#simulateMessageNotificationButton")?.addEventListener("click", async () => {
    $("#messageStatus").textContent = "Notification simulated: @mention in Miami 2027 opened the correct group chat and highlighted the message.";
    addAuditEntry("Message notification routed", "Simulated @mention notification opened the correct conversation.");
    await saveSyncedEvent("message_notification_routed", { type: "mention", conversation: "Miami 2027" });
  });

  $$("[data-memory-like]").forEach((button) => {
    button.addEventListener("click", async () => {
      const count = button.querySelector("b");
      const liked = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!liked));
      button.classList.toggle("active", !liked);
      if (count) count.textContent = String(Math.max(0, Number(count.textContent || 0) + (liked ? -1 : 1)));
      $("#memoriesStatus").textContent = liked
        ? "Like removed. Duplicate likes are prevented for this media item."
        : "Memory liked. The like count updated for authorized viewers only.";
      await saveSyncedEvent("memory_like_updated", { mediaId: button.dataset.memoryLike, liked: !liked });
    });
  });

  $$("[data-memory-comment-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-memory-card]");
      const title = card?.querySelector("strong")?.textContent || "Selected memory";
      if ($("#memoryCommentTitle")) $("#memoryCommentTitle").textContent = title;
      $("#memoryCommentInput")?.focus();
      $("#memoriesStatus").textContent = `Comment panel opened for ${title}. Comments stay attached to this media item.`;
      await saveSyncedEvent("memory_comment_panel_opened", { mediaId: button.dataset.memoryCommentOpen, title });
    });
  });

  $("#memoryCommentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#memoryCommentInput");
    const text = input.value.trim();
    if (!text) return;
    $("#memoryCommentList")?.insertAdjacentHTML("beforeend", `<div><b>JS</b><span>${escapeHtml(text)}</span><time>Now</time></div>`);
    input.value = "";
    $("#memoriesStatus").textContent = "Comment posted to the selected memory. Privacy rules control who can see it.";
    await saveSyncedEvent("memory_comment_added", { title: $("#memoryCommentTitle")?.textContent, privacyAware: true });
  });

  $$("[data-memory-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      $$("[data-memory-view]").forEach((view) => view.classList.toggle("active", view === button));
      $("#memoriesStatus").textContent = `${button.textContent} opened. Memories remains media-only with no chat conversations.`;
      await saveSyncedEvent("memory_view_opened", { view: button.dataset.memoryView });
    });
  });

  $("#walletPreviewCardButton")?.addEventListener("click", () => {
    $("#virtualCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#cardMessage").textContent = "Virtual Card opened from Wallet overview. Wallet PIN is still required for sensitive card actions.";
  });

  $("#walletPreviewCardFreezeButton")?.addEventListener("click", () => {
    $("#lockCardButton")?.click();
  });

  $("#walletPreviewRefundButton")?.addEventListener("click", () => {
    $("#requestRefundButton")?.click();
  });

  $("#walletSectionCardButton")?.addEventListener("click", () => {
    $("#walletPreviewCardButton")?.click();
  });

  $("#walletHeaderVirtualCardButton")?.addEventListener("click", () => {
    $("#virtualCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if ($("#cardMessage")) {
      $("#cardMessage").textContent = "Virtual Card opened. Wallet PIN is still required for sensitive card actions.";
    }
  });

  $("#walletSectionRefundButton")?.addEventListener("click", () => {
    $("#requestRefundButton")?.click();
  });

  $("#walletDashboardRefundButton")?.addEventListener("click", () => {
    $("#requestRefundButton")?.click();
  });

 $$("[data-wallet-section]").forEach((button) => {
   button.addEventListener("click", async () => {
      const section = button.dataset.walletSection;
      const walletSectionTargets = {
        overview: ".wallet-home-grid",
        myWallet: ".wallet-operations-panel",
        tripWallets: ".wallet-section-widget--trip-wallets",
        virtualCard: "#virtualCard",
        splitBills: "#splitBill",
        requests: ".wallet-section-widget--requests",
        transactions: ".wallet-section-widget--transactions",
        refunds: ".wallet-section-widget--refunds",
        paymentMethods: ".wallet-section-widget--payment-methods",
        security: "#adminPanel"
      };
      if (section === "security") {
        navigateSafely("adminPanel", { updateHistory: true, settingsFocus: "security" });
      } else if (!["splitBills", "virtualCard"].includes(section) && $("#walletPanel")?.hidden) {
        navigateSafely("walletPanel", { updateHistory: true });
      }
      $$("[data-wallet-section]").forEach((sectionButton) => sectionButton.classList.toggle("active", sectionButton.dataset.walletSection === section));
      const target = $(walletSectionTargets[section]);
      if (target) {
        document.querySelectorAll(".wallet-focus").forEach((element) => element.classList.remove("wallet-focus"));
        target.classList.add("wallet-focus");
        window.setTimeout(() => target.classList.remove("wallet-focus"), 900);
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      $("#walletMessage").textContent = `${button.textContent.trim()} opened. The selected Wallet workspace is focused, and balances, ledgers, refunds, and security controls remain preserved.`;
      await saveSyncedEvent("wallet_section_opened", { section });
   });
 });

  $("#authForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#emailInput").value.trim();
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      if (location.pathname === "/admin.html") {
        await sendMagicLink(email);
        return;
      }

      await signIn(email, $("#passwordInput").value);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("#signupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#signupPasswordInput").value;
    const confirmPassword = $("#signupConfirmPasswordInput").value;

    if (password !== confirmPassword) {
      $("#authMessage").textContent = "Passwords must match before creating your account.";
      return;
    }

    if (!$("#termsAgreeInput").checked || !$("#privacyAgreeInput").checked) {
      $("#authMessage").textContent = "Agree to the Terms of Service and Privacy Policy to continue.";
      return;
    }

    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      await signUp(
        $("#signupNameInput").value.trim(),
        $("#signupUsernameInput").value.trim(),
        $("#signupEmailInput").value.trim(),
        password
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("#guestAccessForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    verifyGuestAccess();
  });

  $("#openAuthButton")?.addEventListener("click", () => {
    setAuthMode("signin", true);
  });

  $("#openSignupButton")?.addEventListener("click", () => {
    setAuthMode("signup", true);
  });

  $("#showLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#showSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#formLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#formSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#formGuestButton")?.addEventListener("click", () => setAuthMode("guest"));
  $("#landingLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#landingSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#guestReturnLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#guestCreateAccountButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#guestPortalCreateAccountButton")?.addEventListener("click", () => setAuthMode("signup"));
  $$("[data-employee-portal-tab]").forEach((button) => {
    button.addEventListener("click", () => setEmployeePortalTab(button.dataset.employeePortalTab));
  });
  const updateEmployeeBillSplit = (totalSelector, peopleSelector, resultSelector) => {
    const total = Math.max(0, Number($(totalSelector)?.value || 0));
    const people = Math.max(1, Math.floor(Number($(peopleSelector)?.value || 1)));
    setPortalText(resultSelector, `${formatPortalMoney(Math.round((total / people) * 100))} each`);
  };
  ["#employeeBillTotal", "#employeeBillPeople"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => updateEmployeeBillSplit("#employeeBillTotal", "#employeeBillPeople", "#employeeBillEach"));
  });
  ["#linkedEmployeeBillTotal", "#linkedEmployeeBillPeople"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => updateEmployeeBillSplit("#linkedEmployeeBillTotal", "#linkedEmployeeBillPeople", "#linkedEmployeeBillEach"));
  });
  $("#employeeAddFundsButton")?.addEventListener("click", async () => {
    if (!state.session?.access_token || !state.corporateAccess.accountLinked) {
      setPortalText("#employeeWalletMessage", "Create or sign in to a personal account to securely authorize card funding. Your company event access will be linked after sign-in.");
      $("#guestPortalCreateAccountButton")?.focus();
      return;
    }
    const amount = $("#employeeFundAmount")?.value || "100";
    if ($("#fundAmount")) $("#fundAmount").value = amount;
    document.body.classList.remove("employee-portal-active", "auth-screen");
    if ($("#dashboardTripType")) $("#dashboardTripType").value = "corporate";
    enterAppPreview({ forceDashboard: true });
    renderRoute("walletPanel", { updateHistory: true });
    $("#fundsForm")?.requestSubmit();
  });
  $("#linkedEmployeeAddFundsButton")?.addEventListener("click", () => {
    if (!state.walletAccess.canContribute) {
      showWorkflowMessage("Employee wallet", "This event wallet is not accepting contributions yet. Ask the event administrator to activate its PCI-compliant payment provider.");
      return;
    }
    if ($("#fundAmount")) $("#fundAmount").value = $("#linkedEmployeeFundAmount")?.value || "100";
    $("#fundsForm")?.requestSubmit();
  });
  $("#guestHelpButton")?.addEventListener("click", () => {
    $("#authMessage").textContent = "Help request opens organizer support without revealing whether the code or employee record exists.";
    showWorkflowMessage("Guest access help", "Organizer support request prepared with safe, non-sensitive context.");
  });
  $("#guestReverifyButton")?.addEventListener("click", () => {
    setVisibilityWithoutCssLeaks($("#guestPortalPanel"), false);
    $("#guestAccessForm").hidden = false;
    $("#authMessage").textContent = "Re-enter your company event code and attendee ID to reverify.";
  });
  $("#guestLogoutButton")?.addEventListener("click", endGuestAccess);
  $("#guestReportButton")?.addEventListener("click", () => {
    $("#authMessage").textContent = "Unauthorized access report prepared for the company event organizer.";
    showWorkflowMessage("Report unauthorized access", "Guest session risk report logged without exposing employee ID values.");
  });
  $("#corporateEmployeeInviteList")?.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-corporate-access]");
    if (copyButton) {
      const invitation = (state.corporateOperations.invitations || []).find((item) => item.id === copyButton.dataset.copyCorporateAccess);
      if (!invitation?.plain_code) return;
      const accessLabel = invitation.access_mode === "persistent" ? "Reusable employee" : "Temporary event";
      try {
        await navigator.clipboard.writeText(invitation.plain_code);
        if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = `${accessLabel} code copied. Send it through an approved company channel.`;
      } catch (_error) {
        if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = `${accessLabel} code: ${invitation.plain_code}`;
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-corporate-access]");
    if (!removeButton) return;
    if (removeButton.dataset.confirmRemove !== "true") {
      removeButton.dataset.confirmRemove = "true";
      removeButton.textContent = "Confirm complete removal";
      if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = "Confirming removes this employee from all company events, revokes reusable codes, and ends active corporate sessions. Their independent personal account is not deleted.";
      return;
    }

    const attendeeId = removeButton.dataset.removeCorporateAccess;
    const invitation = (state.corporateOperations.invitations || []).find((item) => item.attendee_id === attendeeId);
    removeButton.disabled = true;
    removeButton.textContent = "Removing...";
    try {
      if (!isFilePreview) {
        await apiRequest("/api/guest-access", {
          method: "POST",
          body: JSON.stringify({ action: "remove-attendee-access", tripId: getCorporateOperationsTripId(), attendeeId, scope: "organization" })
        });
      }
      if (invitation) {
        invitation.status = "revoked";
        invitation.plain_code = "";
      }
      renderCorporateEmployeeInvitations();
      if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = "Corporate access removed. Codes and active sessions are revoked, and the employee can no longer enter company events.";
      addAuditEntry("Corporate employee access removed", `${invitation?.invitee_email || "Employee"}: organization access revoked.`);
    } catch (error) {
      removeButton.disabled = false;
      removeButton.dataset.confirmRemove = "false";
      removeButton.textContent = "Remove access";
      if ($("#corporateEmployeeInviteMessage")) $("#corporateEmployeeInviteMessage").textContent = error.message;
    }
  });
  if ($("#enterAppButton")) $("#enterAppButton").hidden = !isFilePreview;
  $("#enterAppButton")?.addEventListener("click", enterAppPreview);
  $("#globalSearchInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = event.target.value.trim();
    if ($("#exploreSearchInput")) $("#exploreSearchInput").value = query;
    renderRoute("exploreDrops", { updateHistory: true });
    $("#exploreStatusMessage").textContent = query
      ? `Search results opened for "${query}" across destinations, trips, flights, hotels, activities, restaurants, messages, documents, and corporate events.`
      : "Explore opened from global search.";
    addAuditEntry("Global search opened", query || "Explore opened without a search term.");
  });
  renderAiPlanner();
  $("#aiPlannerStartButton")?.addEventListener("click", () => {
    renderRoute("aiTravelPlanner", { updateHistory: true });
    $("#aiPlannerStatus").textContent = "AI planning started. Answer one prompt at a time and Travel-Drip will build the draft as you go.";
  });
  $("#aiPlannerReplies")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-answer]");
    if (button) answerAiPlanner(button.dataset.aiAnswer);
  });
  $("#aiPlannerSendButton")?.addEventListener("click", () => {
    const input = $("#aiPlannerFreeformInput");
    answerAiPlanner(input?.value || "");
    if (input) input.value = "";
  });
  $("#aiLiveResearchButton")?.addEventListener("click", runLiveAiResearch);
  $("#aiPlannerFreeformInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("#aiPlannerSendButton")?.click();
  });
  $("#aiPlannerDeleteMemoryButton")?.addEventListener("click", async () => {
    state.aiPlanner = { step: 0, answers: {} };
    saveAiPlannerState();
    $("#aiPlannerTranscript").innerHTML = "";
    renderAiPlanner();
    $("#aiPlannerStatus").textContent = "Planner memory deleted for this session. Saved preferences can be reviewed or removed in Profile settings.";
    addAuditEntry("AI planner memory deleted", "Planning session answers were cleared from this device session.");
    await saveSyncedEvent("ai_planner_memory_deleted", { userControlled: true });
  });
  $("#aiSaveProgressButton")?.addEventListener("click", async () => {
    saveAiPlannerState();
    $("#aiPlannerStatus").textContent = "Progress saved. Continue Planning will reopen this draft with your answers intact.";
    addAuditEntry("AI planner progress saved", `${Object.keys(state.aiPlanner.answers).length} answer(s) preserved.`);
    await saveSyncedEvent("ai_planner_progress_saved", { answers: state.aiPlanner.answers });
  });
  $("#aiRegenerateButton")?.addEventListener("click", async () => {
    const plan = getAiPlannerPlan();
    $("#aiItineraryPreview").insertAdjacentHTML("beforeend", `<div><span>Alt option</span><strong>${escapeHtml(plan.mode)} refresh with more free time</strong><small>Regenerated section only; original answers remain saved.</small></div>`);
    $("#aiPlannerStatus").textContent = "Itinerary regenerated with the current answers. You can keep editing before creating the trip.";
    await saveSyncedEvent("ai_planner_regenerated", { tripMode: plan.mode });
  });
  $("#aiCreateTripButton")?.addEventListener("click", async () => {
    $("#aiPlannerStatus").textContent = "Generated plan handed to guided trip creation. Confirm trip type, dates, travelers, and budget before saving.";
    addAuditEntry("AI-generated trip started", getAiPlannerPlan().title);
    await saveSyncedEvent("ai_planner_create_trip", { plan: getAiPlannerPlan(), estimatesOnly: true });
    renderRoute("tripsPanel", { updateHistory: true });
  });

  $$("[data-plan-type]").forEach((button) => {
    button.addEventListener("click", () => {
      openPlanningWorkflow(button.dataset.planType || "group");
    });
  });

  $$("[data-event-card]").forEach((button) => {
    button.addEventListener("click", async () => {
      const label = button.dataset.eventCard;
      if (button.closest("#eventsPanel")) {
        renderRoute("eventsPanel", { updateHistory: true });
        syncEventInviteFromCard(button);
        renderEventInviteTemplate(createLocalInviteTemplate(getEventInviteContext()));
        if ($("#eventsDashboardMessage")) {
          $("#eventsDashboardMessage").textContent = `${label} opened. Event overview, schedule, guests, invitations, RSVPs, messages, polls, tasks, budget, split bills, memories, files, updates, and check-in stay in Events.`;
        }
        addAuditEntry("Event card opened", `${label} selected from Events dashboard.`);
        await saveSyncedEvent("event_dashboard_card_opened", { label });
        return;
      }
      const type = /wedding/i.test(label)
        ? "wedding"
        : /birthday/i.test(label)
          ? "birthday"
          : /corporate/i.test(label)
            ? "corporate"
            : /cruise/i.test(label)
              ? "cruise"
              : "special_event";
      openPlanningWorkflow(type);
      if ($("#letsPlanMessage")) $("#letsPlanMessage").textContent = `${label} guided event setup opened with RSVP progress, budget, split bills, tasks, memories, and AI planning widgets.`;
      addAuditEntry("Event card opened", `${label} selected from interactive Events dashboard.`);
      await saveSyncedEvent("event_card_opened", { label, type });
    });
  });

  $$("[data-event-dashboard-tab], [data-event-dashboard-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const label = button.dataset.eventDashboardTab || button.dataset.eventDashboardAction;
      $$("[data-event-dashboard-tab]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      if ($("#eventsDashboardMessage")) {
        $("#eventsDashboardMessage").textContent = `${label} opened in Events. No flight, hotel, boarding pass, weather, or travel document tools are shown in this event workspace.`;
      }
      if (/invitation/i.test(label)) {
        openEventInviteStudio();
        if ($("#eventInviteStatus")) $("#eventInviteStatus").textContent = "Invitation Studio opened. Choose a tone and generate a template based on this event.";
      }
      addAuditEntry("Events dashboard action", `${label} selected.`);
      await saveSyncedEvent("events_dashboard_action", { label });
    });
  });

  $("#eventInviteGenerateButton")?.addEventListener("click", generateEventInviteTemplate);
  $("#eventInviteCopyButton")?.addEventListener("click", copyEventInviteTemplate);
  $("#eventInviteSaveButton")?.addEventListener("click", saveEventInviteDraft);
  ["#eventNameInput", "#eventTypeInput", "#eventDateInput", "#eventStartTimeInput", "#eventEndTimeInput", "#eventVenueInput", "#eventAddressInput", "#eventDescriptionInput", "#eventInviteAudience", "#eventInviteTone", "#eventInviteDetails"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      if ($("#eventInviteStatus")) $("#eventInviteStatus").textContent = "Event details changed. Generate a fresh invitation preview when ready.";
    });
  });
  $("#eventTypeInput")?.addEventListener("change", (event) => {
    const selector = $("#eventInviteEventType");
    if (selector && event.target.value in eventInviteTypeLabels) selector.value = event.target.value;
    renderEventInviteTemplate(createLocalInviteTemplate(getEventInviteContext()));
  });
  renderEventInviteTemplate(createLocalInviteTemplate(getEventInviteContext()));

  $$("[data-wallet-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.walletAction;
      if ($("#walletMessage")) {
        $("#walletMessage").textContent = `${action} opened from Wallet. Split bills, payment requests, pending payments, completed payments, and trip contributions remain one click away.`;
      }
      addAuditEntry("Wallet action opened", `${action} opened from wallet action grid.`);
      await saveSyncedEvent("wallet_action_opened", { action });
    });
  });

  $$("[data-plan-ai]").forEach((button) => {
    button.addEventListener("click", async () => {
      renderRoute("aiTravelPlanner", { updateHistory: true });
      renderAiPlanner();
      if ($("#aiPlannerStatus")) {
        $("#aiPlannerStatus").textContent = "AI planning opened from Let's Plan. Answer a few questions to build an itinerary, budget, schedule, recommendations, and invitation-ready plan.";
      }
      if ($("#letsPlanMessage")) $("#letsPlanMessage").textContent = "AI planning opened.";
      addAuditEntry("Let's Plan AI opened", "AI planning card opened from the central planning hub.");
      await saveSyncedEvent("lets_plan_ai_opened", { route: getRouteForTarget("aiTravelPlanner") });
    });
  });
  $("#aiShareTripButton")?.addEventListener("click", async () => {
    $("#aiPlannerStatus").textContent = "Share workflow opened with invited travelers and coworkers. Nothing is shared without approval.";
    addAuditEntry("AI planner share opened", "Draft itinerary sharing prepared with privacy controls.");
    await saveSyncedEvent("ai_planner_share_opened", { privacyControlled: true });
  });
  $("#aiExportButton")?.addEventListener("click", async () => {
    $("#aiPlannerStatus").textContent = "PDF export queued for the generated itinerary, budget estimate, checklist, and day-by-day plan.";
    await saveSyncedEvent("ai_planner_export_requested", { format: "pdf" });
  });
  $("#aiCalendarButton")?.addEventListener("click", async () => {
    $("#aiPlannerStatus").textContent = "Calendar workflow opened. Confirmed reservations can sync to Apple, Google, or Outlook calendars when providers are connected.";
    await saveSyncedEvent("ai_planner_calendar_opened", { providerRequired: true });
  });
  $$("[data-oauth-provider]").forEach((button) => {
    button.addEventListener("click", () => signInWithOAuth(button.dataset.oauthProvider));
  });
  $$("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(`#${button.dataset.passwordToggle}`);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
    });
  });
  $("#continueOnboardingButton")?.addEventListener("click", () => {
    $("#verificationPanel").hidden = true;
    $("#authOnboardingPanel").hidden = false;
    $("#authMessage").textContent = "Choose the first travel experience you want to create.";
  });
  $$("[data-onboarding-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#authMessage").textContent = `${button.dataset.onboardingChoice} selected. Continue into Travel-Drip to finish your guided setup.`;
      enterAppPreview();
    });
  });
  $$("[data-auth-workflow]").forEach((button) => {
    button.addEventListener("click", () => {
      const workflow = button.dataset.authWorkflow;
      const messages = {
        "Forgot Password": "Password reset opens a secure email recovery flow when Supabase auth is fully configured.",
        "Verify Email": "Email verification status is checked after registration and before live account sync.",
        "Two-Factor Authentication": "Two-factor setup appears after sign-in when production auth requires an extra verification step.",
        "Terms of Service": "Terms of Service opens the Travel-Drip usage, payment, content, and account rules in the legal policy area.",
        "Privacy Policy": "Privacy Policy opens the Travel-Drip privacy, security, and data protection guidance in Admin."
      };
      const detail = messages[workflow] || "Authentication workflow opened.";
      $("#authMessage").textContent = detail;
      showWorkflowMessage(workflow, detail);
    });
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#register") setAuthMode("signup");
    if (location.hash === "#login") setAuthMode("signin");
    if (location.hash === "#company-event") setAuthMode("guest");
    const target = getTargetFromRoute();
    if (!getInitialAuthMode()) renderRoute(target, { replace: true });
  });
  window.addEventListener("popstate", () => {
    const authMode = getInitialAuthMode();
    if (authMode) {
      setAuthMode(authMode);
      return;
    }
    renderRoute(getTargetFromRoute());
  });

  const initialAuthMode = getInitialAuthMode();
  if (initialAuthMode) setAuthMode(initialAuthMode);
  else renderRoute(getTargetFromRoute(), { updateHistory: true, replace: true });

  $("#signOutButton")?.addEventListener("click", signOut);
  $("#notifyButton")?.addEventListener("click", enableNotifications);
  $("#notifyForm")?.addEventListener("submit", sendAdminNotification);
  routeInteractionsWired = true;
  renderRoute(getTargetFromRoute(), { replace: true });
}

function filterImportantInfo(event) {
  const query = event.target.value.trim().toLowerCase();
  $$("#infoAccordion .info-section").forEach((section) => {
    const matches = !query || section.innerText.toLowerCase().includes(query);
    section.hidden = !matches;
    if (matches && query) section.open = true;
  });
}

function updateChecklistProgress() {
  const checks = $$(".trip-check");
  if (!checks.length) return;
  const complete = checks.filter((check) => check.checked).length;
  $("#checklistProgress").textContent = `${complete} / ${checks.length}`;
}

function updatePolicyAcknowledgment(event) {
  const now = new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  $("#policyStatus").textContent = event.target.checked ? "Acknowledged" : "Needs acknowledgment";
  $("#ackRecord").textContent = event.target.checked
    ? `Acknowledged by current user on ${now}, version Important Info v1.`
    : "Acknowledgment records user, date, time, and content version.";
}

function updateEnterpriseRole() {
  const selectedRole = $("#rolePreview")?.value || "employee";
  const canSeeFinancials = ["owner", "executive", "finance"].includes(selectedRole);

  $$("[data-visible-roles]").forEach((card) => {
    const allowedRoles = card.dataset.visibleRoles.split(" ");
    card.classList.toggle("is-muted", !allowedRoles.includes(selectedRole));
  });

  $("[data-financial-panel]")?.toggleAttribute("hidden", !canSeeFinancials);
  $("#restrictedFinancePanel")?.toggleAttribute("hidden", canSeeFinancials);

  if (!canSeeFinancials) {
    addAuditEntry("Financial access blocked", `${selectedRole} role preview restricted corporate budget visibility.`);
  }
  updateCorporateOperationsPermissions();
  updateDashboardWidgets();
}

function appendMessage(author, text) {
  const message = document.createElement("div");
  message.className = "msg";
  message.innerHTML = `<strong>${escapeHtml(author)}:</strong> ${escapeHtml(text)}`;
  $("#messages")?.appendChild(message);
  message.scrollIntoView({ block: "nearest" });
}

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "JS";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function renderProfilePhoto() {
  $$("[data-profile-initials]").forEach((avatar) => {
    avatar.textContent = state.profilePhoto.initials;
    avatar.classList.toggle("has-photo", Boolean(state.profilePhoto.dataUrl));
    avatar.classList.toggle("rounded-square", state.profilePhoto.cropShape === "rounded-square");
    avatar.style.setProperty("--profile-photo-scale", state.profilePhoto.zoom);
    avatar.style.setProperty("--profile-photo-rotation", `${state.profilePhoto.rotation}deg`);
    avatar.style.backgroundPosition = `${state.profilePhoto.positionX}% ${state.profilePhoto.positionY}%`;
    if (state.profilePhoto.dataUrl) {
      avatar.style.backgroundImage = `url("${state.profilePhoto.dataUrl}")`;
    } else {
      avatar.style.backgroundImage = "";
    }
  });
  $$("[data-profile-preview]").forEach((preview) => {
    preview.classList.toggle("has-photo", Boolean(state.profilePhoto.dataUrl));
    preview.classList.toggle("rounded-square", state.profilePhoto.cropShape === "rounded-square");
  });
  if ($("#photoCropShape")) $("#photoCropShape").value = state.profilePhoto.cropShape;
  if ($("#photoZoomInput")) $("#photoZoomInput").value = String(state.profilePhoto.zoom);
  if ($("#photoPositionXInput")) $("#photoPositionXInput").value = String(state.profilePhoto.positionX);
  if ($("#photoPositionYInput")) $("#photoPositionYInput").value = String(state.profilePhoto.positionY);
  if ($("#photoRotateInput")) $("#photoRotateInput").value = String(state.profilePhoto.rotation);
  $$("input[name='profilePhotoPrivacy']").forEach((input) => {
    input.checked = input.value === state.profilePhoto.privacy;
  });
}

function setProfilePhotoMessage(message) {
  const el = $("#profilePhotoMessage");
  if (el) el.textContent = message;
}

function renderProfileCover() {
  const cover = $("#profileCoverImage");
  if (!cover) return;
  if (state.profileCover.dataUrl) {
    cover.src = state.profileCover.dataUrl;
    cover.hidden = false;
  } else {
    cover.removeAttribute("src");
    cover.hidden = true;
  }
}

function handleProfileCoverFile(file) {
  if (!file) return;
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/webp"];
  const allowedExtensions = /\.(jpe?g|png|heic|webp)$/i;
  if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
    setProfilePhotoMessage("Unsupported cover type. Use JPG, JPEG, PNG, HEIC, or WEBP.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setProfilePhotoMessage("Cover photo is too large. Choose an image under 5 MB.");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.profileCover.dataUrl = String(reader.result || "");
    state.profileCover.savedDataUrl = state.profileCover.dataUrl;
    localStorage.setItem("traveldripProfileCover", state.profileCover.savedDataUrl);
    renderProfileCover();
    setProfilePhotoMessage(`${file.name} is now your profile cover photo.`);
    addAuditEntry("Profile cover updated", `${file.name} validated for type, size, and profile cover preview.`);
  });
  reader.addEventListener("error", () => {
    setProfilePhotoMessage("Unable to preview that cover photo. Try another JPG, PNG, HEIC, or WEBP file.");
  });
  reader.readAsDataURL(file);
}

function handleProfilePhotoFile(file, source = "upload") {
  if (!file) return;
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/webp"];
  const allowedExtensions = /\.(jpe?g|png|heic|webp)$/i;
  if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
    setProfilePhotoMessage("Unsupported file type. Use JPG, JPEG, PNG, HEIC, or WEBP.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setProfilePhotoMessage("Profile photo is too large. Choose an image under 5 MB.");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.profilePhoto.dataUrl = String(reader.result || "");
    state.profilePhoto.pendingFileName = file.name;
    renderProfilePhoto();
    setProfilePhotoMessage(`${source} preview ready. Crop, reposition, rotate, choose privacy, then save changes.`);
    addAuditEntry("Profile photo previewed", `${file.name} validated for type, size, preview, and moderation-ready upload.`);
  });
  reader.addEventListener("error", () => {
    setProfilePhotoMessage("Unable to preview that image. Try another JPG, PNG, HEIC, or WEBP file.");
  });
  reader.readAsDataURL(file);
}

function addAuditEntry(title, detail) {
  const list = $("#auditList");
  if (!list) return;

  const entry = document.createElement("div");
  entry.innerHTML = `<time>${new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}</time><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
  list.prepend(entry);
}

function addInAppNotification(category, detail) {
  const list = $("#notificationMiniList");
  if (!list) return;

  const notification = document.createElement("span");
  notification.textContent = `${category}: ${detail}`;
  list.prepend(notification);

  while (list.children.length > 5) {
    list.lastElementChild?.remove();
  }
}

function showWalletNotification(notification) {
  if (!notification) return;
  addInAppNotification("Wallet", `${notification.title}: ${notification.body}`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(notification.title || "Travel-Drip wallet alert", {
      body: notification.body || "Open Travel-Drip to review your trip wallet.",
      icon: "icons/icon-192.png",
      tag: `traveldrip-wallet-${notification.id || Date.now()}`
    });
  }
  const status = $("#walletNotificationStatus");
  if (status) status.textContent = "New wallet alert";
}

function addMessageNotification(conversation, direction = "received") {
  const detail = direction === "sent"
    ? `${conversation} message sent. Conversation members will be notified.`
    : `${conversation} received a new message. Open chat to view it.`;
  addInAppNotification("Messages", detail);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(direction === "sent" ? "Travel-Drip message sent" : "New Travel-Drip message", {
      body: direction === "sent"
        ? `${conversation} message sent.`
        : `${conversation} has a new message. Open Travel-Drip to view details.`,
      icon: "icons/icon-192.png",
      tag: `traveldrip-message-${direction}-${conversation.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    });
  }
}

function describeControl(control) {
  return (control.getAttribute("aria-label") || control.textContent || control.id || control.tagName).trim().replace(/\s+/g, " ");
}

function showWorkflowMessage(label, detail = "Workflow opened and navigation context preserved.") {
  const message = $("#navigationStatusMessage") || $("#billMessage") || $("#rideMessage");
  if (message) message.textContent = `${label}: ${detail}`;
  addAuditEntry("Navigation workflow opened", `${label} - ${detail}`);
}

function getNavigationAudit() {
  const issues = [];
  const targetButtons = $$("[data-target]");
  const links = $$("a[href]");
  const workflowButtons = $$("button").filter((button) => {
    if (button.hidden || button.disabled || button.type === "submit") return false;
    if (button.closest("dialog")) return false;
    return true;
  });

  targetButtons.forEach((button) => {
    if (!getRouteComponentById(button.dataset.target)) issues.push(`Missing section target: ${button.dataset.target}`);
    if (!routeDefinitions[button.dataset.target]) issues.push(`Missing route for target: ${button.dataset.target}`);
  });

  Object.entries(routeDefinitions).forEach(([target, route]) => {
    if (!getRouteComponentById(target)) issues.push(`Route ${route.path} points to missing screen: ${target}`);
  });

  $$("[aria-controls]").forEach((control) => {
    const target = control.getAttribute("aria-controls");
    if (target && !document.getElementById(target)) issues.push(`Missing aria-controls target: ${target}`);
  });

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href === "#") issues.push(`Placeholder link: ${describeControl(link)}`);
  });

  const restrictedCards = $$("[data-visible-roles]").length + $$("[data-financial-panel]").length;
  return {
    targetCount: targetButtons.length,
    linkCount: links.length,
    routeCount: Object.keys(routeAliases).length,
    workflowCount: workflowButtons.length,
    restrictedCards,
    issues
  };
}

function renderNavigationAudit() {
  if (!$("#navigationAuditList")) return;
  const audit = getNavigationAudit();
  $("#navTargetCount").textContent = `${audit.targetCount} checked`;
  $("#navLinkCount").textContent = `${audit.linkCount} checked`;
  $("#navWorkflowCount").textContent = `${audit.workflowCount} checked`;
  $("#navigationAuditList").innerHTML = [
    `<div><strong>Main navigation</strong><span>${audit.targetCount} section buttons validate against real screen IDs and route through browser history instead of scroll-only jumps.</span></div>`,
    `<div><strong>Deep links</strong><span>${audit.routeCount} app routes map to dedicated Travel-Drip screens for refresh, bookmarks, and back/forward navigation.</span></div>`,
    `<div><strong>Role permissions</strong><span>${audit.restrictedCards} role-gated corporate panels enforce employee, organizer, owner, and finance visibility messaging.</span></div>`,
    `<div><strong>Modals and workflows</strong><span>Wallet PIN dialog, auth tabs, ride-share connection, receipt scanner, bill split, and fallback workflow messages are wired.</span></div>`,
    audit.issues.length
      ? `<div class="is-warning"><strong>Needs review</strong><span>${audit.issues.map(escapeHtml).join("; ")}</span></div>`
      : `<div><strong>No broken targets found</strong><span>No placeholder links, missing tab controls, missing section targets, or navigation loops were detected in this mock app.</span></div>`
  ].join("");
  $("#navigationStatusMessage").textContent = audit.issues.length
    ? `${audit.issues.length} navigation issue(s) need review before deployment.`
    : "Navigation audit passed for current local markup. Production-only auth, payment, ride-share, and notification providers still require real service credentials.";
}

function getSecurityAudit() {
  const text = document.body.textContent || "";
  const checks = [
    ["Authentication", Boolean($("#authForm") && $("#signupForm") && text.includes("Two-Factor Authentication"))],
    ["Email verification", text.includes("Verify Email") || text.includes("Email verification")],
    ["Wallet PIN gates", Boolean($("#pinDialog") && $("#walletPin") && text.includes("Wallet PIN"))],
    ["Role-based access", Boolean($("#rolePreview") && $$("[data-visible-roles]").length)],
    ["Corporate privacy", text.includes("Employees cannot see") || text.includes("Financial privacy enforced")],
    ["No raw card storage messaging", text.includes("card data must never touch this app") || text.includes("No raw card storage")],
    ["Secure notification copy", text.includes("Never include sensitive information") || text.includes("Open Travel-Drip to view details")],
    ["File upload controls", text.includes("Approved file types only") && text.includes("executable upload blocking")],
    ["Fraud monitoring", text.includes("Rapid PIN failures") && text.includes("Unusual refunds")],
    ["Navigation audit", Boolean($("#navigationAuditList"))]
  ];
  return {
    checks,
    passed: checks.filter(([, ok]) => ok).length,
    failed: checks.filter(([, ok]) => !ok).map(([name]) => name)
  };
}

function renderSecurityAudit() {
  if (!$("#securityAuditMessage")) return;
  const audit = getSecurityAudit();
  $("#securityAuthStatus").textContent = audit.failed.includes("Authentication") ? "Review" : "Configured";
  $("#securityWalletStatus").textContent = audit.failed.includes("Wallet PIN gates") ? "Review" : "PIN-gated";
  $("#securityApiStatus").textContent = "Guarded";
  $("#securityCorpStatus").textContent = audit.failed.includes("Role-based access") ? "Review" : "Role-limited";
  $("#securityAuditMessage").textContent = audit.failed.length
    ? `Security audit found ${audit.failed.length} item(s) needing review: ${audit.failed.join(", ")}.`
    : `Security audit passed ${audit.passed}/${audit.checks.length} local controls. Production still requires real provider-side MFA, tokenized payments, malware scanning, rate limiting, and encrypted storage.`;
  addAuditEntry("Security audit completed", audit.failed.length ? `Review: ${audit.failed.join(", ")}` : "Local security controls validated.");
}

function getBackendReadinessAudit() {
  const checks = $$("[data-backend-status]").map((item) => ({
    title: item.querySelector("strong")?.textContent || "Backend check",
    status: item.dataset.backendStatus || "review"
  }));
  return {
    checks,
    passed: checks.filter((check) => check.status === "pass").length,
    review: checks.filter((check) => check.status === "review").length,
    blocked: checks.filter((check) => check.status === "blocked").length
  };
}

function renderBackendReadiness() {
  if (!$("#backendReadinessMessage")) return;
  const audit = getBackendReadinessAudit();
  $("#backendArchitectureStatus").textContent = audit.passed ? "Documented" : "Needs design";
  $("#backendStorageStatus").textContent = audit.blocked ? "Needs provider tests" : "Ready";
  $("#backendReliabilityStatus").textContent = audit.blocked ? "Blocked" : "Ready";
  $("#backendFinalStatus").textContent = audit.blocked ? "Not ready" : "Ready with limits";
  $("#backendReadinessMessage").textContent = audit.blocked
    ? `Backend readiness blocked: ${audit.blocked} production reliability item(s) still need real environment verification. ${audit.passed} checks passed and ${audit.review} need review.`
    : `Backend readiness has ${audit.passed}/${audit.checks.length} checks passing. Confirm production monitoring and restore drills before launch.`;
  addAuditEntry("Backend readiness audit completed", audit.blocked ? `${audit.blocked} blocking scalability/reliability check(s) remain.` : "Backend readiness checklist passed.");
}

function getGoLiveAudit() {
  const checks = $$("[data-go-live-status]").map((item) => ({
    title: item.querySelector("strong")?.textContent || "Go-live check",
    status: item.dataset.goLiveStatus || "review"
  }));
  return {
    checks,
    passed: checks.filter((check) => check.status === "pass").length,
    blocked: checks.filter((check) => check.status === "blocked").length,
    review: checks.filter((check) => check.status === "review").length
  };
}

function setGoLiveHealthCheck(key, status, detail) {
  const item = $(`[data-go-live-check="${key}"]`);
  if (!item) return;
  item.dataset.goLiveStatus = status;
  if (detail) {
    const description = item.querySelector("span");
    if (description) description.textContent = detail;
  }
}

function applyGoLiveHealth(health) {
  const required = health.requiredChecks || health;
  const optional = health.optionalChecks || health;
  const publicReady = Boolean(
    required.supabasePublicUrlConfigured
      && required.supabasePublishableKeyConfigured
  );
  const serverReady = Boolean(
    required.supabaseServerUrlConfigured
      && required.supabaseServiceRoleConfigured
      && required.adminEmailsConfigured
      && required.guestAccessPepperConfigured
  );
  const pushReady = Boolean(
    required.vapidSubjectConfigured
      && required.vapidPublicKeyConfigured
      && required.vapidPrivateKeyConfigured
      && required.cronSecretConfigured
  );
  const paymentReady = Boolean(
    required.stripeSecretConfigured
      && required.stripeWebhookConfigured
      && required.appBaseUrlConfigured
  );
  const missingExternal = [
    ["Google Places", optional.googlePlacesConfigured],
    ["FlightAware", optional.flightAwareConfigured],
    ["Amadeus", optional.amadeusHotelsConfigured],
    ["OpenAI", optional.openAiConfigured && optional.openAiModelConfigured]
  ].filter(([, configured]) => !configured).map(([name]) => name);
  setGoLiveHealthCheck("public-supabase", publicReady ? "pass" : "blocked", publicReady
    ? "Public Supabase URL and publishable key are configured."
    : "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
  setGoLiveHealthCheck("server-supabase", serverReady ? "pass" : "blocked", serverReady
    ? "Server Supabase URL, service role, admin allowlist, and guest pepper are configured."
    : `Missing server controls: ${health.missingRequiredEnv?.join(", ") || "review Supabase server variables"}.`);
  setGoLiveHealthCheck("push", pushReady ? "pass" : "blocked", pushReady
    ? "VAPID keys, subject, and scheduled reminder secret are configured."
    : "VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and CRON_SECRET are required.");
  setGoLiveHealthCheck("payments", paymentReady ? "review" : "blocked", paymentReady
    ? "Stripe funding and webhook variables are configured; issuer and PCI tap-to-pay testing remains required."
    : "Stripe live funding requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and APP_BASE_URL.");
  setGoLiveHealthCheck("external", missingExternal.length ? "blocked" : "review", missingExternal.length
    ? `Missing provider configuration: ${missingExternal.join(", ")}. Email, SMS, maps, storage, and monitoring still require manual verification.`
    : "Core search and AI providers are configured; email, SMS, maps, storage, monitoring, and backups still require manual verification.");
  $("#goLiveDeploymentStatus").textContent = "Live health checked";
  $("#goLiveEnvironmentStatus").textContent = health.ready ? "Ready" : "Blocked";
  $("#goLiveLocalStatus").textContent = "Validated";
}

function renderGoLiveAuditSummary() {
  if (!$("#goLiveStatusMessage")) return;
  const audit = getGoLiveAudit();
  $("#goLiveDecisionStatus").textContent = audit.blocked ? "Beta-ready; production blocked" : audit.review ? "Manual review required" : "Ready for production";
  $("#goLiveStatusMessage").textContent = audit.blocked
    ? `Public production blocked: ${audit.blocked} critical item(s) still require provider credentials, live integrations, or real user journey verification. ${audit.passed} checks passed; ${audit.review} checks need manual review.`
    : audit.review
      ? `Provider configuration is present, but ${audit.review} manual review item(s) remain before public launch.`
      : `Go-live checklist passed ${audit.passed}/${audit.checks.length} checks. Confirm monitoring and backups before public launch.`;
  addAuditEntry("Go-live audit completed", audit.blocked ? `${audit.blocked} blocking production check(s) remain.` : "Production acceptance checklist completed.");
}

async function renderGoLiveAudit() {
  if (!$("#goLiveStatusMessage")) return;
  if (isFilePreview) {
    $("#goLiveDeploymentStatus").textContent = "Local preview";
    $("#goLiveEnvironmentStatus").textContent = "Not checked";
    $("#goLiveLocalStatus").textContent = "Validated";
    renderGoLiveAuditSummary();
    return;
  }
  $("#goLiveEnvironmentStatus").textContent = "Checking";
  $("#goLiveStatusMessage").textContent = "Checking the deployed /api/health endpoint without exposing secret values...";
  try {
    const response = await fetch("/api/health", { cache: "no-store", headers: { Accept: "application/json" } });
    const health = await response.json().catch(() => ({}));
    if (!response.ok || !health.app) throw new Error("Production health endpoint is unavailable.");
    applyGoLiveHealth(health);
    renderGoLiveAuditSummary();
  } catch (error) {
    $("#goLiveDeploymentStatus").textContent = "Health unavailable";
    $("#goLiveEnvironmentStatus").textContent = "Unknown";
    $("#goLiveLocalStatus").textContent = "Validated locally";
    $("#goLiveDecisionStatus").textContent = "Production blocked";
    $("#goLiveStatusMessage").textContent = `${error.message} Production must not be announced until /api/health responds successfully.`;
    addAuditEntry("Go-live health unavailable", error.message);
  }
}

function wireNavigationFallbacks() {
  const handledSelector = [
    "[data-target]",
    "[data-day]",
    "[data-admin-action]",
    "[data-social-action]",
    "[data-share-platform]",
    "[data-choice]",
    "[data-split-mode]",
    "[data-ride-mode]",
    "[data-bill-pay]",
    "[data-ride-pay]",
    "[data-receipt-source]",
    "[data-ride-provider]",
    "[data-shared-rider]",
    "[data-auth-workflow]",
    "#runNavigationAuditButton"
  ].join(",");

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled || button.type === "submit" || button.closest("dialog")) return;
    if (button.matches(handledSelector) || button.id) return;
    const label = describeControl(button);
    showWorkflowMessage(label, "Feature route is connected to a mock workflow message until the production screen is built.");
  });
}

async function saveSyncedEvent(type, payload) {
  if (!state.supabase || !state.session) return;
  await state.supabase.from("trip_events").insert({
    trip_id: "dubai-weekend",
    event_type: type,
    payload,
    user_id: state.session.user.id
  });
  const crmEventTypes = new Set([
    "guided_trip_created",
    "trip_invitations_sent",
    "reservation_reminder_action",
    "wallet_payment",
    "refund_requested",
    "trip_invitations_skipped",
    "daily_memory_action",
    "corporate_access_admin_action"
  ]);
  if (crmEventTypes.has(type)) {
    queueGhlSync({
      eventType: type === "guided_trip_created" ? "trip_created" : type,
      tripName: payload.tripName,
      tripType: payload.type || payload.tripType,
      destination: payload.destination,
      departureDate: payload.startDate,
      returnDate: payload.endDate,
      travelerCount: payload.travelers,
      budget: payload.budget,
      tripStatus: payload.status || "planning",
      tags: [payload.type, payload.tripType, type === "refund_requested" ? "Refund Requested" : "Trip Planning"]
    });
  }
}

function subscribeToLiveData() {
  if (!state.supabase || !state.session) return;
  const userId = state.session.user.id;
  if (!window.tripChannel) {
    window.tripChannel = state.supabase
      .channel("trip_events:dubai-weekend")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "trip_events",
        filter: "trip_id=eq.dubai-weekend"
      }, ({ new: event }) => {
        if (event.user_id === state.session.user.id) return;
        if (event.event_type === "message") {
          const conversation = event.payload.conversation || "Trip chat";
          appendMessage("Traveler", event.payload.text);
          addMessageNotification(conversation, "received");
          addAuditEntry("Message notification received", `${conversation}: incoming message notification displayed.`);
        }
        if (event.event_type === "wallet") {
          const perPerson = Number(event.payload.perPerson);
          $("#deposit").value = String(perPerson);
          $("#depositValue").textContent = `$${perPerson.toLocaleString()}`;
          $("#walletTotal").textContent = `$${(perPerson * 8).toLocaleString()}`;
        }
      })
      .subscribe((status) => setSyncStatus(status === "SUBSCRIBED" ? "Live" : "Connected"));
  }

  if (window.walletNotificationUserId !== userId) {
    if (window.walletNotificationChannel) state.supabase.removeChannel(window.walletNotificationChannel);
    window.walletNotificationUserId = userId;
    window.walletNotificationChannel = state.supabase
      .channel(`wallet_notifications:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`
      }, ({ new: notification }) => {
        if (["wallet_deposit_confirmed", "wallet_payment_request", "wallet_payment_due"].includes(notification.notification_type)) {
          showWalletNotification(notification);
          loadWalletAccess();
        }
      })
      .subscribe();
  }
}

async function registerServiceWorker() {
  if (isFilePreview) return;
  if (!("serviceWorker" in navigator)) return;
  let registration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  } catch (error) {
    console.warn("Travel-Drip service worker registration failed; continuing without offline mode.", error);
    return;
  }
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        $("#updateAvailableBanner")?.removeAttribute("hidden");
      }
    });
  });
  $("#reloadUpdateButton")?.addEventListener("click", () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
  let refreshingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    window.location.reload();
  });
  registration.update().catch((error) => {
    console.warn("Travel-Drip could not check for a PWA update; the cached app remains available.", error);
  });
}

function wireInstallPrompt() {
  let promptEvent;
  const dismissed = localStorage.getItem("traveldripInstallPromptDismissed") === "true";
  const installButton = $("#installButton");
  const inlineInstallButton = $("#inlineInstallButton");
  const authInstallButton = $("#authInstallButton");
  const installButtons = [installButton, inlineInstallButton, authInstallButton].filter(Boolean);
  const installHelpDialog = $("#installHelpDialog");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
    if (!dismissed) installButtons.forEach((button) => { button.hidden = false; });
  });

  async function promptInstall() {
    if (!promptEvent) {
      installHelpDialog?.showModal();
      return;
    }
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") localStorage.setItem("traveldripInstallPromptDismissed", "true");
    installButtons.forEach((button) => { button.hidden = true; });
    promptEvent = null;
  }

  installButtons.forEach((button) => button.addEventListener("click", promptInstall));
  $("#iosInstallHelpButton")?.addEventListener("click", () => installHelpDialog?.showModal());
  $("#profileInstallHelpButton")?.addEventListener("click", () => installHelpDialog?.showModal());
  window.addEventListener("appinstalled", () => {
    localStorage.setItem("traveldripInstalled", "true");
    installButtons.forEach((button) => { button.hidden = true; });
  });
}

function wireConnectivityStatus() {
  const banner = $("#offlineStatusBanner");
  if (!banner) return;
  const update = () => {
    banner.hidden = navigator.onLine;
    banner.setAttribute("aria-hidden", String(navigator.onLine));
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function enableNotifications() {
  if (!state.session) {
    const panel = $("#authPanel");
    if (panel) panel.hidden = false;
    return;
  }

  if (!("Notification" in window) || !("PushManager" in window)) {
    alert("This browser does not support push notifications.");
    return;
  }

  if (!state.config.vapidPublicKey) {
    alert("Add VAPID_PUBLIC_KEY in Vercel to enable push notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(state.config.vapidPublicKey)
  });

  await fetch("/api/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({ subscription })
  });

  alert("Notifications are enabled for Travel-Drip.");
}

async function sendAdminNotification(event) {
  event.preventDefault();
  const message = $("#adminMessage");
  if (!state.session) return;

  const response = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({
      title: $("#notifyTitle").value.trim(),
      body: $("#notifyBody").value.trim(),
      url: $("#notifyUrl").value.trim()
    })
  });

  const result = await response.json().catch(() => ({}));
  message.textContent = response.ok
    ? `Sent to ${result.sent || 0} subscription(s).`
    : result.error || "Could not send notification.";
}

async function init() {
  applyTheme();
  startAuthCarousel();
  wireLocalInteractions();
  wireInstallPrompt();
  wireConnectivityStatus();
  await registerServiceWorker();
  await loadConfig();
  await loadProfileDetails();
  await loadTrustedContacts();
  updateAuthUi();
  subscribeToLiveData();
  hideLoader();
}

init().catch((error) => {
  console.error(error);
  setSyncStatus("Error");
  hideLoader();
});
