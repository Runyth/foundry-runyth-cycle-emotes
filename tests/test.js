"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");

// Load without Foundry globals; the module exposes pure helpers for tests.
const api = require(path.join(__dirname, "..", "scripts", "token-hud-emotes.js"));

async function run() {
  // 1) Wildcard/path normalization.
  assert.equal(api.normalizePattern("tokens/emotes"), "tokens/emotes/*");
  assert.equal(api.normalizePattern("tokens\\emotes\\Hero_*"), "tokens/emotes/Hero_*");
  assert.equal(api.normalizePattern("tokens/emotes/Hero_*.webp"), "tokens/emotes/Hero_*.webp");
  assert.equal(api.normalizePattern("tokens/emotes/Hero.webp"), "tokens/emotes/Hero.webp");
  assert.equal(api.folderFromPattern("tokens/emotes/Hero_*"), "tokens/emotes");
  assert.equal(api.folderFromPattern("tokens/emotes/*"), "tokens/emotes");

  // 2) Image filtering, sorting, and duplicate removal.
  const records = api.imageRecords([
    "tokens/Hero_10.webp",
    "tokens/Hero_2.webp",
    "tokens/Hero_2.webp",
    "tokens/readme.txt",
    "tokens/Hero_1.PNG"
  ]);
  assert.deepEqual(records.map((r) => r.name), ["Hero_1.PNG", "Hero_2.webp", "Hero_10.webp"]);

  // 3) Foundry wildcard browse invocation contract.
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

  // 4) Cache serialization/parsing used when player FilePicker permissions are restricted.
  const serialized = api.serializeCachedImages(found);
  assert.deepEqual(api.parseCachedImages(serialized).map((r) => r.route), found.map((r) => r.route));

  // 5) Live resolution and player cache fallback.
  const flagValues = {
    pattern: "tokens/emotes/Aria_*",
    cachedImages: JSON.stringify(["tokens/emotes/Aria_cached.webp"])
  };
  const proto = { getFlag: (_module, key) => flagValues[key] };
  const resolveToken = { actor: { name: "Aria", prototypeToken: proto }, document: {} };
  global.game = { user: { isGM: false } };
  global.FilePicker = {
    browse: async () => ({ files: ["tokens/emotes/Aria_live.webp"] })
  };
  assert.deepEqual((await api.resolveTokenImages(resolveToken)).map((r) => r.name), ["Aria_live.webp"]);
  global.FilePicker.browse = async () => { throw new Error("permission denied"); };
  assert.deepEqual((await api.resolveTokenImages(resolveToken)).map((r) => r.name), ["Aria_cached.webp"]);

  // 6) Hook registration mirrors the Foundry lifecycle expected by v13.
  const registered = { once: [], on: [] };
  global.Hooks = {
    once: (name, fn) => registered.once.push([name, fn]),
    on: (name, fn) => registered.on.push([name, fn])
  };
  api.registerHooks();
  assert.equal(registered.once.length, 1);
  assert.equal(registered.once[0][0], "init");
  registered.once[0][1]();
  assert.deepEqual(registered.on.map(([name]) => name).sort(), ["renderPrototypeTokenConfig", "renderTokenHUD"]);

  // 7) Chat content contains selected image and does not reference token artwork updates.
  global.game = {
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

  // 8) ChatMessage.create receives a public message and exactly the selected path.
  let created = null;
  global.ChatMessage = {
    getSpeaker: (options) => ({ alias: options.actor.name }),
    create: async (data) => { created = data; return data; }
  };
  const posted = await api.postImageToChat(token, { route: "tokens/emotes/Aria_angry.webp", name: "Aria_angry.webp" });
  assert.equal(posted, true);
  assert.equal(created.user, "USER-1");
  assert.deepEqual(created.whisper, []);
  assert.equal(created.blind, false);
  assert.match(created.content, /Aria_angry\.webp/);
  assert.equal(created.flags[api.MODULE_ID].image, "tokens/emotes/Aria_angry.webp");

  // 9) Static behavioral guard: module must not write any artwork fields.
  const fs = require("node:fs");
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "token-hud-emotes.js"), "utf8");
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(executable, /texture\.src\s*=/);
  assert.doesNotMatch(executable, /actor\.img\s*=/);
  assert.doesNotMatch(executable, /token\.document\.update\s*\(/);

  console.log("All Token HUD Emotes tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
