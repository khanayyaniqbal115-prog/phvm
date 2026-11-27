package com.purrlix.client.mixin;

import com.purrlix.client.PurrlixSplash;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.SplashOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Covers the Mojang start-up splash with the Purrlix loading screen. */
@Mixin(SplashOverlay.class)
public abstract class SplashOverlayMixin {
    @Inject(method = "render", at = @At("RETURN"))
    private void purrlix$drawSplash(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        PurrlixSplash.draw(context, this);
    }
}
