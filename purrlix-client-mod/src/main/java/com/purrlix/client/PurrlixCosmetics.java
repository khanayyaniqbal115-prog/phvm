package com.purrlix.client;

import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.util.Identifier;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Supplier;

/**
 * Real 3D cosmetics (hats, wings, back items, tails) made of small boxes with painted 64x64 textures.
 * Each texture is split in four 16 pixel high bands; every box picks a band, which gives it its colour.
 * Everything is drawn client side on your own player only.
 */
public final class PurrlixCosmetics {
    public enum Slot { HAT, WINGS, BACK, TAIL }

    public static final class Item {
        public final Slot slot;
        public final String id;
        public final String name;
        private final Supplier<ModelPart> builder;
        private final BiConsumer<ModelPart, Float> animator;
        private ModelPart root;
        public final Identifier texture;

        Item(Slot slot, String id, String name, Supplier<ModelPart> builder, BiConsumer<ModelPart, Float> animator) {
            this.slot = slot;
            this.id = id;
            this.name = name;
            this.builder = builder;
            this.animator = animator;
            this.texture = Identifier.of("purrlix", "textures/cosmetics/" + id + ".png");
        }

        /** The baked model, built the first time it is needed (the render thread). */
        public ModelPart model() {
            if (root == null) root = builder.get();
            return root;
        }

        /** Moves the parts for the current time (seconds). */
        public void animate(float seconds) {
            if (animator != null) animator.accept(model(), seconds);
        }
    }

    public static final List<Item> ALL = new ArrayList<>();

    /** True only while the local player is being drawn (set by PlayerEntityRendererMixin). */
    public static boolean renderingSelf;

    private PurrlixCosmetics() {}

    public static List<Item> of(Slot slot) {
        List<Item> out = new ArrayList<>();
        for (Item i : ALL) if (i.slot == slot) out.add(i);
        return out;
    }

    public static int selectedIndex(Slot slot) {
        PurrlixConfig c = PurrlixConfig.INSTANCE;
        return switch (slot) {
            case HAT -> c.hat;
            case WINGS -> c.wings;
            case BACK -> c.back;
            case TAIL -> c.tail;
        };
    }

    public static void select(Slot slot, int index) {
        PurrlixConfig c = PurrlixConfig.INSTANCE;
        switch (slot) {
            case HAT -> c.hat = index;
            case WINGS -> c.wings = index;
            case BACK -> c.back = index;
            case TAIL -> c.tail = index;
        }
    }

    /** The equipped item of a slot, or null. */
    public static Item selected(Slot slot) {
        int idx = selectedIndex(slot);
        List<Item> list = of(slot);
        return idx >= 1 && idx <= list.size() ? list.get(idx - 1) : null;
    }

    // ------------------------------------------------------------------ building blocks

    private static ModelPartData group(ModelPartData parent, String name, float px, float py, float pz) {
        return parent.addChild(name, ModelPartBuilder.create(), ModelTransform.pivot(px, py, pz));
    }

    private static ModelPartData box(ModelPartData parent, String name, int band, float x, float y, float z, float w, float h, float d) {
        return box(parent, name, band, x, y, z, w, h, d, 0, 0, 0, 0, 0, 0);
    }

    private static ModelPartData box(ModelPartData parent, String name, int band, float x, float y, float z, float w, float h, float d,
                                     float px, float py, float pz, float rx, float ry, float rz) {
        return parent.addChild(name, ModelPartBuilder.create().uv(0, band * 16).cuboid(x, y, z, w, h, d), ModelTransform.of(px, py, pz, rx, ry, rz));
    }

    private static ModelPart bake(ModelData data) {
        return TexturedModelData.of(data, 64, 64).createModel();
    }

    /** A rectangular ring (4 slabs) around the head: hats that should not hide the hair. */
    private static void ring(ModelPartData root, String name, int band, float y, float h, float half) {
        float len = half * 2;
        box(root, name + "f", band, -half, y, -half, len, h, 1);
        box(root, name + "b", band, -half, y, half - 1, len, h, 1);
        box(root, name + "l", band, -half, y, -half + 1, 1, h, len - 2);
        box(root, name + "r", band, half - 1, y, -half + 1, 1, h, len - 2);
    }

    // ------------------------------------------------------------------ hats (head space: the head box is x -4..4, y -8..0, z -4..4)

    private static ModelPart catEars() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        for (int s = -1; s <= 1; s += 2) {
            float x = s < 0 ? -4.2f : 1.4f;
            box(r, "e" + s, 0, x, -10.8f, -1.5f, 2.8f, 3f, 3f);
            box(r, "t" + s, 0, x + 0.4f, -12.6f, -1.1f, 2f, 2f, 2.2f);
            box(r, "p" + s, 1, x + 0.5f, -10.6f, -1.8f, 1.8f, 2.2f, 0.4f);
        }
        return bake(d);
    }

    private static ModelPart crown() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        ring(r, "band", 0, -10f, 2f, 4.6f);
        float[] xs = {-4.6f, -2.3f, -0.5f, 1.3f, 3.6f};
        float[] hs = {2f, 3f, 4f, 3f, 2f};
        for (int i = 0; i < 5; i++) box(r, "p" + i, 0, xs[i], -10f - hs[i], -0.5f, 1.0f, hs[i], 1.0f);
        box(r, "gem", 1, -0.9f, -10.8f, -5.0f, 1.8f, 1.4f, 0.5f);
        return bake(d);
    }

    private static ModelPart halo() {
        ModelData d = new ModelData();
        ring(d.getRoot(), "h", 0, -14f, 0.8f, 4.8f);
        return bake(d);
    }

    private static ModelPart horns() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        for (int s = -1; s <= 1; s += 2) {
            float x = s < 0 ? -4.1f : 2.6f;
            float tipX = s < 0 ? -5.0f : 4.0f;
            box(r, "a" + s, 0, x, -10.4f, -1.2f, 1.6f, 2.8f, 1.8f);
            box(r, "b" + s, 0, x + (s < 0 ? -0.6f : 0.4f), -12.4f, -1.0f, 1.4f, 2.2f, 1.5f);
            box(r, "c" + s, 1, tipX + (s < 0 ? -0.2f : 0.2f), -14.0f, -0.9f, 1.0f, 1.8f, 1.2f);
        }
        return bake(d);
    }

    private static ModelPart topHat() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        box(r, "brim", 0, -6f, -8.6f, -6f, 12f, 1f, 12f);
        box(r, "crown", 0, -4f, -15.6f, -4f, 8f, 7f, 8f);
        box(r, "band", 1, -4.2f, -10.8f, -4.2f, 8.4f, 1.6f, 8.4f);
        return bake(d);
    }

    private static ModelPart wizardHat() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        box(r, "brim", 1, -6f, -8.6f, -6f, 12f, 1f, 12f);
        box(r, "l1", 0, -4f, -12.2f, -4f, 8f, 3.7f, 8f);
        box(r, "l2", 0, -3f, -15.2f, -3f, 6f, 3.2f, 6f);
        box(r, "l3", 0, -2f, -18.2f, -2f, 4f, 3.2f, 4f, 0, 0, 0, 0.0f, 0.0f, 0.12f);
        box(r, "tip", 2, -0.8f, -20.4f, -0.8f, 1.6f, 2.4f, 1.6f);
        return bake(d);
    }

    // ------------------------------------------------------------------ wings (body space: the body box is x -4..4, y 0..12, z -2..2, the back is +z)

    /**
     * Wings made of fanned feathers. lens/angles describe the feathers, bands give each feather its colour band.
     * The left wing grows along +x; the right wing is the mirror image.
     */
    private static ModelPart feathered(float[] lens, float[] angles, int[] bands, float thick) {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        for (int s = -1; s <= 1; s += 2) {
            ModelPartData w = r.addChild(s < 0 ? "wingR" : "wingL", ModelPartBuilder.create(), ModelTransform.pivot(s * 2.5f, 1.5f, 2.4f));
            for (int i = 0; i < lens.length; i++) {
                float x = s > 0 ? 0f : -lens[i];
                box(w, "f" + i, bands[i], x, -thick / 2, -0.4f, lens[i], thick, 0.8f, 0, 0, 0, 0, 0, s * (float) Math.toRadians(angles[i]));
            }
            box(w, "base", bands[bands.length / 2], s > 0 ? -1f : -2.5f, -2.2f, -0.6f, 3.5f, 5f, 1.2f);
        }
        return bake(d);
    }

    private static ModelPart plates() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        for (int s = -1; s <= 1; s += 2) {
            ModelPartData w = r.addChild(s < 0 ? "wingR" : "wingL", ModelPartBuilder.create(), ModelTransform.pivot(s * 2.5f, 1.5f, 2.4f));
            box(w, "up", 0, s > 0 ? 0f : -11f, -10f, -0.3f, 11f, 10f, 0.6f, 0, 0, 0, 0, 0, s * -0.15f);
            box(w, "low", 1, s > 0 ? 0f : -8f, 0f, -0.3f, 8f, 7f, 0.6f, 0, 0, 0, 0, 0, s * 0.2f);
        }
        return bake(d);
    }

    private static void flap(ModelPart root, float t) {
        float amount = 0.5f + 0.28f * (float) Math.sin(t * 7.0);
        ModelPart left = root.getChild("wingL");
        ModelPart right = root.getChild("wingR");
        left.yaw = -amount;
        left.roll = -0.3f;
        right.yaw = amount;
        right.roll = 0.3f;
    }

    // ------------------------------------------------------------------ back items

    private static ModelPart backpack() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        box(r, "main", 0, -3.5f, 0.8f, 2.2f, 7f, 9f, 3.6f);
        box(r, "flap", 1, -3.7f, 0.6f, 2.0f, 7.4f, 3f, 4.0f);
        box(r, "pocket", 1, -2.5f, 5f, 5.7f, 5f, 3f, 0.8f);
        box(r, "buckle", 2, -0.7f, 3.4f, 6.0f, 1.4f, 1.2f, 0.4f);
        box(r, "strapL", 1, -3.2f, 0f, -2.6f, 1.1f, 8f, 0.6f);
        box(r, "strapR", 1, 2.1f, 0f, -2.6f, 1.1f, 8f, 0.6f);
        return bake(d);
    }

    private static ModelPart jetpack() {
        ModelData d = new ModelData();
        ModelPartData r = d.getRoot();
        box(r, "tankL", 0, -4.2f, 1f, 2.2f, 3.4f, 8f, 3.4f);
        box(r, "tankR", 0, 0.8f, 1f, 2.2f, 3.4f, 8f, 3.4f);
        box(r, "bridge", 1, -1f, 3f, 3.2f, 2f, 2f, 1.4f);
        box(r, "nozL", 1, -3.6f, 9f, 2.6f, 2.2f, 1.4f, 2.2f);
        box(r, "nozR", 1, 1.4f, 9f, 2.6f, 2.2f, 1.4f, 2.2f);
        ModelPartData fl = group(r, "flameL", 0, 0, 0);
        box(fl, "f", 2, -3.2f, 10.4f, 3.0f, 1.4f, 3f, 1.4f);
        ModelPartData fr = group(r, "flameR", 0, 0, 0);
        box(fr, "f", 2, 1.8f, 10.4f, 3.0f, 1.4f, 3f, 1.4f);
        return bake(d);
    }

    // ------------------------------------------------------------------ tails

    private static ModelPart tail(float thick, int segments, int tipBand) {
        ModelData d = new ModelData();
        ModelPartData parent = group(d.getRoot(), "root", 0, 10.4f, 1.8f);
        float half = thick / 2;
        for (int i = 0; i < segments; i++) {
            int band = i >= segments - 1 ? tipBand : 0;
            parent = parent.addChild("t" + i, ModelPartBuilder.create().uv(0, band * 16).cuboid(-half, -half, 0, thick, thick, 3.4f),
                ModelTransform.of(0, 0, i == 0 ? 0 : 3.2f, i == 0 ? 0.9f : 0.28f, 0, 0));
        }
        return bake(d);
    }

    private static void sway(ModelPart root, float t) {
        ModelPart p = root.getChild("root");
        int i = 0;
        while (true) {
            String name = "t" + i;
            ModelPart child;
            try {
                child = p.getChild(name);
            } catch (Throwable ex) {
                break;
            }
            child.yaw = (float) Math.sin(t * 3.0 + i * 0.8) * 0.22f;
            p = child;
            i++;
        }
    }

    // ------------------------------------------------------------------ registry

    static {
        ALL.add(new Item(Slot.HAT, "cat_ears", "Cat Ears", PurrlixCosmetics::catEars, null));
        ALL.add(new Item(Slot.HAT, "crown", "Gold Crown", PurrlixCosmetics::crown, null));
        ALL.add(new Item(Slot.HAT, "halo", "Halo", PurrlixCosmetics::halo, (m, t) -> {
            m.setPivot(0, (float) Math.sin(t * 2.5) * 0.8f, 0);
            m.yaw = t * 1.2f;
        }));
        ALL.add(new Item(Slot.HAT, "horns", "Devil Horns", PurrlixCosmetics::horns, null));
        ALL.add(new Item(Slot.HAT, "top_hat", "Top Hat", PurrlixCosmetics::topHat, null));
        ALL.add(new Item(Slot.HAT, "wizard_hat", "Wizard Hat", PurrlixCosmetics::wizardHat, null));

        ALL.add(new Item(Slot.WINGS, "angel_wings", "Angel Wings",
            () -> feathered(new float[] {10, 14, 17, 16, 13, 9}, new float[] {-72, -46, -20, 6, 32, 58}, new int[] {0, 1, 0, 1, 0, 1}, 4.4f), PurrlixCosmetics::flap));
        ALL.add(new Item(Slot.WINGS, "dragon_wings", "Dragon Wings",
            () -> feathered(new float[] {15, 20, 19, 14}, new float[] {-58, -24, 8, 40}, new int[] {0, 1, 0, 2}, 3.6f), PurrlixCosmetics::flap));
        ALL.add(new Item(Slot.WINGS, "phoenix_wings", "Phoenix Wings",
            () -> feathered(new float[] {9, 13, 16, 18, 16, 12, 8}, new float[] {-74, -52, -30, -8, 14, 36, 58}, new int[] {0, 1, 2, 2, 1, 0, 3}, 4.4f), PurrlixCosmetics::flap));
        ALL.add(new Item(Slot.WINGS, "butterfly_wings", "Butterfly Wings", PurrlixCosmetics::plates, PurrlixCosmetics::flap));

        ALL.add(new Item(Slot.BACK, "backpack", "Backpack", PurrlixCosmetics::backpack, null));
        ALL.add(new Item(Slot.BACK, "jetpack", "Jetpack", PurrlixCosmetics::jetpack, (m, t) -> {
            float f = (float) Math.sin(t * 28.0) * 0.5f;
            m.getChild("flameL").setPivot(0, f, 0);
            m.getChild("flameR").setPivot(0, -f, 0);
        }));

        ALL.add(new Item(Slot.TAIL, "cat_tail", "Cat Tail", () -> tail(2.6f, 6, 1), PurrlixCosmetics::sway));
        ALL.add(new Item(Slot.TAIL, "fox_tail", "Fox Tail", () -> tail(4.4f, 5, 1), PurrlixCosmetics::sway));
        ALL.add(new Item(Slot.TAIL, "devil_tail", "Devil Tail", () -> tail(1.6f, 7, 1), PurrlixCosmetics::sway));
    }
}
