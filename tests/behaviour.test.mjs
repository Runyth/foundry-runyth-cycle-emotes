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
    { route: "tokens/emotes/Hero_angry.png", name: "Hero_angry.png" },
    { route: "tokens/emotes/Hero_happy.webp", name: "Hero_happy.webp" }
  ];
  const serialized = api.serializeCachedImages(cached);
  assert.deepEqual(api.parseCachedImages(serialized).map((r) => r.route), cached.map((r) => r.route));
  assert.deepEqual(
    api.parseCachedImages(JSON.stringify(["tokens/emotes/Hero_happy.webp", "tokens/emotes/Hero_angry.png"])).map((r) => r.route),
    ["tokens/emotes/Hero_angry.png", "tokens/emotes/Hero_happy.webp"]
  );
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

/* A minimal DOM sufficient for the Prototype Token Appearance section paths:
   comma-separated selectors of tag, .class and [attr="value"] parts. */
function parseAttributeList(raw) {
  const attributes = {};
  for (const [, name, value] of raw.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
    attributes[name] = value ?? "";
  }
  return attributes;
}

function attachElement(parent, piece) {
  parent.children.push(piece);
  piece.parentElement = parent;
}

function miniDom(tag, attributes = {}) {
  const element = {
    tag,
    attributes,
    classes: String(attributes.class ?? "").split(/\s+/).filter(Boolean),
    children: [],
    parentElement: null,
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    appendChild(child) {
      attachElement(element, child);
      return child;
    },
    insertAdjacentElement(position, target) {
      if (!element.parentElement) return target;
      const siblings = element.parentElement.children;
      if (position === "afterend") siblings.splice(siblings.indexOf(element) + 1, 0, target);
      else siblings.splice(siblings.indexOf(element), 0, target);
      target.parentElement = element.parentElement;
      return target;
    },
    insertAdjacentHTML(position, html) {
      for (const piece of parseHtmlFragment(html)) {
        if (position === "afterend" && element.parentElement) {
          const siblings = element.parentElement.children;
          siblings.splice(siblings.indexOf(element) + 1, 0, piece);
          piece.parentElement = element.parentElement;
        } else {
          attachElement(element, piece);
        }
      }
    },
    get nextElementSibling() {
      if (!element.parentElement) return null;
      const siblings = element.parentElement.children;
      return siblings[siblings.indexOf(element) + 1] ?? null;
    },
    querySelectorAll(selector) {
      return [...descendants(element)].filter(node => matchesSelector(node, selector));
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] ?? null;
    }
  };
  return element;
}

function* descendants(element) {
  for (const child of element.children) {
    yield child;
    yield* descendants(child);
  }
}

function matchesSelector(node, selector) {
  return selector.split(",").some(part => {
    const trimmed = part.trim();
    const tagMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9]*)[\s.[]/);
    if (tagMatch && node.tag !== tagMatch[1]) return false;
    for (const className of trimmed.match(/\.([a-zA-Z0-9_-]+)/g) ?? []) {
      if (!node.classes.includes(className.slice(1))) return false;
    }
    for (const [, name, value] of trimmed.matchAll(/\[([a-zA-Z-]+)(?:="([^"]*)")?\]/g)) {
      if (node.attributes[name] !== (value ?? "")) return false;
    }
    return Boolean(tagMatch || /\.|\[/.test(trimmed));
  });
}

function parseHtmlFragment(html) {
  const roots = [];
  const stack = [];
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)(\/?)>/g)) {
    const [full, closing, tag, rawAttributes] = match;
    if (closing) {
      stack.pop();
      continue;
    }
    const parent = stack.at(-1) ?? null;
    const element = miniDom(tag, parseAttributeList(rawAttributes));
    if (parent) attachElement(parent, element);
    else roots.push(element);
    if (!full.endsWith("/>")) stack.push(element);
  }
  return roots;
}

const FIELD_HTML = '<fieldset class="rce-config-fieldset"><div class="form-fields"><input class="rce-pattern-input"></input><input class="rce-cache-input"></input></div></fieldset>';

function configEnvironment() {
  const appearance = miniDom("div", { class: "tab", "data-tab": "appearance" });
  const root = miniDom("div", { class: "window-content" });
  root.appendChild(appearance);
  const config = { token: { getFlag: () => undefined } };
  globalThis.game = { user: { isGM: true } };
  globalThis.renderTemplate = async () => FIELD_HTML;
  return { root, appearance, config };
}

function addTokenSection(appearance) {
  const tokenField = miniDom("fieldset", { class: "runyth-cycle-token-config" });
  tokenField.appendChild(miniDom("div", { class: "token-legend" }));
  appearance.appendChild(tokenField);
  return tokenField;
}

const tokenSectionOf = (panel) => panel.querySelector("fieldset.runyth-cycle-token-config");
const emoteSectionOf = (panel) => panel.querySelector(".rce-config-fieldset");
const flushRenderQueue = () => new Promise((resolve) => setTimeout(resolve, 0));

test("with Cycle Token present, the emote section is inserted directly below it", async () => {
  const { root, appearance, config } = configEnvironment();
  const tokenField = addTokenSection(appearance);
  await api.renderPrototypeTokenConfig(config, root);
  assert.equal(tokenField.nextElementSibling, emoteSectionOf(appearance));
  assert.equal(emoteSectionOf(appearance).nextElementSibling, null);
  assert.deepEqual([...appearance.children].map(node => node.classes[0]), ["runyth-cycle-token-config", "rce-config-fieldset"]);
});

test("when the sibling module dispatches later, the reconciler moves the emote section below it", async () => {
  const { root, appearance, config } = configEnvironment();
  const render = api.renderPrototypeTokenConfig(config, root);
  addTokenSection(appearance);
  await render;
  await flushRenderQueue();
  assert.equal(tokenSectionOf(appearance).nextElementSibling, emoteSectionOf(appearance));
  assert.equal(appearance.children.length, 2);
});

test("without Cycle Token, the emote section keeps its appended, independent placement", async () => {
  const { root, appearance, config } = configEnvironment();
  await api.renderPrototypeTokenConfig(config, root);
  assert.ok(emoteSectionOf(appearance));
  assert.ok(!tokenSectionOf(appearance));
  assert.equal(appearance.children.at(-1), emoteSectionOf(appearance));
});

test("repeated renders are idempotent: one section only, order still below Cycle Token", async () => {
  const { root, appearance, config } = configEnvironment();
  await api.renderPrototypeTokenConfig(config, root);
  const emotes = emoteSectionOf(appearance);
  await api.renderPrototypeTokenConfig(config, root);
  assert.equal(appearance.querySelectorAll(".rce-config-fieldset").length, 1);
  assert.equal(emoteSectionOf(appearance), emotes);
  assert.equal(appearance.children.at(-1), emotes);
  addTokenSection(appearance);
  await api.renderPrototypeTokenConfig(config, root);
  await flushRenderQueue();
  assert.equal(tokenSectionOf(appearance).nextElementSibling, emoteSectionOf(appearance));
});
