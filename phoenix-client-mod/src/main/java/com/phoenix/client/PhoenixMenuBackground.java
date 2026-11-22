package com.phoenix.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** Phoenix background for the screens outside a world (title, singleplayer, multiplayer, options...). */
public final class PhoenixMenuBackground {
    private static boolean broken;

    private PhoenixMenuBackground() {}

    private static float frac(float x) {
        return x - (float) Math.floor(x);
    }

    /** Returns true when it drew the background, so the vanilla one can be skipped. */
    public static boolean draw(DrawContext ctx) {
        if (broken) return false;
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.world != null || !PhoenixConfig.INSTANCE.menuBackground) return false;
        try {
            int w = ctx.getScaledWindowWidth();
            int h = ctx.getScaledWindowHeight();
            long t = System.currentTimeMillis();
            ctx.fillGradient(0, 0, w, h, 0xFF090C13, 0xFF2A0E08);
            // warm glow rising from the bottom
            ctx.fillGradient(0, h / 2, w, h, 0x00F97316, 0x40F97316);
            // drifting embers
            for (int i = 0; i < 70; i++) {
                float sx = frac(i * 0.6180339f);
                float speed = 0.018f + (i % 7) * 0.006f;
                float prog = frac((i * 37 % 100) / 100f + t / 1000f * speed);
                int ex = (int) (sx * w + Math.sin(t / 1500.0 + i) * 6);
                int ey = (int) (h * (1f - prog));
                int size = i % 3 == 0 ? 3 : 2;
                int alpha = (int) (200 * Math.sin(prog * Math.PI));
                if (alpha <= 4) continue;
                int rgb = i % 2 == 0 ? 0xFFA726 : 0xF97316;
                ctx.fill(ex, ey, ex + size, ey + size, (alpha << 24) | rgb);
            }
            // soft edges
            ctx.fillGradient(0, 0, w, 26, 0x99000000, 0x00000000);
            ctx.fillGradient(0, h - 26, w, h, 0x00000000, 0x99000000);
            return true;
        } catch (Throwable ex) {
            broken = true;
            org.slf4j.LoggerFactory.getLogger("PhoenixClient").error("Phoenix menu background disabled after an error", ex);
            return false;
        }
    }
}
