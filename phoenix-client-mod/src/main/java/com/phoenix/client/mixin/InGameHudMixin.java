package com.phoenix.client.mixin;

import com.phoenix.client.PhoenixConfig;
import com.phoenix.client.PhoenixMotionBlur;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hides the vanilla crosshair while the Phoenix custom crosshair is on. require = 0: if it cannot attach, the game still starts. */
@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
    private void phoenix$hideVanillaCrosshair(CallbackInfo ci) {
        if (PhoenixConfig.INSTANCE.crosshair) ci.cancel();
    }

    /** Motion blur runs right before the HUD, so only the world picture is blurred. */
    @Inject(method = "render", at = @At("HEAD"), require = 0)
    private void phoenix$motionBlur(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        PhoenixMotionBlur.apply(context.getMatrices().peek().getPositionMatrix());
    }
}
