package com.phoenix.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

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
