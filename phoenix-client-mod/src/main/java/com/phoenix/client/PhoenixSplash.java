package com.phoenix.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.MathHelper;

import java.lang.reflect.Field;

/** Draws the Phoenix loading screen over Minecraft's own start-up splash. */
public final class PhoenixSplash {
    private static final String[] EMBLEM = {
        ".......YY.......",
        "......YYYY......",
        ".....OYWWYO.....",
        "..R..OOYYOO..R..",
        ".RR.OOOYYOOO.RR.",
        "RRROOOOYYOOOORRR",
        "RROOOOOYYOOOOORR",
        ".ROOOOOOOOOOOOR.",
        "..ROOOOOYYOOOR..",
        "...ROOOOYYOOR...",
        "....ROOYYOOR....",
        ".....ROYYOR.....",
        "......OYYO......",
        ".....OOYYOO.....",
        "....OO.YY.OO....",
        "....O..YY..O...."
    };

    private static Field progressField;
    private static boolean fieldSearched;
    private static long doneAt = -1;
    private static final long START = System.currentTimeMillis();

    private PhoenixSplash() {}

    /** Reads the splash progress by field type, so it does not depend on obfuscated names. */
    private static float readProgress(Object overlay) {
        try {
            if (!fieldSearched) {
                fieldSearched = true;
                for (Field f : overlay.getClass().getDeclaredFields()) {
                    if (f.getType() == float.class) {
                        f.setAccessible(true);
                        progressField = f;
                        break;
                    }
                }
            }
            if (progressField != null) return progressField.getFloat(overlay);
        } catch (Throwable ignored) {
            // fall through to time-based estimate
        }
        return MathHelper.clamp((System.currentTimeMillis() - START) / 12000f, 0f, 0.95f);
    }

    public static void draw(DrawContext ctx, Object overlay) {
        if (!PhoenixConfig.INSTANCE.splash) return;
        MinecraftClient mc = MinecraftClient.getInstance();
        int w = ctx.getScaledWindowWidth();
        int h = ctx.getScaledWindowHeight();
        long now = System.currentTimeMillis();

        float progress = readProgress(overlay);
        if (progress >= 0.985f && doneAt < 0) doneAt = now;
        float alpha = 1f;
        if (doneAt > 0) {
            float t = (now - doneAt) / 1000f;
            alpha = t >= 1f ? 1f - MathHelper.clamp(t - 1f, 0f, 1f) : 1f;
        }
        int a = MathHelper.ceil(alpha * 255f) & 0xFF;
        if (a <= 1) return;
        int top = (a << 24) | 0x0B0F17;
        int bottom = (a << 24) | 0x2A0E08;
        ctx.fillGradient(0, 0, w, h, top, bottom);

        // soft glow behind the emblem
        int cx = w / 2;
        int cy = h / 2 - 20;
        int px = Math.max(3, Math.min(h / 40, 6));
        int ex = cx - 8 * px;
        int ey = cy - 8 * px;
        ctx.fillGradient(cx - 11 * px, cy - 11 * px, cx + 11 * px, cy + 11 * px, (Math.min(a, 40) << 24) | 0xF97316, (0 << 24) | 0xF97316);
        for (int r = 0; r < EMBLEM.length; r++) {
            String row = EMBLEM[r];
            for (int c = 0; c < row.length(); c++) {
                int color = switch (row.charAt(c)) {
                    case 'Y' -> 0xFDE047;
                    case 'O' -> 0xF97316;
                    case 'R' -> 0xDC2626;
                    case 'W' -> 0xFFF3B0;
                    default -> -1;
                };
                if (color == -1) continue;
                ctx.fill(ex + c * px, ey + r * px, ex + (c + 1) * px, ey + (r + 1) * px, (a << 24) | color);
            }
        }

        // title
        ctx.getMatrices().push();
        ctx.getMatrices().scale(2f, 2f, 1f);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, "PHOENIX LAUNCHER", w / 4, (cy + 10 * px) / 2, (a << 24) | 0xFFA726);
        ctx.getMatrices().pop();
        ctx.drawCenteredTextWithShadow(mc.textRenderer, "Loading Minecraft...", cx, cy + 10 * px + 24, (a << 24) | 0xC8CED8);

        // progress bar
        int barW = Math.min(w - 80, 260);
        int bx = cx - barW / 2;
        int by = cy + 10 * px + 42;
        ctx.fill(bx - 1, by - 1, bx + barW + 1, by + 7, (a << 24) | 0x3A4252);
        ctx.fill(bx, by, bx + barW, by + 6, (a << 24) | 0x10151F);
        ctx.fill(bx, by, bx + (int) (barW * MathHelper.clamp(progress, 0f, 1f)), by + 6, (a << 24) | 0xF97316);
    }
}
