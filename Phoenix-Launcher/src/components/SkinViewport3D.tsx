import { useEffect, useRef, useState } from 'react';
import { drawPhoenixCape } from '../utils/capeArt';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sword,
} from 'lucide-react';

export type SkinAnimationMode = 'idle' | 'walk' | 'run' | 'wave' | 'paused';
export type CameraPreset = 'hero' | 'portrait' | 'turntable';

interface SkinViewport3DProps {
  skinDataUrl: string;
  modelType: 'classic' | 'slim';
  showOuterLayer: boolean;
  showCape?: boolean;
  showSword?: boolean;
  embeddedHero?: boolean;
  hideHeroControls?: boolean;
  /** Externally controlled animation (e.g. from the home screen chips). */
  animation?: SkinAnimationMode;
  onToggleOuterLayer?: () => void;
  onToggleCape?: () => void;
  onToggleSword?: () => void;
  onChangeModelType?: (type: 'classic' | 'slim') => void;
}

const _emberDummy = new THREE.Object3D();
const _emberColor = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetCtrlTarget = new THREE.Vector3();

function applyBoxMinecraftUVs(
  geometry: THREE.BoxGeometry,
  ox: number,
  oy: number,
  w: number,
  h: number,
  d: number,
  texW = 64,
  texH = 64
) {
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;

  const setFaceUV = (faceIndex: number, px: number, py: number, pw: number, ph: number) => {
    const u0 = px / texW;
    const u1 = (px + pw) / texW;
    const v1 = 1 - py / texH;
    const v0 = 1 - (py + ph) / texH;
    const offset = faceIndex * 4;
    uvAttr.setXY(offset + 0, u0, v1);
    uvAttr.setXY(offset + 1, u1, v1);
    uvAttr.setXY(offset + 2, u0, v0);
    uvAttr.setXY(offset + 3, u1, v0);
  };

  setFaceUV(0, ox + d + w, oy + d, d, h);
  setFaceUV(1, ox, oy + d, d, h);
  setFaceUV(2, ox + d, oy, w, d);
  setFaceUV(3, ox + d + w, oy, w, d);
  setFaceUV(4, ox + d, oy + d, w, h);
  setFaceUV(5, ox + d + w + d, oy + d, w, h);

  uvAttr.needsUpdate = true;
}

function createRuneRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Outer & inner concentric forged gold rings
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 236, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 192, 0, Math.PI * 2);
  ctx.stroke();

  // Geometric precision degree ticks + Phoenix diamond runes
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const r0 = isMajor ? 196 : 208;
    const r1 = 232;
    ctx.strokeStyle = isMajor ? 'rgba(253, 224, 71, 0.95)' : 'rgba(249, 115, 22, 0.65)';
    ctx.lineWidth = isMajor ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();

    if (isMajor) {
      const rx = cx + Math.cos(angle) * 174;
      const ry = cy + Math.sin(angle) * 174;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.9)';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, -5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createPhoenixCapeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 528;
  drawPhoenixCape(canvas.getContext('2d')!, 320, 528);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createEnchantedBladeTexture(): THREE.CanvasTexture {
  const w = 8;
  const h = 24;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || x === w - 1) {
        // Forged molten-gold edge
        ctx.fillStyle = y % 3 === 0 ? '#FDE047' : '#F59E0B';
      } else if (x === 3 || x === 4) {
        // Glowing ember fuller core
        ctx.fillStyle = y > 2 && y < h - 2 ? '#FB923C' : '#334155';
      } else {
        // Dark netherite damascus steel
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1E2534' : '#2A3347';
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function SkinViewport3D({
  skinDataUrl,
  modelType,
  showOuterLayer,
  showCape = true,
  showSword = true,
  embeddedHero = false,
  hideHeroControls = false,
  animation,
  onToggleOuterLayer,
  onToggleCape,
  onToggleSword,
  onChangeModelType,
}: SkinViewport3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [animMode, setAnimMode] = useState<SkinAnimationMode>(embeddedHero ? 'idle' : 'walk');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero');
  const [localCape, setLocalCape] = useState(showCape);
  const [localSword, setLocalSword] = useState(showSword);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const effectiveCape = onToggleCape ? showCape : localCape;
  const effectiveSword = false; // the held sword was removed

  const animModeRef = useRef<SkinAnimationMode>(animMode);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const showOuterRef = useRef<boolean>(showOuterLayer);
  const showCapeRef = useRef<boolean>(effectiveCape);
  const showSwordRef = useRef<boolean>(effectiveSword);
  const transitionActiveRef = useRef<boolean>(false);
  const applyPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    if (animation) setAnimMode(animation);
  }, [animation]);

  useEffect(() => {
    animModeRef.current = animMode;
  }, [animMode]);

  useEffect(() => {
    showOuterRef.current = showOuterLayer;
  }, [showOuterLayer]);

  useEffect(() => {
    showCapeRef.current = effectiveCape;
  }, [effectiveCape]);

  useEffect(() => {
    showSwordRef.current = effectiveSword;
  }, [effectiveSword]);

  const outerMeshesRef = useRef<THREE.Mesh[]>([]);
  const capePivotRef = useRef<THREE.Group | null>(null);
  const swordGroupRef = useRef<THREE.Group | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const innerMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    outerMeshesRef.current.forEach((m) => {
      m.visible = showOuterLayer;
    });
  }, [showOuterLayer]);

  useEffect(() => {
    if (capePivotRef.current) {
      capePivotRef.current.visible = effectiveCape;
    }
  }, [effectiveCape]);

  useEffect(() => {
    if (swordGroupRef.current) {
      swordGroupRef.current.visible = effectiveSword;
    }
  }, [effectiveSword]);

  useEffect(() => {
    if (!skinDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;

      const oldTex = textureRef.current;
      textureRef.current = tex;

      if (innerMatRef.current) {
        innerMatRef.current.map = tex;
        innerMatRef.current.needsUpdate = true;
      }
      if (outerMatRef.current) {
        outerMatRef.current.map = tex;
        outerMatRef.current.needsUpdate = true;
      }
      if (oldTex) oldTex.dispose();
    };
    img.src = skinDataUrl;
  }, [skinDataUrl]);

  const rigBuilderRef = useRef<((type: 'classic' | 'slim') => void) | null>(null);
  useEffect(() => {
    rigBuilderRef.current?.(modelType);
  }, [modelType]);

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    cameraPresetRef.current = preset;
    applyPresetRef.current?.(preset);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 460;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    if (!embeddedHero) {
      scene.background = new THREE.Color(0x090c12);
      scene.fog = new THREE.FogExp2(0x090c12, 0.036);
    }

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    if (embeddedHero) {
      camera.position.set(1.35, 2.05, 4.15);
    } else {
      camera.position.set(2.45, 2.25, 4.35);
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: embeddedHero,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (embeddedHero) {
      renderer.setClearColor(0x000000, 0);
    }

    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting + Warm Plinth Under-Glow
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1a1f2c, 0.45);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff2dc, 1.05);
    keyLight.position.set(3.8, 6.2, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -2.8;
    keyLight.shadow.camera.right = 2.8;
    keyLight.shadow.camera.top = 3.8;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf97316, 1.0);
    rimLight.position.set(-3.8, 3.6, -3.5);
    scene.add(rimLight);

    const coolBackFill = new THREE.DirectionalLight(0x60a5fa, 0.35);
    coolBackFill.position.set(2.5, 2.8, -4.2);
    scene.add(coolBackFill);

    const plinthGlowLight = new THREE.PointLight(0xff8c24, 1.2, 4.8);
    plinthGlowLight.position.set(0, 0.38, 0);
    scene.add(plinthGlowLight);

    // Multi-Tier Obsidian & Brushed-Gold Plinth
    const plinthGroup = new THREE.Group();
    scene.add(plinthGroup);

    const obsidianMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d111a,
      roughness: 0.22,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
    });
    const brushedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5b041,
      metalness: 0.94,
      roughness: 0.17,
      anisotropy: 0.85,
      clearcoat: 0.38,
      clearcoatRoughness: 0.14,
    });

    const tier1Geo = new THREE.CylinderGeometry(1.44, 1.58, 0.14, 8);
    const tier1 = new THREE.Mesh(tier1Geo, obsidianMat);
    tier1.position.y = -0.11;
    tier1.rotation.y = Math.PI / 8;
    tier1.receiveShadow = true;
    plinthGroup.add(tier1);

    const tier2Geo = new THREE.CylinderGeometry(1.28, 1.36, 0.055, 8);
    const tier2 = new THREE.Mesh(tier2Geo, brushedGoldMat);
    tier2.position.y = -0.015;
    tier2.rotation.y = Math.PI / 8;
    tier2.receiveShadow = true;
    plinthGroup.add(tier2);

    const tier3Geo = new THREE.CylinderGeometry(1.16, 1.22, 0.06, 8);
    const tier3 = new THREE.Mesh(tier3Geo, obsidianMat);
    tier3.position.y = 0.03;
    tier3.rotation.y = Math.PI / 8;
    tier3.receiveShadow = true;
    plinthGroup.add(tier3);

    const goldInlayGeo = new THREE.RingGeometry(1.06, 1.11, 8);
    const goldInlay = new THREE.Mesh(goldInlayGeo, brushedGoldMat);
    goldInlay.rotation.x = -Math.PI / 2;
    goldInlay.rotation.z = Math.PI / 8;
    goldInlay.position.y = 0.062;
    plinthGroup.add(goldInlay);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const runeTex = createRuneRingTexture(maxAniso);
    const runeGeo = new THREE.RingGeometry(0.76, 1.04, 64);
    const runeMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const runeMesh = new THREE.Mesh(runeGeo, runeMat);
    runeMesh.rotation.x = -Math.PI / 2;
    runeMesh.position.y = 0.064;
    plinthGroup.add(runeMesh);

    // 8 Instanced Gold Corner Filigree Studs
    const studGeo = new THREE.BoxGeometry(0.08, 0.09, 0.08);
    const studMesh = new THREE.InstancedMesh(studGeo, brushedGoldMat, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      _emberDummy.position.set(Math.cos(a) * 1.26, 0.035, Math.sin(a) * 1.26);
      _emberDummy.rotation.set(0, -a, 0);
      _emberDummy.scale.set(1, 1, 1);
      _emberDummy.updateMatrix();
      studMesh.setMatrixAt(i, _emberDummy.matrix);
    }
    studMesh.instanceMatrix.needsUpdate = true;
    studMesh.computeBoundingSphere();
    plinthGroup.add(studMesh);

    // Radial Contact Shadow Grounding
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.72)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowGeo = new THREE.PlaneGeometry(1.55, 1.55);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.066;
    scene.add(contactShadow);

    // Instanced Floating Ember Sparks
    const EMBER_COUNT = 36;
    const emberGeo = new THREE.OctahedronGeometry(0.022, 0);
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xff6a00,
      emissiveIntensity: 2.3,
      roughness: 0.3,
      metalness: 0.1,
    });
    const emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, EMBER_COUNT);
    emberMesh.frustumCulled = false;

    const emberBaseAngle = new Float32Array(EMBER_COUNT);
    const emberRadius = new Float32Array(EMBER_COUNT);
    const emberPhase = new Float32Array(EMBER_COUNT);
    const emberSpeed = new Float32Array(EMBER_COUNT);

    for (let i = 0; i < EMBER_COUNT; i++) {
      emberBaseAngle[i] = (i / EMBER_COUNT) * Math.PI * 2 + (i % 3) * 0.4;
      emberRadius[i] = 0.92 + (i % 5) * 0.16;
      emberPhase[i] = (i * 0.37) % 1;
      emberSpeed[i] = 0.11 + (i % 4) * 0.032;
      _emberColor.setHSL(0.07 + (i % 4) * 0.015, 0.95, 0.56);
      emberMesh.setColorAt(i, _emberColor);
    }
    if (emberMesh.instanceColor) emberMesh.instanceColor.needsUpdate = true;
    emberMesh.computeBoundingSphere();
    scene.add(emberMesh);

    // Character Skin + Accessory Textures/Materials
    const innerMat = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.06,
    });
    const outerMat = new THREE.MeshStandardMaterial({
      roughness: 0.58,
      metalness: 0.14,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    innerMatRef.current = innerMat;
    outerMatRef.current = outerMat;

    if (textureRef.current) {
      innerMat.map = textureRef.current;
      outerMat.map = textureRef.current;
    }

    const capeTex = createPhoenixCapeTexture();
    const capeCtx = (capeTex.image as HTMLCanvasElement).getContext('2d')!;
    let capeRedrawIn = 0;
    // assigned when the character model is built (the sway targets the cloth mesh)
    let capeMeshRef: THREE.Object3D = new THREE.Object3D();
    const capeMat = new THREE.MeshStandardMaterial({
      map: capeTex,
      roughness: 0.65,
      metalness: 0.18,
    });
    const capeSideMat = new THREE.MeshStandardMaterial({ color: 0x3a0e14, roughness: 0.8, metalness: 0.1 });

    const bladeTex = createEnchantedBladeTexture();
    const bladeMat = new THREE.MeshPhysicalMaterial({
      map: bladeTex,
      emissive: 0xff6a00,
      emissiveMap: bladeTex,
      emissiveIntensity: 0.45,
      metalness: 0.72,
      roughness: 0.22,
      clearcoat: 0.8,
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x261a14,
      roughness: 0.86,
      metalness: 0.08,
    });
    const rubyGemMat = new THREE.MeshPhysicalMaterial({
      color: 0xff5a1f,
      emissive: 0xf97316,
      emissiveIntensity: 1.4,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
    });

    const PLINTH_TOP_Y = 0.06;
    const characterRoot = new THREE.Group();
    characterRoot.position.y = PLINTH_TOP_Y;
    scene.add(characterRoot);

    let headPivot = new THREE.Group();
    let torsoGroup = new THREE.Group();
    let capePivot = new THREE.Group();
    let rightArmPivot = new THREE.Group();
    let leftArmPivot = new THREE.Group();
    let rightLegPivot = new THREE.Group();
    let leftLegPivot = new THREE.Group();
    let swordGroup = new THREE.Group();

    const unit = 0.085;
    const disposableGeos: THREE.BufferGeometry[] = [];

    const buildCharacterRig = (armStyle: 'classic' | 'slim') => {
      while (characterRoot.children.length > 0) {
        characterRoot.remove(characterRoot.children[0]);
      }
      disposableGeos.forEach((g) => g.dispose());
      disposableGeos.length = 0;
      outerMeshesRef.current = [];

      const armPx = armStyle === 'slim' ? 3 : 4;

      headPivot = new THREE.Group();
      headPivot.position.set(0, 24 * unit, 0);

      torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 18 * unit, 0);

      rightArmPivot = new THREE.Group();
      rightArmPivot.position.set(-(4 + armPx / 2) * unit, 22 * unit, 0);

      leftArmPivot = new THREE.Group();
      leftArmPivot.position.set((4 + armPx / 2) * unit, 22 * unit, 0);

      rightLegPivot = new THREE.Group();
      rightLegPivot.position.set(-2 * unit, 12 * unit, 0);

      leftLegPivot = new THREE.Group();
      leftLegPivot.position.set(2 * unit, 12 * unit, 0);

      // Head + Hat
      const headGeo = new THREE.BoxGeometry(8 * unit, 8 * unit, 8 * unit);
      applyBoxMinecraftUVs(headGeo, 0, 0, 8, 8, 8);
      const headMesh = new THREE.Mesh(headGeo, innerMat);
      headMesh.position.y = 4 * unit;
      headMesh.castShadow = true;

      const hatGeo = new THREE.BoxGeometry(8.55 * unit, 8.55 * unit, 8.55 * unit);
      applyBoxMinecraftUVs(hatGeo, 32, 0, 8, 8, 8);
      const hatMesh = new THREE.Mesh(hatGeo, outerMat);
      hatMesh.position.y = 4 * unit;
      hatMesh.visible = showOuterRef.current;
      headPivot.add(headMesh, hatMesh);

      // Torso + Jacket
      const bodyGeo = new THREE.BoxGeometry(8 * unit, 12 * unit, 4 * unit);
      applyBoxMinecraftUVs(bodyGeo, 16, 16, 8, 12, 4);
      const bodyMesh = new THREE.Mesh(bodyGeo, innerMat);
      bodyMesh.castShadow = true;

      const jacketGeo = new THREE.BoxGeometry(8.45 * unit, 12.45 * unit, 4.45 * unit);
      applyBoxMinecraftUVs(jacketGeo, 16, 32, 8, 12, 4);
      const jacketMesh = new THREE.Mesh(jacketGeo, outerMat);
      jacketMesh.visible = showOuterRef.current;

      // 3D Phoenix Cape Pivot attached to back of torso
      capePivot = new THREE.Group();
      capePivot.position.set(0, 5.6 * unit, -2.35 * unit);
      capePivot.visible = showCapeRef.current;
      capePivotRef.current = capePivot;

      const capeGeo = new THREE.BoxGeometry(9.2 * unit, 15.2 * unit, 0.72 * unit);
      // box faces: +x, -x, +y, -y, +z (against the body), -z (back, shows the text)
      const capeMesh = new THREE.Mesh(capeGeo, [capeSideMat, capeSideMat, capeSideMat, capeSideMat, capeSideMat, capeMat]);
      capeMesh.position.set(0, -7.4 * unit, -0.35 * unit);
      capeMeshRef = capeMesh;
      capeMesh.castShadow = true;

      const claspGeo = new THREE.BoxGeometry(1.4 * unit, 1.1 * unit, 1.2 * unit);
      const claspL = new THREE.Mesh(claspGeo, brushedGoldMat);
      claspL.position.set(-3.2 * unit, -0.2 * unit, 0.1 * unit);
      const claspR = new THREE.Mesh(claspGeo, brushedGoldMat);
      claspR.position.set(3.2 * unit, -0.2 * unit, 0.1 * unit);

      const capeHemGeo = new THREE.BoxGeometry(9.4 * unit, 0.7 * unit, 0.85 * unit);
      const capeHem = new THREE.Mesh(capeHemGeo, brushedGoldMat);
      capeHem.position.set(0, -14.8 * unit, -0.35 * unit);

      capePivot.add(capeMesh, claspL, claspR, capeHem);
      torsoGroup.add(bodyMesh, jacketMesh, capePivot);

      // Right Arm + Sleeve + 3D Enchanted Phoenix Sword
      const rArmGeo = new THREE.BoxGeometry(armPx * unit, 12 * unit, 4 * unit);
      applyBoxMinecraftUVs(rArmGeo, 40, 16, armPx, 12, 4);
      const rArmMesh = new THREE.Mesh(rArmGeo, innerMat);
      rArmMesh.position.y = -4 * unit;
      rArmMesh.castShadow = true;

      const rSleeveGeo = new THREE.BoxGeometry((armPx + 0.45) * unit, 12.45 * unit, 4.45 * unit);
      applyBoxMinecraftUVs(rSleeveGeo, 40, 32, armPx, 12, 4);
      const rSleeveMesh = new THREE.Mesh(rSleeveGeo, outerMat);
      rSleeveMesh.position.y = -4 * unit;
      rSleeveMesh.visible = showOuterRef.current;

      swordGroup = new THREE.Group();
      swordGroup.position.set(0, -9.2 * unit, 0.9 * unit);
      swordGroup.rotation.set(Math.PI * 0.36, 0, 0.04);
      swordGroup.visible = showSwordRef.current;
      swordGroupRef.current = swordGroup;

      const pommelGeo = new THREE.BoxGeometry(1.65 * unit, 1.3 * unit, 1.65 * unit);
      const pommel = new THREE.Mesh(pommelGeo, brushedGoldMat);
      pommel.position.y = -2.2 * unit;

      const gripGeo = new THREE.BoxGeometry(1.05 * unit, 3.0 * unit, 1.05 * unit);
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.y = -0.3 * unit;

      const guardCenterGeo = new THREE.BoxGeometry(4.4 * unit, 1.15 * unit, 1.45 * unit);
      const guardCenter = new THREE.Mesh(guardCenterGeo, brushedGoldMat);
      guardCenter.position.y = 1.4 * unit;

      const guardWingGeo = new THREE.BoxGeometry(1.6 * unit, 0.9 * unit, 1.2 * unit);
      const guardWingL = new THREE.Mesh(guardWingGeo, brushedGoldMat);
      guardWingL.position.set(-2.6 * unit, 1.85 * unit, 0);
      guardWingL.rotation.z = -0.45;
      const guardWingR = new THREE.Mesh(guardWingGeo, brushedGoldMat);
      guardWingR.position.set(2.6 * unit, 1.85 * unit, 0);
      guardWingR.rotation.z = 0.45;

      const gemGeo = new THREE.OctahedronGeometry(0.68 * unit, 0);
      const gem = new THREE.Mesh(gemGeo, rubyGemMat);
      gem.position.set(0, 1.4 * unit, 0.55 * unit);

      const bladeGeo = new THREE.BoxGeometry(1.65 * unit, 11.4 * unit, 0.52 * unit);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 7.5 * unit;
      blade.castShadow = true;

      const bladeTipGeo = new THREE.BoxGeometry(1.05 * unit, 1.3 * unit, 0.46 * unit);
      const bladeTip = new THREE.Mesh(bladeTipGeo, bladeMat);
      bladeTip.position.y = 13.7 * unit;

      swordGroup.add(pommel, grip, guardCenter, guardWingL, guardWingR, gem, blade, bladeTip);
      rightArmPivot.add(rArmMesh, rSleeveMesh, swordGroup);

      // Left Arm + Sleeve
      const lArmGeo = new THREE.BoxGeometry(armPx * unit, 12 * unit, 4 * unit);
      applyBoxMinecraftUVs(lArmGeo, 32, 48, armPx, 12, 4);
      const lArmMesh = new THREE.Mesh(lArmGeo, innerMat);
      lArmMesh.position.y = -4 * unit;
      lArmMesh.castShadow = true;

      const lSleeveGeo = new THREE.BoxGeometry((armPx + 0.45) * unit, 12.45 * unit, 4.45 * unit);
      applyBoxMinecraftUVs(lSleeveGeo, 48, 48, armPx, 12, 4);
      const lSleeveMesh = new THREE.Mesh(lSleeveGeo, outerMat);
      lSleeveMesh.position.y = -4 * unit;
      lSleeveMesh.visible = showOuterRef.current;
      leftArmPivot.add(lArmMesh, lSleeveMesh);

      // Right Leg + Pant
      const rLegGeo = new THREE.BoxGeometry(4 * unit, 12 * unit, 4 * unit);
      applyBoxMinecraftUVs(rLegGeo, 0, 16, 4, 12, 4);
      const rLegMesh = new THREE.Mesh(rLegGeo, innerMat);
      rLegMesh.position.y = -6 * unit;
      rLegMesh.castShadow = true;

      const rPantGeo = new THREE.BoxGeometry(4.4 * unit, 12.4 * unit, 4.4 * unit);
      applyBoxMinecraftUVs(rPantGeo, 0, 32, 4, 12, 4);
      const rPantMesh = new THREE.Mesh(rPantGeo, outerMat);
      rPantMesh.position.y = -6 * unit;
      rPantMesh.visible = showOuterRef.current;
      rightLegPivot.add(rLegMesh, rPantMesh);

      // Left Leg + Pant
      const lLegGeo = new THREE.BoxGeometry(4 * unit, 12 * unit, 4 * unit);
      applyBoxMinecraftUVs(lLegGeo, 16, 48, 4, 12, 4);
      const lLegMesh = new THREE.Mesh(lLegGeo, innerMat);
      lLegMesh.position.y = -6 * unit;
      lLegMesh.castShadow = true;

      const lPantGeo = new THREE.BoxGeometry(4.4 * unit, 12.4 * unit, 4.4 * unit);
      applyBoxMinecraftUVs(lPantGeo, 0, 48, 4, 12, 4);
      const lPantMesh = new THREE.Mesh(lPantGeo, outerMat);
      lPantMesh.position.y = -6 * unit;
      lPantMesh.visible = showOuterRef.current;
      leftLegPivot.add(lLegMesh, lPantMesh);

      disposableGeos.push(
        headGeo,
        hatGeo,
        bodyGeo,
        jacketGeo,
        capeGeo,
        claspGeo,
        capeHemGeo,
        rArmGeo,
        rSleeveGeo,
        pommelGeo,
        gripGeo,
        guardCenterGeo,
        guardWingGeo,
        gemGeo,
        bladeGeo,
        bladeTipGeo,
        lArmGeo,
        lSleeveGeo,
        rLegGeo,
        rPantGeo,
        lLegGeo,
        lPantGeo
      );
      outerMeshesRef.current = [hatMesh, jacketMesh, rSleeveMesh, lSleeveMesh, rPantMesh, lPantMesh];

      characterRoot.add(headPivot, torsoGroup, rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot);
    };

    rigBuilderRef.current = buildCharacterRig;
    buildCharacterRig(modelType);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, embeddedHero ? 1.25 : 1.38, 0);
    controls.enableZoom = !embeddedHero;
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI / 1.92;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.6;
    controls.update();

    const onControlsStart = () => {
      transitionActiveRef.current = false;
      controls.autoRotate = false;
    };
    controls.addEventListener('start', onControlsStart);

    applyPresetRef.current = (preset: CameraPreset) => {
      if (preset === 'portrait') {
        _targetCamPos.set(1.15, 2.25, 2.35);
        _targetCtrlTarget.set(0, 2.02, 0);
        controls.autoRotate = false;
      } else if (preset === 'turntable') {
        _targetCamPos.set(2.2, 2.2, 4.2);
        _targetCtrlTarget.set(0, 1.38, 0);
        controls.autoRotate = !isSoftwareGl;
      } else {
        _targetCamPos.set(embeddedHero ? 1.85 : 2.45, embeddedHero ? 2.15 : 2.25, 4.35);
        _targetCtrlTarget.set(0, 1.38, 0);
        controls.autoRotate = false;
      }
      transitionActiveRef.current = true;
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let elapsedAnim = 0;
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastFrameMs = 0;
    const tick = () => {
      if (disposed) return;
      // 30 frames per second is plenty for a spinning skin and keeps weak PCs cool
      const nowMs = performance.now();
      if (!isSoftwareGl && nowMs - lastFrameMs < 30) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastFrameMs = nowMs;
      const delta = Math.min(clock.getDelta(), 0.1);
      const mode = animModeRef.current;

      if (mode !== 'paused') {
        elapsedAnim += delta;
      }

      // Animated cape: redraw the flames/embers ~20 times a second and sway the cloth
      capeRedrawIn -= delta;
      if (capeRedrawIn <= 0 && showCapeRef.current) {
        capeRedrawIn = isSoftwareGl ? 0.12 : 0.05;
        drawPhoenixCape(capeCtx, 320, 528, 0, 0, clock.elapsedTime);
        capeTex.needsUpdate = true;
      }
      capeMeshRef.rotation.z = Math.sin(clock.elapsedTime * 1.6) * 0.035;
      capeMeshRef.rotation.x = Math.sin(clock.elapsedTime * 2.3 + 1) * 0.03;

      // Rotate arcane plinth ring slowly & breathe ember underglow
      runeMesh.rotation.z = elapsedAnim * 0.18;
      plinthGlowLight.intensity = 1.1 + Math.sin(elapsedAnim * 2.4) * 0.2;

      // Update 36 Instanced Floating Ember Sparks (zero GC allocations)
      for (let i = 0; i < EMBER_COUNT; i++) {
        const life = (emberPhase[i] + elapsedAnim * emberSpeed[i]) % 1;
        const angle = emberBaseAngle[i] + elapsedAnim * 0.35 + life * 1.4;
        const r = emberRadius[i] - life * 0.28;
        const y = 0.18 + life * 2.85;
        const pulse = Math.sin(life * Math.PI);
        const s = 0.45 + pulse * 0.85;

        _emberDummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        _emberDummy.rotation.set(elapsedAnim * 1.5 + i, elapsedAnim * 1.1, 0);
        _emberDummy.scale.setScalar(s);
        _emberDummy.updateMatrix();
        emberMesh.setMatrixAt(i, _emberDummy.matrix);
      }
      emberMesh.instanceMatrix.needsUpdate = true;

      // Pose Kinematics + Cape Billow
      if (mode === 'idle') {
        const breath = Math.sin(elapsedAnim * 2.1);
        rightArmPivot.rotation.x = THREE.MathUtils.damp(
          rightArmPivot.rotation.x,
          (showSwordRef.current ? -0.32 : 0) + breath * 0.08,
          8,
          delta
        );
        leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -breath * 0.08, 8, delta);
        rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.07, 8, delta);
        leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.07, 8, delta);
        rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, 0, 8, delta);
        leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0, 8, delta);
        headPivot.rotation.y = Math.sin(elapsedAnim * 0.9) * 0.22;
        headPivot.rotation.x = Math.sin(elapsedAnim * 1.4) * 0.05;
        capePivot.rotation.x = THREE.MathUtils.damp(
          capePivot.rotation.x,
          0.14 + Math.sin(elapsedAnim * 2.2) * 0.06,
          6,
          delta
        );
        characterRoot.position.y = PLINTH_TOP_Y + Math.sin(elapsedAnim * 2.1) * 0.015;
      } else if (mode === 'walk' || mode === 'run') {
        const speed = mode === 'run' ? 8.5 : 4.2;
        const amp = mode === 'run' ? 0.85 : 0.48;
        const swing = Math.sin(elapsedAnim * speed) * amp;
        rightArmPivot.rotation.x = showSwordRef.current ? -0.25 + swing * 0.6 : swing;
        leftArmPivot.rotation.x = -swing;
        rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.05, 8, delta);
        leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.05, 8, delta);
        rightLegPivot.rotation.x = -swing;
        leftLegPivot.rotation.x = swing;
        headPivot.rotation.y = Math.sin(elapsedAnim * 1.1) * 0.12;
        headPivot.rotation.x = 0;
        const capeLift = mode === 'run' ? 0.62 : 0.34;
        capePivot.rotation.x = capeLift + Math.abs(Math.sin(elapsedAnim * speed)) * 0.14;
        characterRoot.position.y =
          PLINTH_TOP_Y + Math.abs(Math.sin(elapsedAnim * speed)) * (mode === 'run' ? 0.06 : 0.025);
      } else if (mode === 'wave') {
        rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -2.55, 10, delta);
        rightArmPivot.rotation.z = -0.35 + Math.sin(elapsedAnim * 7.5) * 0.35;
        leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, 0, 8, delta);
        leftArmPivot.rotation.z = 0.07;
        rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, 0, 8, delta);
        leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0, 8, delta);
        headPivot.rotation.y = Math.sin(elapsedAnim * 2.5) * 0.15;
        capePivot.rotation.x = THREE.MathUtils.damp(
          capePivot.rotation.x,
          0.18 + Math.sin(elapsedAnim * 3.0) * 0.05,
          6,
          delta
        );
        characterRoot.position.y = PLINTH_TOP_Y;
      }

      // Smooth damped camera preset transitions
      if (transitionActiveRef.current) {
        const k = 1 - Math.exp(-8 * delta);
        camera.position.lerp(_targetCamPos, k);
        controls.target.lerp(_targetCtrlTarget, k);
        if (camera.position.distanceToSquared(_targetCamPos) < 0.0008) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetCtrlTarget);
          transitionActiveRef.current = false;
        }
      }

      controls.update();
      const idle = document.hidden || document.documentElement.classList.contains('game-running');
      if (!idle) renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      disposableGeos.forEach((g) => g.dispose());
      tier1Geo.dispose();
      tier2Geo.dispose();
      tier3Geo.dispose();
      goldInlayGeo.dispose();
      runeGeo.dispose();
      runeMat.dispose();
      runeTex.dispose();
      studGeo.dispose();
      obsidianMat.dispose();
      brushedGoldMat.dispose();
      emberGeo.dispose();
      emberMat.dispose();
      shadowTex.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      capeTex.dispose();
      capeMat.dispose();
      capeSideMat.dispose();
      bladeTex.dispose();
      bladeMat.dispose();
      gripMat.dispose();
      rubyGemMat.dispose();
      innerMat.dispose();
      outerMat.dispose();
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [embeddedHero]);

  const handleToggleCapeAction = () => {
    if (onToggleCape) {
      onToggleCape();
    } else {
      setLocalCape((v) => !v);
    }
  };

  const handleToggleSwordAction = () => {
    if (onToggleSword) {
      onToggleSword();
    } else {
      setLocalSword((v) => !v);
    }
  };

  if (embeddedHero) {
    return (
      <div className="relative w-full h-full min-h-[300px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        {!hideHeroControls && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-[#0B0E14]/92 border border-white/10 p-1.5 shadow-lg max-w-[96%]">
          <div className="flex items-center gap-0.5">
            {(['idle', 'walk', 'wave'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAnimMode(mode)}
                className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                  animMode === mode
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-0.5">
            {(
              [
                { id: 'hero', label: 'Hero' },
                { id: 'portrait', label: 'Close' },
                { id: 'turntable', label: '360°' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleSelectCameraPreset(cam.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  cameraPreset === cam.id
                    ? 'bg-[#1A2130] text-amber-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          <button
            type="button"
            onClick={handleToggleCapeAction}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              effectiveCape
                ? 'bg-orange-500/20 text-amber-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" />
            Cape
          </button>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-xl overflow-hidden border border-white/[0.08] bg-[#090C12]">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090C12] text-sm text-slate-300">
          WebGL context paused. Restoring 3D skin renderer...
        </div>
      )}

      <div className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-amber-300">Obsidian Showcase</span>
        <span aria-hidden="true">·</span>
        <span>{modelType === 'slim' ? 'Slim (3px arms)' : 'Classic (4px arms)'}</span>
        <span aria-hidden="true">·</span>
        <span>Drag to orbit</span>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(95%,740px)] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-[#131822]/95 border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {dockCollapsed ? 'Show Controls' : 'Hide Controls'}
        </button>

        {!dockCollapsed && (
          <div className="w-full flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#131822]/95 border border-white/10 px-3 py-2 shadow-xl">
            <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
              {(['walk', 'run', 'idle', 'wave'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAnimMode(mode)}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                    animMode === mode
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAnimMode((m) => (m === 'paused' ? 'walk' : 'paused'))}
                aria-label={animMode === 'paused' ? 'Resume animation' : 'Pause animation'}
                className={`p-1.5 rounded transition-colors ${
                  animMode === 'paused'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {animMode === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
              <Camera className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-0.5" />
              {(
                [
                  { id: 'hero', label: 'Hero' },
                  { id: 'portrait', label: 'Portrait' },
                  { id: 'turntable', label: '360°' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => handleSelectCameraPreset(cam.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === cam.id
                      ? 'bg-[#1A2130] text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onChangeModelType && (
                <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onChangeModelType('classic')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      modelType === 'classic'
                        ? 'bg-[#1A2130] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Classic
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeModelType('slim')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      modelType === 'slim'
                        ? 'bg-[#1A2130] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Slim
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleCapeAction}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  effectiveCape
                    ? 'bg-orange-500/15 border-orange-500/40 text-amber-300'
                    : 'bg-[#0B0E14] border-white/[0.08] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Cape
              </button>

              {onToggleOuterLayer && (
                <button
                  type="button"
                  onClick={onToggleOuterLayer}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    showOuterLayer
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-[#0B0E14] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Outer
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectCameraPreset('hero')}
                aria-label="Reset camera"
                className="p-1.5 rounded-lg bg-[#0B0E14] border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
