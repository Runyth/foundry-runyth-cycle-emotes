# Token HUD Emotes

A small system-agnostic Foundry VTT module targeting **Foundry VTT v13 Build 351**.

## What it does

- Adds a **🎭 emoji button** to the Token HUD when the selected actor has emote images configured.
- Clicking the emoji opens a thumbnail grid.
- Clicking a thumbnail posts **only that image** as a normal public Chat Message visible to all connected players and the GM.
- It **never changes** the placed Token image, Prototype Token image, or Actor portrait.
- Adds a dedicated **Token HUD Emotes** section to the **Prototype Token Configuration → Appearance** tab for the GM.
- Supports Foundry-style wildcard paths, for example:
  - `tokens/emotes/Hero_*`
  - `tokens/emotes/Hero_*.webp`
  - `tokens/emotes/*`
- The folder picker fills the field as `selected/folder/*`; the GM can then narrow it to a filename prefix such as `selected/folder/Hero_*`.
- Stores a resolved image list as a fallback so player accounts with restricted File Picker access can still use the menu after the GM has saved the Prototype Token sheet.

## Installation

1. Extract the folder `token-hud-emotes` into Foundry's `Data/modules/` directory.
2. Restart Foundry VTT if necessary.
3. Enable **Token HUD Emotes** in **Manage Modules** for the world.

## Configuration

1. Open an Actor.
2. Open **Prototype Token** configuration.
3. Open **Appearance**.
4. Find **Token HUD Emotes**.
5. Use the folder button or type a wildcard path, e.g. `tokens/emotes/Aria_*`.
6. Use the refresh button to verify the number of matching images.
7. Save the Prototype Token configuration.

Players who control a token for that Actor can now open the Token HUD and use the 🎭 button.

## Notes

The wildcard lookup uses Foundry's v13 `FilePicker.browse("data", pattern, { wildcard: true })` API. Images are filtered to common image formats (AVIF, GIF, JPG/JPEG, PNG, SVG, WEBP).
