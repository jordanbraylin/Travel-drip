import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDestinationPages, buildSitemap } from "./build-destinations.js";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public");

const staticFiles = [
  "adventure-social.css",
  "adventure-social.js",
  "admin.html",
  "app.js",
  "auth-workflows.js",
  "auth-workflows.css",
  "usability.js",
  "trip-management.js",
  "live-weather.js",
  "messaging-contacts.js",
  "messaging.css",
  "planning-studio.js",
  "planning-studio.css",
  "trip-workspaces.js",
  "trip-itinerary.js",
  "trip-workspaces.css",
  "journey-dashboard.js",
  "journey-dashboard.css",
  "photo-feed.js",
  "passport-book.js",
  "passport-book.css",
  "photo-feed.css",
  "trip-joy.js",
  "trip-joy.css",
  "discovery-studio.js",
  "discovery-studio.css",
  "planner-conversation.js",
  "planner-conversation.css",
  "simple.css",
  "index.html",
  "login.html",
  "manifest.webmanifest",
  "navigation.css",
  "offline.html",
  "privacy.html",
  "public-config.js",
  "register.html",
  "robots.txt",
  "styles.css",
  "sw.js",
  "terms.html",
];

const staticDirectories = ["icons", "vendor"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of staticFiles) {
  if (file === "index.html") {
    // Root-relative deployment assets also work when a nested route is refreshed.
    const html = await readFile(resolve(root, file), "utf8");
    // Internal readiness/QA panels (marked data-dev-panel) are for local previews only.
    const publicHtml = html.replace(/<section\b[^>]*\bdata-dev-panel\b[^>]*>[\s\S]*?<\/section>\s*/g, "");
    await writeFile(resolve(output, file), publicHtml.replace("<head>", '<head>\n  <base href="/">'));
  } else {
    await cp(resolve(root, file), resolve(output, file));
  }
}

for (const directory of staticDirectories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

const destinationPaths = await buildDestinationPages(output);
await writeFile(resolve(output, "sitemap.xml"), buildSitemap(destinationPaths));

console.log(
  `Prepared Vercel static output with ${staticFiles.length} files and ${staticDirectories.length} asset directories.`,
);
