package com.phoenix.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
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

    private record Row(String label, BooleanSupplier get, Consumer<Boolean> set) {}
    private record Section(String title, List<Row> rows) {}

    private final PhoenixConfig cfg;
    private final List<Section> sections = new ArrayList<>();

    // geometry, recomputed in layout()
    private int px, py, pw, ph, colW;
    private int doneX, doneY, doneW, doneH;
    private int minusX, plusX, scaleY;

    public PhoenixMenu(PhoenixConfig cfg) {
        super(Text.literal("Phoenix Client"));
        this.cfg = cfg;
        sections.add(new Section("HUD", List.of(
            new Row("FPS", () -> cfg.fps, v -> cfg.fps = v),
            new Row("CPS", () -> cfg.cps, v -> cfg.cps = v),
            new Row("Ping", () -> cfg.ping, v -> cfg.ping = v),
            new Row("Coordinates", () -> cfg.coords, v -> cfg.coords = v),
            new Row("Direction", () -> cfg.direction, v -> cfg.direction = v),
            new Row("Speed", () -> cfg.speed, v -> cfg.speed = v),
            new Row("Clock", () -> cfg.clock, v -> cfg.clock = v),
            new Row("Memory", () -> cfg.memory, v -> cfg.memory = v),
            new Row("Potion effects", () -> cfg.effects, v -> cfg.effects = v),
            new Row("Armor status", () -> cfg.armor, v -> cfg.armor = v),
            new Row("Keystrokes", () -> cfg.keystrokes, v -> cfg.keystrokes = v),
            new Row("Item counters", () -> cfg.itemCounts, v -> cfg.itemCounts = v),
            new Row("World day", () -> cfg.worldDay, v -> cfg.worldDay = v),
            new Row("HUD on the right", () -> cfg.hudRight, v -> cfg.hudRight = v),
            new Row("HUD background", () -> cfg.hudBackground, v -> cfg.hudBackground = v))));
        sections.add(new Section("GAMEPLAY", List.of(
            new Row("Always sprint", () -> cfg.alwaysSprint, v -> cfg.alwaysSprint = v),
            new Row("Zoom (hold C)", () -> cfg.zoom, v -> cfg.zoom = v),
            new Row("Fast place", () -> cfg.fastPlace, v -> cfg.fastPlace = v),
            new Row("Fullbright", () -> cfg.fullbright, v -> cfg.fullbright = v),
            new Row("Animated cape (you)", () -> cfg.animatedCape, v -> cfg.animatedCape = v),
            new Row("Phoenix loading screen", () -> cfg.splash, v -> cfg.splash = v))));
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
                ctx.fill(x, y, x + colW, y + 15, hover ? ROW_HOVER : ROW);
                ctx.drawTextWithShadow(this.textRenderer, r.label(), x + 6, y + 4, 0xFFE6E9F0);
                drawSwitch(ctx, x + colW - 26, y + 2, r.get().getAsBoolean());
            }
        }

        // HUD size control sits under the gameplay column
        int gx = rowX(1);
        scaleY = rowY(sections.get(1).rows().size() + 1);
        ctx.drawTextWithShadow(this.textRenderer, "APPEARANCE", gx, scaleY - 9, ORANGE);
        ctx.fill(gx, scaleY, gx + colW, scaleY + 15, ROW);
        ctx.drawTextWithShadow(this.textRenderer, "HUD size", gx + 6, scaleY + 4, 0xFFE6E9F0);
        minusX = gx + colW - 62;
        plusX = gx + colW - 16;
        ctx.fill(minusX, scaleY + 1, minusX + 13, scaleY + 14, OFF);
        ctx.fill(plusX, scaleY + 1, plusX + 13, scaleY + 14, OFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "-", minusX + 7, scaleY + 4, 0xFFFFFFFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "+", plusX + 7, scaleY + 4, 0xFFFFFFFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, cfg.scale + "%", (minusX + plusX + 13) / 2, scaleY + 4, AMBER);

        // done button
        boolean doneHover = mouseX >= doneX && mouseX < doneX + doneW && mouseY >= doneY && mouseY < doneY + doneH;
        ctx.fill(doneX, doneY, doneX + doneW, doneY + doneH, doneHover ? AMBER : ORANGE);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "Done", doneX + doneW / 2, doneY + 6, 0xFF1A0E05);
        ctx.drawTextWithShadow(this.textRenderer, "Right Shift opens this menu", px + 14, doneY + 6, MUTED);
    }

    private static void drawSwitch(DrawContext ctx, int x, int y, boolean on) {
        ctx.fill(x, y, x + 24, y + 11, on ? ORANGE : OFF);
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
            if (mx >= doneX && mx < doneX + doneW && my >= doneY && my < doneY + doneH) {
                close();
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }
}
