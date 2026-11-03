# Runyth Cycle Emotes

Runyth Cycle Emotes adds an emoji button to the Token HUD. Each actor can use a
GM-configured wildcard emote-image path; selecting an emote posts it publicly to chat
without changing token or actor artwork. A small system-agnostic Foundry VTT module
targeting **Foundry VTT v13**.

## Supported environment

- Foundry Virtual Tabletop 13
- System-agnostic: any actor with a normal token prototype can post emote images

## Features

- Adds a **🎭 emoji button** to the Token HUD when the selected actor has emote images
  configured. When **Runyth Cycle Portrait** is installed and active the button sits
  directly below the Runyth Cycle Portrait control; when only **Runyth Cycle Token**
  is installed and active it sits directly below the Runyth Cycle Token control;
  with all three modules active the HUD order is Runyth Cycle Token, Runyth Cycle
  Portrait, Runyth Cycle Emote. Buttons are recognised by their module ids, so the
  order holds regardless of module load order.
- Clicking the emoji opens a thumbnail grid of the configured images.
- Clicking a thumbnail posts **only that image** as a normal public Chat Message visible
  to all connected players and the Game Master.
- It **never changes** the placed Token image, Prototype Token image, or Actor portrait.
- Adds a dedicated **Runyth Cycle Emote** section to **Prototype Token Configuration →
  Appearance** for the Game Master. When **Runyth Cycle Token** is installed, the
  section appears directly below the Runyth Cycle Token section, regardless of
  module load order.
- Supports Foundry-style wildcard paths, for example:
  - `tokens/emotes/Hero_*`
  - `tokens/emotes/Hero_*.webp`
  - `tokens/emotes/*`
- The folder picker fills the field as `selected/folder/*`; the Game Master can then
  narrow it to a filename prefix such as `selected/folder/Hero_*`.
- Stores a resolved image list as a fallback so player accounts with restricted file
  locator access can still use the menu after the Game Master has saved the Prototype
  Token sheet.
- Carries English and German localization and scoped CSS under the `rce-` class
  namespace.

## Installation

1. Extract the `runyth-cycle-emotes` directory into:

   ```text
   <Foundry user-data>/Data/modules/
   ```

2. Restart Foundry VTT if necessary.
3. Enable **Runyth Cycle Emotes** in **Manage Modules** for the world.

## Configuration

1. Open an Actor.
2. Open **Prototype Token** configuration.
3. Open **Appearance**.
4. Find **Runyth Cycle Emote**.
5. Use the folder button or type a wildcard path, e.g. `tokens/emotes/Aria_*`.
6. Use the refresh button to verify the number of matching images.
7. Save the Prototype Token configuration.

Players who control a token for that Actor can now open the Token HUD and use the 🎭
button. Selecting an emote posts the image to chat; the token's artwork is untouched.

## Technical notes

The wildcard lookup uses Foundry's v13 `FilePicker.browse("data", pattern,
{ wildcard: true })` API. Images are filtered to common image formats (AVIF, GIF,
JPG/JPEG, PNG, SVG, WEBP). Per-actor settings ride on the prototype token document in
the `runyth-cycle-emotes` flag scope and ship no module settings of their own.

## Development validation

With Node.js 24 (22.13 or later works):

```text
npm test
npm run check
```

These checks validate pattern normalisation, image filtering and ordering, the file
locator wildcard contract, cache serialisation, live resolution and player fallback,
hook registration, chat-card content, the artwork guard, manifest identity and URL
surfaces, localization key prefixes, source notices, licence and publication hygiene,
and deterministic byte-identical release packaging.
They do not replace testing in a live Foundry world.

## Releases

The GitHub repository is
[`Runyth/foundry-runyth-cycle-emotes`](https://github.com/Runyth/foundry-runyth-cycle-emotes).
Every release attaches:

```text
runyth-cycle-emotes-v<version>-mod.zip
runyth-cycle-emotes-v<version>-src.zip
runyth-cycle-emotes-v<version>-doc.zip
module.json
runyth-cycle-emotes-v<version>-SHA256SUMS.txt
```

The `module.json` manifest download URL points at the matching release's installable
archive, and the marked Latest release is always the highest published version.

## Licence

Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
