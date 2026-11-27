package com.purrlix.client.mixin;

import com.purrlix.client.PurrlixMenuBackground;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Swaps the dirt / panorama background of menu screens for the Purrlix one. */
@Mixin(Screen.class)
public abstract class ScreenMixin {
    @Inject(method = "renderBackground", at = @At("HEAD"), cancellable = true)
    private void purrlix$background(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (PurrlixMenuBackground.draw(context)) ci.cancel();
    }
}
