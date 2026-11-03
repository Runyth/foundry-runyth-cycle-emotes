// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
const MODULE_ID = "runyth-cycle-emotes";
const FLAG_PATTERN = "pattern";
const FLAG_CACHE = "cachedImages";
const CONFIG_TEMPLATE = `/modules/${MODULE_ID}/templates/config-field.html`;
const HUD_TEMPLATE = `/modules/${MODULE_ID}/templates/hud.html`;
const CYCLE_TOKEN_SECTION = "fieldset.runyth-cycle-token-config";
const RCE_SECTION = ".rce-config-fieldset";
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const WILDCARD_CHARACTER = /[*?{}\[\]]/;

function getRootElement(html) {
  if (!html) return null;
  if (typeof html.querySelector === "function") return html;
  if (html[0] && typeof html[0].querySelector === "function") return html[0];
  return null;
}

function normalizePattern(value) {
  const pattern = String(value ?? "").trim().replace(/\\/g, "/");
  if (!pattern) return "";
  if (WILDCARD_CHARACTER.test(pattern) || IMAGE_EXTENSION.test(pattern)) return pattern;
  return `${pattern.replace(/\/+$/, "")}/*`;
}

function folderFromPattern(value) {
  const pattern = String(value ?? "").trim().replace(/\\/g, "/");
  if (!pattern) return "";
  const wildcardIndex = pattern.search(WILDCARD_CHARACTER);
  const stable = wildcardIndex >= 0 ? pattern.slice(0, wildcardIndex) : pattern;
  if (!stable) return "";
  if (stable.endsWith("/")) return stable.replace(/\/+$/, "");
  const slash = stable.lastIndexOf("/");
  if (slash < 0) return "";
  return stable.slice(0, slash);
}

function filenameFromPath(path) {
  const raw = String(path ?? "").split(/[?#]/, 1)[0].split("/").pop() || String(path ?? "");
  try {
    return decodeURIComponent(raw);
  } catch (_err) {
    return raw;
  }
}

function isImagePath(path) {
  return IMAGE_EXTENSION.test(String(path ?? ""));
}

function imageRecords(paths) {
  return [...new Set((paths ?? []).filter(isImagePath))]
    .sort((a, b) => filenameFromPath(a).localeCompare(filenameFromPath(b), undefined, { numeric: true, sensitivity: "base" }))
    .map((route) => ({ route, name: filenameFromPath(route) }));
}

function parseCachedImages(value) {
  if (Array.isArray(value)) return imageRecords(value);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? imageRecords(parsed) : [];
  } catch (_err) {
    return [];
  }
}

function serializeCachedImages(images) {
  const paths = (images ?? []).map((entry) => typeof entry === "string" ? entry : entry?.route).filter(Boolean);
  return JSON.stringify([...new Set(paths)]);
}

async function browseWildcardImages(pattern, browse = globalThis.FilePicker?.browse) {
  const normalized = normalizePattern(pattern);
  if (!normalized || typeof browse !== "function") return [];

  if (!WILDCARD_CHARACTER.test(normalized) && isImagePath(normalized)) {
    return imageRecords([normalized]);
  }

  const result = await browse.call(globalThis.FilePicker, "data", normalized, { wildcard: true });
  return imageRecords(result?.files ?? []);
}

function getFlag(document, key) {
  try {
    return document?.getFlag?.(MODULE_ID, key);
  } catch (_err) {
    return undefined;
  }
}

function getPrototypeToken(token) {
  return token?.actor?.prototypeToken ?? token?.document?.actor?.prototypeToken ?? null;
}

function getPatternForToken(token) {
  const prototypeToken = getPrototypeToken(token);
  return getFlag(prototypeToken, FLAG_PATTERN) || getFlag(token?.document, FLAG_PATTERN) || "";
}

function getCachedImagesForToken(token) {
  const prototypeToken = getPrototypeToken(token);
  const raw = getFlag(prototypeToken, FLAG_CACHE) ?? getFlag(token?.document, FLAG_CACHE) ?? "[]";
  return parseCachedImages(raw);
}

async function resolveTokenImages(token) {
  const pattern = getPatternForToken(token);
  if (!pattern) return [];

  const cached = getCachedImagesForToken(token);
  try {
    const live = await browseWildcardImages(pattern);
    if (live.length || globalThis.game?.user?.isGM || !cached.length) return live;
    return cached;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not browse wildcard path; falling back to cached images.`, error);
    if (cached.length) return cached;
    return [];
  }
}

function escapeHTML(value) {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localize(key, data) {
  if (data && globalThis.game?.i18n?.format) return game.i18n.format(key, data);
  if (globalThis.game?.i18n?.localize) return game.i18n.localize(key);
  return key;
}

function makeChatContent(image, token) {
  const actorName = token?.actor?.name || token?.document?.name || "Token";
  const alt = localize("RCE.ChatAlt", { name: actorName });
  return `<div class="rce-chat-card"><img class="rce-chat-image" src="${escapeHTML(image.route)}" alt="${escapeHTML(alt)}"></div>`;
}

async function postImageToChat(token, image) {
  if (!image?.route || !globalThis.ChatMessage?.create) return false;
  try {
    const speaker = ChatMessage.getSpeaker({
      actor: token?.actor,
      token: token?.document,
      scene: token?.document?.parent
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker,
      content: makeChatContent(image, token),
      whisper: [],
      blind: false,
      flags: {
        [MODULE_ID]: {
          image: image.route
        }
      }
    });
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to create chat message.`, error);
    globalThis.ui?.notifications?.error?.(localize("RCE.PostError"));
    return false;
  }
}

async function updateConfigPreview(root, patternInput, cacheInput, status) {
  const pattern = normalizePattern(patternInput?.value);
  if (!pattern) {
    if (cacheInput) cacheInput.value = "[]";
    if (status) {
      status.textContent = localize("RCE.NoPattern");
      status.classList.remove("rce-error");
    }
    return [];
  }

  try {
    const images = await browseWildcardImages(pattern);
    if (cacheInput) cacheInput.value = serializeCachedImages(images);
    if (status) {
      status.textContent = images.length
        ? localize("RCE.ImagesFound", { count: images.length })
        : localize("RCE.NoImagesFound");
      status.classList.remove("rce-error");
    }
    return images;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not preview wildcard path.`, error);
    if (status) {
      status.textContent = localize("RCE.PathError");
      status.classList.add("rce-error");
    }
    return [];
  }
}

/**
 * Keep this section ordered beside Runyth Cycle Token: when the sibling module
 * rendered its own Appearance fieldset, the emote section sits directly below,
 * regardless of which module dispatched first. Only our fieldset is moved;
 * the sibling section is never touched.
 */
function placeBelowCycleToken(appearanceTab, rceFieldset) {
  if (!appearanceTab || !rceFieldset) return;
  const tokenSection = appearanceTab.querySelector(CYCLE_TOKEN_SECTION);
  if (!tokenSection || tokenSection.parentElement !== rceFieldset.parentElement) return;
  if (tokenSection.nextElementSibling === rceFieldset) return;
  tokenSection.insertAdjacentElement("afterend", rceFieldset);
}

async function renderPrototypeTokenConfig(config, html) {
  if (!globalThis.game?.user?.isGM) return;
  const root = getRootElement(html);
  if (!root) return;

  const appearanceTab = root.querySelector('.tab[data-tab="appearance"], .tab[data-tab="image"]');
  if (!appearanceTab) return;

  const existing = root.querySelector(RCE_SECTION);
  if (existing) {
    placeBelowCycleToken(appearanceTab, existing);
    return;
  }

  const tokenDocument = config?.token ?? config?.document ?? null;
  const pattern = getFlag(tokenDocument, FLAG_PATTERN) || "";
  const cachedImages = getFlag(tokenDocument, FLAG_CACHE) || "[]";
  const fieldHTML = await renderTemplate(CONFIG_TEMPLATE, { pattern, cachedImages });
  const tokenSection = appearanceTab.querySelector(CYCLE_TOKEN_SECTION);
  if (tokenSection) tokenSection.insertAdjacentHTML("afterend", fieldHTML);
  else appearanceTab.insertAdjacentHTML("beforeend", fieldHTML);

  const fieldset = appearanceTab.querySelector(RCE_SECTION);
  // The sibling module may subscribe after us; one bounded reconciliation after
  // the synchronous render dispatch covers that order.
  const reconcile = () => placeBelowCycleToken(appearanceTab, appearanceTab.querySelector(RCE_SECTION));
  reconcile();
  globalThis.queueMicrotask?.(reconcile);
  const patternInput = fieldset?.querySelector(".rce-pattern-input");
  const cacheInput = fieldset?.querySelector(".rce-cache-input");
  const status = fieldset?.querySelector(".rce-config-status");
  const folderButton = fieldset?.querySelector(".rce-folder-picker");
  const refreshButton = fieldset?.querySelector(".rce-refresh");
  if (!fieldset || !patternInput || !cacheInput) return;

  let refreshSequence = 0;
  const refresh = async () => {
    const sequence = ++refreshSequence;
    refreshButton?.setAttribute("disabled", "disabled");
    const images = await updateConfigPreview(root, patternInput, cacheInput, status);
    if (sequence === refreshSequence) refreshButton?.removeAttribute("disabled");
    return images;
  };

  folderButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const current = folderFromPattern(patternInput.value);
    const picker = new FilePicker({
      type: "folder",
      current,
      callback: async (selected) => {
        const folder = String(selected ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
        patternInput.value = folder ? `${folder}/*` : "*";
        patternInput.dispatchEvent(new Event("change", { bubbles: true }));
        await refresh();
      }
    });
    picker.render(true);
  });

  refreshButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    await refresh();
  });

  patternInput.addEventListener("change", async () => {
    patternInput.value = normalizePattern(patternInput.value);
    await refresh();
  });

  await refresh();
}

/**
 * Keep this control ordered beside the Runyth cycle family deterministically:
 * directly below the Runyth Cycle Portrait control when that module is active
 * and rendered, otherwise directly below the Runyth Cycle Token control, and
 * independently appended when neither is present. Siblings are located by their
 * module-id-derived markers, never by artwork or guesswork; only our own
 * control is ever moved, and only within its own column.
 */
const CYCLE_PORTRAIT_ID = "runyth-cycle-portrait";
const CYCLE_TOKEN_ID = "runyth-cycle-token";
const PORTRAIT_CONTROL = '[data-module="' + CYCLE_PORTRAIT_ID + '"]';
const TOKEN_CONTROL = "button." + CYCLE_TOKEN_ID + "-hud";

function placeBelowCycleSiblings(right, control) {
  if (!right || !control) return;
  const modules = globalThis.game?.modules;
  const portraits = modules?.get?.(CYCLE_PORTRAIT_ID)?.active
    ? right.querySelector(PORTRAIT_CONTROL)
    : null;
  const tokenControl = modules?.get?.(CYCLE_TOKEN_ID)?.active
    ? right.querySelector(TOKEN_CONTROL)
    : null;
  const anchor = portraits ?? tokenControl;
  if (!anchor || anchor === control || anchor.parentElement !== control.parentElement) return;
  if (anchor.nextElementSibling === control) return;
  anchor.insertAdjacentElement("afterend", control);
}

let hudObserver = null;
let observedRight = null;
let observedControl = null;

function stopHudOrdering() {
  if (hudObserver?.disconnect) hudObserver.disconnect();
  hudObserver = null;
  observedRight = null;
  observedControl = null;
}

function trackHudOrdering(right, control) {
  if (observedRight === right && observedControl === control && hudObserver) {
    placeBelowCycleSiblings(right, control);
    return;
  }
  stopHudOrdering();
  observedRight = right;
  observedControl = control;
  placeBelowCycleSiblings(right, control);
  if (typeof globalThis.MutationObserver === "function") {
    hudObserver = new globalThis.MutationObserver(() => {
      if (observedRight === right && observedControl === control && right.contains(control)) {
        placeBelowCycleSiblings(right, control);
      } else {
        stopHudOrdering();
      }
    });
    hudObserver.observe(right, { childList: true, subtree: true });
  }
}

async function renderTokenHUD(app, html) {
  const root = getRootElement(html);
  if (!root || root.querySelector('[data-action="rce-selector"]')) return;

  const token = app?.object?.document ? app.object : globalThis.canvas?.tokens?.controlled?.at?.(-1);
  if (!token) return;

  const pattern = getPatternForToken(token);
  if (!pattern) return;

  const images = await resolveTokenImages(token);
  if (!images.length) return;

  const hudHTML = await renderTemplate(HUD_TEMPLATE, { images });
  const right = root.querySelector("div.right");
  if (!right) return;
  right.insertAdjacentHTML("beforeend", hudHTML);

  const control = right.querySelector('[data-action="rce-selector"]');
  const selector = control?.querySelector(".rce-selector-wrap");
  if (!control || !selector) return;
  control.dataset.module = MODULE_ID;
  const reconcile = () => placeBelowCycleSiblings(right, control);
  reconcile();
  globalThis.queueMicrotask?.(reconcile);
  trackHudOrdering(right, control);

  control.addEventListener("click", (event) => {
    if (event.target?.closest?.(".rce-image-button")) return;
    event.preventDefault();
    event.stopPropagation();
    control.classList.toggle("active");
    selector.classList.toggle("active");
  });

  for (const button of selector.querySelectorAll(".rce-image-button")) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(button.dataset.index);
      const image = images[index];
      if (!image) return;
      const posted = await postImageToChat(token, image);
      if (posted) {
        control.classList.remove("active");
        selector.classList.remove("active");
      }
    });
  }
}

function registerHooks() {
  if (!globalThis.Hooks?.once || !globalThis.Hooks?.on) return;
  Hooks.once("init", () => {
    console.log(`${MODULE_ID} | Initializing`);
    Hooks.on("renderPrototypeTokenConfig", renderPrototypeTokenConfig);
    Hooks.on("renderTokenHUD", renderTokenHUD);
    Hooks.on("canvasTearDown", stopHudOrdering);
  });
}

const api = Object.freeze({
  MODULE_ID,
  normalizePattern,
  folderFromPattern,
  filenameFromPath,
  isImagePath,
  imageRecords,
  parseCachedImages,
  serializeCachedImages,
  browseWildcardImages,
  getPatternForToken,
  getCachedImagesForToken,
  resolveTokenImages,
  makeChatContent,
  postImageToChat,
  renderPrototypeTokenConfig,
  renderTokenHUD,
  registerHooks
});

globalThis.RunythCycleEmotes = api;
registerHooks();

export default api;
