package com.phoenix.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Phoenix-styled settings screen (opened with Right Shift by default). Drawn by hand, no vanilla buttons. */
public final class PhoenixMenu extends Screen {
    private static final int PANEL = 0xF00D1018;
    private static final int PANEL_EDGE = 0xFF262D3B;
    private static final int ROW = 0xFF151A25;
    private static final int ROW_HOVER = 0xFF1D2433;
    private static final int MUTED = 0xFF8B94A7;
    private static final int OFF = 0xFF303747;

    private record Row(String label, Item icon, BooleanSupplier get, Consumer<Boolean> set) {}
    private record Section(String title, List<Row> rows) {}
    /** A number control: label, icon, current value text, and what - and + do. */
    private record Stepper(String label, Item icon, java.util.function.Supplier<String> value, Runnable dec, Runnable inc) {}

    private final PhoenixConfig cfg;
    private final List<Section> sections = new ArrayList<>();
    private final List<Stepper> steppers = new ArrayList<>();

    // geometry, recomputed in layout()
    private int px, py, pw, ph, colW;
    private int doneX, doneY, doneW, doneH;

    public PhoenixMenu(PhoenixConfig cfg) {
        super(Text.literal("Phoenix Client"));
        this.cfg = cfg;
        sections.add(new Section("HUD", List.of(
            new Row("FPS", Items.REDSTONE, () -> cfg.fps, v -> cfg.fps = v),
            new Row("CPS", Items.IRON_SWORD, () -> cfg.cps, v -> cfg.cps = v),
            new Row("Ping", Items.ENDER_EYE, () -> cfg.ping, v -> cfg.ping = v),
            new Row("Coordinates", Items.COMPASS, () -> cfg.coords, v -> cfg.coords = v),
            new Row("Direction", Items.FILLED_MAP, () -> cfg.direction, v -> cfg.direction = v),
            new Row("Speed", Items.FEATHER, () -> cfg.speed, v -> cfg.speed = v),
            new Row("Clock", Items.CLOCK, () -> cfg.clock, v -> cfg.clock = v),
            new Row("Memory", Items.REDSTONE_TORCH, () -> cfg.memory, v -> cfg.memory = v),
            new Row("Potion effects", Items.POTION, () -> cfg.effects, v -> cfg.effects = v),
            new Row("Armor status", Items.IRON_CHESTPLATE, () -> cfg.armor, v -> cfg.armor = v),
            new Row("Keystrokes", Items.STONE_BUTTON, () -> cfg.keystrokes, v -> cfg.keystrokes = v),
            new Row("Item counters", Items.TOTEM_OF_UNDYING, () -> cfg.itemCounts, v -> cfg.itemCounts = v),
            new Row("HUD on the right", Items.ARROW, () -> cfg.hudRight, v -> cfg.hudRight = v),
            new Row("HUD background", Items.BLACK_STAINED_GLASS, () -> cfg.hudBackground, v -> cfg.hudBackground = v))));
        sections.add(new Section("INFO", List.of(
            new Row("World day", Items.SUNFLOWER, () -> cfg.worldDay, v -> cfg.worldDay = v),
            new Row("Game time", Items.CLOCK, () -> cfg.gameTime, v -> cfg.gameTime = v),
            new Row("Biome", Items.OAK_SAPLING, () -> cfg.biome, v -> cfg.biome = v),
            new Row("Light level", Items.TORCH, () -> cfg.lightLevel, v -> cfg.lightLevel = v),
            new Row("Looking at", Items.SPYGLASS, () -> cfg.lookingAt, v -> cfg.lookingAt = v),
            new Row("Server info", Items.NAME_TAG, () -> cfg.serverInfo, v -> cfg.serverInfo = v),
            new Row("Session timer", Items.HOPPER, () -> cfg.session, v -> cfg.session = v),
            new Row("Waypoints", Items.RECOVERY_COMPASS, () -> cfg.waypointHud, v -> cfg.waypointHud = v),
            new Row("Low durability", Items.IRON_PICKAXE, () -> cfg.lowDurability, v -> cfg.lowDurability = v))));
        sections.add(new Section("GAMEPLAY", List.of(
            new Row("Always sprint", Items.LEATHER_BOOTS, () -> cfg.alwaysSprint, v -> cfg.alwaysSprint = v),
            new Row("Zoom (hold C)", Items.SPYGLASS, () -> cfg.zoom, v -> cfg.zoom = v),
            new Row("Fast place", Items.BRICKS, () -> cfg.fastPlace, v -> cfg.fastPlace = v),
            new Row("Death waypoint", Items.SKELETON_SKULL, () -> cfg.deathWaypoint, v -> cfg.deathWaypoint = v),
            new Row("Custom crosshair", Items.ENDER_EYE, () -> cfg.crosshair, v -> cfg.crosshair = v),
            new Row("Motion blur", Items.PRISMARINE_SHARD, () -> cfg.motionBlur, v -> { cfg.motionBlur = v; if (!v) com.phoenix.client.PhoenixMotionBlur.reset(); }),
            new Row("Fullbright", Items.GLOWSTONE, () -> cfg.fullbright, v -> cfg.fullbright = v),
            new Row("Animated cape (you)", Items.ELYTRA, () -> cfg.animatedCape, v -> cfg.animatedCape = v),
            new Row("Loading screen", Items.PAINTING, () -> cfg.splash, v -> cfg.splash = v),
            new Row("Menu background", Items.GLOW_ITEM_FRAME, () -> cfg.menuBackground, v -> cfg.menuBackground = v))));
        steppers.add(new Stepper("HUD size", Items.SPYGLASS, () -> cfg.scale + "%",
            () -> cfg.scale = Math.max(60, cfg.scale - 10), () -> cfg.scale = Math.min(160, cfg.scale + 10)));
        steppers.add(new Stepper("HUD opacity", Items.BLACK_STAINED_GLASS, () -> cfg.hudOpacity + "%",
            () -> cfg.hudOpacity = Math.max(20, cfg.hudOpacity - 10), () -> cfg.hudOpacity = Math.min(100, cfg.hudOpacity + 10)));
        steppers.add(new Stepper("Accent", Items.ORANGE_DYE, () -> Ui.ACCENT_NAMES[Math.floorMod(cfg.accent, Ui.ACCENT_NAMES.length)],
            () -> cfg.accent = Math.floorMod(cfg.accent - 1, Ui.ACCENT_NAMES.length), () -> cfg.accent = Math.floorMod(cfg.accent + 1, Ui.ACCENT_NAMES.length)));
        steppers.add(new Stepper("Place delay", Items.BRICKS, () -> cfg.fastPlaceDelay == 0 ? "MAX" : cfg.fastPlaceDelay + "t",
            () -> cfg.fastPlaceDelay = Math.max(0, cfg.fastPlaceDelay - 1), () -> cfg.fastPlaceDelay = Math.min(3, cfg.fastPlaceDelay + 1)));
        steppers.add(new Stepper("Blur strength", Items.PRISMARINE_SHARD, () -> cfg.motionBlurStrength + "%",
            () -> cfg.motionBlurStrength = Math.max(10, cfg.motionBlurStrength - 10), () -> cfg.motionBlurStrength = Math.min(90, cfg.motionBlurStrength + 10)));
        steppers.add(new Stepper("Zoom FOV", Items.SPYGLASS, () -> String.valueOf(cfg.zoomFov),
            () -> cfg.zoomFov = Math.max(5, cfg.zoomFov - 5), () -> cfg.zoomFov = Math.min(70, cfg.zoomFov + 5)));
        steppers.add(new Stepper("Cross style", Items.ENDER_EYE, () -> new String[] {"Plus", "Dot", "X", "Ring", "Plus+dot"}[Math.floorMod(cfg.crossStyle, 5)],
            () -> cfg.crossStyle = Math.floorMod(cfg.crossStyle - 1, 5), () -> cfg.crossStyle = Math.floorMod(cfg.crossStyle + 1, 5)));
        steppers.add(new Stepper("Cross size", Items.ARROW, () -> String.valueOf(cfg.crossSize),
            () -> cfg.crossSize = Math.max(2, cfg.crossSize - 1), () -> cfg.crossSize = Math.min(12, cfg.crossSize + 1)));
        steppers.add(new Stepper("Cross color", Items.LIME_DYE, () -> new String[] {"White", "Accent", "Green", "Red", "Cyan", "Yellow"}[Math.floorMod(cfg.crossColor, 6)],
            () -> cfg.crossColor = Math.floorMod(cfg.crossColor - 1, 6), () -> cfg.crossColor = Math.floorMod(cfg.crossColor + 1, 6)));
    }

    private void layout() {
        int n = sections.size() + 1; // the last column holds the number controls
        pw = Math.min(this.width - 20, 640);
        colW = (pw - 28 - (n - 1) * 8) / n;
        int rows = steppers.size();
        for (Section sec : sections) rows = Math.max(rows, sec.rows().size());
        ph = 62 + rows * 17 + 44;
        px = (this.width - pw) / 2;
        py = Math.max(6, (this.height - ph) / 2);
        doneW = 90;
        doneH = 20;
        doneX = px + pw - doneW - 14;
        doneY = py + ph - doneH - 12;
    }

    private int rowX(int section) {
        return px + 14 + section * (colW + 8);
    }

    private int rowY(int index) {
        return py + 58 + index * 17;
    }

    private int minusX(int x) {
        return x + colW - 58;
    }

    private int plusX(int x) {
        return x + colW - 15;
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        layout();
        int main = Ui.main();
        int light = Ui.light();
        ctx.fillGradient(0, 0, this.width, this.height, 0xB0050709, 0xB0140A06);
        Ui.box(ctx, px - 1, py - 1, px + pw + 1, py + ph + 1, PANEL_EDGE);
        Ui.box(ctx, px, py, px + pw, py + ph, PANEL);
        ctx.fillGradient(px + 1, py, px + pw - 1, py + 3, main, light);
        int columns = sections.size() + 1;
        for (int s = 0; s < columns; s++) {
            int cx = rowX(s) - 4;
            Ui.box(ctx, cx, py + 44, cx + colW + 8, py + ph - 38, 0x55070A10);
        }

        ctx.getMatrices().push();
        ctx.getMatrices().translate(px + 14, py + 14, 0);
        ctx.getMatrices().scale(1.6f, 1.6f, 1f);
        ctx.drawTextWithShadow(this.textRenderer, "PHOENIX CLIENT", 0, 0, light);
        ctx.getMatrices().pop();
        ctx.drawTextWithShadow(this.textRenderer, "Click a switch to turn a module on or off. Use - and + for numbers.", px + 14, py + 38, MUTED);

        for (int s = 0; s < sections.size(); s++) {
            Section sec = sections.get(s);
            int x = rowX(s);
            ctx.drawTextWithShadow(this.textRenderer, sec.title(), x, py + 49, main);
            for (int i = 0; i < sec.rows().size(); i++) {
                Row r = sec.rows().get(i);
                int y = rowY(i);
                boolean hover = mouseX >= x && mouseX < x + colW && mouseY >= y && mouseY < y + 15;
                boolean on = r.get().getAsBoolean();
                Ui.box(ctx, x, y, x + colW, y + 15, hover ? ROW_HOVER : ROW);
                if (on) ctx.fill(x, y + 2, x + 2, y + 13, main);
                drawIcon(ctx, r.icon(), x + 4, y + 2);
                if (!on) ctx.fill(x + 4, y + 2, x + 15, y + 13, 0x99151A25);
                ctx.drawTextWithShadow(this.textRenderer, this.textRenderer.trimToWidth(r.label(), colW - 52), x + 20, y + 4, on ? 0xFFF3F5FA : 0xFF9AA3B5);
                drawSwitch(ctx, x + colW - 26, y + 2, on);
            }
        }

        int gx = rowX(sections.size());
        ctx.drawTextWithShadow(this.textRenderer, "TUNE", gx, py + 49, main);
        for (int i = 0; i < steppers.size(); i++) {
            Stepper st = steppers.get(i);
            int y = rowY(i);
            Ui.box(ctx, gx, y, gx + colW, y + 15, ROW);
            drawIcon(ctx, st.icon(), gx + 4, y + 2);
            ctx.drawTextWithShadow(this.textRenderer, this.textRenderer.trimToWidth(st.label(), colW - 80), gx + 20, y + 4, 0xFFE6E9F0);
            int mx = minusX(gx), pxx = plusX(gx);
            boolean hm = mouseX >= mx && mouseX < mx + 13 && mouseY >= y && mouseY < y + 15;
            boolean hp = mouseX >= pxx && mouseX < pxx + 13 && mouseY >= y && mouseY < y + 15;
            Ui.box(ctx, mx, y + 1, mx + 13, y + 14, hm ? main : OFF);
            Ui.box(ctx, pxx, y + 1, pxx + 13, y + 14, hp ? main : OFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, "-", mx + 7, y + 4, 0xFFFFFFFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, "+", pxx + 7, y + 4, 0xFFFFFFFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, st.value().get(), (mx + 13 + pxx) / 2, y + 4, light);
        }

        boolean doneHover = mouseX >= doneX && mouseX < doneX + doneW && mouseY >= doneY && mouseY < doneY + doneH;
        Ui.box(ctx, doneX, doneY, doneX + doneW, doneY + doneH, doneHover ? light : main);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "Done", doneX + doneW / 2, doneY + 6, 0xFF1A0E05);
        ctx.drawTextWithShadow(this.textRenderer, "Right Shift: menu   .: type a command (.help)", px + 14, doneY + 6, MUTED);
    }

    private void drawIcon(DrawContext ctx, Item item, int x, int y) {
        try {
            ctx.getMatrices().push();
            ctx.getMatrices().translate(x, y, 0);
            ctx.getMatrices().scale(0.7f, 0.7f, 1f);
            ctx.drawItem(new ItemStack(item), 0, 0);
            ctx.getMatrices().pop();
        } catch (Throwable ignored) {
            // icons are cosmetic, never break the menu
        }
    }

    private static void drawSwitch(DrawContext ctx, int x, int y, boolean on) {
        Ui.box(ctx, x, y, x + 24, y + 11, on ? Ui.main() : OFF);
        int kx = on ? x + 14 : x + 2;
        ctx.fill(kx, y + 2, kx + 8, y + 9, 0xFFFFFFFF);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (button == 0) {
            layout();
            for (int s = 0; s < sections.size(); s++) {
                int x = rowX(s);
                List<Row> rows = sections.get(s).rows();
                for (int i = 0; i < rows.size(); i++) {
                    int y = rowY(i);
                    if (mx >= x && mx < x + colW && my >= y && my < y + 15) {
                        Row r = rows.get(i);
                        r.set().accept(!r.get().getAsBoolean());
                        cfg.save();
                        return true;
                    }
                }
            }
            int gx = rowX(sections.size());
            for (int i = 0; i < steppers.size(); i++) {
                int y = rowY(i);
                if (my < y || my >= y + 15) continue;
                if (mx >= minusX(gx) && mx < minusX(gx) + 13) {
                    steppers.get(i).dec().run();
                    cfg.save();
                    return true;
                }
                if (mx >= plusX(gx) && mx < plusX(gx) + 13) {
                    steppers.get(i).inc().run();
                    cfg.save();
                    return true;
                }
            }
            if (mx >= doneX && mx < doneX + doneW && my >= doneY && my < doneY + doneH) {
                close();
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }
}
