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

    public PhoenixMenu(PhoenixConfig cfg) {
        super(Text.literal("Phoenix Client"));
        this.cfg = cfg;
    }

    @Override
    protected void init() {
        int w = 200;
        int x = this.width / 2 - w / 2;
        int y = this.height / 2 - 100;
        toggle(x, y, w, "FPS", () -> cfg.fps, v -> cfg.fps = v);
        toggle(x, y + 22, w, "CPS", () -> cfg.cps, v -> cfg.cps = v);
        toggle(x, y + 44, w, "Ping", () -> cfg.ping, v -> cfg.ping = v);
        toggle(x, y + 66, w, "Coordinates", () -> cfg.coords, v -> cfg.coords = v);
        toggle(x, y + 88, w, "Direction", () -> cfg.direction, v -> cfg.direction = v);
        toggle(x, y + 110, w, "Armor status", () -> cfg.armor, v -> cfg.armor = v);
        toggle(x, y + 132, w, "Keystrokes", () -> cfg.keystrokes, v -> cfg.keystrokes = v);
        toggle(x, y + 154, w, "Always sprint", () -> cfg.alwaysSprint, v -> cfg.alwaysSprint = v);
        toggle(x, y + 176, w, "Zoom (hold C)", () -> cfg.zoom, v -> cfg.zoom = v);
        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), b -> close()).dimensions(x, y + 204, w, 20).build());
    }

    private void toggle(int x, int y, int w, String label, Supplier<Boolean> get, Consumer<Boolean> set) {
        addDrawableChild(ButtonWidget.builder(text(label, get.get()), b -> {
            set.accept(!get.get());
            b.setMessage(text(label, get.get()));
            cfg.save();
        }).dimensions(x, y, w, 20).build());
    }

    private static Text text(String label, boolean on) {
        return Text.literal(label + ": " + (on ? "ON" : "OFF"));
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);
        ctx.drawCenteredTextWithShadow(this.textRenderer, Text.literal("Phoenix Client"), this.width / 2, this.height / 2 - 120, 0xFFFFA726);
    }
}
