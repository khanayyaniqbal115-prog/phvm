package com.purrlix.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import org.lwjgl.glfw.GLFW;

import com.purrlix.client.mixin.MinecraftClientAccessor;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Items;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;

/** Purrlix Client: a small original HUD mod made for Purrlix Launcher. */
public final class PurrlixClient implements ClientModInitializer {
    private static final int TEXT = 0xFFFFFFFF;

    private PurrlixConfig cfg;
    private KeyBinding menuKey;
    private KeyBinding zoomKey;
    private KeyBinding commandKey;
    private boolean wasDead;

    // values that do not need to be recomputed every frame (refreshed every 10 ticks)
    private int cacheTicks;
    private final int[] cachedCounts = new int[3];
    private String cachedBiome = "?";
    private int cachedBlockLight;
    private int cachedSkyLight;
    private final java.util.List<PurrlixConfig.Waypoint> cachedWaypoints = new java.util.ArrayList<>();
    private String cachedRam = "";

    private final Deque<Long> leftClicks = new ArrayDeque<>();
    private final Deque<Long> rightClicks = new ArrayDeque<>();
    private boolean leftDown;
    private boolean rightDown;

    private double speed;
    private double lastX, lastZ;
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    private boolean fullbrightApplied;
    private boolean zooming;
    private int savedFov;

    @Override
    public void onInitializeClient() {
        PurrlixConfig.load();
        cfg = PurrlixConfig.INSTANCE;
        menuKey = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.purrlix.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.purrlix"));
        zoomKey = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.purrlix.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.purrlix"));

        commandKey = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.purrlix.command", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_PERIOD, "category.purrlix"));
        PurrlixCommands.init();

        net.fabricmc.fabric.api.client.rendering.v1.LivingEntityFeatureRendererRegistrationCallback.EVENT.register((entityType, entityRenderer, registrationHelper, context) -> {
            if (entityRenderer instanceof net.minecraft.client.render.entity.PlayerEntityRenderer playerRenderer) {
                registrationHelper.register(new PurrlixCosmeticsFeature(playerRenderer));
            }
        });
        ClientTickEvents.END_CLIENT_TICK.register(this::tick);
        // title screen: two Purrlix buttons in the top right corner
        net.fabricmc.fabric.api.client.screen.v1.ScreenEvents.AFTER_INIT.register((mc, screen, w, h) -> {
            if (screen instanceof net.minecraft.client.gui.screen.TitleScreen) {
                var buttons = net.fabricmc.fabric.api.client.screen.v1.Screens.getButtons(screen);
                buttons.add(net.minecraft.client.gui.widget.ButtonWidget.builder(net.minecraft.text.Text.literal("Purrlix Menu"), b -> mc.setScreen(new PurrlixMenu(cfg))).dimensions(w - 96, 6, 90, 18).build());
                buttons.add(net.minecraft.client.gui.widget.ButtonWidget.builder(net.minecraft.text.Text.literal("Cosmetics"), b -> mc.setScreen(new PurrlixCosmeticsScreen(cfg))).dimensions(w - 96, 28, 90, 18).build());
            }
        });
        HudRenderCallback.EVENT.register(this::renderHud);
    }

    // ------------------------------------------------------------------ logic

    private void tick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            client.setScreen(new PurrlixMenu(cfg));
        }
        while (commandKey.wasPressed()) {
            // chat opens with a dot already typed: type "fps" and Enter to run .fps
            if (client.currentScreen == null) client.setScreen(new net.minecraft.client.gui.screen.ChatScreen("."));
        }
        if (PurrlixCommands.openMenuRequested && client.currentScreen == null) {
            PurrlixCommands.openMenuRequested = false;
            client.setScreen(new PurrlixMenu(cfg));
        }
        if (client.player == null) return;

        // remember where you died
        boolean dead = client.player.getHealth() <= 0f;
        if (dead && !wasDead && cfg.deathWaypoint && client.world != null) {
            cfg.waypoints.removeIf(w -> w.name.equals("death"));
            cfg.waypoints.add(new PurrlixConfig.Waypoint("death", (int) Math.floor(client.player.getX()),
                (int) Math.floor(client.player.getY()), (int) Math.floor(client.player.getZ()),
                client.world.getRegistryKey().getValue().toString()));
            cfg.save();
        }
        wasDead = dead;

        if (cacheTicks++ % 10 == 0) refreshCache(client);

        trackClicks(client);
        double dx = client.player.getX() - lastX, dz = client.player.getZ() - lastZ;
        speed = Math.sqrt(dx * dx + dz * dz) * 20.0;
        lastX = client.player.getX();
        lastZ = client.player.getZ();

        if (cfg.alwaysSprint && client.options.forwardKey.isPressed() && !client.player.isSneaking()) {
            client.options.sprintKey.setPressed(true);
        }

        updateZoom(client);

        // Fast place: no delay between blocks while the use key is held
        if (cfg.fastPlace && client.options.useKey.isPressed() && client.player.getMainHandStack().getItem() instanceof BlockItem) {
            MinecraftClientAccessor acc = (MinecraftClientAccessor) (Object) client;
            int limit = Math.max(0, Math.min(3, cfg.fastPlaceDelay));
            if (acc.purrlix$getItemUseCooldown() > limit) acc.purrlix$setItemUseCooldown(limit);
        }

        // Fullbright: client-side night vision, refreshed before it starts to flicker
        if (cfg.fullbright) {
            StatusEffectInstance cur = client.player.getStatusEffect(StatusEffects.NIGHT_VISION);
            if (cur == null || cur.getDuration() < 400) {
                client.player.addStatusEffect(new StatusEffectInstance(StatusEffects.NIGHT_VISION, 1200, 0, false, false, false));
            }
            fullbrightApplied = true;
        } else if (fullbrightApplied) {
            client.player.removeStatusEffect(StatusEffects.NIGHT_VISION);
            fullbrightApplied = false;
        }
    }

    private void refreshCache(MinecraftClient client) {
        if (client.player == null || client.world == null) return;
        if (cfg.itemCounts) {
            net.minecraft.item.Item[] items = {Items.TOTEM_OF_UNDYING, Items.GOLDEN_APPLE, Items.ENDER_PEARL};
            for (int i = 0; i < items.length; i++) cachedCounts[i] = client.player.getInventory().count(items[i]);
        }
        net.minecraft.util.math.BlockPos pos = client.player.getBlockPos();
        if (cfg.biome) cachedBiome = client.world.getBiome(pos).getKey().map(k -> clean(k.getValue().getPath())).orElse("?");
        if (cfg.lightLevel) {
            cachedBlockLight = client.world.getLightLevel(net.minecraft.world.LightType.BLOCK, pos);
            cachedSkyLight = client.world.getLightLevel(net.minecraft.world.LightType.SKY, pos);
        }
        if (cfg.memory) {
            Runtime rt = Runtime.getRuntime();
            cachedRam = ((rt.totalMemory() - rt.freeMemory()) / 1048576L) + "/" + (rt.maxMemory() / 1048576L) + " MB";
        }
        cachedWaypoints.clear();
        if (cfg.waypointHud && !cfg.waypoints.isEmpty()) {
            String dim = client.world.getRegistryKey().getValue().toString();
            double px = client.player.getX(), pz = client.player.getZ();
            for (PurrlixConfig.Waypoint w : cfg.waypoints) if (dim.equals(w.dim)) cachedWaypoints.add(w);
            cachedWaypoints.sort(java.util.Comparator.comparingDouble(w -> Math.hypot(w.x + 0.5 - px, w.z + 0.5 - pz)));
            while (cachedWaypoints.size() > 4) cachedWaypoints.remove(cachedWaypoints.size() - 1);
        }
    }

    private void trackClicks(MinecraftClient client) {
        long handle = client.getWindow().getHandle();
        long now = System.currentTimeMillis();
        boolean left = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        boolean right = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        if (left && !leftDown) leftClicks.addLast(now);
        if (right && !rightDown) rightClicks.addLast(now);
        leftDown = left;
        rightDown = right;
        while (!leftClicks.isEmpty() && now - leftClicks.peekFirst() > 1000) leftClicks.pollFirst();
        while (!rightClicks.isEmpty() && now - rightClicks.peekFirst() > 1000) rightClicks.pollFirst();
    }

    private void updateZoom(MinecraftClient client) {
        boolean wantZoom = cfg.zoom && zoomKey.isPressed() && client.currentScreen == null;
        if (wantZoom && !zooming) {
            savedFov = client.options.getFov().getValue();
            zooming = true;
        }
        if (wantZoom) {
            client.options.getFov().setValue(Math.max(5, Math.min(70, cfg.zoomFov)));
        } else if (zooming) {
            client.options.getFov().setValue(savedFov);
            zooming = false;
        }
    }

    // ------------------------------------------------------------------ HUD

    private void renderHud(DrawContext ctx, net.minecraft.client.render.RenderTickCounter tickCounter) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden || client.getDebugHud().shouldShowDebugHud()) return;

        float sc = Math.max(0.5f, cfg.scale / 100f);
        int sw = (int) (ctx.getScaledWindowWidth() / sc);
        int sh = (int) (ctx.getScaledWindowHeight() / sc);
        ctx.getMatrices().push();
        ctx.getMatrices().scale(sc, sc, 1f);
        int x = 6;
        int y = 6;
        if (cfg.fps) {
            int f = client.getCurrentFps();
            String col = f >= 60 ? "\u00a7a" : f >= 30 ? "\u00a7e" : "\u00a7c";
            y = line(ctx, client, sw, x, y, "FPS ", col + f);
        }
        if (cfg.cps) y = line(ctx, client, sw, x, y, "CPS ", leftClicks.size() + " | " + rightClicks.size());
        if (cfg.ping) y = line(ctx, client, sw, x, y, "Ping ", pingText(client) + " ms");
        if (cfg.coords) {
            y = line(ctx, client, sw, x, y, "XYZ ",
                (int) Math.floor(client.player.getX()) + " " + (int) Math.floor(client.player.getY()) + " " + (int) Math.floor(client.player.getZ()));
        }
        if (cfg.direction) y = line(ctx, client, sw, x, y, "Facing ", client.player.getHorizontalFacing().asString());
        if (cfg.speed) y = line(ctx, client, sw, x, y, "Speed ", String.format("%.1f b/s", speed));
        if (cfg.clock) y = line(ctx, client, sw, x, y, "Time ", LocalTime.now().format(CLOCK));
        if (cfg.worldDay && client.world != null) y = line(ctx, client, sw, x, y, "Day ", String.valueOf(client.world.getTimeOfDay() / 24000L + 1));
        if (cfg.memory) {
            y = line(ctx, client, sw, x, y, "RAM ", cachedRam);
        }
        if (cfg.nowPlaying) {
            String song = PurrlixNowPlaying.text();
            if (!song.isEmpty()) y = line(ctx, client, sw, x, y, "Music ", song);
        }
        if (cfg.effects) {
            for (StatusEffectInstance e : client.player.getStatusEffects()) {
                if (cfg.fullbright && e.getEffectType().equals(StatusEffects.NIGHT_VISION)) continue;
                int secs = e.getDuration() / 20;
                String name = e.getEffectType().value().getName().getString();
                y = line(ctx, client, sw, x, y, name + " ", (e.getAmplifier() + 1) + " " + (secs / 60) + ":" + String.format("%02d", secs % 60));
            }
        }
        String timer = PurrlixCommands.timerText();
        if (timer != null) y = line(ctx, client, sw, x, y, "Timer ", timer);
        y = drawInfo(ctx, client, sw, x, y);
        if (cfg.waypointHud) y = drawWaypoints(ctx, client, sw, x, y);
        if (cfg.lowDurability) drawDurabilityWarning(ctx, client, sw);
        if (cfg.armor) drawArmor(ctx, client, sw, sh);
        if (cfg.itemCounts) drawCounts(ctx, client, sw, sh);
        if (cfg.keystrokes) drawKeystrokes(ctx, client, sh);
        ctx.getMatrices().pop();
        if (cfg.crosshair && client.currentScreen == null && client.options.getPerspective().isFirstPerson()) {
            drawCrosshair(ctx);
        }
    }

    private static final int[] CROSS_COLORS = {0xFFFFFFFF, 0, 0xFF55FF55, 0xFFFF5555, 0xFF55FFFF, 0xFFFFFF55};

    private static void bar(DrawContext ctx, int x1, int y1, int x2, int y2, int color) {
        ctx.fill(x1 - 1, y1 - 1, x2 + 1, y2 + 1, 0xAA000000);
        ctx.fill(x1, y1, x2, y2, color);
    }

    /** Custom crosshair in the middle of the screen (the vanilla one is hidden by InGameHudMixin). */
    private void drawCrosshair(DrawContext ctx) {
        int cx = ctx.getScaledWindowWidth() / 2;
        int cy = ctx.getScaledWindowHeight() / 2;
        int size = Math.max(2, Math.min(12, cfg.crossSize));
        int gap = Math.max(0, Math.min(6, cfg.crossGap));
        int color = cfg.crossColor == 1 ? Ui.main() : CROSS_COLORS[Math.floorMod(cfg.crossColor, CROSS_COLORS.length)];
        switch (cfg.crossStyle) {
            case 1 -> bar(ctx, cx - 1, cy - 1, cx + 1, cy + 1, color);
            case 2 -> {
                for (int i = gap + 1; i <= gap + size; i++) {
                    for (int sx = -1; sx <= 1; sx += 2) {
                        for (int sy = -1; sy <= 1; sy += 2) {
                            int px = cx + sx * i - (sx > 0 ? 0 : 1);
                            int py = cy + sy * i - (sy > 0 ? 0 : 1);
                            ctx.fill(px, py, px + 1, py + 1, color);
                        }
                    }
                }
            }
            case 3 -> {
                int r = gap + size;
                bar(ctx, cx - r, cy - r, cx + r, cy - r + 1, color);
                bar(ctx, cx - r, cy + r - 1, cx + r, cy + r, color);
                bar(ctx, cx - r, cy - r, cx - r + 1, cy + r, color);
                bar(ctx, cx + r - 1, cy - r, cx + r, cy + r, color);
            }
            default -> {
                bar(ctx, cx - gap - size, cy, cx - gap, cy + 1, color);
                bar(ctx, cx + gap + 1, cy, cx + gap + size + 1, cy + 1, color);
                bar(ctx, cx, cy - gap - size, cx + 1, cy - gap, color);
                bar(ctx, cx, cy + gap + 1, cx + 1, cy + gap + size + 1, color);
                if (cfg.crossStyle == 4) bar(ctx, cx, cy, cx + 1, cy + 1, color);
            }
        }
    }

    private static final long SESSION_START = System.currentTimeMillis();

    private static String clean(String id) {
        return id.replace('_', ' ');
    }

    /** Biome, light, game time, server, looking-at and session lines. */
    private int drawInfo(DrawContext ctx, MinecraftClient client, int sw, int x, int y) {
        if (client.world == null) return y;
        net.minecraft.util.math.BlockPos pos = client.player.getBlockPos();
        if (cfg.gameTime) {
            long t = client.world.getTimeOfDay() % 24000L;
            int hours = (int) ((t / 1000 + 6) % 24);
            int mins = (int) ((t % 1000) * 60 / 1000);
            y = line(ctx, client, sw, x, y, "Game time ", String.format("%02d:%02d", hours, mins));
        }
        if (cfg.biome) {
            y = line(ctx, client, sw, x, y, "Biome ", cachedBiome);
        }
        if (cfg.lightLevel) {
            int block = cachedBlockLight;
            int sky = cachedSkyLight;
            y = line(ctx, client, sw, x, y, "Light ", (block == 0 ? "\u00a7c" : "\u00a7a") + "block " + block + "\u00a7r  sky " + sky);
        }
        if (cfg.serverInfo) {
            net.minecraft.client.network.ServerInfo si = client.getCurrentServerEntry();
            String where = si != null ? si.address : "Singleplayer";
            if (si != null && client.getNetworkHandler() != null) where += " (" + client.getNetworkHandler().getPlayerList().size() + ")";
            y = line(ctx, client, sw, x, y, "Server ", where);
        }
        if (cfg.lookingAt && client.crosshairTarget != null
            && client.crosshairTarget.getType() == net.minecraft.util.hit.HitResult.Type.BLOCK) {
            net.minecraft.util.hit.BlockHitResult hit = (net.minecraft.util.hit.BlockHitResult) client.crosshairTarget;
            String name = client.world.getBlockState(hit.getBlockPos()).getBlock().getName().getString();
            y = line(ctx, client, sw, x, y, "Looking at ", name);
        }
        if (cfg.session) {
            long mins = (System.currentTimeMillis() - SESSION_START) / 60000L;
            y = line(ctx, client, sw, x, y, "Session ", (mins / 60) + "h " + String.format("%02d", mins % 60) + "m");
        }
        return y;
    }

    /** Flashes a warning in the top middle when a tool or armor piece has 10% durability or less. */
    private void drawDurabilityWarning(DrawContext ctx, MinecraftClient client, int sw) {
        if ((System.currentTimeMillis() / 500) % 2 == 0) return;
        EquipmentSlot[] slots = {EquipmentSlot.MAINHAND, EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
        for (EquipmentSlot slot : slots) {
            ItemStack stack = client.player.getEquippedStack(slot);
            if (stack.isEmpty() || !stack.isDamageable() || stack.getMaxDamage() <= 0) continue;
            int left = stack.getMaxDamage() - stack.getDamage();
            if (left * 10 <= stack.getMaxDamage()) {
                ctx.drawCenteredTextWithShadow(client.textRenderer, "LOW DURABILITY: " + stack.getName().getString() + " (" + left + ")", sw / 2, 24, 0xFFFF5555);
                return;
            }
        }
    }

    private static final String[] ARROWS = {"\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"};

    /** Up to four nearest waypoints of this dimension: name, distance and an arrow that points the way. */
    private int drawWaypoints(DrawContext ctx, MinecraftClient client, int sw, int x, int y) {
        if (cachedWaypoints.isEmpty() || client.world == null) return y;
        double px = client.player.getX(), pz = client.player.getZ();
        for (PurrlixConfig.Waypoint w : cachedWaypoints) {
            double dx = w.x + 0.5 - px, dz = w.z + 0.5 - pz;
            double target = Math.toDegrees(Math.atan2(-dx, dz));
            double rel = net.minecraft.util.math.MathHelper.wrapDegrees(target - client.player.getYaw());
            int idx = Math.floorMod((int) Math.round(rel / 45.0), 8);
            y = line(ctx, client, sw, x, y, w.name + " ", ARROWS[idx] + " " + (int) Math.hypot(dx, dz) + "m");
        }
        return y;
    }

    private int line(DrawContext ctx, MinecraftClient client, int sw, int x, int y, String label, String value) {
        int w = client.textRenderer.getWidth(label + value) + 8;
        int lx = cfg.hudRight ? sw - w - 3 : x;
        if (cfg.hudBackground) {
            Ui.box(ctx, lx - 3, y - 2, lx - 3 + w, y + 10, (Math.max(20, Math.min(100, cfg.hudOpacity)) * 255 / 100) << 24 | 0x0B0F17);
            ctx.fill(cfg.hudRight ? lx - 3 + w - 2 : lx - 3, y - 2, cfg.hudRight ? lx - 3 + w : lx - 1, y + 10, Ui.main());
        }
        ctx.drawTextWithShadow(client.textRenderer, label, lx, y, Ui.light());
        ctx.drawTextWithShadow(client.textRenderer, value, lx + client.textRenderer.getWidth(label), y, TEXT);
        return y + 14;
    }

    private static String pingText(MinecraftClient client) {
        if (client.getNetworkHandler() == null || client.player == null) return "0";
        PlayerListEntry entry = client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
        return entry == null ? "0" : String.valueOf(entry.getLatency());
    }

    private void drawArmor(DrawContext ctx, MinecraftClient client, int sw, int sh) {
        EquipmentSlot[] slots = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};
        int x = sw - 60;
        int y = sh / 2 - 45;
        for (EquipmentSlot slot : slots) {
            ItemStack stack = client.player.getEquippedStack(slot);
            if (stack.isEmpty()) continue;
            ctx.drawItem(stack, x, y);
            if (stack.isDamageable()) {
                String durability = String.valueOf(stack.getMaxDamage() - stack.getDamage());
                ctx.drawTextWithShadow(client.textRenderer, durability, x + 20, y + 4, TEXT);
            }
            y += 18;
        }
    }

    /** Totems, golden apples and ender pearls in your inventory, bottom right. */
    private void drawCounts(DrawContext ctx, MinecraftClient client, int sw, int sh) {
        net.minecraft.item.Item[] items = {Items.TOTEM_OF_UNDYING, Items.GOLDEN_APPLE, Items.ENDER_PEARL};
        int x = sw - 52;
        int y = sh - 90;
        int idx = 0;
        for (net.minecraft.item.Item item : items) {
            int n = cachedCounts[idx++];
            Ui.box(ctx, x - 2, y - 2, x + 46, y + 18, 0x990B0F17);
            ctx.fill(x - 2, y - 2, x, y + 18, n > 0 ? Ui.main() : 0xFF303747);
            ctx.drawItem(new ItemStack(item), x + 2, y);
            ctx.drawTextWithShadow(client.textRenderer, "x" + n, x + 22, y + 4, n > 0 ? TEXT : 0xFF8B94A7);
            y += 22;
        }
    }

    private void drawKeystrokes(DrawContext ctx, MinecraftClient client, int sh) {
        int size = 22;
        int gap = 2;
        int baseX = 6;
        int baseY = sh - 3 * (size + gap) - 28;
        key(ctx, client, baseX + size + gap, baseY, size, "W", client.options.forwardKey.isPressed());
        key(ctx, client, baseX, baseY + size + gap, size, "A", client.options.leftKey.isPressed());
        key(ctx, client, baseX + size + gap, baseY + size + gap, size, "S", client.options.backKey.isPressed());
        key(ctx, client, baseX + 2 * (size + gap), baseY + size + gap, size, "D", client.options.rightKey.isPressed());
        int row3 = baseY + 2 * (size + gap);
        key(ctx, client, baseX, row3, size * 3 / 2 + 1, "LMB", client.options.attackKey.isPressed());
        key(ctx, client, baseX + size * 3 / 2 + gap + 1, row3, size * 3 / 2 + 1, "RMB", client.options.useKey.isPressed());
        key(ctx, client, baseX, row3 + size + gap, 3 * size + 2 * gap, "SPACE", client.options.jumpKey.isPressed());
    }

    private static void key(DrawContext ctx, MinecraftClient client, int x, int y, int w, String label, boolean down) {
        int h = 22;
        Ui.box(ctx, x, y, x + w, y + h, down ? 0xDDF97316 : 0x990B0F17);
        ctx.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, down ? 0xFFFFD08A : 0xFF303747);
        int tw = client.textRenderer.getWidth(label);
        ctx.drawTextWithShadow(client.textRenderer, label, x + (w - tw) / 2, y + 7, down ? 0xFF1A1A1A : TEXT);
    }
}
