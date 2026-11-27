package com.purrlix.client.mixin;

import com.purrlix.client.PurrlixCape;
import com.purrlix.client.PurrlixConfig;
import com.purrlix.client.PurrlixSkin;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Shows the launcher skin and the animated Purrlix cape on the local player. Other players are never changed. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void purrlix$ownLook(CallbackInfoReturnable<SkinTextures> cir) {
        PurrlixConfig cfg = PurrlixConfig.INSTANCE;
        if ((Object) this != MinecraftClient.getInstance().player) return;
        SkinTextures old = cir.getReturnValue();
        Identifier skin = old.texture();
        SkinTextures.Model model = old.model();
        Identifier cape = old.capeTexture();
        Identifier elytra = old.elytraTexture();
        boolean changed = false;

        if (cfg.launcherSkin) {
            Identifier custom = PurrlixSkin.texture();
            if (custom != null) {
                skin = custom;
                model = PurrlixSkin.slim() ? SkinTextures.Model.SLIM : SkinTextures.Model.WIDE;
                changed = true;
            }
        }
        if (cfg.animatedCape) {
            Identifier frame = PurrlixCape.current();
            cape = frame;
            elytra = frame;
            changed = true;
        }
        if (changed) cir.setReturnValue(new SkinTextures(skin, old.textureUrl(), cape, elytra, model, old.secure()));
    }
}
