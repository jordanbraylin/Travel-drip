// Evergreen destination guides used to generate crawlable pages at /destinations/<slug>/.
// Keep facts general and durable: no prices, opening hours or visa rules.
export const destinations = [
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    tagline: "Hilltop viewpoints, trams, tiled streets and easy day trips.",
    why: "Lisbon packs river views, historic neighborhoods, great food and beaches into a compact, walkable-with-hills city. It works well for friends, couples and families.",
    bestTime: "April to June and September to October bring warm days without peak-summer heat. July and August are hot and busy; winter is mild and rainy.",
    highlights: [
      "Wander Alfama and Mouraria for viewpoints and fado music",
      "Ride Tram 28 early in the morning to avoid queues",
      "Try pastéis de nata in Belém, then visit the Jerónimos Monastery",
      "Day trip to Sintra for palaces and forest trails",
      "Take the train to Cascais for beaches and seafood"
    ],
    itinerary: [
      ["Day 1", "Baixa, Chiado and Alfama on foot, sunset at a miradouro (viewpoint)."],
      ["Day 2", "Belém in the morning, LX Factory in the afternoon, dinner in Bairro Alto."],
      ["Day 3", "Sintra by train, back for a relaxed riverside dinner."]
    ],
    groupTips: "Pick a base near a metro line, since the hills tire groups quickly. Split taxi rides and the Sintra day-trip costs in the app so nobody fronts the money.",
    faqs: [
      ["How many days do you need in Lisbon?", "Three full days cover the main neighborhoods plus one day trip. Add one or two days for the coast or extra day trips."],
      ["Is Lisbon good for groups?", "Yes. Many restaurants handle larger tables, rides are easy to split, and day trips are simple by train."]
    ]
  },
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    tagline: "Neon districts, quiet shrines and some of the world's best food.",
    why: "Tokyo mixes ultra-modern districts with calm temples and gardens. Transit is reliable, so a group can split up for a day and meet for dinner.",
    bestTime: "Late March to early April for cherry blossoms and November for autumn leaves are the most popular windows. Summers are hot and humid.",
    highlights: [
      "Explore Asakusa and Senso-ji early in the day",
      "See Shibuya Crossing and the Shibuya Sky viewpoint at sunset",
      "Eat your way through Tsukiji Outer Market and local izakaya",
      "Visit Meiji Shrine and Yoyogi Park",
      "Day trip to Kamakura or Nikko for temples and nature"
    ],
    itinerary: [
      ["Day 1", "Asakusa, Ueno Park and museums, evening in Akihabara."],
      ["Day 2", "Meiji Shrine, Harajuku, Shibuya, dinner in Shinjuku."],
      ["Day 3", "Kamakura day trip, return for a late ramen or izakaya night."]
    ],
    groupTips: "Load a transit IC card onto each phone or pick up a card on arrival. Reserve popular restaurants early and use a shared poll to settle dinner choices.",
    faqs: [
      ["How many days do you need in Tokyo?", "Four to five days covers the highlights plus a day trip."],
      ["Is Tokyo easy to navigate without speaking Japanese?", "Yes. Stations and signs include English, and map apps handle most routes."]
    ]
  },
  {
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    tagline: "Rice terraces, temples, surf breaks and slow beach days.",
    why: "Bali offers distinct regions in one small island: cultural Ubud, surf-focused Uluwatu and Canggu, and quieter coastal towns. It suits both active trips and slow wellness trips.",
    bestTime: "The drier season runs roughly April to October. The wetter season brings afternoon downpours but fewer crowds.",
    highlights: [
      "Walk the Tegallalang and Jatiluwih rice terraces",
      "Visit Uluwatu Temple for sunset views",
      "Take a surf lesson in Canggu or Uluwatu",
      "Explore Ubud's art markets and the Sacred Monkey Forest",
      "Snorkel or dive around Nusa Penida and Nusa Lembongan"
    ],
    itinerary: [
      ["Day 1", "Settle in Ubud, rice terraces and a cooking class."],
      ["Day 2", "Temples and waterfalls with a hired driver."],
      ["Day 3", "Move to the coast for a surf lesson and sunset dinner."]
    ],
    groupTips: "Hire a driver for the day and split the cost. Traffic can be slow, so avoid packing the day. Consider a rental villa for larger groups and use the shared budget to track it.",
    faqs: [
      ["How many days do you need in Bali?", "A week lets you see two regions without rushing. Ten days adds time for island hopping."],
      ["Which part of Bali should I stay in?", "Ubud for culture and nature, Canggu for cafés and surf, Uluwatu for cliffs and beaches."]
    ]
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    tagline: "World-class food, museums, markets and ancient history in one huge city.",
    why: "Mexico City combines a deep food scene, major museums and ancient sites in a city of parks and plazas. Neighborhoods feel distinct, so groups can mix and match.",
    bestTime: "November to April is the drier season with pleasant days. The city sits at high altitude, so mornings and evenings can be cool.",
    highlights: [
      "Walk the Zócalo and Centro Histórico",
      "Visit Frida Kahlo's Casa Azul in Coyoacán (book ahead)",
      "Eat at markets such as Mercado de San Juan and Mercado Roma",
      "Explore Chapultepec Park and the National Museum of Anthropology",
      "Day trip to the pyramids of Teotihuacan"
    ],
    itinerary: [
      ["Day 1", "Centro Histórico, Templo Mayor and a rooftop dinner."],
      ["Day 2", "Coyoacán, Casa Azul and Xochimilco in the afternoon."],
      ["Day 3", "Teotihuacan early, then Roma and Condesa for dinner."]
    ],
    groupTips: "Use a rideshare app for evening rides and split the fare in the app. Pace the first day, since altitude can cause fatigue.",
    faqs: [
      ["How many days do you need in Mexico City?", "Four days covers the core sights and a day trip."],
      ["What should I know about altitude?", "The city is about 2,240 meters above sea level. Drink water and take it easy on arrival."]
    ]
  },
  {
    slug: "iceland",
    name: "Iceland",
    country: "Iceland",
    tagline: "Waterfalls, glaciers, geothermal pools and the northern lights.",
    why: "Iceland's landscapes are dramatic and close together. A road trip around the Golden Circle and South Coast works for most groups.",
    bestTime: "June to August has long daylight and open roads. September to March offers a chance at the northern lights. Winter roads need careful planning.",
    highlights: [
      "Drive the Golden Circle: Thingvellir, Geysir and Gullfoss",
      "Stop at Seljalandsfoss and Skógafoss on the South Coast",
      "Walk on Reynisfjara black sand beach (watch the waves)",
      "Soak in a geothermal lagoon",
      "Look for the northern lights on clear winter nights"
    ],
    itinerary: [
      ["Day 1", "Reykjavik, then the Golden Circle loop."],
      ["Day 2", "South Coast waterfalls and black sand beaches."],
      ["Day 3", "Glacier or ice cave tour with a licensed guide, then a geothermal soak."]
    ],
    groupTips: "Rent one larger vehicle and split fuel and rental costs. Check road and weather conditions daily and keep the itinerary flexible.",
    faqs: [
      ["How many days do you need in Iceland?", "Five to seven days covers the South Coast and Golden Circle; a full ring road trip takes about ten."],
      ["When can you see the northern lights?", "Typically from September to March, on dark, clear nights."]
    ]
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    tagline: "Gaudí architecture, beaches, tapas and late nights.",
    why: "Barcelona blends architecture, beach time and food in one walkable, well-connected city. It's an easy first trip to Europe and a strong choice for friend groups.",
    bestTime: "May, June and September are warm without the peak crowds of July and August.",
    highlights: [
      "See the Sagrada Família and Park Güell (book tickets ahead)",
      "Wander the Gothic Quarter and El Born",
      "Eat tapas and visit La Boqueria market",
      "Relax on Barceloneta or Bogatell beach",
      "Day trip to Montserrat for mountain views"
    ],
    itinerary: [
      ["Day 1", "Gothic Quarter, El Born and a tapas crawl."],
      ["Day 2", "Sagrada Família, Eixample and Park Güell at golden hour."],
      ["Day 3", "Montserrat in the morning, beach in the afternoon."]
    ],
    groupTips: "Book major attractions in one group booking and split the cost. Dinner often starts late, so plan lighter afternoons.",
    faqs: [
      ["How many days do you need in Barcelona?", "Three to four days covers the main sights and a day trip."],
      ["Is Barcelona walkable?", "The center is very walkable, with a metro for longer hops."]
    ]
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    tagline: "Mountains, beaches, penguins and wine country in one trip.",
    why: "Cape Town sits between Table Mountain and the ocean, with wine regions and coastal drives close by. It suits adventurous groups and relaxed foodies alike.",
    bestTime: "November to March is warm and dry. Whale season runs roughly from June to November.",
    highlights: [
      "Hike or ride the cable car up Table Mountain (weather permitting)",
      "Drive the Cape Peninsula to Cape Point and Boulders Beach penguins",
      "Visit the Stellenbosch or Franschhoek wine regions",
      "Explore the V&A Waterfront and Bo-Kaap",
      "Watch sunset from Signal Hill or Camps Bay"
    ],
    itinerary: [
      ["Day 1", "Table Mountain in the morning, Waterfront and Bo-Kaap after."],
      ["Day 2", "Cape Peninsula loop with penguins and Cape Point."],
      ["Day 3", "Winelands day trip with a designated driver or tour."]
    ],
    groupTips: "Use licensed tour operators or reputable ride apps, share your trip plan with the group and check local safety advice for each area before you go.",
    faqs: [
      ["How many days do you need in Cape Town?", "Four to five days covers the city, peninsula and winelands."],
      ["When is the best time to visit?", "November to March for beach weather; shoulder months have fewer crowds."]
    ]
  },
  {
    slug: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    tagline: "Skyline views, desert adventures, beaches and standout dining.",
    why: "Dubai mixes record-setting architecture with desert and beach experiences. It's a strong choice for a short, high-energy trip.",
    bestTime: "November to March has the most comfortable temperatures. Summers are very hot, so plan indoor activities.",
    highlights: [
      "Go up the Burj Khalifa observation deck (book ahead)",
      "Take a desert safari with dune driving and a camp dinner",
      "Explore Old Dubai: Al Fahidi, the souks and abra boats",
      "Relax on a public beach near the Marina or Jumeirah",
      "Try rooftop dining with skyline views"
    ],
    itinerary: [
      ["Day 1", "Downtown Dubai, Burj Khalifa at sunset and a fountain show."],
      ["Day 2", "Old Dubai in the morning, beach in the afternoon."],
      ["Day 3", "Desert safari with a dinner camp."]
    ],
    groupTips: "Check dress codes for restaurants and public places, and book popular experiences early. Split taxis and tickets in the app.",
    faqs: [
      ["How many days do you need in Dubai?", "Three to four days covers the highlights."],
      ["What is the best time to visit?", "November to March, when temperatures are milder."]
    ]
  }
];
