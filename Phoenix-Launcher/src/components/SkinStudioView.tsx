import { makeSkinCode, readSkinCode } from '../utils/skinShare';
import { recolorSkin } from '../utils/skinRecolor';
import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eraser,
  Paintbrush,
  Pipette,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import type { PlayerProfile, SkinAsset } from '../types/launcher';
import { normalizeUploadedSkinFile } from '../utils/skinGenerator';
import { SkinViewport3D } from './SkinViewport3D';
import { SkinHeadAvatar } from './SkinHeadAvatar';

interface SkinStudioViewProps {
  skins: SkinAsset[];
  activeProfile: PlayerProfile;
  onSelectSkinForProfile: (skinId: string) => void;
  onUpdateSkin: (skinId: string, updater: (prev: SkinAsset) => SkinAsset) => void;
  onAddSkin: (skin: SkinAsset) => void;
  onDeleteSkin: (skinId: string) => void;
}

const SWATCH_COLORS = [
  '#F97316',
  '#FACC15',
  '#10B981',
  '#38BDF8',
  '#6366F1',
  '#EC4899',
  '#F8FAFC',
  '#94A3B8',
  '#1E293B',
  '#0B0E14',
  '#DDA882',
  '#4A2C18',
];

export function SkinStudioView({
  skins,
  activeProfile,
  onSelectSkinForProfile,
  onUpdateSkin,
  onAddSkin,
  onDeleteSkin,
}: SkinStudioViewProps) {
  const activeSkin = skins.find((s) => s.id === activeProfile.activeSkinId) ?? skins[0];

  const [brushColor, setBrushColor] = useState('#F97316');
  const [tool, setTool] = useState<'brush' | 'eraser' | 'eyedropper'>('brush');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mojangBusy, setMojangBusy] = useState(false);
  const [mojangNote, setMojangNote] = useState('');
  const [lookupName, setLookupName] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [rc, setRc] = useState({ hue: 0, saturation: 100, brightness: 100, keepFace: true });
  const [rcPreview, setRcPreview] = useState('');
  const [rcBusy, setRcBusy] = useState(false);
  const [skinCode, setSkinCode] = useState('');
  const [skinCodeNote, setSkinCodeNote] = useState('');
  const copySkinCode = async () => {
    if (!activeSkin) return;
    try {
      await navigator.clipboard.writeText(makeSkinCode(activeSkin));
      setSkinCodeNote('Skin code copied. Send it to a friend.');
    } catch {
      setSkinCodeNote('Could not copy. Allow clipboard access and try again.');
    }
  };
  const importSkinCode = () => {
    const r = readSkinCode(skinCode);
    if (!r.ok) {
      setSkinCodeNote(r.error);
      return;
    }
    const added: SkinAsset = { id: `skin-${Date.now()}`, name: r.name, modelType: r.modelType, dataUrl: r.dataUrl, showOuterLayer: true, isCustom: true };
    onAddSkin(added);
    onSelectSkinForProfile(added.id);
    setSkinCode('');
    setSkinCodeNote(`Added "${r.name}".`);
  };
  useEffect(() => {
    if (!activeSkin?.dataUrl) return;
    let live = true;
    recolorSkin(activeSkin.dataUrl, rc).then((u) => live && setRcPreview(u)).catch(() => live && setRcPreview(''));
    return () => {
      live = false;
    };
  }, [activeSkin?.dataUrl, rc]);
  const saveRecolor = async () => {
    if (!activeSkin) return;
    setRcBusy(true);
    try {
      const url = await recolorSkin(activeSkin.dataUrl, rc);
      const copy: SkinAsset = {
        ...activeSkin,
        id: `skin-${Date.now()}`,
        name: `${activeSkin.name} (recolor)`,
        dataUrl: url,
        isCustom: true,
      };
      onAddSkin(copy);
      onSelectSkinForProfile(copy.id);
    } finally {
      setRcBusy(false);
    }
  };
  const [paintMode, setPaintMode] = useState<'face' | 'sheet'>('face');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);

  // Sync offscreen 64x64 canvas & visible magnified editor canvas whenever activeSkin changes
  useEffect(() => {
    if (!activeSkin?.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = 64;
        offscreenCanvasRef.current.height = 64;
      }
      const offCtx = offscreenCanvasRef.current.getContext('2d')!;
      offCtx.clearRect(0, 0, 64, 64);
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(img, 0, 0);

      drawEditorGrid();
    };
    img.src = activeSkin.dataUrl;
  }, [activeSkin?.id, activeSkin?.dataUrl, paintMode]);

  const drawEditorGrid = () => {
    const viewCanvas = pixelCanvasRef.current;
    const offCanvas = offscreenCanvasRef.current;
    if (!viewCanvas || !offCanvas) return;

    const ctx = viewCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, viewCanvas.width, viewCanvas.height);

    // Checkerboard background
    const cols = paintMode === 'face' ? 8 : 64;
    const cellSize = viewCanvas.width / cols;
    for (let y = 0; y < cols; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#131822' : '#0E121A';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    if (paintMode === 'face') {
      // Crop Head Front region (x: 8..16, y: 8..16)
      ctx.drawImage(offCanvas, 8, 8, 8, 8, 0, 0, viewCanvas.width, viewCanvas.height);
    } else {
      ctx.drawImage(offCanvas, 0, 0, 64, 64, 0, 0, viewCanvas.width, viewCanvas.height);
    }

    // Crisp pixel grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    const step = paintMode === 'face' ? cellSize : cellSize * 4;
    for (let i = step; i < viewCanvas.width; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, viewCanvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(viewCanvas.width, i);
      ctx.stroke();
    }
  };

  const applyCanvasEdit = (clientX: number, clientY: number) => {
    const viewCanvas = pixelCanvasRef.current;
    const offCanvas = offscreenCanvasRef.current;
    if (!viewCanvas || !offCanvas || !activeSkin) return;

    const rect = viewCanvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;

    const px =
      paintMode === 'face'
        ? 8 + Math.floor(relX * 8)
        : Math.floor(relX * 64);
    const py =
      paintMode === 'face'
        ? 8 + Math.floor(relY * 8)
        : Math.floor(relY * 64);

    if (px < 0 || px >= 64 || py < 0 || py >= 64) return;
    const offCtx = offCanvas.getContext('2d')!;

    if (tool === 'eyedropper') {
      const pixel = offCtx.getImageData(px, py, 1, 1).data;
      if (pixel[3] > 0) {
        const hex = `#${[pixel[0], pixel[1], pixel[2]]
          .map((c) => c.toString(16).padStart(2, '0'))
          .join('')}`;
        setBrushColor(hex);
        setTool('brush');
      }
      return;
    }

    if (tool === 'eraser') {
      offCtx.clearRect(px, py, 1, 1);
    } else {
      offCtx.fillStyle = brushColor;
      offCtx.fillRect(px, py, 1, 1);
    }

    drawEditorGrid();
    const updatedUrl = offCanvas.toDataURL('image/png');
    onUpdateSkin(activeSkin.id, (prev) => ({ ...prev, dataUrl: updatedUrl }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const normalized = await normalizeUploadedSkinFile(file);
      const newSkin: SkinAsset = {
        id: `skin-${Date.now()}`,
        name: normalized.name,
        modelType: 'classic',
        dataUrl: normalized.dataUrl,
        showOuterLayer: true,
        isCustom: true,
      };
      onAddSkin(newSkin);
      onSelectSkinForProfile(newSkin.id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load skin PNG.');
    } finally {
      e.target.value = '';
    }
  };

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = lookupName.trim();
    if (!name) return;
    setLookupBusy(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/skin?name=${encodeURIComponent(name)}`);
      const data = (await res.json()) as { ok: boolean; error?: string; name?: string; model?: 'classic' | 'slim'; skinPng?: string };
      if (!data.ok || !data.skinPng) throw new Error(data.error || 'Skin not found.');
      const newSkin: SkinAsset = {
        id: `skin-${Date.now()}`,
        name: data.name || name,
        modelType: data.model === 'slim' ? 'slim' : 'classic',
        dataUrl: `data:image/png;base64,${data.skinPng}`,
        showOuterLayer: true,
        isCustom: true,
      };
      onAddSkin(newSkin);
      onSelectSkinForProfile(newSkin.id);
      setLookupName('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not load that skin.');
    } finally {
      setLookupBusy(false);
    }
  };

  const handleExportPng = () => {
    if (!activeSkin) return;
    const a = document.createElement('a');
    a.href = activeSkin.dataUrl;
    a.download = `${activeSkin.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
  };

  if (!activeSkin) return null;

  return (
    <div className="space-y-5">
      {mojangNote && <div className="rounded-lg bg-white/[0.06] border border-white/10 p-3 text-xs text-slate-200">{mojangNote}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-50">
            3D Skin Studio
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Look at your skin in 3D, paint it, load any player's skin by name, or upload a 64x64 PNG.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={handleFileUpload}
            className="hidden"
          />
          {activeProfile.accountType === 'microsoft' && activeProfile.uuid && window.phoenixDesktop && (
            <button
              type="button"
              disabled={mojangBusy}
              onClick={async () => {
                setMojangBusy(true);
                setMojangNote('');
                const r = await window.phoenixDesktop!.uploadSkin({
                  uuid: activeProfile.uuid!,
                  skinPng: activeSkin.dataUrl.split(',')[1] ?? '',
                  variant: activeSkin.modelType,
                });
                setMojangBusy(false);
                setMojangNote(r.ok ? 'Skin saved to your Minecraft account.' : r.error);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              {mojangBusy ? 'Uploading...' : 'Use on my Minecraft account'}
            </button>
          )}
          <form onSubmit={handleLookup} className="flex items-center gap-1.5">
            <input
              value={lookupName}
              onChange={(e) => setLookupName(e.target.value)}
              placeholder="Player name, e.g. Dream"
              maxLength={16}
              aria-label="Minecraft player name"
              className="w-40 rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={lookupBusy || !lookupName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-100 hover:border-orange-500/50 disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              {lookupBusy ? 'Loading...' : 'Get skin'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-100 hover:border-orange-500/50 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            Upload PNG
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export 64x64 PNG
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Main 3D Viewport */}
        <div className="xl:col-span-7 min-h-[520px]">
          <SkinViewport3D
            skinDataUrl={activeSkin.dataUrl}
            modelType={activeSkin.modelType}
            showOuterLayer={activeSkin.showOuterLayer}
            showCape={activeSkin.showCape ?? true}
            showSword={activeSkin.showSword ?? true}
            onToggleCape={() =>
              onUpdateSkin(activeSkin.id, (prev) => ({
                ...prev,
                showCape: !(prev.showCape ?? true),
              }))
            }
            onToggleSword={() =>
              onUpdateSkin(activeSkin.id, (prev) => ({
                ...prev,
                showSword: !(prev.showSword ?? true),
              }))
            }
            onToggleOuterLayer={() =>
              onUpdateSkin(activeSkin.id, (prev) => ({
                ...prev,
                showOuterLayer: !prev.showOuterLayer,
              }))
            }
            onChangeModelType={(type) =>
              onUpdateSkin(activeSkin.id, (prev) => ({
                ...prev,
                modelType: type,
              }))
            }
          />
        </div>

        {/* Right: Skin Library + Live Pixel Painter */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* Skin Library Selector */}
          <div className="rounded-xl bg-[#131822] border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Skin Wardrobe ({skins.length})
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                Active on {activeProfile.username}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {skins.map((skin) => {
                const isSelected = skin.id === activeSkin.id;
                return (
                  <div
                    key={skin.id}
                    onClick={() => onSelectSkinForProfile(skin.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSkinForProfile(skin.id);
                      }
                    }}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1A2130] border-orange-500/60'
                        : 'bg-[#0B0E14] border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SkinHeadAvatar
                        skinDataUrl={skin.dataUrl}
                        alt={skin.name}
                        size={32}
                        className="border border-white/10"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {skin.name}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {skin.modelType === 'slim' ? 'Slim (3px)' : 'Classic (4px)'}
                        </div>
                      </div>
                    </div>
                    {skin.isCustom && skins.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSkin(skin.id);
                        }}
                        aria-label={`Delete ${skin.name}`}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Pixel Editor */}
          <div className="flex-1 rounded-xl bg-[#131822] border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">
                Live Pixel Editor
              </h2>
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setPaintMode('face')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    paintMode === 'face'
                      ? 'bg-[#1A2130] text-orange-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Face (8x8)
                </button>
                <button
                  type="button"
                  onClick={() => setPaintMode('sheet')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    paintMode === 'sheet'
                      ? 'bg-[#1A2130] text-orange-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Full Sheet (64x64)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTool('brush')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                    tool === 'brush'
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                      : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Paint
                </button>
                <button
                  type="button"
                  onClick={() => setTool('eraser')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                    tool === 'eraser'
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                      : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Erase
                </button>
                <button
                  type="button"
                  onClick={() => setTool('eyedropper')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                    tool === 'eyedropper'
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                      : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Pipette className="w-3.5 h-3.5" />
                  Pick
                </button>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <span>Color</span>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                />
              </label>
            </div>

            {/* Swatches */}
            <div className="flex flex-wrap gap-1.5">
              {SWATCH_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    setBrushColor(swatch);
                    setTool('brush');
                  }}
                  aria-label={`Select color ${swatch}`}
                  style={{ backgroundColor: swatch }}
                  className={`w-5 h-5 rounded border transition-transform ${
                    brushColor.toLowerCase() === swatch.toLowerCase()
                      ? 'border-white scale-110'
                      : 'border-white/20 hover:scale-105'
                  }`}
                />
              ))}
            </div>

            {/* Recolor: makes a new skin, the original stays */}
            <div className="space-y-2 rounded-lg bg-[#090C12] border border-white/10 p-3">
              <div className="text-xs font-semibold text-slate-200">Recolor this skin</div>
              <div className="flex gap-3 items-start">
                {rcPreview && <img src={rcPreview} alt="Recolor preview" className="w-20 h-20 rounded bg-[#1A2130]" style={{ imageRendering: 'pixelated' }} />}
                <div className="flex-1 space-y-1.5 text-[11px] text-slate-300">
                  <label className="flex items-center gap-2">Colour<input type="range" min={-180} max={180} value={rc.hue} onChange={(e) => setRc({ ...rc, hue: Number(e.target.value) })} className="flex-1" /></label>
                  <label className="flex items-center gap-2">Vivid<input type="range" min={0} max={200} value={rc.saturation} onChange={(e) => setRc({ ...rc, saturation: Number(e.target.value) })} className="flex-1" /></label>
                  <label className="flex items-center gap-2">Light<input type="range" min={50} max={150} value={rc.brightness} onChange={(e) => setRc({ ...rc, brightness: Number(e.target.value) })} className="flex-1" /></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={rc.keepFace} onChange={(e) => setRc({ ...rc, keepFace: e.target.checked })} />Keep face colour</label>
                </div>
              </div>
              <button type="button" disabled={rcBusy} onClick={saveRecolor} className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50">Save as new skin</button>
            </div>

            {/* Share code */}
            <div className="space-y-2 rounded-lg bg-[#090C12] border border-white/10 p-3">
              <div className="text-xs font-semibold text-slate-200">Share this skin</div>
              <button type="button" onClick={copySkinCode} className="rounded-md bg-[#1A2130] border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">Copy skin code</button>
              <div className="flex gap-2">
                <input value={skinCode} onChange={(e) => setSkinCode(e.target.value)} placeholder="Paste a PHXS1... code" aria-label="Skin code" className="min-w-0 flex-1 rounded-md bg-[#1A2130] border border-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-500" />
                <button type="button" disabled={!skinCode.trim()} onClick={importSkinCode} className="rounded-md bg-orange-500 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-50">Add</button>
              </div>
              {skinCodeNote && <p className="text-[10px] text-slate-300">{skinCodeNote}</p>}
            </div>

            {/* Interactive Canvas */}
            <div className="flex justify-center pt-1">
              <canvas
                ref={pixelCanvasRef}
                width={256}
                height={256}
                onPointerDown={(e) => {
                  isPaintingRef.current = true;
                  applyCanvasEdit(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (isPaintingRef.current) applyCanvasEdit(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  isPaintingRef.current = false;
                }}
                onPointerLeave={() => {
                  isPaintingRef.current = false;
                }}
                className="w-60 h-60 rounded-lg border border-white/15 cursor-crosshair touch-none [image-rendering:pixelated]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
