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

    private static final String[] TABS = {"All", "HUD", "Info", "Gameplay", "Tune"};
    private static final int CARD_W = 92, CARD_H = 62, GAP = 6;
    private int tab = 0;
    private String query = "";
    private int scroll = 0;

    // geometry, recomputed in layout()
    private int px, py, pw, ph;
    private int gridX, gridY, gridW, gridH, cols;

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
            new Row("Now playing (Spotify)", Items.JUKEBOX, () -> cfg.nowPlaying, v -> cfg.nowPlaying = v),
            new Row("Motion blur", Items.PRISMARINE_SHARD, () -> cfg.motionBlur, v -> { cfg.motionBlur = v; if (!v) com.phoenix.client.PhoenixMotionBlur.reset(); }),
            new Row("Fullbright", Items.GLOWSTONE, () -> cfg.fullbright, v -> cfg.fullbright = v),
            new Row("Launcher skin", Items.PLAYER_HEAD, () -> cfg.launcherSkin, v -> cfg.launcherSkin = v),
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
        pw = Math.min(this.width - 16, 520);
        ph = Math.min(this.height - 12, 300);
        px = (this.width - pw) / 2;
        py = (this.height - ph) / 2;
        gridX = px + 12;
        gridY = py + 62;
        gridW = pw - 24;
        gridH = ph - 62 - 34;
        cols = Math.max(1, (gridW + GAP) / (CARD_W + GAP));
    }

    /** Modules shown for the current tab and search text. */
    private List<Row> visible() {
        List<Row> out = new ArrayList<>();
        String q = query.trim().toLowerCase(java.util.Locale.ROOT);
        for (int s = 0; s < sections.size(); s++) {
            if (tab != 0 && tab != s + 1) continue;
            for (Row r : sections.get(s).rows()) {
                if (q.isEmpty() || r.label().toLowerCase(java.util.Locale.ROOT).contains(q)) out.add(r);
            }
        }
        return out;
    }

    private int tabX(int i) {
        int x = px + 12;
        for (int k = 0; k < i; k++) x += this.textRenderer.getWidth(TABS[k]) + 16;
        return x;
    }

    private int contentHeight(int count) {
        int rows = (count + cols - 1) / cols;
        return rows * (CARD_H + GAP);
    }

    private int maxScroll(int count) {
        return Math.max(0, contentHeight(count) - gridH);
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

        ctx.getMatrices().push();
        ctx.getMatrices().translate(px + 12, py + 11, 0);
        ctx.getMatrices().scale(1.5f, 1.5f, 1f);
        ctx.drawTextWithShadow(this.textRenderer, "PHOENIX MENU", 0, 0, light);
        ctx.getMatrices().pop();

        // search box
        int sw = 110, sx = px + pw - sw - 12, sy = py + 10;
        Ui.box(ctx, sx, sy, sx + sw, sy + 14, ROW);
        ctx.drawTextWithShadow(this.textRenderer, query.isEmpty() ? "Search..." : this.textRenderer.trimToWidth(query, sw - 8), sx + 5, sy + 3, query.isEmpty() ? MUTED : 0xFFF3F5FA);

        // tabs
        for (int i = 0; i < TABS.length; i++) {
            int x = tabX(i);
            int w = this.textRenderer.getWidth(TABS[i]) + 10;
            boolean on = i == tab;
            boolean hover = mouseX >= x && mouseX < x + w && mouseY >= py + 34 && mouseY < py + 50;
            Ui.box(ctx, x, py + 34, x + w, py + 50, on ? main : hover ? ROW_HOVER : ROW);
            ctx.drawTextWithShadow(this.textRenderer, TABS[i], x + 5, py + 38, on ? 0xFF1A0E05 : 0xFFC9D0DE);
        }

        if (tab == 4) renderTune(ctx, mouseX, mouseY, main, light);
        else renderCards(ctx, mouseX, mouseY, main);

        // footer buttons
        int by = py + ph - 26;
        button(ctx, px + 12, by, 80, 18, "Cosmetics", mouseX, mouseY, false);
        button(ctx, px + 98, by, 56, 18, "Reset", mouseX, mouseY, false);
        button(ctx, px + pw - 92, by, 80, 18, "Done", mouseX, mouseY, true);
        ctx.drawTextWithShadow(this.textRenderer, "Right Shift: menu   .: commands", px + 164, by + 5, MUTED);
    }

    private void button(DrawContext ctx, int x, int y, int w, int h, String text, int mx, int my, boolean primary) {
        boolean hover = mx >= x && mx < x + w && my >= y && my < y + h;
        int bg = primary ? (hover ? Ui.light() : Ui.main()) : (hover ? ROW_HOVER : OFF);
        Ui.box(ctx, x, y, x + w, y + h, bg);
        ctx.drawCenteredTextWithShadow(this.textRenderer, text, x + w / 2, y + (h - 8) / 2, primary ? 0xFF1A0E05 : 0xFFFFFFFF);
    }

    private void renderCards(DrawContext ctx, int mouseX, int mouseY, int main) {
        List<Row> rows = visible();
        scroll = Math.max(0, Math.min(scroll, maxScroll(rows.size())));
        if (rows.isEmpty()) {
            ctx.drawTextWithShadow(this.textRenderer, "No module matches your search.", gridX, gridY + 6, MUTED);
            return;
        }
        ctx.enableScissor(gridX, gridY, gridX + gridW, gridY + gridH);
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            int cx = gridX + (i % cols) * (CARD_W + GAP);
            int cy = gridY + (i / cols) * (CARD_H + GAP) - scroll;
            if (cy + CARD_H < gridY || cy > gridY + gridH) continue;
            boolean on = r.get().getAsBoolean();
            boolean hover = mouseX >= cx && mouseX < cx + CARD_W && mouseY >= Math.max(cy, gridY) && mouseY < Math.min(cy + CARD_H, gridY + gridH);
            Ui.box(ctx, cx, cy, cx + CARD_W, cy + CARD_H, hover ? ROW_HOVER : ROW);
            if (on) ctx.fill(cx + 2, cy, cx + CARD_W - 2, cy + 1, main);
            ctx.drawTextWithShadow(this.textRenderer, this.textRenderer.trimToWidth(r.label(), CARD_W - 10), cx + 6, cy + 6, 0xFFE6E9F0);
            try {
                ctx.getMatrices().push();
                ctx.getMatrices().translate(cx + CARD_W / 2f - 12, cy + 18, 0);
                ctx.getMatrices().scale(1.5f, 1.5f, 1f);
                ctx.drawItem(new ItemStack(r.icon()), 0, 0);
                ctx.getMatrices().pop();
            } catch (Throwable ignored) {
                // icons are cosmetic
            }
            int bx = cx + 6, by = cy + CARD_H - 19, bw = CARD_W - 12;
            Ui.box(ctx, bx, by, bx + bw, by + 14, on ? 0xFF1E5B34 : 0xFF1B212D);
            ctx.drawCenteredTextWithShadow(this.textRenderer, on ? "Enabled" : "Disabled", bx + bw / 2, by + 3, on ? 0xFF7CF0A1 : 0xFF9AA3B5);
        }
        ctx.disableScissor();
        int max = maxScroll(rows.size());
        if (max > 0) {
            int trackH = gridH;
            int thumbH = Math.max(14, trackH * gridH / contentHeight(rows.size()));
            int thumbY = gridY + (trackH - thumbH) * scroll / max;
            ctx.fill(gridX + gridW + 4, gridY, gridX + gridW + 6, gridY + trackH, 0x33FFFFFF);
            ctx.fill(gridX + gridW + 4, thumbY, gridX + gridW + 6, thumbY + thumbH, main);
        }
    }

    private void renderTune(DrawContext ctx, int mouseX, int mouseY, int main, int light) {
        for (int i = 0; i < steppers.size(); i++) {
            Stepper st = steppers.get(i);
            int y = gridY + i * 17;
            if (y + 15 > gridY + gridH) break;
            int x = gridX, w = Math.min(gridW, 300);
            Ui.box(ctx, x, y, x + w, y + 15, ROW);
            drawIcon(ctx, st.icon(), x + 4, y + 2);
            ctx.drawTextWithShadow(this.textRenderer, st.label(), x + 20, y + 4, 0xFFE6E9F0);
            int mx = x + w - 90, pxx = x + w - 17;
            boolean hm = mouseX >= mx && mouseX < mx + 13 && mouseY >= y && mouseY < y + 15;
            boolean hp = mouseX >= pxx && mouseX < pxx + 13 && mouseY >= y && mouseY < y + 15;
            Ui.box(ctx, mx, y + 1, mx + 13, y + 14, hm ? main : OFF);
            Ui.box(ctx, pxx, y + 1, pxx + 13, y + 14, hp ? main : OFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, "-", mx + 7, y + 4, 0xFFFFFFFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, "+", pxx + 7, y + 4, 0xFFFFFFFF);
            ctx.drawCenteredTextWithShadow(this.textRenderer, st.value().get(), (mx + 13 + pxx) / 2, y + 4, light);
        }
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

    @Override
    public boolean charTyped(char chr, int modifiers) {
        if (chr >= 32 && chr != 127 && query.length() < 20) {
            query += chr;
            scroll = 0;
            return true;
        }
        return super.charTyped(chr, modifiers);
    }

    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode == 259 && !query.isEmpty()) { // backspace
            query = query.substring(0, query.length() - 1);
            scroll = 0;
            return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        if (tab != 4) {
            scroll = Math.max(0, Math.min(maxScroll(visible().size()), scroll - (int) (verticalAmount * 24)));
            return true;
        }
        return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (button != 0) return super.mouseClicked(mx, my, button);
        layout();
        for (int i = 0; i < TABS.length; i++) {
            int x = tabX(i);
            int w = this.textRenderer.getWidth(TABS[i]) + 10;
            if (mx >= x && mx < x + w && my >= py + 34 && my < py + 50) {
                tab = i;
                scroll = 0;
                return true;
            }
        }
        int by = py + ph - 26;
        if (my >= by && my < by + 18) {
            if (mx >= px + 12 && mx < px + 92) {
                if (this.client != null) this.client.setScreen(new PhoenixCosmeticsScreen(cfg));
                return true;
            }
            if (mx >= px + 98 && mx < px + 154) {
                cfg.resetToDefaults();
                PhoenixMotionBlur.reset();
                cfg.save();
                return true;
            }
            if (mx >= px + pw - 92 && mx < px + pw - 12) {
                close();
                return true;
            }
        }
        if (tab == 4) {
            for (int i = 0; i < steppers.size(); i++) {
                int y = gridY + i * 17;
                if (my < y || my >= y + 15) continue;
                int w = Math.min(gridW, 300);
                int mxm = gridX + w - 90, mxp = gridX + w - 17;
                if (mx >= mxm && mx < mxm + 13) {
                    steppers.get(i).dec().run();
                    cfg.save();
                    return true;
                }
                if (mx >= mxp && mx < mxp + 13) {
                    steppers.get(i).inc().run();
                    cfg.save();
                    return true;
                }
            }
            return true;
        }
        if (mx >= gridX && mx < gridX + gridW && my >= gridY && my < gridY + gridH) {
            List<Row> rows = visible();
            for (int i = 0; i < rows.size(); i++) {
                int cx = gridX + (i % cols) * (CARD_W + GAP);
                int cy = gridY + (i / cols) * (CARD_H + GAP) - scroll;
                if (mx >= cx && mx < cx + CARD_W && my >= cy && my < cy + CARD_H) {
                    Row r = rows.get(i);
                    r.set().accept(!r.get().getAsBoolean());
                    cfg.save();
                    return true;
                }
            }
        }
        return super.mouseClicked(mx, my, button);
    }
}
