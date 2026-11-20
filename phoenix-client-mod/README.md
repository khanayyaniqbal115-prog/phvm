# Phoenix Client (Fabric, Minecraft 1.21.4)

Original HUD mod for Phoenix Launcher. MIT licensed.

Features (v1.1): FPS (colour coded), CPS (left | right), ping, coordinates, facing direction, speed, clock, RAM use, potion effects, armor and held-item durability,
WASD + mouse + space keystrokes, hold-C zoom and always-sprint. Press **Right Shift** in game to open the settings menu
(every module can be switched off, HUD size 80-150%). Also replaces the Minecraft loading screen with the Phoenix Launcher logo and theme (can be switched off in the menu). Settings are stored in `config/phoenix-client.json`.

Not included yet: motion blur (it needs deep render-pipeline hooks that differ between Minecraft versions).

## Build
Push this folder to GitHub and run the "Build Phoenix Client mod" workflow, or locally: `gradle build`
(Gradle 8.12+, Java 21). The jar appears in `build/libs/phoenix-client-1.1.0.jar`.

## v1.2
- New Phoenix-styled settings screen (Right Shift) drawn by the mod, no vanilla buttons.
- **Fast place**: no delay between blocks while the use key is held (some servers do not allow this; use it where it is permitted).
- **Fullbright**: client-side night vision.
- Phoenix loading screen now uses a built-in pixel font (Minecraft fonts are not loaded yet at that point) and cannot crash the game if drawing fails.
- The launcher installs this mod (and Fabric API) automatically in Fabric 1.21.4 profiles from the newest GitHub release.

## v1.3
- **Animated Phoenix cape** on your own character (24 frames, 2.4 s loop). Only you see it; other players still see your normal cape. Switch off in the menu if needed.
- **Item counters** (totems, golden apples, ender pearls), **world day**, **HUD on the right side**, **HUD background** switch.
- HUD scale now keeps armor, counters and keystrokes on screen at every size.
