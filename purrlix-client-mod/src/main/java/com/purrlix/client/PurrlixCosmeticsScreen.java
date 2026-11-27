package com.purrlix.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

/** Cosmetics: capes, auras and Purrlix wings. Pick one on the left, see yourself on the right. */
public final class PurrlixCosmeticsScreen extends Screen {
    private static final int PANEL = 0xF00D1018;
    private static final int PANEL_EDGE = 0xFF262D3B;
    private static final int ROW = 0xFF151A25;
    private static final int ROW_HOVER = 0xFF1D2433;
    private static final int MUTED = 0xFF8B94A7;

    private record Entry(String name, BooleanSupplier equipped, Runnable equip) {}

    private static final String[] TABS = {"Capes", "Hats", "Wings", "Back", "Tail"};

    private final PurrlixConfig cfg;
    private int tab = 0;
    private int px, py, pw, ph;

    public PurrlixCosmeticsScreen(PurrlixConfig cfg) {
        super(Text.literal("Purrlix Cosmetics"));
        this.cfg = cfg;
    }

    private List<Entry> entries() {
        List<Entry> list = new ArrayList<>();
        if (tab == 0) {
            list.add(new Entry("Animated Purrlix cape", () -> cfg.animatedCape, () -> cfg.animatedCape = true));
            list.add(new Entry("No animated cape", () -> !cfg.animatedCape, () -> cfg.animatedCape = false));
            return list;
        }
        PurrlixCosmetics.Slot slot = PurrlixCosmetics.Slot.values()[tab - 1];
        list.add(new Entry("None", () -> PurrlixCosmetics.selectedIndex(slot) == 0, () -> PurrlixCosmetics.select(slot, 0)));
        List<PurrlixCosmetics.Item> items = PurrlixCosmetics.of(slot);
        for (int i = 0; i < items.size(); i++) {
            final int idx = i + 1;
            list.add(new Entry(items.get(i).name, () -> PurrlixCosmetics.selectedIndex(slot) == idx, () -> PurrlixCosmetics.select(slot, idx)));
        }
        return list;
    }

    private void layout() {
        pw = Math.min(this.width - 16, 480);
        ph = Math.min(this.height - 12, 280);
        px = (this.width - pw) / 2;
        py = (this.height - ph) / 2;
    }

    private int tabX(int i) {
        int x = px + 12;
        for (int k = 0; k < i; k++) x += this.textRenderer.getWidth(TABS[k]) + 16;
        return x;
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        layout();
        int main = Ui.main();
        int light = Ui.light();
        ctx.fillGradient(0, 0, this.width, this.height, 0xB0050709, 0xB0140A06);
        Ui.box(ctx, px - 1, py - 1, px + pw + 1, py + ph + 1, PANEL_EDGE);
        Ui.box(ctx, px, py, px + pw, py + ph, PANEL);
        ctx.fillGradient(px + 1, py, px + pw - 1, py + 3, main, light);
        ctx.drawTextWithShadow(this.textRenderer, "COSMETICS", px + 12, py + 12, light);
        ctx.drawTextWithShadow(this.textRenderer, "Only you see these. Back items, wings and tails show in third person (F5).", px + 12, py + 24, MUTED);

        for (int i = 0; i < TABS.length; i++) {
            int x = tabX(i);
            int w = this.textRenderer.getWidth(TABS[i]) + 10;
            boolean on = i == tab;
            Ui.box(ctx, x, py + 38, x + w, py + 54, on ? main : ROW);
            ctx.drawTextWithShadow(this.textRenderer, TABS[i], x + 5, py + 42, on ? 0xFF1A0E05 : 0xFFC9D0DE);
        }

        int listX = px + 12, listY = py + 62, listW = pw / 2 - 18;
        List<Entry> list = entries();
        for (int i = 0; i < list.size(); i++) {
            Entry e = list.get(i);
            int y = listY + i * 18;
            if (y + 16 > py + ph - 36) break;
            boolean hover = mouseX >= listX && mouseX < listX + listW && mouseY >= y && mouseY < y + 16;
            boolean on = e.equipped().getAsBoolean();
            Ui.box(ctx, listX, y, listX + listW, y + 16, hover ? ROW_HOVER : ROW);
            if (on) ctx.fill(listX, y + 2, listX + 2, y + 14, main);
            ctx.drawTextWithShadow(this.textRenderer, e.name(), listX + 8, y + 4, on ? 0xFFF3F5FA : 0xFF9AA3B5);
            String tag = on ? "Equipped" : "Equip";
            ctx.drawTextWithShadow(this.textRenderer, tag, listX + listW - this.textRenderer.getWidth(tag) - 6, y + 4, on ? 0xFF7CF0A1 : light);
        }

        // preview
        int vx = px + pw / 2 + 6, vy = py + 62, vw = pw / 2 - 18, vh = ph - 62 - 40;
        Ui.box(ctx, vx, vy, vx + vw, vy + vh, 0xFF090C12);
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) {
            try {
                InventoryScreen.drawEntity(ctx, vx, vy, vx + vw, vy + vh, Math.max(20, vh / 3), 0.0625f, mouseX, mouseY, mc.player);
            } catch (Throwable ignored) {
                // preview is cosmetic
            }
        } else {
            ctx.drawCenteredTextWithShadow(this.textRenderer, "Join a world to see yourself here", vx + vw / 2, vy + vh / 2 - 4, MUTED);
        }

        int by = py + ph - 26;
        boolean hb = mouseX >= px + 12 && mouseX < px + 92 && mouseY >= by && mouseY < by + 18;
        Ui.box(ctx, px + 12, by, px + 92, by + 18, hb ? ROW_HOVER : 0xFF303747);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "Back", px + 52, by + 5, 0xFFFFFFFF);
        boolean hd = mouseX >= px + pw - 92 && mouseX < px + pw - 12 && mouseY >= by && mouseY < by + 18;
        Ui.box(ctx, px + pw - 92, by, px + pw - 12, by + 18, hd ? light : main);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "Done", px + pw - 52, by + 5, 0xFF1A0E05);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (button != 0) return super.mouseClicked(mx, my, button);
        layout();
        for (int i = 0; i < TABS.length; i++) {
            int x = tabX(i);
            int w = this.textRenderer.getWidth(TABS[i]) + 10;
            if (mx >= x && mx < x + w && my >= py + 38 && my < py + 54) {
                tab = i;
                return true;
            }
        }
        int listX = px + 12, listY = py + 62, listW = pw / 2 - 18;
        List<Entry> list = entries();
        for (int i = 0; i < list.size(); i++) {
            int y = listY + i * 18;
            if (mx >= listX && mx < listX + listW && my >= y && my < y + 16) {
                list.get(i).equip().run();
                cfg.save();
                return true;
            }
        }
        int by = py + ph - 26;
        if (my >= by && my < by + 18) {
            if (mx >= px + 12 && mx < px + 92) {
                if (this.client != null) this.client.setScreen(new PurrlixMenu(cfg));
                return true;
            }
            if (mx >= px + pw - 92 && mx < px + pw - 12) {
                close();
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }
}
