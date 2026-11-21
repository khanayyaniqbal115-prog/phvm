package com.phoenix.client;

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

import com.phoenix.client.mixin.MinecraftClientAccessor;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Items;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;

/** Phoenix Client: a small original HUD mod made for Phoenix Launcher. */
public final class PhoenixClient implements ClientModInitializer {
    private static final int TEXT = 0xFFFFFFFF;
    private static final int ACCENT = 0xFFFFA726;

    private PhoenixConfig cfg;
    private KeyBinding menuKey;
    private KeyBinding zoomKey;

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
        PhoenixConfig.load();
        cfg = PhoenixConfig.INSTANCE;
        menuKey = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.phoenix.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.phoenix"));
        zoomKey = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.phoenix.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.phoenix"));

        ClientTickEvents.END_CLIENT_TICK.register(this::tick);
        HudRenderCallback.EVENT.register(this::renderHud);
    }

    // ------------------------------------------------------------------ logic

    private void tick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            client.setScreen(new PhoenixMenu(cfg));
        }
        if (client.player == null) return;

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
            if (acc.phoenix$getItemUseCooldown() > limit) acc.phoenix$setItemUseCooldown(limit);
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
            client.options.getFov().setValue(30);
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
            Runtime rt = Runtime.getRuntime();
            long used = (rt.totalMemory() - rt.freeMemory()) / 1048576L;
            y = line(ctx, client, sw, x, y, "RAM ", used + "/" + (rt.maxMemory() / 1048576L) + " MB");
        }
        if (cfg.effects) {
            for (StatusEffectInstance e : client.player.getStatusEffects()) {
                if (cfg.fullbright && e.getEffectType().equals(StatusEffects.NIGHT_VISION)) continue;
                int secs = e.getDuration() / 20;
                String name = e.getEffectType().value().getName().getString();
                y = line(ctx, client, sw, x, y, name + " ", (e.getAmplifier() + 1) + " " + (secs / 60) + ":" + String.format("%02d", secs % 60));
            }
        }
        if (cfg.armor) drawArmor(ctx, client, sw, sh);
        if (cfg.itemCounts) drawCounts(ctx, client, sw, sh);
        if (cfg.keystrokes) drawKeystrokes(ctx, client, sh);
        ctx.getMatrices().pop();
    }

    private int line(DrawContext ctx, MinecraftClient client, int sw, int x, int y, String label, String value) {
        int w = client.textRenderer.getWidth(label + value) + 8;
        int lx = cfg.hudRight ? sw - w - 3 : x;
        if (cfg.hudBackground) {
            Ui.box(ctx, lx - 3, y - 2, lx - 3 + w, y + 10, 0x990B0F17);
            ctx.fill(cfg.hudRight ? lx - 3 + w - 2 : lx - 3, y - 2, cfg.hudRight ? lx - 3 + w : lx - 1, y + 10, 0xFFF97316);
        }
        ctx.drawTextWithShadow(client.textRenderer, label, lx, y, ACCENT);
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
        for (net.minecraft.item.Item item : items) {
            int n = client.player.getInventory().count(item);
            Ui.box(ctx, x - 2, y - 2, x + 46, y + 18, 0x990B0F17);
            ctx.fill(x - 2, y - 2, x, y + 18, n > 0 ? 0xFFF97316 : 0xFF303747);
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
