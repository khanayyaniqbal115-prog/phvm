package com.phoenix.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.function.Consumer;
import java.util.function.Supplier;

/** In-game settings screen (opened with Right Shift by default). */
public final class PhoenixMenu extends Screen {
    private final PhoenixConfig cfg;
    private int index;
    private int left;
    private int top;

    public PhoenixMenu(PhoenixConfig cfg) {
        super(Text.literal("Phoenix Client"));
        this.cfg = cfg;
    }

    @Override
    protected void init() {
        int w = 150;
        index = 0;
        left = this.width / 2 - w - 3;
        top = this.height / 2 - 90;
        toggle(w, "FPS", () -> cfg.fps, v -> cfg.fps = v);
        toggle(w, "CPS", () -> cfg.cps, v -> cfg.cps = v);
        toggle(w, "Ping", () -> cfg.ping, v -> cfg.ping = v);
        toggle(w, "Coordinates", () -> cfg.coords, v -> cfg.coords = v);
        toggle(w, "Direction", () -> cfg.direction, v -> cfg.direction = v);
        toggle(w, "Speed (blocks/s)", () -> cfg.speed, v -> cfg.speed = v);
        toggle(w, "Clock", () -> cfg.clock, v -> cfg.clock = v);
        toggle(w, "Memory", () -> cfg.memory, v -> cfg.memory = v);
        toggle(w, "Potion effects", () -> cfg.effects, v -> cfg.effects = v);
        toggle(w, "Armor status", () -> cfg.armor, v -> cfg.armor = v);
        toggle(w, "Keystrokes", () -> cfg.keystrokes, v -> cfg.keystrokes = v);
        toggle(w, "Always sprint", () -> cfg.alwaysSprint, v -> cfg.alwaysSprint = v);
        toggle(w, "Zoom (hold C)", () -> cfg.zoom, v -> cfg.zoom = v);
        toggle(w, "Phoenix loading screen", () -> cfg.splash, v -> cfg.splash = v);

        int x = pos(w, true);
        int y = pos(w, false);
        addDrawableChild(ButtonWidget.builder(scaleText(), b -> {
            cfg.scale = cfg.scale == 80 ? 100 : cfg.scale == 100 ? 125 : cfg.scale == 125 ? 150 : 80;
            b.setMessage(scaleText());
            cfg.save();
        }).dimensions(x, y, w, 20).build());
        index++;
        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), b -> close())
            .dimensions(this.width / 2 - 100, top + 8 * 22 + 6, 200, 20).build());
    }

    private int pos(int w, boolean xAxis) {
        int col = index % 2;
        int row = index / 2;
        return xAxis ? left + col * (w + 6) : top + row * 22;
    }

    private void toggle(int w, String label, Supplier<Boolean> get, Consumer<Boolean> set) {
        int x = pos(w, true);
        int y = pos(w, false);
        index++;
        addDrawableChild(ButtonWidget.builder(text(label, get.get()), b -> {
            set.accept(!get.get());
            b.setMessage(text(label, get.get()));
            cfg.save();
        }).dimensions(x, y, w, 20).build());
    }

    private Text scaleText() {
        return Text.literal("HUD size: " + cfg.scale + "%");
    }

    private static Text text(String label, boolean on) {
        return Text.literal(label + ": " + (on ? "ON" : "OFF"));
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);
        ctx.drawCenteredTextWithShadow(this.textRenderer, Text.literal("Phoenix Client"), this.width / 2, top - 22, 0xFFFFA726);
    }
}
