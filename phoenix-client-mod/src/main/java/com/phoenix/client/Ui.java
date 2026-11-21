package com.phoenix.client;

import net.minecraft.client.gui.DrawContext;

/** Small drawing helpers shared by the HUD and the menu. */
public final class Ui {
    private Ui() {}

    /** A filled box with cut corners (looks rounded at Minecraft's pixel scale). */
    public static void box(DrawContext ctx, int x1, int y1, int x2, int y2, int color) {
        ctx.fill(x1 + 1, y1, x2 - 1, y2, color);
        ctx.fill(x1, y1 + 1, x2, y2 - 1, color);
    }
}
