package com.phoenix.client.mixin;

import com.phoenix.client.PhoenixMenuBackground;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Swaps the dirt / panorama background of menu screens for the Phoenix one. */
@Mixin(Screen.class)
public abstract class ScreenMixin {
    @Inject(method = "renderBackground", at = @At("HEAD"), cancellable = true)
    private void phoenix$background(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (PhoenixMenuBackground.draw(context)) ci.cancel();
    }
}
