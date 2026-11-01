"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
assert.equal(manifest.id, "token-hud-emotes");
assert.equal(manifest.compatibility.minimum, "13");
assert.equal(manifest.compatibility.verified, "13");

for (const relative of [...manifest.scripts, ...manifest.styles, ...manifest.languages.map((l) => l.path)]) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing manifest file: ${relative}`);
}
for (const language of manifest.languages) {
  JSON.parse(fs.readFileSync(path.join(root, language.path), "utf8"));
}
for (const relative of ["templates/config-field.html", "templates/hud.html", "README.md", "LICENSE"]) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing package file: ${relative}`);
}
console.log("Package manifest and localization validation passed.");
