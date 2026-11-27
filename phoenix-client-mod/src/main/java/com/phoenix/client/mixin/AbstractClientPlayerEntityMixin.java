package com.phoenix.client.mixin;

import com.phoenix.client.PhoenixCape;
import com.phoenix.client.PhoenixConfig;
import com.phoenix.client.PhoenixSkin;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Shows the launcher skin and the animated Phoenix cape on the local player. Other players are never changed. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void phoenix$ownLook(CallbackInfoReturnable<SkinTextures> cir) {
        PhoenixConfig cfg = PhoenixConfig.INSTANCE;
        if ((Object) this != MinecraftClient.getInstance().player) return;
        SkinTextures old = cir.getReturnValue();
        Identifier skin = old.texture();
        SkinTextures.Model model = old.model();
        Identifier cape = old.capeTexture();
        Identifier elytra = old.elytraTexture();
        boolean changed = false;

        if (cfg.launcherSkin) {
            Identifier custom = PhoenixSkin.texture();
            if (custom != null) {
                skin = custom;
                model = PhoenixSkin.slim() ? SkinTextures.Model.SLIM : SkinTextures.Model.WIDE;
                changed = true;
            }
        }
        if (cfg.animatedCape) {
            Identifier frame = PhoenixCape.current();
            cape = frame;
            elytra = frame;
            changed = true;
        }
        if (changed) cir.setReturnValue(new SkinTextures(skin, old.textureUrl(), cape, elytra, model, old.secure()));
    }
}
