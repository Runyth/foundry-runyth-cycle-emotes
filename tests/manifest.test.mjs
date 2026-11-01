// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
// Manifest, URL, and package-integrity checks for Runyth Cycle Emotes.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = (name) => path.join(root, name);
const readJson = (name) => JSON.parse(readFileSync(repo(name), "utf8"));

const manifest = readJson("module.json");

test("manifest identity", () => {
  assert.equal(manifest.id, "runyth-cycle-emotes");
  assert.equal(manifest.title, "Runyth Cycle Emotes");
  assert.equal(manifest.authors.length, 1);
  assert.equal(manifest.authors[0].name, "Runyth");
  assert.equal(manifest.authors[0].url, "https://github.com/Runyth");
});

test("manifest URL surfaces", () => {
  const version = manifest.version;
  assert.equal(manifest.license, "LICENSE");
  assert.equal(manifest.url, "https://github.com/Runyth/foundry-runyth-cycle-emotes");
  assert.equal(manifest.manifest, "https://github.com/Runyth/foundry-runyth-cycle-emotes/releases/latest/download/module.json");
  assert.equal(
    manifest.download,
    `https://github.com/Runyth/foundry-runyth-cycle-emotes/releases/download/v${version}/runyth-cycle-emotes-v${version}-mod.zip`
  );
});

test("manifest runtime files and localization trees", () => {
  assert.equal(manifest.compatibility.minimum, "13");
  assert.ok(manifest.compatibility.verified);
  for (const entry of manifest.esmodules) {
    assert.ok(existsSync(repo(entry)), `${entry} must exist`);
    assert.match(entry, /scripts\/runyth-cycle-emotes\.mjs$/);
  }
  for (const style of manifest.styles) {
    assert.ok(existsSync(repo(style)), `${style} must exist`);
  }
  for (const language of manifest.languages) {
    assert.ok(existsSync(repo(language.path)), `${language.path} must exist`);
    assert.doesNotThrow(() => JSON.parse(readFileSync(repo(language.path), "utf8")));
  }
  for (const template of ["templates/config-field.html", "templates/hud.html"]) {
    assert.ok(existsSync(repo(template)), `${template} must exist`);
  }
  assert.ok(existsSync(repo("README.md")));
  assert.ok(existsSync(repo("CHANGELOG.md")));
});

test("the localization namespace follows the module family prefix", () => {
  for (const language of manifest.languages) {
    const data = JSON.parse(readFileSync(repo(language.path), "utf8"));
    for (const key of Object.keys(data)) {
      assert.match(key, /^RCE\./, `${language.path} key ${key}`);
    }
  }
});

test("no volunteer identity surface remains on runtime surfaces", () => {
  const importedId = ["token-", "hud-emotes"].join("");
  for (const file of ["module.json", ...manifest.esmodules, ...manifest.styles, ...manifest.languages.map((row) => row.path), "templates/config-field.html", "templates/hud.html"]) {
    const text = readFileSync(repo(file), "utf8");
    assert.ok(!text.includes(importedId), `${file} must not carry the imported identity`);
    for (const needle of ["thci", "THCI"]) {
      assert.ok(!text.includes(needle), `${file} carries ${needle}`);
    }
  }
});
