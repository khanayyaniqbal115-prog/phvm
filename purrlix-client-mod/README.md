# Purrlix Client (Fabric, Minecraft 1.21.4)

Original HUD mod for Purrlix Launcher. MIT licensed.

Features (v1.1): FPS (colour coded), CPS (left | right), ping, coordinates, facing direction, speed, clock, RAM use, potion effects, armor and held-item durability,
WASD + mouse + space keystrokes, hold-C zoom and always-sprint. Press **Right Shift** in game to open the settings menu
(every module can be switched off, HUD size 80-150%). Also replaces the Minecraft loading screen with the Purrlix Launcher logo and theme (can be switched off in the menu). Settings are stored in `config/purrlix-client.json`.

Not included yet: motion blur (it needs deep render-pipeline hooks that differ between Minecraft versions).

## Build
Push this folder to GitHub and run the "Build Purrlix Client mod" workflow, or locally: `gradle build`
(Gradle 8.12+, Java 21). The jar appears in `build/libs/purrlix-client-1.1.0.jar`.

## v1.2
- New Purrlix-styled settings screen (Right Shift) drawn by the mod, no vanilla buttons.
- **Fast place**: no delay between blocks while the use key is held (some servers do not allow this; use it where it is permitted).
- **Fullbright**: client-side night vision.
- Purrlix loading screen now uses a built-in pixel font (Minecraft fonts are not loaded yet at that point) and cannot crash the game if drawing fails.
- The launcher installs this mod (and Fabric API) automatically in Fabric 1.21.4 profiles from the newest GitHub release.

## v1.3
- **Animated Purrlix cape** on your own character (24 frames, 2.4 s loop). Only you see it; other players still see your normal cape. Switch off in the menu if needed.
- **Item counters** (totems, golden apples, ender pearls), **world day**, **HUD on the right side**, **HUD background** switch.
- HUD scale now keeps armor, counters and keystrokes on screen at every size.

## v1.5 - commands, waypoints, new menu
Commands work three ways: `/purrlix <command>` (tab completion), `.<command>` typed in chat (no slash), or press the **command key** (default `.`) to open chat already filled with a dot. `/px` is a short alias.

| Command | What it does |
| --- | --- |
| `.help` | list of commands |
| `.<module> [on/off]` | switch a module, e.g. `.fps`, `.fullbright on`, `.sprint off` |
| `.fastplace <0-3>` | turn Fast place on with a delay (0 = fastest) |
| `.list` / `.status` | which modules are on and off |
| `.menu` | open the settings menu |
| `.scale 60-160` | HUD size |
| `.fov 30-110` | field of view |
| `.copycoords` | copy your XYZ to the clipboard |
| `.wp add [name]`, `.wp del <name>`, `.wp list`, `.wp clear` | waypoints (distance + arrow on the HUD) |
| `.timer start/stop/reset` | stopwatch on the HUD |
| `.reset` | all settings back to default (waypoints kept) |

A waypoint called `death` is saved automatically where you die (switch off with `.deathpoint`).
The menu got panel cards, an orange bar and bright icon for modules that are on (dimmed when off), and two new rows (Waypoints on HUD, Death waypoint).
Loading screen: the Purrlix screen is now drawn on every return path of the splash, so Mojang's red screen is fully covered.

## v1.6 - ten upgrades
1. **Purrlix menu background** behind the title, singleplayer, multiplayer and options screens (drifting embers). Switch: `.menubg`.
2. **Biome** line (`.biome`). 3. **Light level** (block and sky, `.light`). 4. **Server info** (address and player count, `.server`).
5. **Looking at** (block under the crosshair, `.looking`). 6. **Low durability warning** that flashes when a tool or armor piece is at 10% or less (`.durability`).
7. **Game time** HH:MM (`.gametime`). 8. **Session timer** (`.session`).
9. **HUD presets**: `.preset pvp | survival | minimal | full`.
10. **Zoom FOV** setting: `.zoomfov 5-70`, also a control in the menu.
The menu now has three columns (HUD, INFO, GAMEPLAY).

## v1.6.1 - title screen
- The title screen panorama is replaced by a Purrlix one (glowing lava ridges and embers) through the mod's own `assets/minecraft/textures/gui/title/background/panorama_0..5.png`.
- The yellow splash text next to the logo is removed (`assets/minecraft/texts/splashes.txt` is empty).
- Both work only while the mod is installed (Fabric 1.21.4 profile). A resource pack the player enables themselves still wins over them.

## v1.9

- Now playing: shows the Spotify song on the HUD (`.music` to toggle). Purrlix Launcher writes `purrlix-nowplaying.json` into the game folder; the mod only reads it.
- Loading screen uses the real Purrlix icon; the cape frames use it too.

## v1.8

- Motion blur (`.motionblur 10-90`, or Purrlix menu > Gameplay). Frame accumulation drawn just before the HUD, so the HUD stays sharp. Off by default.

## v1.7
- **Accent colours** for the HUD and menu: orange, blue, violet, green, red, pink (`.accent blue`, or the Accent control in the menu).
- **HUD opacity** `.opacity 20-100`.
- **Custom crosshair** (`.crosshair`): five styles (plus, dot, X, ring, plus+dot), six colours, size and gap (`.xstyle`, `.xcolor`, `.xsize`, `.xgap`). The vanilla crosshair is hidden while it is on. If that hiding cannot attach on your build, the game still starts and you would see both crosshairs.
- The menu has a fourth column, **TUNE**, with all number controls (HUD size, opacity, accent, place delay, zoom FOV, crosshair style, size, colour).

## v1.10
- New Purrlix Menu: module cards with tabs (All, HUD, Info, Gameplay, Tune), search and scrolling.
- New Cosmetics screen (Menu > Cosmetics, or the title screen button): animated cape plus real 3D hats, wings, backpacks and tails. Client side only (only you see them).
- Title screen gets Purrlix Menu and Cosmetics buttons.
