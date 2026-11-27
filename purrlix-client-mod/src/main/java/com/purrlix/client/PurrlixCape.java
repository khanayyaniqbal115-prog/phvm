package com.purrlix.client;

import net.minecraft.util.Identifier;

/** The 24 animation frames of the Purrlix cape (assets/purrlix/textures/cape/f00.png ... f23.png). */
public final class PurrlixCape {
    private static final int FRAMES = 24;
    private static final Identifier[] CAPE = new Identifier[FRAMES];

    static {
        for (int i = 0; i < FRAMES; i++) {
            CAPE[i] = Identifier.of("purrlix", "textures/cape/f" + (i < 10 ? "0" : "") + i + ".png");
        }
    }

    private PurrlixCape() {}

    /** The frame to show right now (changes every 100 ms). */
    public static Identifier current() {
        return CAPE[(int) ((System.currentTimeMillis() / 100L) % FRAMES)];
    }
}
