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
    private static final int ORANGE = 0xFFF97316;
    private static final int AMBER = 0xFFFFA726;
    private static final int MUTED = 0xFF8B94A7;
    private static final int OFF = 0xFF303747;

    private record Row(String label, Item icon, BooleanSupplier get, Consumer<Boolean> set) {}
    private record Section(String title, List<Row> rows) {}

    private final PhoenixConfig cfg;
    private final List<Section> sections = new ArrayList<>();

    // geometry, recomputed in layout()
    private int px, py, pw, ph, colW;
    private int doneX, doneY, doneW, doneH;
    private int minusX, plusX, scaleY, delayY;

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
            new Row("World day", Items.SUNFLOWER, () -> cfg.worldDay, v -> cfg.worldDay = v),
            new Row("HUD on the right", Items.ARROW, () -> cfg.hudRight, v -> cfg.hudRight = v),
            new Row("HUD background", Items.BLACK_STAINED_GLASS, () -> cfg.hudBackground, v -> cfg.hudBackground = v))));
        sections.add(new Section("GAMEPLAY", List.of(
            new Row("Always sprint", Items.LEATHER_BOOTS, () -> cfg.alwaysSprint, v -> cfg.alwaysSprint = v),
            new Row("Zoom (hold C)", Items.SPYGLASS, () -> cfg.zoom, v -> cfg.zoom = v),
            new Row("Fast place", Items.BRICKS, () -> cfg.fastPlace, v -> cfg.fastPlace = v),
            new Row("Fullbright", Items.GLOWSTONE, () -> cfg.fullbright, v -> cfg.fullbright = v),
            new Row("Animated cape (you)", Items.ELYTRA, () -> cfg.animatedCape, v -> cfg.animatedCape = v),
            new Row("Phoenix loading screen", Items.PAINTING, () -> cfg.splash, v -> cfg.splash = v))));
    }

    private void layout() {
        pw = Math.min(this.width - 20, 420);
        colW = (pw - 36) / 2;
        int hudRows = sections.get(0).rows().size();
        int gameRows = sections.get(1).rows().size();
        int rows = Math.max(hudRows, gameRows + 3); // gameplay column also holds the HUD size control
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

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        layout();
        ctx.fillGradient(0, 0, this.width, this.height, 0xB0050709, 0xB0140A06);
        // panel
        ctx.fill(px - 1, py - 1, px + pw + 1, py + ph + 1, PANEL_EDGE);
        ctx.fill(px, py, px + pw, py + ph, PANEL);
        ctx.fillGradient(px, py, px + pw, py + 3, ORANGE, AMBER);

        // title
        ctx.getMatrices().push();
        ctx.getMatrices().translate(px + 14, py + 14, 0);
        ctx.getMatrices().scale(1.6f, 1.6f, 1f);
        ctx.drawTextWithShadow(this.textRenderer, "PHOENIX CLIENT", 0, 0, AMBER);
        ctx.getMatrices().pop();
        ctx.drawTextWithShadow(this.textRenderer, "Modules turn on and off instantly. Click a switch.", px + 14, py + 38, MUTED);

        for (int s = 0; s < sections.size(); s++) {
            Section sec = sections.get(s);
            int x = rowX(s);
            ctx.drawTextWithShadow(this.textRenderer, sec.title(), x, py + 49, ORANGE);
            for (int i = 0; i < sec.rows().size(); i++) {
                Row r = sec.rows().get(i);
                int y = rowY(i);
                boolean hover = mouseX >= x && mouseX < x + colW && mouseY >= y && mouseY < y + 15;
                Ui.box(ctx, x, y, x + colW, y + 15, hover ? ROW_HOVER : ROW);
                drawIcon(ctx, r.icon(), x + 3, y + 2);
                ctx.drawTextWithShadow(this.textRenderer, r.label(), x + 19, y + 4, 0xFFE6E9F0);
                drawSwitch(ctx, x + colW - 26, y + 2, r.get().getAsBoolean());
            }
        }

        // HUD size control sits under the gameplay column
        int gx = rowX(1);
        scaleY = rowY(sections.get(1).rows().size() + 1);
        ctx.drawTextWithShadow(this.textRenderer, "APPEARANCE", gx, scaleY - 9, ORANGE);
        Ui.box(ctx, gx, scaleY, gx + colW, scaleY + 15, ROW);
        drawIcon(ctx, Items.SPYGLASS, gx + 3, scaleY + 2);
        ctx.drawTextWithShadow(this.textRenderer, "HUD size", gx + 19, scaleY + 4, 0xFFE6E9F0);
        minusX = gx + colW - 62;
        plusX = gx + colW - 16;
        stepper(ctx, mouseX, mouseY, scaleY, cfg.scale + "%");
        delayY = scaleY + 17;
        Ui.box(ctx, gx, delayY, gx + colW, delayY + 15, ROW);
        drawIcon(ctx, Items.BRICKS, gx + 3, delayY + 2);
        ctx.drawTextWithShadow(this.textRenderer, "Fast place delay", gx + 19, delayY + 4, 0xFFE6E9F0);
        stepper(ctx, mouseX, mouseY, delayY, cfg.fastPlaceDelay == 0 ? "MAX" : cfg.fastPlaceDelay + "t");

        // done button
        boolean doneHover = mouseX >= doneX && mouseX < doneX + doneW && mouseY >= doneY && mouseY < doneY + doneH;
        Ui.box(ctx, doneX, doneY, doneX + doneW, doneY + doneH, doneHover ? AMBER : ORANGE);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "Done", doneX + doneW / 2, doneY + 6, 0xFF1A0E05);
        ctx.drawTextWithShadow(this.textRenderer, "Right Shift opens this menu", px + 14, doneY + 6, MUTED);
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

    private void stepper(DrawContext ctx, int mx, int my, int y, String value) {
        boolean hm = mx >= minusX && mx < minusX + 13 && my >= y && my < y + 15;
        boolean hp = mx >= plusX && mx < plusX + 13 && my >= y && my < y + 15;
        Ui.box(ctx, minusX, y + 1, minusX + 13, y + 14, hm ? ORANGE : OFF);
        Ui.box(ctx, plusX, y + 1, plusX + 13, y + 14, hp ? ORANGE : OFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "-", minusX + 7, y + 4, 0xFFFFFFFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "+", plusX + 7, y + 4, 0xFFFFFFFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, value, (minusX + plusX + 13) / 2, y + 4, AMBER);
    }

    private static void drawSwitch(DrawContext ctx, int x, int y, boolean on) {
        Ui.box(ctx, x, y, x + 24, y + 11, on ? ORANGE : OFF);
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
            if (my >= scaleY && my < scaleY + 15) {
                if (mx >= minusX && mx < minusX + 13) {
                    cfg.scale = Math.max(60, cfg.scale - 10);
                    cfg.save();
                    return true;
                }
                if (mx >= plusX && mx < plusX + 13) {
                    cfg.scale = Math.min(160, cfg.scale + 10);
                    cfg.save();
                    return true;
                }
            }
            if (my >= delayY && my < delayY + 15) {
                if (mx >= minusX && mx < minusX + 13) {
                    cfg.fastPlaceDelay = Math.max(0, cfg.fastPlaceDelay - 1);
                    cfg.save();
                    return true;
                }
                if (mx >= plusX && mx < plusX + 13) {
                    cfg.fastPlaceDelay = Math.min(3, cfg.fastPlaceDelay + 1);
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
