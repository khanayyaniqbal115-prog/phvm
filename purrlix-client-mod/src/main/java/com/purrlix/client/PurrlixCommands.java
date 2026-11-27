package com.purrlix.client;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.message.v1.ClientSendMessageEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.command.CommandSource;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Purrlix commands. They work three ways with one implementation:
 *   /purrlix fps            (normal slash command, with tab completion)
 *   .fps                    (type a dot in chat, no slash needed)
 *   press the command key   (opens chat already filled with ".")
 */
public final class PurrlixCommands {
    private PurrlixCommands() {}

    private record Module(String label, BooleanSupplier get, Consumer<Boolean> set) {}

    private static final Map<String, Module> MODULES = new LinkedHashMap<>();
    private static final List<String> SUGGEST = new ArrayList<>();

    /** Set by ".menu"; PurrlixClient opens the menu on its next tick (chat closes itself after sending). */
    public static boolean openMenuRequested;

    // stopwatch
    private static long timerStartedAt = -1;
    private static long timerBanked;

    private static final String[] KNOWN = {
        "help", "menu", "status", "list", "scale", "fov", "zoomfov", "preset", "accent", "opacity", "xstyle", "xcolor", "xsize", "xgap", "copycoords", "wp", "waypoint", "timer", "reset", "toggle", "motionblur", "music"
    };

    static void init() {
        PurrlixConfig c = PurrlixConfig.INSTANCE;
        mod("fps", "FPS", () -> c.fps, v -> c.fps = v);
        mod("cps", "CPS", () -> c.cps, v -> c.cps = v);
        mod("ping", "Ping", () -> c.ping, v -> c.ping = v);
        mod("coords", "Coordinates", () -> c.coords, v -> c.coords = v);
        mod("direction", "Direction", () -> c.direction, v -> c.direction = v);
        mod("speed", "Speed", () -> c.speed, v -> c.speed = v);
        mod("clock", "Clock", () -> c.clock, v -> c.clock = v);
        mod("memory", "Memory", () -> c.memory, v -> c.memory = v);
        mod("effects", "Potion effects", () -> c.effects, v -> c.effects = v);
        mod("armor", "Armor status", () -> c.armor, v -> c.armor = v);
        mod("keys", "Keystrokes", () -> c.keystrokes, v -> c.keystrokes = v);
        mod("counts", "Item counters", () -> c.itemCounts, v -> c.itemCounts = v);
        mod("day", "World day", () -> c.worldDay, v -> c.worldDay = v);
        mod("waypoints", "Waypoints on HUD", () -> c.waypointHud, v -> c.waypointHud = v);
        mod("deathpoint", "Death waypoint", () -> c.deathWaypoint, v -> c.deathWaypoint = v);
        mod("gametime", "Game time", () -> c.gameTime, v -> c.gameTime = v);
        mod("biome", "Biome", () -> c.biome, v -> c.biome = v);
        mod("light", "Light level", () -> c.lightLevel, v -> c.lightLevel = v);
        mod("server", "Server info", () -> c.serverInfo, v -> c.serverInfo = v);
        mod("looking", "Looking at", () -> c.lookingAt, v -> c.lookingAt = v);
        mod("session", "Session timer", () -> c.session, v -> c.session = v);
        mod("durability", "Low durability warning", () -> c.lowDurability, v -> c.lowDurability = v);
        mod("menubg", "Purrlix menu background", () -> c.menuBackground, v -> c.menuBackground = v);
        mod("crosshair", "Custom crosshair", () -> c.crosshair, v -> c.crosshair = v);
        mod("hudright", "HUD on the right", () -> c.hudRight, v -> c.hudRight = v);
        mod("hudbg", "HUD background", () -> c.hudBackground, v -> c.hudBackground = v);
        mod("sprint", "Always sprint", () -> c.alwaysSprint, v -> c.alwaysSprint = v);
        mod("zoom", "Zoom", () -> c.zoom, v -> c.zoom = v);
        mod("fastplace", "Fast place", () -> c.fastPlace, v -> c.fastPlace = v);
        mod("fullbright", "Fullbright", () -> c.fullbright, v -> c.fullbright = v);
        mod("music", "Now playing", () -> c.nowPlaying, v -> c.nowPlaying = v);
        mod("motionblur", "Motion blur", () -> c.motionBlur, v -> { c.motionBlur = v; if (!v) PurrlixMotionBlur.reset(); });
        mod("cape", "Animated cape", () -> c.animatedCape, v -> c.animatedCape = v);
        mod("splash", "Purrlix loading screen", () -> c.splash, v -> c.splash = v);

        for (String k : MODULES.keySet()) {
            SUGGEST.add(k);
            SUGGEST.add("toggle " + k);
        }
        for (String s : new String[] {"help", "menu", "status", "copycoords", "reset", "timer start", "timer stop", "timer reset",
            "wp add", "wp list", "wp clear", "wp del", "motionblur 30", "motionblur 50", "motionblur 70", "fastplace 0", "fastplace 1", "fastplace 2", "fastplace 3",
            "accent blue", "accent violet", "accent green", "accent red", "accent pink", "accent orange", "opacity 60", "xstyle 0", "xstyle 1", "xstyle 2", "xstyle 3", "xstyle 4", "xcolor 0", "xsize 5", "xgap 2", "preset pvp", "preset survival", "preset minimal", "preset full", "zoomfov 15", "zoomfov 30", "zoomfov 50", "scale 80", "scale 100", "scale 125", "scale 150", "fov 70", "fov 90", "fov 110"}) {
            SUGGEST.add(s);
        }

        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            for (String root : new String[] {"purrlix", "px"}) {
                dispatcher.register(ClientCommandManager.literal(root)
                    .executes(ctx -> {
                        run("help");
                        return 1;
                    })
                    .then(ClientCommandManager.argument("command", StringArgumentType.greedyString())
                        .suggests((ctx, builder) -> CommandSource.suggestMatching(SUGGEST, builder))
                        .executes(ctx -> {
                            run(StringArgumentType.getString(ctx, "command"));
                            return 1;
                        })));
            }
        });

        // ".fps" typed in normal chat runs the command instead of being sent to the server
        ClientSendMessageEvents.ALLOW_CHAT.register(message -> !handleDot(message));
    }

    private static void mod(String key, String label, BooleanSupplier get, Consumer<Boolean> set) {
        MODULES.put(key, new Module(label, get, set));
    }

    private static boolean isKnown(String word) {
        if (MODULES.containsKey(word)) return true;
        for (String k : KNOWN) if (k.equals(word)) return true;
        return false;
    }

    private static boolean handleDot(String message) {
        if (message == null || message.length() < 2 || message.charAt(0) != '.' || !Character.isLetter(message.charAt(1))) return false;
        String line = message.substring(1).trim();
        String first = line.split("\\s+")[0].toLowerCase(Locale.ROOT);
        if (!isKnown(first)) return false; // not ours: send it as normal chat
        run(line);
        return true;
    }

    // ------------------------------------------------------------------ helpers

    private static void say(String text) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) mc.player.sendMessage(Text.literal("§6[Purrlix]§r " + text), false);
    }

    private static String state(boolean on) {
        return on ? "§aON§r" : "§cOFF§r";
    }

    private static Boolean parseSwitch(String s) {
        return switch (s.toLowerCase(Locale.ROOT)) {
            case "on", "true", "1", "yes", "enable" -> Boolean.TRUE;
            case "off", "false", "0", "no", "disable" -> Boolean.FALSE;
            default -> null;
        };
    }

    // ------------------------------------------------------------------ commands

    public static void run(String line) {
        PurrlixConfig cfg = PurrlixConfig.INSTANCE;
        MinecraftClient mc = MinecraftClient.getInstance();
        String[] p = line.trim().split("\\s+");
        String cmd = p[0].toLowerCase(Locale.ROOT);
        if (cmd.isEmpty()) cmd = "help";

        if (cmd.equals("toggle") && p.length > 1) {
            String[] rest = new String[p.length - 1];
            System.arraycopy(p, 1, rest, 0, rest.length);
            p = rest;
            cmd = p[0].toLowerCase(Locale.ROOT);
        }

        Module m = MODULES.get(cmd);
        if (m != null) {
            if (cmd.equals("fastplace") && p.length > 1 && p[1].matches("\\d")) {
                cfg.fastPlaceDelay = Math.max(0, Math.min(3, Integer.parseInt(p[1])));
                cfg.fastPlace = true;
                cfg.save();
                say("Fast place " + state(true) + ", delay " + (cfg.fastPlaceDelay == 0 ? "MAX (0 ticks)" : cfg.fastPlaceDelay + " ticks"));
                return;
            }
            if (cmd.equals("motionblur") && p.length > 1 && p[1].matches("\\d{1,3}")) {
                cfg.motionBlurStrength = Math.max(10, Math.min(90, Integer.parseInt(p[1])));
                cfg.motionBlur = true;
                cfg.save();
                say("Motion blur " + state(true) + ", strength " + cfg.motionBlurStrength + "%");
                return;
            }
            boolean now = p.length > 1 && parseSwitch(p[1]) != null ? parseSwitch(p[1]) : !m.get().getAsBoolean();
            m.set().accept(now);
            cfg.save();
            say(m.label() + " " + state(now));
            return;
        }

        switch (cmd) {
            case "help" -> {
                say("Commands (use /purrlix <command>, or type a dot in chat: .<command>)");
                say("§e<module>§r [on|off]  e.g. .fps  .fullbright on  .fastplace 2  .motionblur 60 (10-90)");
                say("§elist§r  all modules and their state    §emenu§r  open the settings menu");
                say("§escale§r 60-160   §efov§r 30-110   §ezoomfov§r 5-70   §epreset§r pvp|survival|minimal|full");
                say("§ecrosshair§r on|off  §exstyle§r 0-4  §excolor§r 0-5  §exsize§r 2-12  §exgap§r 0-6  §eaccent§r <colour>  §eopacity§r 20-100");
                say("§ecopycoords§r   §ereset§r");
                say("§ewp§r add [name] | del <name> | list | clear   §etimer§r start|stop|reset");
            }
            case "menu" -> openMenuRequested = true;
            case "status", "list" -> {
                StringBuilder on = new StringBuilder();
                StringBuilder off = new StringBuilder();
                for (Map.Entry<String, Module> e : MODULES.entrySet()) {
                    (e.getValue().get().getAsBoolean() ? on : off).append(e.getKey()).append(' ');
                }
                say("§aON:§r " + (on.length() == 0 ? "-" : on.toString().trim()));
                say("§cOFF:§r " + (off.length() == 0 ? "-" : off.toString().trim()));
                say("HUD size " + cfg.scale + "%, fast place delay " + cfg.fastPlaceDelay);
            }
            case "scale" -> {
                Integer n = parseInt(p, 1);
                if (n == null || n < 60 || n > 160) {
                    say("Use a number from 60 to 160, for example .scale 125");
                    return;
                }
                cfg.scale = n;
                cfg.save();
                say("HUD size " + n + "%");
            }
            case "fov" -> {
                Integer n = parseInt(p, 1);
                if (n == null || n < 30 || n > 110) {
                    say("Use a number from 30 to 110, for example .fov 90");
                    return;
                }
                mc.options.getFov().setValue(n);
                mc.options.write();
                say("FOV " + n);
            }
            case "zoomfov" -> {
                Integer n = parseInt(p, 1);
                if (n == null || n < 5 || n > 70) {
                    say("Use a number from 5 to 70 (smaller = more zoom), for example .zoomfov 20");
                    return;
                }
                cfg.zoomFov = n;
                cfg.save();
                say("Zoom FOV " + n);
            }
            case "accent" -> {
                int pick = -1;
                if (p.length > 1) {
                    for (int i = 0; i < Ui.ACCENT_NAMES.length; i++) if (Ui.ACCENT_NAMES[i].equalsIgnoreCase(p[1])) pick = i;
                    if (pick < 0 && p[1].matches("[0-5]")) pick = Integer.parseInt(p[1]);
                }
                if (pick < 0) {
                    say("Accent colours: orange, blue, violet, green, red, pink. Example: .accent blue");
                    return;
                }
                cfg.accent = pick;
                cfg.save();
                say("Accent colour " + Ui.ACCENT_NAMES[pick]);
            }
            case "opacity" -> intSetting(p, 20, 100, "HUD opacity", v -> cfg.hudOpacity = v, cfg);
            case "xstyle" -> intSetting(p, 0, 4, "Crosshair style (0 plus, 1 dot, 2 X, 3 ring, 4 plus+dot)", v -> cfg.crossStyle = v, cfg);
            case "xcolor" -> intSetting(p, 0, 5, "Crosshair colour (0 white, 1 accent, 2 green, 3 red, 4 cyan, 5 yellow)", v -> cfg.crossColor = v, cfg);
            case "xsize" -> intSetting(p, 2, 12, "Crosshair size", v -> cfg.crossSize = v, cfg);
            case "xgap" -> intSetting(p, 0, 6, "Crosshair gap", v -> cfg.crossGap = v, cfg);
            case "preset" -> preset(p.length > 1 ? p[1].toLowerCase(Locale.ROOT) : "", cfg);
            case "copycoords" -> {
                if (mc.player == null) return;
                String xyz = (int) Math.floor(mc.player.getX()) + " " + (int) Math.floor(mc.player.getY()) + " " + (int) Math.floor(mc.player.getZ());
                mc.keyboard.setClipboard(xyz);
                say("Copied " + xyz);
            }
            case "wp", "waypoint" -> waypoint(p, cfg, mc);
            case "timer" -> timer(p);
            case "reset" -> {
                cfg.resetToDefaults();
                cfg.save();
                say("All settings are back to default (waypoints kept)");
            }
            default -> say("Unknown command. Type .help");
        }
    }

    private static final String[] HUD_KEYS = {"fps", "cps", "ping", "coords", "direction", "speed", "clock", "memory", "effects",
        "armor", "keys", "counts", "day", "gametime", "biome", "light", "server", "looking", "session", "waypoints"};

    /** HUD presets: only the HUD modules change, gameplay modules stay as they are. */
    private static void preset(String name, PurrlixConfig cfg) {
        java.util.Set<String> on = switch (name) {
            case "pvp" -> java.util.Set.of("fps", "cps", "ping", "keys", "armor", "counts", "effects");
            case "survival" -> java.util.Set.of("fps", "coords", "direction", "armor", "effects", "day", "biome", "light", "looking", "waypoints");
            case "minimal" -> java.util.Set.of("fps");
            case "full" -> new java.util.HashSet<>(java.util.Arrays.asList(HUD_KEYS));
            default -> null;
        };
        if (on == null) {
            say("Presets: pvp, survival, minimal, full. Example: .preset pvp");
            return;
        }
        for (String k : HUD_KEYS) MODULES.get(k).set().accept(on.contains(k));
        cfg.save();
        say("HUD preset \u00a7e" + name + "\u00a7r applied");
    }

    private static void intSetting(String[] p, int min, int max, String label, java.util.function.IntConsumer apply, PurrlixConfig cfg) {
        Integer n = parseInt(p, 1);
        if (n == null || n < min || n > max) {
            say(label + ": use a number from " + min + " to " + max);
            return;
        }
        apply.accept(n);
        if (label.startsWith("Crosshair")) cfg.crosshair = true;
        cfg.save();
        say(label.split(" \\(")[0] + " = " + n);
    }

    private static Integer parseInt(String[] p, int i) {
        if (p.length <= i) return null;
        try {
            return Integer.parseInt(p[i]);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String dimension(MinecraftClient mc) {
        return mc.world == null ? "" : mc.world.getRegistryKey().getValue().toString();
    }

    private static void waypoint(String[] p, PurrlixConfig cfg, MinecraftClient mc) {
        String sub = p.length > 1 ? p[1].toLowerCase(Locale.ROOT) : "list";
        switch (sub) {
            case "add", "set" -> {
                if (mc.player == null) return;
                String name = p.length > 2 ? p[2] : "wp" + (cfg.waypoints.size() + 1);
                cfg.waypoints.removeIf(w -> w.name.equalsIgnoreCase(name));
                cfg.waypoints.add(new PurrlixConfig.Waypoint(name, (int) Math.floor(mc.player.getX()),
                    (int) Math.floor(mc.player.getY()), (int) Math.floor(mc.player.getZ()), dimension(mc)));
                cfg.save();
                say("Waypoint §e" + name + "§r saved here");
            }
            case "del", "remove", "delete" -> {
                if (p.length < 3) {
                    say("Use: .wp del <name>");
                    return;
                }
                boolean gone = cfg.waypoints.removeIf(w -> w.name.equalsIgnoreCase(p[2]));
                cfg.save();
                say(gone ? "Waypoint removed" : "No waypoint called " + p[2]);
            }
            case "clear" -> {
                cfg.waypoints.clear();
                cfg.save();
                say("All waypoints removed");
            }
            default -> {
                if (cfg.waypoints.isEmpty()) say("No waypoints yet. Stand somewhere and type .wp add home");
                for (PurrlixConfig.Waypoint w : cfg.waypoints) {
                    say("§e" + w.name + "§r  " + w.x + " " + w.y + " " + w.z + "  (" + w.dim.replace("minecraft:", "") + ")");
                }
            }
        }
    }

    private static void timer(String[] p) {
        String sub = p.length > 1 ? p[1].toLowerCase(Locale.ROOT) : "toggle";
        long now = System.currentTimeMillis();
        switch (sub) {
            case "start" -> {
                if (timerStartedAt < 0) timerStartedAt = now;
                say("Timer started");
            }
            case "stop" -> {
                if (timerStartedAt >= 0) {
                    timerBanked += now - timerStartedAt;
                    timerStartedAt = -1;
                }
                say("Timer stopped at " + timerText());
            }
            case "reset" -> {
                timerStartedAt = -1;
                timerBanked = 0;
                say("Timer reset");
            }
            default -> {
                if (timerStartedAt < 0) {
                    timerStartedAt = now;
                    say("Timer started");
                } else {
                    timerBanked += now - timerStartedAt;
                    timerStartedAt = -1;
                    say("Timer stopped at " + timerText());
                }
            }
        }
    }

    /** Stopwatch text for the HUD, or null when it was never started. */
    public static String timerText() {
        long ms = timerBanked + (timerStartedAt >= 0 ? System.currentTimeMillis() - timerStartedAt : 0);
        if (ms == 0 && timerStartedAt < 0) return null;
        long s = ms / 1000;
        return String.format("%d:%02d.%d", s / 60, s % 60, (ms % 1000) / 100);
    }
}
