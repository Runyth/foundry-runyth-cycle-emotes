// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
// Behavioural suite for Runyth Cycle Emotes, moved from the baseline node harness.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import api from "../scripts/runyth-cycle-emotes.mjs";

test("wildcard and path normalisation", () => {
  assert.equal(api.normalizePattern("tokens/emotes"), "tokens/emotes/*");
  assert.equal(api.normalizePattern("tokens\\emotes\\Hero_*"), "tokens/emotes/Hero_*");
  assert.equal(api.normalizePattern("tokens/emotes/Hero_*.webp"), "tokens/emotes/Hero_*.webp");
  assert.equal(api.normalizePattern("tokens/emotes/Hero.webp"), "tokens/emotes/Hero.webp");
  assert.equal(api.folderFromPattern("tokens/emotes/Hero_*"), "tokens/emotes");
  assert.equal(api.folderFromPattern("tokens/emotes/*"), "tokens/emotes");
});

test("image filtering, sorting, and duplicate removal", () => {
  const records = api.imageRecords([
    "tokens/Hero_10.webp",
    "tokens/Hero_2.webp",
    "tokens/Hero_2.webp",
    "tokens/readme.txt",
    "tokens/Hero_1.PNG"
  ]);
  assert.deepEqual(records.map((r) => r.name), ["Hero_1.PNG", "Hero_2.webp", "Hero_10.webp"]);
});

test("file locator wildcard browse invocation contract", async () => {
  const calls = [];
  const found = await api.browseWildcardImages("tokens/emotes/Hero_*", async (...args) => {
    calls.push(args);
    return { files: ["tokens/emotes/Hero_happy.webp", "tokens/emotes/Hero_angry.png", "tokens/emotes/Hero_note.txt"] };
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "data");
  assert.equal(calls[0][1], "tokens/emotes/Hero_*");
  assert.deepEqual(calls[0][2], { wildcard: true });
  assert.deepEqual(found.map((r) => r.name), ["Hero_angry.png", "Hero_happy.webp"]);
});

test("cache serialisation and parsing used when player file permissions are restricted", () => {
  const cached = [
    { route: "tokens/emotes/Hero_happy.webp", name: "Hero_happy.webp" },
    { route: "tokens/emotes/Hero_angry.png", name: "Hero_angry.png" }
  ];
  const serialized = api.serializeCachedImages(cached);
  assert.deepEqual(api.parseCachedImages(serialized).map((r) => r.route), cached.map((r) => r.route));
});

test("live resolution and player cache fallback", async () => {
  const flagValues = {
    pattern: "tokens/emotes/Aria_*",
    cachedImages: JSON.stringify(["tokens/emotes/Aria_cached.webp"])
  };
  const proto = { getFlag: (_module, key) => flagValues[key] };
  const resolveToken = { actor: { name: "Aria", prototypeToken: proto }, document: {} };
  globalThis.game = { user: { isGM: false } };
  globalThis.FilePicker = {
    browse: async () => ({ files: ["tokens/emotes/Aria_live.webp"] })
  };
  assert.deepEqual((await api.resolveTokenImages(resolveToken)).map((r) => r.name), ["Aria_live.webp"]);
  globalThis.FilePicker.browse = async () => { throw new Error("permission denied"); };
  assert.deepEqual((await api.resolveTokenImages(resolveToken)).map((r) => r.name), ["Aria_cached.webp"]);
});

test("hook registration mirrors the Foundry v13 lifecycle", () => {
  const registered = { once: [], on: [] };
  globalThis.Hooks = {
    once: (name, fn) => registered.once.push([name, fn]),
    on: (name, fn) => registered.on.push([name, fn])
  };
  api.registerHooks();
  assert.equal(registered.once.length, 1);
  assert.equal(registered.once[0][0], "init");
  registered.once[0][1]();
  assert.deepEqual(registered.on.map(([name]) => name).sort(), ["renderPrototypeTokenConfig", "renderTokenHUD"]);
});

test("chat content contains the selected image and no artwork references", () => {
  globalThis.game = {
    i18n: {
      format: (_key, data) => `Chat image from ${data.name}`,
      localize: (key) => key
    },
    user: { id: "USER-1" }
  };
  const token = { actor: { name: "Aria" }, document: { name: "Aria Token", parent: { id: "SCENE-1" } } };
  const html = api.makeChatContent({ route: "tokens/emotes/Aria_smile.webp" }, token);
  assert.match(html, /Aria_smile\.webp/);
  assert.match(html, /Chat image from Aria/);
  assert.doesNotMatch(html, /texture\.src|actor\.img/);
});

test("the chat message is public and carries exactly the selected path", async () => {
  globalThis.ChatMessage = {
    getSpeaker: (options) => ({ alias: options.actor.name }),
    create: async (data) => data
  };
  const token = { actor: { name: "Aria" }, document: { name: "Aria Token", parent: { id: "SCENE-1" } } };
  let created = null;
  const originalCreate = globalThis.ChatMessage.create;
  globalThis.ChatMessage.create = async (data) => {
    created = data;
    return originalCreate(data);
  };
  const posted = await api.postImageToChat(token, { route: "tokens/emotes/Aria_angry.webp", name: "Aria_angry.webp" });
  assert.equal(posted, true);
  assert.equal(created.user, "USER-1");
  assert.deepEqual(created.whisper, []);
  assert.equal(created.blind, false);
  assert.match(created.content, /Aria_angry\.webp/);
  assert.equal(created.flags[api.MODULE_ID].image, "tokens/emotes/Aria_angry.webp");
});

test("static guard: the module source writes no artwork fields", () => {
  const source = readFileSync(new URL("../scripts/runyth-cycle-emotes.mjs", import.meta.url), "utf8");
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(executable, /texture\.src\s*=/);
  assert.doesNotMatch(executable, /actor\.img\s*=/);
  assert.doesNotMatch(executable, /token\.document\.update\s*\(/);
});
