import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public");

const staticFiles = [
  "admin.html",
  "app.js",
  "usability.js",
  "trip-management.js",
  "live-weather.js",
  "messaging-contacts.js",
  "messaging.css",
  "planning-studio.js",
  "planning-studio.css",
  "trip-workspaces.js",
  "trip-workspaces.css",
  "journey-dashboard.js",
  "journey-dashboard.css",
  "photo-feed.js",
  "photo-feed.css",
  "trip-joy.js",
  "trip-joy.css",
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
    await writeFile(resolve(output, file), html.replace("<head>", '<head>\n  <base href="/">'));
  } else {
    await cp(resolve(root, file), resolve(output, file));
  }
}

for (const directory of staticDirectories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

console.log(
  `Prepared Vercel static output with ${staticFiles.length} files and ${staticDirectories.length} asset directories.`,
);
