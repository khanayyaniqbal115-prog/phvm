package com.phoenix.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Cosmetic particle effects around your own player: auras and Phoenix wings.
 * They are drawn only on your own screen (client side), nobody else sees them.
 */
public final class PhoenixAuras {
    private PhoenixAuras() {}

    public static final String[] NAMES = {"None", "Fire Aura", "Ember Aura", "Frost Aura", "Totem Aura", "Wind Aura", "Heart Aura", "Magic Aura", "Soul Aura"};

    private static ParticleEffect effect(int index) {
        return switch (index) {
            case 1 -> ParticleTypes.FLAME;
            case 2 -> ParticleTypes.SMALL_FLAME;
            case 3 -> ParticleTypes.SNOWFLAKE;
            case 4 -> ParticleTypes.TOTEM_OF_UNDYING;
            case 5 -> ParticleTypes.CLOUD;
            case 6 -> ParticleTypes.HEART;
            case 7 -> ParticleTypes.ENCHANT;
            case 8 -> ParticleTypes.SOUL_FIRE_FLAME;
            default -> null;
        };
    }

    public static void tick(MinecraftClient client) {
        PhoenixConfig cfg = PhoenixConfig.INSTANCE;
        ClientPlayerEntity p = client.player;
        if (p == null || client.world == null || client.isPaused()) return;
        if (client.options.getPerspective().isFirstPerson()) return; // would block the view
        ThreadLocalRandom rnd = ThreadLocalRandom.current();

        ParticleEffect aura = effect(cfg.aura);
        if (aura != null) {
            for (int i = 0; i < 2; i++) {
                double a = rnd.nextDouble() * Math.PI * 2;
                double r = 0.45 + rnd.nextDouble() * 0.35;
                client.world.addParticle(aura, p.getX() + Math.cos(a) * r, p.getY() + rnd.nextDouble() * 1.9, p.getZ() + Math.sin(a) * r, 0, 0.02, 0);
            }
        }

        if (cfg.phoenixWings && !p.isSneaking()) {
            double yaw = Math.toRadians(p.getBodyYaw());
            double fx = -Math.sin(yaw), fz = Math.cos(yaw); // forward
            double rx = -Math.cos(yaw), rz = -Math.sin(yaw); // right
            double flap = Math.sin((client.world.getTime() + 0.0) * 0.18) * 0.45 + (p.isOnGround() ? 0.0 : 0.35);
            for (int side = -1; side <= 1; side += 2) {
                for (int k = 0; k < 5; k++) {
                    double u = rnd.nextDouble(); // 0 = shoulder, 1 = wing tip
                    double lateral = 0.18 + u * 1.5;
                    double height = 1.3 + u * 0.55 + Math.sin(flap) * u * 0.9 - u * u * 0.7 - rnd.nextDouble() * 0.35 * u;
                    double back = 0.25 + u * 0.35 + Math.abs(Math.sin(flap)) * u * 0.1;
                    double x = p.getX() + side * rx * lateral - fx * back;
                    double z = p.getZ() + side * rz * lateral - fz * back;
                    client.world.addParticle(u > 0.55 ? ParticleTypes.FLAME : ParticleTypes.SMALL_FLAME, x, p.getY() + height, z, 0, 0.005, 0);
                }
            }
        }
    }
}
