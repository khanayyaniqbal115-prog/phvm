package com.phoenix.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Saved settings (config/phoenix-client.json). */
public final class PhoenixConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("phoenix-client.json");

    /** Shared instance so mixins can read the same settings. */
    public static PhoenixConfig INSTANCE = new PhoenixConfig();

    public boolean fps = true;
    public boolean cps = true;
    public boolean ping = true;
    public boolean coords = true;
    public boolean direction = true;
    public boolean speed = false;
    public boolean clock = false;
    public boolean memory = false;
    public boolean effects = true;
    public boolean armor = true;
    public boolean keystrokes = true;
    public boolean alwaysSprint = false;
    public boolean zoom = true;
    public boolean splash = true;
    /** Removes the delay between placing blocks while the use key is held. */
    public boolean fastPlace = false;
    /** Ticks between placed blocks while Fast place is on: 0 = fastest, 3 = almost vanilla (vanilla is 4). */
    public int fastPlaceDelay = 0;
    /** Makes everything fully bright (client-side night vision). */
    public boolean fullbright = false;
    /** Plays the animated Phoenix cape on your own character (only you see it). */
    public boolean animatedCape = true;
    /** Totem / golden apple / ender pearl counters. */
    public boolean itemCounts = false;
    /** Shows the world day. */
    public boolean worldDay = false;
    /** Puts the HUD text on the right side of the screen. */
    public boolean hudRight = false;
    /** Dark panel behind the HUD lines. */
    public boolean hudBackground = true;
    /** HUD scale in percent (80, 100, 125 or 150). */
    public int scale = 100;

    /** Shows saved waypoints (distance and arrow) on the HUD. */
    public boolean waypointHud = true;
    /** Saves a waypoint where you die. */
    public boolean deathWaypoint = true;
    /** Biome name line. */
    public boolean biome = false;
    /** Block and sky light at your feet. */
    public boolean lightLevel = false;
    /** Server address and player count (or Singleplayer). */
    public boolean serverInfo = false;
    /** Name of the block under the crosshair. */
    public boolean lookingAt = false;
    /** Flashing warning when a tool or armor piece is almost broken. */
    public boolean lowDurability = true;
    /** In-game clock (the world's time of day as HH:MM). */
    public boolean gameTime = false;
    /** How long this play session has lasted. */
    public boolean session = false;
    /** Phoenix background behind the title, singleplayer, multiplayer and options screens. */
    public boolean menuBackground = true;
    /** Field of view while holding the zoom key (5 to 70). */
    public int zoomFov = 30;
    /** Accent colour of the HUD and menu: 0 orange, 1 blue, 2 violet, 3 green, 4 red, 5 pink. */
    public int accent = 0;
    /** HUD background opacity in percent (20 to 100). */
    public int hudOpacity = 60;
    /** Custom crosshair (replaces the vanilla one). */
    public boolean crosshair = false;
    /** 0 plus, 1 dot, 2 X, 3 square ring, 4 plus with dot. */
    public int crossStyle = 0;
    /** 0 white, 1 accent, 2 green, 3 red, 4 cyan, 5 yellow. */
    public int crossColor = 0;
    public int crossSize = 5;
    public int crossGap = 2;
    public List<Waypoint> waypoints = new ArrayList<>();

    public static final class Waypoint {
        public String name = "";
        public int x, y, z;
        public String dim = "";

        public Waypoint() {}

        public Waypoint(String name, int x, int y, int z, String dim) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.z = z;
            this.dim = dim;
        }
    }

    /** Puts every setting back to its default (waypoints are kept). */
    public void resetToDefaults() {
        PhoenixConfig fresh = new PhoenixConfig();
        for (java.lang.reflect.Field f : PhoenixConfig.class.getDeclaredFields()) {
            if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) || f.getName().equals("waypoints")) continue;
            try {
                f.set(this, f.get(fresh));
            } catch (IllegalAccessException ignored) {
                // skip
            }
        }
    }

    public static PhoenixConfig load() {
        try {
            if (Files.exists(FILE)) {
                PhoenixConfig cfg = GSON.fromJson(Files.readString(FILE), PhoenixConfig.class);
                if (cfg != null) {
                    INSTANCE = cfg;
                    return cfg;
                }
            }
        } catch (Exception ignored) {
            // fall back to defaults
        }
        return INSTANCE;
    }

    public void save() {
        try {
            Files.writeString(FILE, GSON.toJson(this));
        } catch (IOException ignored) {
            // not critical
        }
    }
}
