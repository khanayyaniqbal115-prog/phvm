package com.purrlix.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The skin chosen in Purrlix Launcher. The launcher writes purrlix-skin.png (64x64) and purrlix-skin.txt ("classic" or "slim")
 * into the game folder; this class turns the PNG into a texture and the mixin shows it on the local player.
 */
public final class PurrlixSkin {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger("purrlix-skin");
    private static Identifier texture;
    private static boolean slim;
    private static boolean tried;

    private PurrlixSkin() {}

    /** The texture to use for the local player, or null when the launcher did not provide a skin. */
    public static Identifier texture() {
        if (!tried) {
            tried = true;
            load();
        }
        return texture;
    }

    public static boolean slim() {
        return slim;
    }

    private static void load() {
        try {
            Path dir = MinecraftClient.getInstance().runDirectory.toPath();
            Path png = dir.resolve("purrlix-skin.png");
            if (!Files.exists(png)) return;
            try (InputStream in = Files.newInputStream(png)) {
                NativeImage image = NativeImage.read(in);
                if (image.getWidth() != 64 || image.getHeight() != 64) {
                    image.close();
                    LOG.warn("purrlix-skin.png must be 64x64, ignoring it");
                    return;
                }
                Identifier id = Identifier.of("purrlix", "launcher_skin");
                MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(image));
                texture = id;
            }
            Path model = dir.resolve("purrlix-skin.txt");
            slim = Files.exists(model) && Files.readString(model).trim().equalsIgnoreCase("slim");
        } catch (Throwable t) {
            LOG.warn("Could not load the launcher skin: {}", t.toString());
        }
    }
}
