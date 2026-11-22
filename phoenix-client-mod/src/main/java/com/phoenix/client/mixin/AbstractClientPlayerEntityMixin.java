package com.phoenix.client.mixin;

import com.phoenix.client.PhoenixCape;
import com.phoenix.client.PhoenixConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Swaps the cape of the local player for the animated Phoenix cape. Only the local player is changed. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void phoenix$animatedCape(CallbackInfoReturnable<SkinTextures> cir) {
        if (!PhoenixConfig.INSTANCE.animatedCape) return;
        if ((Object) this != MinecraftClient.getInstance().player) return;
        SkinTextures old = cir.getReturnValue();
        Identifier frame = PhoenixCape.current();
        cir.setReturnValue(new SkinTextures(old.texture(), old.textureUrl(), frame, frame, old.model(), old.secure()));
    }
}
