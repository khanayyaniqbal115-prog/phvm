# Phoenix Client (Fabric, Minecraft 1.21.4)

Original HUD mod for Phoenix Launcher. MIT licensed.

Features: FPS, CPS (left | right), ping, coordinates, facing direction, armor and held-item durability,
WASD + mouse + space keystrokes, hold-C zoom and always-sprint. Press **Right Shift** in game to open the settings menu
(every module can be switched off). Settings are stored in `config/phoenix-client.json`.

Not included yet: motion blur (it needs deep render-pipeline hooks that differ between Minecraft versions).

## Build
Push this folder to GitHub and run the "Build Phoenix Client mod" workflow, or locally: `gradle build`
(Gradle 8.12+, Java 21). The jar appears in `build/libs/phoenix-client-1.0.0.jar`.
