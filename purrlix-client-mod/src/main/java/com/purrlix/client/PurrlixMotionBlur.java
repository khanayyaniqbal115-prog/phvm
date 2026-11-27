package com.purrlix.client;

import com.mojang.blaze3d.platform.GlStateManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.Framebuffer;
import net.minecraft.client.gl.ShaderProgramKeys;
import net.minecraft.client.gl.SimpleFramebuffer;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.BufferRenderer;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormat;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.util.Window;
import org.joml.Matrix4f;
import org.lwjgl.opengl.GL30;

/**
 * Motion blur by frame accumulation.
 *
 * Every frame the previous (already blurred) picture is laid over the new world picture with some transparency, and the result is
 * stored again for the next frame. Fast camera movement leaves a short trail, a still picture stays sharp. It runs once per frame
 * right before the HUD is drawn, so the HUD and menus stay sharp.
 */
public final class PurrlixMotionBlur {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger("purrlix-motionblur");
    private static SimpleFramebuffer previous;
    private static boolean primed;

    private PurrlixMotionBlur() {}

    /** Forget the stored picture (used when a screen opens or the setting is switched off) so no old frame is ever shown. */
    public static void reset() {
        primed = false;
    }

    public static void apply(Matrix4f matrix) {
        PurrlixConfig cfg = PurrlixConfig.INSTANCE;
        MinecraftClient mc = MinecraftClient.getInstance();
        if (!cfg.motionBlur || mc.world == null || mc.currentScreen != null) {
            primed = false;
            return;
        }
        try {
            Framebuffer main = mc.getFramebuffer();
            int w = main.textureWidth;
            int h = main.textureHeight;
            if (previous == null) {
                previous = new SimpleFramebuffer(w, h, false);
                primed = false;
            } else if (previous.textureWidth != w || previous.textureHeight != h) {
                previous.resize(w, h);
                primed = false;
            }

            if (primed) {
                float alpha = Math.max(0, Math.min(90, cfg.motionBlurStrength)) / 100f;
                if (alpha > 0f) drawPrevious(matrix, mc.getWindow(), alpha);
            }

            // store the picture we just made (old frame + new frame blended) for the next frame
            GlStateManager._glBindFramebuffer(GL30.GL_READ_FRAMEBUFFER, main.fbo);
            GlStateManager._glBindFramebuffer(GL30.GL_DRAW_FRAMEBUFFER, previous.fbo);
            GlStateManager._glBlitFrameBuffer(0, 0, w, h, 0, 0, w, h, GL30.GL_COLOR_BUFFER_BIT, GL30.GL_NEAREST);
            main.beginWrite(false);
            primed = true;
        } catch (Throwable t) {
            // never take the game down because of a visual effect: switch it off and say why once in the log
            LOG.warn("Motion blur switched off: {}", t.toString());
            cfg.motionBlur = false;
            primed = false;
        }
    }

    private static void drawPrevious(Matrix4f matrix, Window window, float alpha) {
        float sw = window.getScaledWidth();
        float sh = window.getScaledHeight();
        RenderSystem.disableDepthTest();
        RenderSystem.enableBlend();
        RenderSystem.blendFuncSeparate(
            com.mojang.blaze3d.platform.GlStateManager.SrcFactor.SRC_ALPHA,
            com.mojang.blaze3d.platform.GlStateManager.DstFactor.ONE_MINUS_SRC_ALPHA,
            com.mojang.blaze3d.platform.GlStateManager.SrcFactor.ONE,
            com.mojang.blaze3d.platform.GlStateManager.DstFactor.ZERO);
        RenderSystem.setShader(ShaderProgramKeys.POSITION_TEX_COLOR);
        RenderSystem.setShaderTexture(0, previous.getColorAttachment());
        BufferBuilder b = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_TEXTURE_COLOR);
        // framebuffer textures are stored upside down, so v runs from 1 (top) to 0 (bottom)
        b.vertex(matrix, 0f, sh, 0f).texture(0f, 0f).color(1f, 1f, 1f, alpha);
        b.vertex(matrix, sw, sh, 0f).texture(1f, 0f).color(1f, 1f, 1f, alpha);
        b.vertex(matrix, sw, 0f, 0f).texture(1f, 1f).color(1f, 1f, 1f, alpha);
        b.vertex(matrix, 0f, 0f, 0f).texture(0f, 1f).color(1f, 1f, 1f, alpha);
        BufferRenderer.drawWithGlobalProgram(b.end());
        RenderSystem.defaultBlendFunc();
        RenderSystem.enableDepthTest();
    }
}
