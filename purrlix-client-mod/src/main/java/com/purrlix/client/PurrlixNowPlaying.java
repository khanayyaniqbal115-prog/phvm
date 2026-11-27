package com.purrlix.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Shows the song that Purrlix Launcher reports from Spotify. The launcher writes purrlix-nowplaying.json into the game folder every
 * few seconds while the game runs; this class only reads that small file (at most once every 2 seconds) and never talks to the network.
 */
public final class PurrlixNowPlaying {
    private static final Path FILE = FabricLoader.getInstance().getGameDir().resolve("purrlix-nowplaying.json");
    private static long lastRead;
    private static String cached = "";

    private PurrlixNowPlaying() {}

    /** "Title - Artist", or an empty text when nothing is playing or the launcher is not feeding data. */
    public static String text() {
        long now = System.currentTimeMillis();
        if (now - lastRead < 2000) return cached;
        lastRead = now;
        cached = "";
        try {
            if (!Files.isRegularFile(FILE) || Files.size(FILE) > 4096) return cached;
            JsonObject o = JsonParser.parseString(new String(Files.readAllBytes(FILE), StandardCharsets.UTF_8)).getAsJsonObject();
            long at = o.has("at") ? o.get("at").getAsLong() : 0L;
            boolean playing = o.has("playing") && o.get("playing").getAsBoolean();
            if (!playing || now - at > 20_000) return cached; // stale: the launcher stopped updating
            String title = o.has("title") ? o.get("title").getAsString() : "";
            String artist = o.has("artist") ? o.get("artist").getAsString() : "";
            if (title.isEmpty()) return cached;
            String t = artist.isEmpty() ? title : title + " - " + artist;
            cached = t.length() > 48 ? t.substring(0, 47) + "..." : t;
        } catch (Exception ignored) {
            cached = "";
        }
        return cached;
    }
}
