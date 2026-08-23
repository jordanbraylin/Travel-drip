import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const checkedAssets = new Set();

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => failures.push(message);

const requiredFiles = [
  "index.html",
  "admin.html",
  "offline.html",
  "manifest.webmanifest",
  "sw.js",
  "app.js",
  "styles.css",
  "navigation.css",
  "public-config.js",
  "vercel.json",
  "api/corporate-bookings.js",
  "api/_corporate-policy.js",
  "supabase-corporate-booking.sql",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required app file: ${file}`);
}

const htmlFiles = ["index.html", "admin.html", "offline.html", "login.html", "register.html", "privacy.html", "terms.html"];
const localReferencePattern = /\b(?:src|href)="([^"]+)"/g;

for (const htmlFile of htmlFiles) {
  if (!exists(htmlFile)) {
    fail(`Missing HTML page: ${htmlFile}`);
    continue;
  }
  const html = read(htmlFile);
  for (const match of html.matchAll(localReferencePattern)) {
    const reference = match[1];
    if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(reference)) continue;
    const localPath = reference.split(/[?#]/, 1)[0].replace(/^\//, "");
    if (!localPath || localPath.endsWith("/")) continue;
    checkedAssets.add(localPath);
    if (!exists(localPath)) fail(`${htmlFile} references missing asset: ${reference}`);
  }
}

const collectJavaScript = (directory) => {
  if (!exists(directory)) return [];
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(relativePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [relativePath] : [];
  });
};

const javascriptFiles = ["app.js", "sw.js", "public-config.js", ...collectJavaScript("api"), ...collectJavaScript("scripts")];
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail(`${file} has invalid JavaScript: ${(result.stderr || result.stdout).trim()}`);
}

if (exists("manifest.webmanifest") && exists("vercel.json")) {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const vercel = JSON.parse(read("vercel.json"));
  const rewrites = new Set((vercel.rewrites || []).map((rewrite) => rewrite.source));
  for (const shortcut of manifest.shortcuts || []) {
    const shortcutPath = new URL(shortcut.url, "https://travel-drip.test").pathname;
    if (shortcutPath !== "/" && !rewrites.has(shortcutPath)) {
      fail(`Manifest shortcut has no matching Vercel rewrite: ${shortcutPath}`);
    }
  }
}

for (const script of ["scripts/validate-pwa.js", "scripts/verify-links-search-booking.js"]) {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${script} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

if (failures.length) {
  console.error("Travel-Drip smoke test failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Travel-Drip smoke test passed.");
console.log(`HTML pages checked: ${htmlFiles.length}`);
console.log(`Local assets checked: ${checkedAssets.size}`);
console.log(`JavaScript files checked: ${javascriptFiles.length}`);
console.log("PWA parity, manifest shortcuts, routes, links, and static API surface: PASS");
