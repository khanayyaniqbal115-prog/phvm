package com.purrlix.client.mixin;

import com.purrlix.client.PurrlixConfig;
import com.purrlix.client.PurrlixMotionBlur;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hides the vanilla crosshair while the Purrlix custom crosshair is on. require = 0: if it cannot attach, the game still starts. */
@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
    private void purrlix$hideVanillaCrosshair(CallbackInfo ci) {
        if (PurrlixConfig.INSTANCE.crosshair) ci.cancel();
    }

    /** Motion blur runs right before the HUD, so only the world picture is blurred. */
    @Inject(method = "render", at = @At("HEAD"), require = 0)
    private void purrlix$motionBlur(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        PurrlixMotionBlur.apply(context.getMatrices().peek().getPositionMatrix());
    }
}
