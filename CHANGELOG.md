# Changelog

## 1.0.4 — 2026-11-03

- The 🎭 Token HUD button is now placed among the Runyth cycle family by module
  id, never by guessing: when Runyth Cycle Portrait is installed and active on
  the world it sits directly below the Runyth Cycle Portrait control; when only
  Runyth Cycle Token is installed and active it sits directly below the Runyth
  Cycle Token control; with neither, its place is unchanged. With all three
  modules active the HUD order is Runyth Cycle Token, Runyth Cycle Portrait,
  Runyth Cycle Emote, whatever the module load order is.
- Sibling controls are recognised through their module-id-derived markers (the
  `runyth-cycle-token-hud` control class and Portrait's `data-module` control
  attribute). Only the emote control is ever moved, and only within its own HUD
  column; a bounded reconciliation after the render dispatch and a bounded
  observer for later rerenders keep the place stable.
- Behaviour is otherwise unchanged: the emote selector, public chat posting,
  the campaign Appearance-section placement below Runyth Cycle Token, cached
  image fallback and the guarantee that token and actor artwork are never
  rewritten.

## 1.0.3 — 2026-11-03

- The 🎭 emoji on the Token HUD button is properly centered in its control
  again: the control lays its content out with flex aligning and centering,
  and the emoji renders at its natural size as a plain inline-block glyph
  with a single line height, matching the Runyth Cycle Token HUD control
  pattern. Nothing else on the HUD movement or the emote selector changed.

## 1.0.2 — 2026-11-02

- The section in **Prototype Token Configuration → Appearance** now reads
  **Runyth Cycle Emote** in English and German, matching the naming of the
  Runyth Cycle Token section; the wildcard path hint no longer names the
  former menu title.
- When **Runyth Cycle Token** is installed, the Runyth Cycle Emote section
  always appears directly below the Runyth Cycle Token section in the
  Appearance tab, regardless of which module is loaded first. Only the
  emote section is ever moved; when Cycle Token is absent the placement is
  unchanged.
- Behaviour is otherwise unchanged: the emoji gallery on the Token HUD, the
  GM-configured wildcard emote image paths, the cached-image fallback for
  players with restricted file locator permission, public chat posting, and
  the guarantee that token and actor artwork are never rewritten.

## 1.0.1 — 2026-11-01

- First Runyth release, published as `runyth-cycle-emotes` / **Runyth Cycle Emotes**.
- The rebrand reaches every real surface: the Foundry module id and title, the npm package, the flag scope `runyth-cycle-emotes`, the module script file `scripts/runyth-cycle-emotes.mjs`, the stylesheet `styles/runyth-cycle-emotes.css`, the localization namespace `RCE.*` in both bundled languages, and the scoped `rce-` CSS class prefixes and template flag names.
- The module now loads as a standard ES module in Foundry: the manifest declares `esmodules`, the formerly classic IIFE script keeps its exact helper surface and side effects, and the behavioural suite imports the module directly.
- Behaviour is unchanged: the emoji gallery on the Token HUD, GM-configured wildcard emote image paths on the prototype token appearance tab, the cached-image fallback for players with restricted file locator permission, public chat posting, and the guarantee that token and actor artwork are never rewritten.
- The program is `AGPL-3.0-or-later` with the standard two-line source notice on every program source, the full `LICENSE` text, and the standard README licence chapter.
- Implemented the publication standard: deterministic installable, source, and documentation archives with per-version checksums, byte-identical rebuild verification, publication scanning that guards the identity and licence surfaces, and the standard quality and release pipelines on Node 24.
