import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  usePlannerStore, LayoutItem, RotateDirection, PlacementZone,
  checkCollision, calculateDropY, checkFullSupport,
  getColumnGroup, calculatePlacementZones,
} from '../store/plannerStore';

// ── Scale factor ─────────────────────────────────────────────────────
const S = 0.01;

// ── PDF Capture Camera Positions ─────────────────────────────────────
// Adjust these multipliers to change the PDF screenshot angle.
// x, y, z are multiplied by container l (length), h (height), w (width).
// Right view: camera is on the left side looking right, elevated.
// Left view: camera is on the right side looking left, elevated.
const CAPTURE_CAM_RIGHT = { x: 1.1, y: 2.5, z: 2.5 };
const CAPTURE_CAM_LEFT = { x: 1.1, y: 2.5, z: -1.5 };

// ── Texture Cache ────────────────────────────────────────────────────
const textureCache: Record<string, THREE.CanvasTexture> = {};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const explicitLines = text.split('//');
  const lines: string[] = [];

  for (let j = 0; j < explicitLines.length; j++) {
    let part = explicitLines[j].trim();
    if (j < explicitLines.length - 1) {
      part += ' //';
    }

    if (part === '') continue;

    const words = part.split(' ');
    let current = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const test = current + ' ' + words[i];
      if (ctx.measureText(test).width < maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export function getLabelTexture(label: string, w: number, h: number): THREE.CanvasTexture {
  const key = `${label}_${w}_${h}`;
  if (textureCache[key]) return textureCache[key];

  const canvas = document.createElement('canvas');
  const scale = 1000 / Math.max(w, h, 1);
  const cw = w * scale;
  const ch = h * scale;
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  let minSize = 10;
  let maxSize = Math.min(cw, ch);
  let bestSize = minSize;
  let bestLines: string[] = [label];

  for (let i = 0; i < 20; i++) {
    const mid = (minSize + maxSize) / 2;
    ctx.font = `bold ${mid}px Arial, sans-serif`;

    const lines = wrapText(ctx, label, cw * 0.9);
    const lh = mid * 1.1;
    const totalHeight = lines.length * lh;

    let fitsWidth = true;
    for (const l of lines) {
      if (ctx.measureText(l).width > cw * 0.95) {
        fitsWidth = false;
        break;
      }
    }

    if (totalHeight <= ch * 0.9 && fitsWidth) {
      bestSize = mid;
      bestLines = lines;
      minSize = mid;
    } else {
      maxSize = mid;
    }
  }

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${bestSize}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const lh = bestSize * 1.1;
  const totalTextHeight = bestLines.length * lh;
  const extraSpace = ch - totalTextHeight;
  const spacing = bestLines.length > 1 ? extraSpace / (bestLines.length + 1) : 0;

  let currentY = bestLines.length > 1 ? spacing + (lh / 2) : ch / 2;

  bestLines.forEach((line) => {
    ctx.fillText(line, cw * 0.05, currentY);
    if (bestLines.length > 1) currentY += lh + spacing;
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  textureCache[key] = tex;
  return tex;
}

export function getUpArrowTexture(): THREE.CanvasTexture {
  if (textureCache['__up_arrow']) return textureCache['__up_arrow'];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Draw an up arrow
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(256, 100);
  ctx.lineTo(150, 250);
  ctx.lineTo(210, 250);
  ctx.lineTo(210, 400);
  ctx.lineTo(302, 400);
  ctx.lineTo(302, 250);
  ctx.lineTo(362, 250);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  textureCache['__up_arrow'] = tex;
  return tex;
}

// ── Container Box ────────────────────────────────────────────────────
function ContainerBox({ length, width, height }: { length: number; width: number; height: number }) {
  const l = length * S, w = width * S, h = height * S;
  return (
    <group>
      <mesh position={[l / 2, 0, w / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[l, w]} />
        <meshStandardMaterial color="#8C8980" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h / 2, w / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#D4D3D1" side={THREE.FrontSide} />
      </mesh>
      <mesh position={[l, h / 2, w / 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#D4D3D1" side={THREE.FrontSide} />
      </mesh>
      <mesh position={[l / 2, h / 2, 0]}>
        <planeGeometry args={[l, h]} />
        <meshStandardMaterial color="#BDB8B3" side={THREE.FrontSide} />
      </mesh>
      <mesh position={[l / 2, h / 2, w]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[l, h]} />
        <meshStandardMaterial color="#BDB8B3" side={THREE.FrontSide} />
      </mesh>
      <lineSegments position={[l / 2, h / 2, w / 2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(l, h, w)]} />
        <lineBasicMaterial color="#4b5563" />
      </lineSegments>
    </group>
  );
}

// ── Placement Zones (Green indicators) ───────────────────────────────
function PlacementZones({ zones }: { zones: PlacementZone[] }) {
  if (zones.length === 0) return null;

  return (
    <group>
      {zones.map((zone, i) => (
        <mesh key={i} position={[(zone.x * S) + (zone.l * S) / 2, (zone.y * S) + 0.005, (zone.z * S) + (zone.w * S) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[zone.l * S, zone.w * S]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ── Product Box ──────────────────────────────────────────────────────
interface ProductBoxProps {
  item: LayoutItem;
  isSelected: boolean;
  isInGroup: boolean;
  isHovered: boolean;
  onSelect: (item: LayoutItem) => void;
  onHover: (item: LayoutItem | null) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>, item: LayoutItem) => void;
}

function ProductBox({ item, isSelected, isInGroup, isHovered, onSelect, onHover, onContextMenu }: ProductBoxProps) {
  // Current bounding box
  const l = item.length_cm * S, w = item.width_cm * S, h = item.height_cm * S;
  const x = item.pos_x * S, y = item.pos_y * S, z = item.pos_z * S;

  // Original dimensions for geometry
  const product = usePlannerStore(s => s.products.find(p => p.id === item.product_id));
  const origL = (product?.length_cm || item.length_cm) * S;
  const origW = (product?.width_cm || item.width_cm) * S;
  const origH = (product?.height_cm || item.height_cm) * S;

  const baseColor = item.color_hex || '#fde047';
  const darkColor = darkenColor(baseColor, 0.4);
  const displayColor = isSelected ? '#4ade80' : isInGroup ? '#86efac' : isHovered ? '#fef08a' : baseColor;
  const outlineColor = isSelected ? '#16a34a' : isInGroup ? '#22c55e' : '';

  const texTop = useMemo(() => getLabelTexture(item.product_name, origL * 0.9, origW * 0.9), [item.product_name, origL, origW]);
  const texFront = useMemo(() => getLabelTexture(item.product_name, origL * 0.9, Math.min(origH * 0.5, origL * 0.45)), [item.product_name, origL, origH]);
  const texSide = useMemo(() => getLabelTexture(item.product_name, origW * 0.9, Math.min(origH * 0.5, origW * 0.45)), [item.product_name, origW, origH]);

  return (
    <group position={[x + l / 2, y + h / 2, z + w / 2]}>
      {/* Rotated Physical Model */}
      <group rotation={[item.rot_x * Math.PI / 180, item.rot_y * Math.PI / 180, item.rot_z * Math.PI / 180]}>
        <mesh
          onClick={(e) => { e.stopPropagation(); onSelect(item); }}
          onPointerEnter={() => onHover(item)}
          onPointerLeave={() => onHover(null)}
          onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
          castShadow receiveShadow
        >
          <boxGeometry args={[origL, origH, origW]} />
          <meshStandardMaterial color={displayColor} roughness={0.7} />
        </mesh>

        {/* Dark bottom face */}
        <mesh position={[0, -origH / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[origL, origW]} />
          <meshBasicMaterial color="#374151" />
        </mesh>

        {/* Labels */}
        <mesh position={[0, origH / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[origL * 0.9, origW * 0.9]} />
          <meshBasicMaterial map={texTop} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, origW / 2 + 0.001]}>
          <planeGeometry args={[origL * 0.9, Math.min(origH * 0.5, origL * 0.45)]} />
          <meshBasicMaterial map={texFront} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -origW / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[origL * 0.9, Math.min(origH * 0.5, origL * 0.45)]} />
          <meshBasicMaterial map={texFront} transparent depthWrite={false} />
        </mesh>
        <mesh position={[-origL / 2 - 0.001, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[origW * 0.9, Math.min(origH * 0.5, origW * 0.45)]} />
          <meshBasicMaterial map={texSide} transparent depthWrite={false} />
        </mesh>
        <mesh position={[origL / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[origW * 0.9, Math.min(origH * 0.5, origW * 0.45)]} />
          <meshBasicMaterial map={texSide} transparent depthWrite={false} />
        </mesh>

        {/* This Side Up Icons */}
        {item.this_side_up && (
          <group>
            <mesh position={[0, origH / 4, origW / 2 + 0.002]}>
              <planeGeometry args={[Math.min(origL, origH) * 0.3, Math.min(origL, origH) * 0.3]} />
              <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
            </mesh>
            <mesh position={[0, origH / 4, -origW / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[Math.min(origL, origH) * 0.3, Math.min(origL, origH) * 0.3]} />
              <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
            </mesh>
            <mesh position={[-origL / 2 - 0.002, origH / 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[Math.min(origW, origH) * 0.3, Math.min(origW, origH) * 0.3]} />
              <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
            </mesh>
            <mesh position={[origL / 2 + 0.002, origH / 4, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[Math.min(origW, origH) * 0.3, Math.min(origW, origH) * 0.3]} />
              <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* Bottom strip indicator on 4 sides */}
        {[
          { pos: [0, -origH / 2 + Math.min(origH * 0.08, 0.05), origW / 2 + 0.002] as [number, number, number], rot: undefined, sz: origL },
          { pos: [0, -origH / 2 + Math.min(origH * 0.08, 0.05), -origW / 2 - 0.002] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], sz: origL },
          { pos: [-origL / 2 - 0.002, -origH / 2 + Math.min(origH * 0.08, 0.05), 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], sz: origW },
          { pos: [origL / 2 + 0.002, -origH / 2 + Math.min(origH * 0.08, 0.05), 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], sz: origW },
        ].map((s, i) => (
          <mesh key={i} position={s.pos} rotation={s.rot}>
            <planeGeometry args={[s.sz, Math.min(origH * 0.16, 0.1)]} />
            <meshBasicMaterial color={darkColor} />
          </mesh>
        ))}
      </group>

      {/* Selection/Group outline stays orthogonal */}
      {(isSelected || isInGroup) && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(l + 0.02, h + 0.02, w + 0.02)]} />
          <lineBasicMaterial color={outlineColor} linewidth={3} />
        </lineSegments>
      )}
    </group>
  );
}

// ── Placement Controller (Pick and Place) ────────────────────────────
function PlacementController({ containerLength, containerWidth, containerHeight, placementZones }: {
  containerLength: number; containerWidth: number; containerHeight: number;
  placementZones: PlacementZone[];
}) {
  const { camera, raycaster, gl } = useThree();
  const { isPlacing, setPlacing, layoutItems, selectedItemId, selectedGroupIds, updateLayoutItem, pushToHistory, projectConfig } = usePlannerStore();

  const groupOffsetsRef = useRef<Record<string, { dx: number; dz: number }>>({});

  useEffect(() => {
    if (!isPlacing || !selectedItemId) return;

    const item = layoutItems.find(i => i.id === selectedItemId);
    if (!item) return;

    // Calculate relative offsets for the entire column group
    const offsets: Record<string, { dx: number; dz: number }> = {};
    for (const gid of selectedGroupIds) {
      if (gid === selectedItemId) continue;
      const gi = layoutItems.find(i => i.id === gid);
      if (gi) offsets[gid] = { dx: gi.pos_x - item.pos_x, dz: gi.pos_z - item.pos_z };
    }
    groupOffsetsRef.current = offsets;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      // Intersect floor
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(floorPlane, intersection);
      if (!intersection) return;

      const targetX = intersection.x / S - item.length_cm / 2;
      const targetZ = intersection.z / S - item.width_cm / 2;

      let snappedZone: PlacementZone | null = null;
      let minDistance = Infinity;

      for (const zone of placementZones) {
        const dist = Math.sqrt(Math.pow(zone.x - targetX, 2) + Math.pow(zone.z - targetZ, 2));
        if (dist < minDistance) {
          minDistance = dist;
          snappedZone = zone;
        }
      }

      if (snappedZone) {
        updateLayoutItem(item.id, {
          pos_x: snappedZone.x,
          pos_y: snappedZone.y,
          pos_z: snappedZone.z,
          length_cm: snappedZone.l,
          width_cm: snappedZone.w,
          height_cm: snappedZone.h,
          rot_x: snappedZone.rot_x,
          rot_y: snappedZone.rot_y,
          rot_z: snappedZone.rot_z,
        });

        for (const gid of selectedGroupIds) {
          if (gid === selectedItemId) continue;
          const gi = layoutItems.find(i => i.id === gid);
          if (gi) {
            updateLayoutItem(gid, {
              pos_x: snappedZone.x + groupOffsetsRef.current[gid].dx,
              pos_y: gi.pos_y - item.pos_y + snappedZone.y,
              pos_z: snappedZone.z + groupOffsetsRef.current[gid].dz,
            });
          }
        }
      }
    };

    gl.domElement.addEventListener('pointermove', handlePointerMove);

    return () => {
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isPlacing, selectedItemId, selectedGroupIds, layoutItems, camera, raycaster, gl, placementZones, updateLayoutItem, pushToHistory, setPlacing]);

  return null;
}

// ── XYZ Debug Info ───────────────────────────────────────────────────
function XYZDebugOverlay({ controlsRef }: { controlsRef: any }) {
  const { camera } = useThree();
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    if (camera) {
      setPos({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }
  });

  return (
    <Html>
      <div style={{
        position: 'fixed', bottom: 10, right: 10,
        background: 'rgba(0,0,0,0.7)', color: '#0f0',
        padding: '5px 10px', borderRadius: '4px',
        fontFamily: 'monospace', fontSize: '12px',
        pointerEvents: 'none', zIndex: 9999,
        width: 'max-content'
      }}>
        Cam Pos - X: {(pos.x / S).toFixed(1)} | Y: {(pos.y / S).toFixed(1)} | Z: {(pos.z / S).toFixed(1)}
      </div>
    </Html>
  );
}

// ── Camera Controller ────────────────────────────────────────────────
function CameraController({ container, isDragging, onControlsReady }: { container: any; isDragging: boolean; onControlsReady: (ctrl: any) => void }) {
  const { cameraView, setCameraView } = usePlannerStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const l = container.length_cm * S, w = container.width_cm * S, h = container.height_cm * S;
  const cx = l / 2, cy = h / 2, cz = w / 2;

  useFrame(() => {
    if (cameraView !== 'default' && controlsRef.current) {
      const cam = camera as THREE.PerspectiveCamera;
      let dest: THREE.Vector3;
      if (cameraView === 'right') dest = new THREE.Vector3(l * CAPTURE_CAM_RIGHT.x, h * CAPTURE_CAM_RIGHT.y, w * CAPTURE_CAM_RIGHT.z);
      else if (cameraView === 'left') dest = new THREE.Vector3(l * CAPTURE_CAM_LEFT.x, h * CAPTURE_CAM_LEFT.y, w * CAPTURE_CAM_LEFT.z);
      else dest = new THREE.Vector3(cx, Math.max(l, w) * 1.5, cz); // top

      cam.position.lerp(dest, 0.05);
      controlsRef.current.target.lerp(new THREE.Vector3(cx, cy, cz), 0.05);
      controlsRef.current.update();
      if (cam.position.distanceTo(dest) < 0.1) setCameraView('default');
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={!isDragging}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2 - 0.05}
      screenSpacePanning={false}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      onChange={() => {
        if (controlsRef.current) {
          onControlsReady(controlsRef.current);
        }
      }}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────
export function ContainerViewer3D() {
  const {
    projectConfig, layoutItems, selectedItemId, selectedGroupIds,
    selectItem, contextMenu, showContextMenu, hideContextMenu,
    rotateItem, removeLayoutItem, pushToHistory,
  } = usePlannerStore();

  const [hoveredItem, setHoveredItem] = useState<LayoutItem | null>(null);
  const [controlsRef, setControlsRef] = useState<any>(null);
  const isPlacing = usePlannerStore(s => s.isPlacing);
  const isDragging = isPlacing;

  const container = projectConfig?.containerType;
  const L = container?.length_cm || 0;
  const W = container?.width_cm || 0;
  const H = container?.height_cm || 0;

  const handleSelect = (item: LayoutItem) => {
    const state = usePlannerStore.getState();
    if (state.isPlacing && state.selectedItemId === item.id) {
      state.setPlacing(false);
      state.pushToHistory();
    } else {
      state.selectItem(item.id);
      state.setPlacing(true);
    }
  };

  const placementZones = useMemo(() => {
    if (!selectedItemId || !isPlacing || !container) return [];
    const item = layoutItems.find(i => i.id === selectedItemId);
    if (!item) return [];
    return calculatePlacementZones(item, layoutItems, container, selectedGroupIds);
  }, [selectedItemId, isPlacing, layoutItems, container, selectedGroupIds]);

  const handleContextMenu = useCallback((e: ThreeEvent<MouseEvent>, item: LayoutItem) => {
    e.nativeEvent.preventDefault();
    e.nativeEvent.stopPropagation();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      showContextMenu(e.nativeEvent.clientX - rect.left, e.nativeEvent.clientY - rect.top, item.id);
    }
  }, [showContextMenu]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, []);

  if (!container) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#B5B5B5' }}>
        <p className="text-gray-600">Select or create a project to begin</p>
      </div>
    );
  }

  const camDist = Math.max(container.length_cm, container.width_cm, container.height_cm) * S * 1.5;

  const rotationButtons: Array<{ dir: RotateDirection; label: string; icon: string }> = [
    { dir: 'spin-right', label: 'Putar Kanan', icon: '↻' },
    { dir: 'spin-left', label: 'Putar Kiri', icon: '↺' },
    { dir: 'tip-forward', label: 'Putar Depan Bawah', icon: '⤵' },
    { dir: 'tip-backward', label: 'Putar Belakang Bawah', icon: '⤴' },
    { dir: 'tip-right', label: 'Putar Kanan Bawah', icon: '⤸' },
    { dir: 'tip-left', label: 'Putar Kiri Bawah', icon: '⤹' },
  ];

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: '#B5B5B5' }} ref={containerRef}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => {
          const state = usePlannerStore.getState();
          if (state.isPlacing) {
            state.setPlacing(false);
            state.pushToHistory();
          } else {
            state.selectItem(null);
            state.hideContextMenu();
          }
        }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        <PerspectiveCamera makeDefault position={[camDist * 0.8, camDist * 0.6, camDist * 0.8]} fov={50} />
        <color attach="background" args={['#B5B5B5']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-10, 5, -10]} intensity={0.3} />

        <ContainerBox length={container.length_cm} width={container.width_cm} height={container.height_cm} />

        {placementZones.length > 0 && (
          <PlacementZones zones={placementZones} />
        )}

        {layoutItems.map((item) => (
          <ProductBox
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            isInGroup={selectedGroupIds.includes(item.id) && selectedItemId !== item.id}
            isHovered={hoveredItem?.id === item.id}
            onSelect={handleSelect}
            onHover={setHoveredItem}
            onContextMenu={handleContextMenu}
          />
        ))}

        <PlacementController
          containerLength={L}
          containerWidth={W}
          containerHeight={H}
          placementZones={placementZones}
        />
        <Environment preset="city" />
        <CameraController container={container} isDragging={isDragging} onControlsReady={setControlsRef} />
        <XYZDebugOverlay controlsRef={controlsRef} />
      </Canvas>

      {contextMenu && (
        <div className="absolute z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-2 shadow-xl min-w-[200px]">
            <div className="text-xs text-gray-500 px-2 py-1 mb-1 font-medium">Rotate</div>
            {rotationButtons.map((btn) => (
              <button
                key={btn.dir}
                onClick={() => rotateItem(contextMenu.itemId, btn.dir)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="text-lg w-6 text-center">{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
            <div className="border-t border-gray-200 mt-1 pt-1">
              <button
                onClick={() => {
                  // Remove all items in the group
                  const store = usePlannerStore.getState();
                  const idsToRemove = store.selectedGroupIds.length > 0 ? store.selectedGroupIds : [contextMenu.itemId];
                  const newItems = store.layoutItems.filter(i => !idsToRemove.includes(i.id));
                  usePlannerStore.setState({ layoutItems: newItems, selectedItemId: null, selectedGroupIds: [], contextMenu: null });
                  pushToHistory();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <span className="text-lg w-6 text-center">🗑️</span>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function darkenColor(hex: string, factor: number): string {
  const c = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((c >> 16) & 255) * (1 - factor));
  const g = Math.round(((c >> 8) & 255) * (1 - factor));
  const b = Math.round((c & 255) * (1 - factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
