# Changelog

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
