import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public");

const staticFiles = [
  "admin.html",
  "app.js",
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

const staticDirectories = ["documents", "icons"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of staticFiles) {
  await cp(resolve(root, file), resolve(output, file));
}

for (const directory of staticDirectories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

console.log(
  `Prepared Vercel static output with ${staticFiles.length} files and ${staticDirectories.length} asset directories.`,
);
