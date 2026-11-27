package com.purrlix.client.mixin;

import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Gives Purrlix Client access to the right-click delay (used by Fast Place). */
@Mixin(MinecraftClient.class)
public interface MinecraftClientAccessor {
    @Accessor("itemUseCooldown")
    void purrlix$setItemUseCooldown(int value);

    @Accessor("itemUseCooldown")
    int purrlix$getItemUseCooldown();
}
