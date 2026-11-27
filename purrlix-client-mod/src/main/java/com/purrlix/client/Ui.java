package com.purrlix.client;

import net.minecraft.client.gui.DrawContext;

/** Small drawing helpers and the accent palette shared by the HUD and the menu. */
public final class Ui {
    private Ui() {}

    public static final String[] ACCENT_NAMES = {"Orange", "Blue", "Violet", "Green", "Red", "Pink"};
    private static final int[] MAIN = {0xF97316, 0x3B82F6, 0x8B5CF6, 0x10B981, 0xEF4444, 0xEC4899};
    private static final int[] LIGHT = {0xFFA726, 0x93C5FD, 0xC4B5FD, 0x6EE7B7, 0xFCA5A5, 0xF9A8D4};

    private static int idx() {
        return Math.floorMod(PurrlixConfig.INSTANCE.accent, MAIN.length);
    }

    /** Strong accent colour (ARGB, opaque). */
    public static int main() {
        return 0xFF000000 | MAIN[idx()];
    }

    /** Lighter accent colour for text (ARGB, opaque). */
    public static int light() {
        return 0xFF000000 | LIGHT[idx()];
    }

    /** A filled box with cut corners (looks rounded at Minecraft's pixel scale). */
    public static void box(DrawContext ctx, int x1, int y1, int x2, int y2, int color) {
        ctx.fill(x1 + 1, y1, x2 - 1, y2, color);
        ctx.fill(x1, y1 + 1, x2, y2 - 1, color);
    }
}
