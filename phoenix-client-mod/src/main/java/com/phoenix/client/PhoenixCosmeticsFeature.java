package com.phoenix.client;

import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;

/** Draws the equipped cosmetics on the local player (hats on the head, everything else on the body). */
public final class PhoenixCosmeticsFeature extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {
    public PhoenixCosmeticsFeature(PlayerEntityRenderer renderer) {
        super(renderer);
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light, PlayerEntityRenderState state, float limbAngle, float limbDistance) {
        if (!PhoenixCosmetics.renderingSelf) return;
        float seconds = (System.currentTimeMillis() % 3_600_000L) / 1000f;
        PlayerEntityModel model = this.getContextModel();

        PhoenixCosmetics.Item hat = PhoenixCosmetics.selected(PhoenixCosmetics.Slot.HAT);
        if (hat != null) draw(hat, model.head, matrices, vertexConsumers, light, seconds);

        draw(PhoenixCosmetics.selected(PhoenixCosmetics.Slot.WINGS), model.body, matrices, vertexConsumers, light, seconds);
        draw(PhoenixCosmetics.selected(PhoenixCosmetics.Slot.BACK), model.body, matrices, vertexConsumers, light, seconds);
        draw(PhoenixCosmetics.selected(PhoenixCosmetics.Slot.TAIL), model.body, matrices, vertexConsumers, light, seconds);
    }

    private static void draw(PhoenixCosmetics.Item item, net.minecraft.client.model.ModelPart anchor, MatrixStack matrices,
                             VertexConsumerProvider vertexConsumers, int light, float seconds) {
        if (item == null) return;
        try {
            item.animate(seconds);
            matrices.push();
            anchor.rotate(matrices);
            VertexConsumer vc = vertexConsumers.getBuffer(RenderLayer.getEntityCutoutNoCull(item.texture));
            item.model().render(matrices, vc, light, OverlayTexture.DEFAULT_UV);
            matrices.pop();
        } catch (Throwable ignored) {
            // a cosmetic must never crash the game
        }
    }
}
