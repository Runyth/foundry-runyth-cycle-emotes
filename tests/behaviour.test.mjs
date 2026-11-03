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
  assert.deepEqual(registered.on.map(([name]) => name).sort(), ["canvasTearDown", "renderPrototypeTokenConfig", "renderTokenHUD"]);
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
    get dataset() {
      const self = element;
      const kebab = property => "data-" + String(property).replace(/[A-Z]/g, c => "-" + c.toLowerCase());
      return new Proxy({}, {
        get: (_target, property) => self.attributes[kebab(property)] ?? "",
        set: (_target, property, value) => { self.attributes[kebab(property)] = value; return true; }
      });
    },
    appendChild(child) {
      attachElement(element, child);
      return child;
    },
    insertAdjacentElement(position, target) {
      // A real DOM moves the node: detach it from wherever it currently lives first.
      const origin = target.parentElement;
      if (origin) {
        const at = origin.children.indexOf(target);
        if (at >= 0) origin.children.splice(at, 1);
      }
      if (!element.parentElement) {
        attachElement(element, target);
        return target;
      }
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
    const quoted = trimmed.replace(/"[^"]*"/g, '""');
    for (const className of quoted.match(/\.([a-zA-Z0-9_-]+)/g) ?? []) {
      if (!node.classes.includes(className.slice(1))) return false;
    }
    for (const [, name, value] of trimmed.matchAll(/\[([a-zA-Z-]+)(?:="([^"]*)")?\]/g)) {
      if (node.attributes[name] !== (value ?? "")) return false;
    }
    return Boolean(tagMatch || /\.|\[/.test(quoted));
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

/* --- Token HUD ordering contract -----------------------------------------
   Runyth Cycle Portrait (active) outranks Runyth Cycle Token; the emote
   control sits directly below the highest-ranked rendered sibling. Siblings
   are located by module-id markers, never by artwork. */

const HUD_HTML = '<div class="control-icon rce-hud-control" data-action="rce-selector" data-tooltip="RCE.Title"><div class="rce-selector-wrap"></div><button type="button" class="rce-image-button" data-index="0" data-tooltip="Hero_happy.webp" aria-label="Hero_happy.webp"></button></div>';

function hudEnvironment({ portrait = null, token = null } = {}) {
  const right = miniDom("div", { class: "col right" });
  const root = miniDom("div", { class: "token-hud" });
  root.appendChild(right);
  const tokenDoc = { getFlag: (_m, key) => key === "pattern" ? "tokens/emotes/*" : undefined };
  const app = { object: { document: tokenDoc, actor: { prototypeToken: tokenDoc } } };
  globalThis.game = {
    modules: {
      get: id => ({ active: id === portrait || id === token ? true : false })
    },
    user: { isGM: true }
  };
  globalThis.renderTemplate = async () => HUD_HTML;
  globalThis.FilePicker = { browse: async () => ({ files: ["tokens/emotes/Hero_happy.webp"] }) };
  return { root, right, app };
}

function makeTokenHudButton() {
  const button = miniDom("button", { class: "control-icon runyth-cycle-token-hud" });
  button.appendChild(miniDom("span", { class: "rct-hud-emoji" }));
  return button;
}

function makePortraitHudButton() {
  const button = miniDom("button", { class: "control-icon rcp-hud-button", "data-module": "runyth-cycle-portrait" });
  button.appendChild(miniDom("span", { class: "rcp-hud-emoji" }));
  return button;
}

const emoteHudControl = panel => panel.querySelector('[data-action="rce-selector"]');
const classesByKey = panel => [...panel.children].map(node => node.attributes["data-module"] ?? node.classes[1] ?? node.classes[0]);

test("HUD: with Portrait and Token active, the control lands directly below Portrait", async () => {
  const { root, right, app } = hudEnvironment({ portrait: "runyth-cycle-portrait", token: "runyth-cycle-token" });
  right.appendChild(makeTokenHudButton());
  right.appendChild(makePortraitHudButton());
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.deepEqual(classesByKey(right), ["runyth-cycle-token-hud", "runyth-cycle-portrait", "runyth-cycle-emotes"]);
  assert.equal(classesByKey(right).at(-1), "runyth-cycle-emotes");
  assert.equal(right.children[1].nextElementSibling, emoteHudControl(right));
});

test("HUD: with only Token active, the control lands directly below Token", async () => {
  const { root, right, app } = hudEnvironment({ token: "runyth-cycle-token" });
  right.appendChild(makeTokenHudButton());
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.deepEqual(classesByKey(right), ["runyth-cycle-token-hud", "runyth-cycle-emotes"]);
});

test("HUD: a Portrait control without an active module never outranks Token", async () => {
  const { root, right, app } = hudEnvironment({ token: "runyth-cycle-token" });
  right.appendChild(makeTokenHudButton());
  right.appendChild(makePortraitHudButton());
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.deepEqual(classesByKey(right), ["runyth-cycle-token-hud", "runyth-cycle-emotes", "runyth-cycle-portrait"]);
});

test("HUD: without active siblings the control keeps its independent appended place", async () => {
  const { root, right, app } = hudEnvironment();
  right.appendChild(miniDom("button", { class: "control-icon unrelated-sibling" }));
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.deepEqual(classesByKey(right), ["unrelated-sibling", "runyth-cycle-emotes"]);
});

test("HUD: siblings that arrive after our control are caught by the reconciliation", async () => {
  const { root, right, app } = hudEnvironment({ portrait: "runyth-cycle-portrait", token: "runyth-cycle-token" });
  const render = api.renderTokenHUD(app, root);
  right.appendChild(makePortraitHudButton());
  right.appendChild(makeTokenHudButton());
  await render;
  await flushRenderQueue();
  // Our invariant: directly below the highest-ranked active sibling. The mutual
  // Token-vs-Portrait order is Cycle Token's own hud-order job, never ours.
  assert.deepEqual(classesByKey(right), ["runyth-cycle-portrait", "runyth-cycle-emotes", "runyth-cycle-token-hud"]);
  assert.equal(right.children[0].nextElementSibling, emoteHudControl(right));
});

test("HUD: a sibling in another column is never adopted across parents", async () => {
  const { root, right, app } = hudEnvironment({ portrait: "runyth-cycle-portrait", token: "runyth-cycle-token" });
  const left = miniDom("div", { class: "col left" });
  root.appendChild(left);
  left.appendChild(makePortraitHudButton());
  right.appendChild(makeTokenHudButton());
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.deepEqual(classesByKey(right), ["runyth-cycle-token-hud", "runyth-cycle-emotes"]);
  assert.equal(left.children[0].attributes["data-module"], "runyth-cycle-portrait");
});

test("HUD: repeated renders with the HUD root still present stay idempotent", async () => {
  const { root, right, app } = hudEnvironment({ portrait: "runyth-cycle-portrait", token: "runyth-cycle-token" });
  right.appendChild(makeTokenHudButton());
  right.appendChild(makePortraitHudButton());
  await api.renderTokenHUD(app, root);
  const first = emoteHudControl(right);
  await api.renderTokenHUD(app, root);
  await flushRenderQueue();
  assert.equal(emoteHudControl(right), first);
  assert.deepEqual(classesByKey(right), ["runyth-cycle-token-hud", "runyth-cycle-portrait", "runyth-cycle-emotes"]);
});
