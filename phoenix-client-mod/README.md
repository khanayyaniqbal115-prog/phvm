# Phoenix Client (Fabric, Minecraft 1.21.4)

Original HUD mod for Phoenix Launcher. MIT licensed.

Features (v1.1): FPS (colour coded), CPS (left | right), ping, coordinates, facing direction, speed, clock, RAM use, potion effects, armor and held-item durability,
WASD + mouse + space keystrokes, hold-C zoom and always-sprint. Press **Right Shift** in game to open the settings menu
(every module can be switched off, HUD size 80-150%). Also replaces the Minecraft loading screen with the Phoenix Launcher logo and theme (can be switched off in the menu). Settings are stored in `config/phoenix-client.json`.

Not included yet: motion blur (it needs deep render-pipeline hooks that differ between Minecraft versions).

## Build
Push this folder to GitHub and run the "Build Phoenix Client mod" workflow, or locally: `gradle build`
(Gradle 8.12+, Java 21). The jar appears in `build/libs/phoenix-client-1.1.0.jar`.
