import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Canvas, useThree, ThreeEvent, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import {
  usePlannerStore,
  LayoutItem,
  RotateDirection,
  PlacementZone,
  calculatePlacementZones,
} from "../store/plannerStore";

// ── Scale factor ─────────────────────────────────────────────────────
const S = 0.01;

// ── PDF Capture Camera Positions ─────────────────────────────────────
// Define positions for each container code (20FT, 40FT, 40HC, 45HC)
// Coordinate values will be multiplied by scale S
//
// Each view is { pos, target }. `target` is the look-at/pivot point
// ("titik nol") — if omitted it falls back to the exact container
// center. To tune a view:
//   1. Open the viewer, use the on-screen X/Y/Z debug readout (bottom
//      right) — it shows both camera position AND the current
//      pivot/target in real container cm.
//   2. Left-click-drag (PAN) until the framing looks right (Alt+drag
//      to orbit if you also need to check the angle).
//   3. Read the "Cam Pos" and "Target/0" lines and paste those cm
//      values into a view below, e.g.
//      { pos: new THREE.Vector3(1152.2 * S, 460.1 * S, 602.7 * S),
//        target: new THREE.Vector3(881.0 * S, 134.5 * S, 206.8 * S) }
//
// All these container codes share the same 235cm width, so once one
// side (left or right) is tuned, the other can be derived by mirroring
// across the width instead of being tuned separately — see
// mirrorAcrossWidth below.
const CONTAINER_WIDTH_CM = 235;

interface CaptureView {
  pos: THREE.Vector3;
  target?: THREE.Vector3;
}
interface CaptureConfig {
  left: CaptureView;
  right: CaptureView;
  top: CaptureView;
}

/**
 * Mirrors a tuned view across the container's width (Z axis) to get
 * the opposite-side vantage point — same forward offset (X) and
 * height (Y), just flipped to face the other wall (Z). This is the
 * "calculation" for deriving the reverse/"baliknya" view instead of
 * guessing new numbers by hand: mirroredZ = containerWidth - originalZ
 * (in the same scaled units), applied to both the camera position and
 * its target.
 */
function mirrorAcrossWidth(view: CaptureView): CaptureView {
  const widthScaled = CONTAINER_WIDTH_CM * S;
  return {
    pos: new THREE.Vector3(view.pos.x, view.pos.y, widthScaled - view.pos.z),
    target: view.target
      ? new THREE.Vector3(
          view.target.x,
          view.target.y,
          widthScaled - view.target.z,
        )
      : undefined,
  };
}

// 40HC "left" view tuned by hand via the debug overlay readout
// (Cam Pos - X: 1152.2 | Y: 460.1 | Z: 602.7,
//  Target/0 - X: 881.0 | Y: 134.5 | Z: 206.8). "right" is derived by
// mirroring it across the container width rather than tuned again from
// scratch.
const HC40HC_LEFT: CaptureView = {
  pos: new THREE.Vector3(1152.2 * S, 460.1 * S, 602.7 * S),
  target: new THREE.Vector3(881.0 * S, 134.5 * S, 206.8 * S),
};

const HC20_LEFT: CaptureView = {
  pos: new THREE.Vector3(464.8 * S, 381.0 * S, 502.6 * S),
  target: new THREE.Vector3(290.6 * S, 0.0 * S, 27.8 * S),
};

const CAPTURE_CAM_POS: Record<string, CaptureConfig> = {
  "40HC": {
    left: HC40HC_LEFT,
    right: mirrorAcrossWidth(HC40HC_LEFT),
    top: { pos: new THREE.Vector3(1546.9 * S, 603.4 * S, 87.6 * S) },
  },
  "20FT": {
    left: HC20_LEFT,
    right: mirrorAcrossWidth(HC20_LEFT),
    top: { pos: new THREE.Vector3(600 * S, 800 * S, 0 * S) },
  },
  "40FT": {
    left: { pos: new THREE.Vector3(1080 * S, 520 * S, 650 * S) },
    right: { pos: new THREE.Vector3(1080 * S, 520 * S, -650 * S) },
    top: { pos: new THREE.Vector3(1560 * S, 850 * S, 80 * S) },
  },
  "45HC": {
    left: { pos: new THREE.Vector3(1200 * S, 550 * S, 700 * S) },
    right: { pos: new THREE.Vector3(1200 * S, 550 * S, -700 * S) },
    top: { pos: new THREE.Vector3(1700 * S, 900 * S, 85 * S) },
  },
};

// ── Texture Cache ────────────────────────────────────────────────────
const textureCache: Record<string, THREE.CanvasTexture> = {};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const explicitLines = text.split("//");
  const lines: string[] = [];

  for (let j = 0; j < explicitLines.length; j++) {
    let part = explicitLines[j].trim();
    if (j < explicitLines.length - 1) {
      part += " //";
    }

    if (part === "") continue;

    const words = part.split(" ");
    let current = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const test = current + " " + words[i];
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

export function getLabelTexture(
  label: string,
  w: number,
  h: number,
): THREE.CanvasTexture {
  const key = `${label}_${w}_${h}`;
  if (textureCache[key]) return textureCache[key];

  const canvas = document.createElement("canvas");
  const scale = 1000 / Math.max(w, h, 1);
  const cw = w * scale;
  const ch = h * scale;
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

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
  ctx.fillStyle = "#111827";
  ctx.font = `bold ${bestSize}px Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const lh = bestSize * 1.1;
  const totalTextHeight = bestLines.length * lh;
  const extraSpace = ch - totalTextHeight;
  const spacing =
    bestLines.length > 1 ? extraSpace / (bestLines.length + 1) : 0;

  let currentY = bestLines.length > 1 ? spacing + lh / 2 : ch / 2;

  bestLines.forEach((line) => {
    ctx.fillText(line, cw * 0.05, currentY);
    if (bestLines.length > 1) currentY += lh + spacing;
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  textureCache[key] = tex;
  return tex;
}

/**
 * Standard "This Way Up" shipping pictogram: two parallel arrows
 * pointing up (as seen on real shipping cartons), so it reads clearly
 * even when the box has been laid down on its side — the icon always
 * marks which face is the original "up" face, whether the box is
 * standing upright or lying down.
 */
export function getUpArrowTexture(): THREE.CanvasTexture {
  if (textureCache["__up_arrow"]) return textureCache["__up_arrow"];
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 512);

  ctx.fillStyle = "#000000";

  const drawArrow = (cx: number) => {
    const shaftW = 34;
    const headW = 76;
    const tipY = 70;
    const headY = 230;
    const shaftBottomY = 430;

    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - headW / 2, headY);
    ctx.lineTo(cx - shaftW / 2, headY);
    ctx.lineTo(cx - shaftW / 2, shaftBottomY);
    ctx.lineTo(cx + shaftW / 2, shaftBottomY);
    ctx.lineTo(cx + shaftW / 2, headY);
    ctx.lineTo(cx + headW / 2, headY);
    ctx.closePath();
    ctx.fill();
  };

  // Two parallel arrows, standard "This Side Up" pictogram layout
  drawArrow(190);
  drawArrow(322);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  textureCache["__up_arrow"] = tex;
  return tex;
}

// ── Container Box ────────────────────────────────────────────────────
function ContainerBox({
  length,
  width,
  height,
}: {
  length: number;
  width: number;
  height: number;
}) {
  const l = length * S,
    w = width * S,
    h = height * S;
  return (
    <group>
      <mesh
        position={[l / 2, 0, w / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[l, w]} />
        <meshStandardMaterial color="#8C8980" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[0, h / 2, w / 2]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#D4D3D1" side={THREE.FrontSide} />
      </mesh>
      <mesh
        position={[l, h / 2, w / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
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
        <mesh
          key={i}
          position={[
            zone.x * S + (zone.l * S) / 2,
            zone.y * S + 0.005,
            zone.z * S + (zone.w * S) / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[zone.l * S, zone.w * S]} />
          <meshBasicMaterial
            color="#22c55e"
            transparent
            opacity={0.6}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
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

function ProductBox({
  item,
  isSelected,
  isInGroup,
  isHovered,
  onSelect,
  onHover,
  onContextMenu,
}: ProductBoxProps) {
  // Current bounding box
  const l = item.length_cm * S,
    w = item.width_cm * S,
    h = item.height_cm * S;
  const x = item.pos_x * S,
    y = item.pos_y * S,
    z = item.pos_z * S;

  // Original dimensions for geometry
  const product = usePlannerStore((s) =>
    s.products.find((p) => p.id === item.product_id),
  );
  const origL = (product?.length_cm || item.length_cm) * S;
  const origW = (product?.width_cm || item.width_cm) * S;
  const origH = (product?.height_cm || item.height_cm) * S;

  const baseColor = item.color_hex || "#fde047";
  const darkColor = darkenColor(baseColor, 0.6);
  const displayColor = isSelected
    ? "#4ade80"
    : isInGroup
      ? "#86efac"
      : isHovered
        ? "#fef08a"
        : baseColor;
  const outlineColor = isSelected ? "#16a34a" : isInGroup ? "#22c55e" : "";

  const texTop = useMemo(
    () => getLabelTexture(item.product_name, origL * 0.9, origW * 0.9),
    [item.product_name, origL, origW],
  );
  const texFront = useMemo(
    () =>
      getLabelTexture(
        item.product_name,
        origL * 0.9,
        Math.min(origH * 0.5, origL * 0.45),
      ),
    [item.product_name, origL, origH],
  );
  const texSide = useMemo(
    () =>
      getLabelTexture(
        item.product_name,
        origW * 0.9,
        Math.min(origH * 0.5, origW * 0.45),
      ),
    [item.product_name, origW, origH],
  );

  return (
    <group position={[x + l / 2, y + h / 2, z + w / 2]}>
      {/* Rotated Physical Model */}
      <group
        rotation={[
          (item.rot_x * Math.PI) / 180,
          (item.rot_y * Math.PI) / 180,
          (item.rot_z * Math.PI) / 180,
        ]}
      >
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          onPointerEnter={() => onHover(item)}
          onPointerLeave={() => onHover(null)}
          onContextMenu={(e) => {
            e.stopPropagation();
            onContextMenu(e, item);
          }}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[origL, origH, origW]} />
          <meshStandardMaterial color={displayColor} roughness={0.7} />
        </mesh>

        {/* Black outline for every individual product */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(origL, origH, origW)]} />
          <lineBasicMaterial color="#111111" />
        </lineSegments>

        {/* Dark bottom face — marks the product's original underside.
            Two things had to be right for this to actually render:
            1) rotation +Math.PI/2 (NOT -Math.PI/2 like the top face) so
               the plane's normal faces DOWN (-Y) instead of up/into the
               box (that was the first bug, already fixed).
            2) the epsilon offset must push OUTWARD, i.e. MORE negative
               (-origH/2 - 0.001), same as every other face on its
               negative side (compare the "back" face below, which
               correctly subtracts). The previous "+0.001" pushed it
               INWARD instead, so the box's own opaque bottom surface
               (sitting right at -origH/2) was always nearer to a
               camera below and won the depth test — the dark plane was
               being fully hidden behind it regardless of the rotation
               fix. DoubleSide stays as a safety net. */}
        <mesh
          position={[0, -origH / 2 - 0.001, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[origL, origW]} />
          <meshBasicMaterial color={darkColor} side={THREE.DoubleSide} />
        </mesh>

        {/* Labels */}
        <mesh
          position={[0, origH / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[origL * 0.9, origW * 0.9]} />
          <meshBasicMaterial map={texTop} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, origW / 2 + 0.001]}>
          <planeGeometry
            args={[origL * 0.9, Math.min(origH * 0.5, origL * 0.45)]}
          />
          <meshBasicMaterial map={texFront} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -origW / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry
            args={[origL * 0.9, Math.min(origH * 0.5, origL * 0.45)]}
          />
          <meshBasicMaterial map={texFront} transparent depthWrite={false} />
        </mesh>
        <mesh
          position={[-origL / 2 - 0.001, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry
            args={[origW * 0.9, Math.min(origH * 0.5, origW * 0.45)]}
          />
          <meshBasicMaterial map={texSide} transparent depthWrite={false} />
        </mesh>
        <mesh
          position={[origL / 2 + 0.001, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry
            args={[origW * 0.9, Math.min(origH * 0.5, origW * 0.45)]}
          />
          <meshBasicMaterial map={texSide} transparent depthWrite={false} />
        </mesh>

        {/* This Side Up Icons */}
        {item.this_side_up && (
          <group>
            <mesh position={[0, origH / 4, origW / 2 + 0.002]}>
              <planeGeometry
                args={[
                  Math.min(origL, origH) * 0.3,
                  Math.min(origL, origH) * 0.3,
                ]}
              />
              <meshBasicMaterial
                map={getUpArrowTexture()}
                transparent
                depthWrite={false}
              />
            </mesh>
            <mesh
              position={[0, origH / 4, -origW / 2 - 0.002]}
              rotation={[0, Math.PI, 0]}
            >
              <planeGeometry
                args={[
                  Math.min(origL, origH) * 0.3,
                  Math.min(origL, origH) * 0.3,
                ]}
              />
              <meshBasicMaterial
                map={getUpArrowTexture()}
                transparent
                depthWrite={false}
              />
            </mesh>
            <mesh
              position={[-origL / 2 - 0.002, origH / 4, 0]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <planeGeometry
                args={[
                  Math.min(origW, origH) * 0.3,
                  Math.min(origW, origH) * 0.3,
                ]}
              />
              <meshBasicMaterial
                map={getUpArrowTexture()}
                transparent
                depthWrite={false}
              />
            </mesh>
            <mesh
              position={[origL / 2 + 0.002, origH / 4, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <planeGeometry
                args={[
                  Math.min(origW, origH) * 0.3,
                  Math.min(origW, origH) * 0.3,
                ]}
              />
              <meshBasicMaterial
                map={getUpArrowTexture()}
                transparent
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        {/* Bottom strip indicator on 4 sides */}
        {[
          {
            pos: [
              0,
              -origH / 2 + Math.min(origH * 0.08, 0.05),
              origW / 2 + 0.002,
            ] as [number, number, number],
            rot: undefined,
            sz: origL,
          },
          {
            pos: [
              0,
              -origH / 2 + Math.min(origH * 0.08, 0.05),
              -origW / 2 - 0.002,
            ] as [number, number, number],
            rot: [0, Math.PI, 0] as [number, number, number],
            sz: origL,
          },
          {
            pos: [
              -origL / 2 - 0.002,
              -origH / 2 + Math.min(origH * 0.08, 0.05),
              0,
            ] as [number, number, number],
            rot: [0, -Math.PI / 2, 0] as [number, number, number],
            sz: origW,
          },
          {
            pos: [
              origL / 2 + 0.002,
              -origH / 2 + Math.min(origH * 0.08, 0.05),
              0,
            ] as [number, number, number],
            rot: [0, Math.PI / 2, 0] as [number, number, number],
            sz: origW,
          },
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
          <edgesGeometry
            args={[new THREE.BoxGeometry(l + 0.02, h + 0.02, w + 0.02)]}
          />
          <lineBasicMaterial color={outlineColor} linewidth={3} />
        </lineSegments>
      )}
    </group>
  );
}

// ── Placement Controller (Pick and Place) ────────────────────────────
function PlacementController({
  containerLength,
  containerWidth,
  containerHeight,
  placementZones,
}: {
  containerLength: number;
  containerWidth: number;
  containerHeight: number;
  placementZones: PlacementZone[];
}) {
  const { camera, raycaster, gl } = useThree();
  const {
    isPlacing,
    setPlacing,
    layoutItems,
    selectedItemId,
    selectedGroupIds,
    updateLayoutItem,
    pushToHistory,
  } = usePlannerStore();

  const groupOffsetsRef = useRef<Record<string, { dx: number; dz: number }>>(
    {},
  );

  useEffect(() => {
    if (!isPlacing || !selectedItemId) return;

    const item = layoutItems.find((i) => i.id === selectedItemId);
    if (!item) return;

    // Calculate relative offsets for the entire column group
    const offsets: Record<string, { dx: number; dz: number }> = {};
    for (const gid of selectedGroupIds) {
      if (gid === selectedItemId) continue;
      const gi = layoutItems.find((i) => i.id === gid);
      if (gi)
        offsets[gid] = { dx: gi.pos_x - item.pos_x, dz: gi.pos_z - item.pos_z };
    }
    groupOffsetsRef.current = offsets;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
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
        const dist = Math.sqrt(
          Math.pow(zone.x - targetX, 2) + Math.pow(zone.z - targetZ, 2),
        );
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
          const gi = layoutItems.find((i) => i.id === gid);
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

    gl.domElement.addEventListener("pointermove", handlePointerMove);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
    };
  }, [
    isPlacing,
    selectedItemId,
    selectedGroupIds,
    layoutItems,
    camera,
    raycaster,
    gl,
    placementZones,
    updateLayoutItem,
    pushToHistory,
    setPlacing,
  ]);

  return null;
}

// ── XYZ Debug Info ───────────────────────────────────────────────────
// Shows the live camera position AND the orbit pivot/"titik nol" in
// real container cm, so a good framing found by hand (left-click PAN)
// can be read off and pasted into CAPTURE_CAM_POS above for a
// repeatable report view. Toggle with Shift+D; see debugOverlayVisible
// in the store for how to turn it off by default for production.
function XYZDebugOverlay({
  controlsRef,
  containerCode,
}: {
  controlsRef: any;
  containerCode?: string;
}) {
  const { camera } = useThree();
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [target, setTarget] = useState({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    if (camera) {
      setPos({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      });
    }
    if (controlsRef?.target) {
      setTarget({
        x: controlsRef.target.x,
        y: controlsRef.target.y,
        z: controlsRef.target.z,
      });
    }
  });

  return (
    <Html>
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          background: "rgba(0,0,0,0.75)",
          color: "#0f0",
          padding: "6px 10px",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "11px",
          pointerEvents: "none",
          zIndex: 9999,
          width: "max-content",
          lineHeight: 1.6,
        }}
      >
        <div>Container: {containerCode || "-"}</div>
        <div>
          Cam Pos &nbsp;&nbsp;- X: {(pos.x / S).toFixed(1)} | Y:{" "}
          {(pos.y / S).toFixed(1)} | Z: {(pos.z / S).toFixed(1)}
        </div>
        <div>
          Target/0 &nbsp;- X: {(target.x / S).toFixed(1)} | Y:{" "}
          {(target.y / S).toFixed(1)} | Z: {(target.z / S).toFixed(1)}
        </div>
      </div>
    </Html>
  );
}

// ── Camera Controller ────────────────────────────────────────────────
function CameraController({
  container,
  isDragging,
  onControlsReady,
}: {
  container: any;
  isDragging: boolean;
  onControlsReady: (ctrl: any) => void;
}) {
  const { cameraView, setCameraView, viewRotateLocked } = usePlannerStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const l = container.length_cm * S,
    w = container.width_cm * S,
    h = container.height_cm * S;
  const cx = l / 2,
    cy = h / 2,
    cz = w / 2;

  // Jump the camera instantly to the requested capture view (no gradual
  // lerp/animation — that was the cause of blank/half-transitioned
  // screenshots because the PDF export grabbed the canvas before the
  // lerp had actually reached the destination).
  useEffect(() => {
    if (cameraView === "default" || !controlsRef.current) return;

    const cam = camera as THREE.PerspectiveCamera;
    const camConfig =
      CAPTURE_CAM_POS[container.code] || CAPTURE_CAM_POS["40HC"];

    let view: CaptureView;
    if (cameraView === "right") view = camConfig.right;
    else if (cameraView === "left") view = camConfig.left;
    else view = camConfig.top;

    // Use the view's tuned target/pivot ("titik nol") if one was set
    // above; otherwise fall back to the exact container center.
    const targetPoint = view.target
      ? view.target.clone()
      : new THREE.Vector3(cx, cy, cz);

    cam.position.copy(view.pos.clone());
    controlsRef.current.target.copy(targetPoint);
    controlsRef.current.update();
    cam.updateProjectionMatrix();

    // Signal that the camera is in place; PDF export waits for this via
    // the 'default' transition below plus a couple of rendered frames.
    setCameraView("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraView]);

  // Restore direct mouse camera control.
  // - Left drag  = orbit/rotate
  // - Right drag = orbit/rotate too (requested to restore right-click camera control)
  // - Middle / wheel = zoom
  // Plain right-click is still available for the product rotate menu; the
  // context-menu handler below ignores a right-drag once the pointer moves.
  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={!isDragging && !viewRotateLocked}
      rotateSpeed={0.8}
      minPolarAngle={0.05}
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
    projectConfig,
    layoutItems,
    selectedItemId,
    selectedGroupIds,
    contextMenu,
    showContextMenu,
    rotateItem,
    pushToHistory,
    transparentBackground,
    debugOverlayVisible,
    setDebugOverlayVisible,
  } = usePlannerStore();

  // Keyboard controls for the selected product:
  //  - Esc                 -> deselect (same as clicking the product
  //                            again / clicking empty space)
  //  - Delete / Backspace   -> remove the selected product (+ its
  //                            stacked column, same set the right-click
  //                            "Delete" menu removes)
  //  - Arrow Up/Down/L/R    -> tip/roll the product (same 6 rotations
  //                            as the right-click rotate menu)
  //  - Shift + Arrow        -> spin 90° around the vertical axis only
  //                            (heading change, e.g. east-west becomes
  //                            north-south — footprint/height unchanged)
  //  - Ctrl/Cmd + Arrow     -> slide the product across the floor,
  //                            clamped so it lands flush ("nempel")
  //                            against the wall/neighbor instead of
  //                            overlapping it
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        setDebugOverlayVisible(!usePlannerStore.getState().debugOverlayVisible);
        return;
      }

      if (isTypingTarget(e.target)) return;

      const state = usePlannerStore.getState();

      // Esc — cancel current selection, same as clicking the product
      // again / clicking empty space to deselect.
      if (e.key === "Escape") {
        if (state.isPlacing) {
          state.setPlacing(false);
        }
        state.selectItem(null);
        state.hideContextMenu();
        return;
      }

      // Everything below acts on the selected product. Note: selecting a
      // product (a single click) already puts it into "isPlacing" mode
      // (see handleSelect above), so we must NOT skip on isPlacing here —
      // that would block keyboard control almost every time something is
      // selected. Delete/rotate/nudge are safe to run in that mode too;
      // if the item is currently being drag-placed with the mouse, a
      // keyboard action here simply updates its position/rotation same
      // as a mouse drop would.
      if (!state.selectedItemId) return;

      const itemId = state.selectedItemId;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const idsToRemove =
          state.selectedGroupIds.length > 0 ? state.selectedGroupIds : [itemId];
        const newItems = state.layoutItems.filter(
          (i) => !idsToRemove.includes(i.id),
        );
        usePlannerStore.setState({
          layoutItems: newItems,
          selectedItemId: null,
          selectedGroupIds: [],
          contextMenu: null,
        });
        state.pushToHistory();
        return;
      }

      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrowKeys.includes(e.key)) return;
      e.preventDefault();

      // Ctrl/Cmd + Arrow — slide across the floor.
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "ArrowRight") state.nudgeItem(itemId, "x", 1);
        else if (e.key === "ArrowLeft") state.nudgeItem(itemId, "x", -1);
        else if (e.key === "ArrowUp") state.nudgeItem(itemId, "z", -1);
        else if (e.key === "ArrowDown") state.nudgeItem(itemId, "z", 1);
        return;
      }

      // Shift + Arrow — spin the heading only (90° around vertical axis).
      if (e.shiftKey) {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          state.rotateItem(itemId, "spin-right");
        } else {
          state.rotateItem(itemId, "spin-left");
        }
        return;
      }

      // Plain Arrow — tip/roll onto a side or back upright.
      if (e.key === "ArrowUp") state.rotateItem(itemId, "tip-forward");
      else if (e.key === "ArrowDown") state.rotateItem(itemId, "tip-backward");
      else if (e.key === "ArrowRight") state.rotateItem(itemId, "tip-right");
      else if (e.key === "ArrowLeft") state.rotateItem(itemId, "tip-left");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setDebugOverlayVisible]);

  const [hoveredItem, setHoveredItem] = useState<LayoutItem | null>(null);
  const [controlsRef, setControlsRef] = useState<any>(null);
  const isPlacing = usePlannerStore((s) => s.isPlacing);
  const isDragging = isPlacing;

  const container = projectConfig?.containerType;
  const L = container?.length_cm || 0;
  const W = container?.width_cm || 0;
  const H = container?.height_cm || 0;

  const handleSelect = useCallback((item: LayoutItem) => {
    const state = usePlannerStore.getState();
    if (state.isPlacing && state.selectedItemId === item.id) {
      state.setPlacing(false);
      state.pushToHistory();
    } else {
      state.selectItem(item.id);
      state.setPlacing(true);
    }
  }, []);

  const layoutItemsRef = useRef(layoutItems);
  useEffect(() => {
    if (!isPlacing) {
      layoutItemsRef.current = layoutItems;
    }
  }, [layoutItems, isPlacing]);

  const placementZones = useMemo(() => {
    if (!selectedItemId || !isPlacing || !container) return [];
    // Gunakan cached layoutItems agar kalkulasi rumit tidak jalan 60x per detik saat item digeser
    const items = layoutItemsRef.current;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return [];
    return calculatePlacementZones(
      item,
      items,
      container,
      selectedGroupIds,
    );
  }, [selectedItemId, isPlacing, container, selectedGroupIds]);

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>, item: LayoutItem) => {
      e.nativeEvent.preventDefault();
      e.nativeEvent.stopPropagation();

      // Right-drag belongs to camera pan. Only a click without meaningful
      // movement opens the product rotate menu.
      if (rightPointerRef.current.dragging) {
        return;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        usePlannerStore.getState().showContextMenu(
          e.nativeEvent.clientX - rect.left,
          e.nativeEvent.clientY - rect.top,
          item.id,
        );
      }
    },
    [],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Right mouse is used for camera pan, but a plain right-click should
  // still open the product rotate menu. Track whether the right button moved
  // far enough to be considered a camera drag.
  const rightPointerRef = useRef({ x: 0, y: 0, dragging: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      rightPointerRef.current = { x: e.clientX, y: e.clientY, dragging: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      if ((e.buttons & 2) === 0) return;
      const dx = e.clientX - rightPointerRef.current.x;
      const dy = e.clientY - rightPointerRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        rightPointerRef.current.dragging = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        // Keep the drag flag until contextmenu fires.
        window.setTimeout(() => {
          rightPointerRef.current = { x: 0, y: 0, dragging: false };
        }, 0);
      }
    };

    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointermove", onPointerMove, true);
    el.addEventListener("pointerup", onPointerUp, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointermove", onPointerMove, true);
      el.removeEventListener("pointerup", onPointerUp, true);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  const initialCamPos = useMemo(() => {
    if (!container) return new THREE.Vector3(10, 10, 10);
    const camDist =
      Math.max(container.length_cm, container.width_cm, container.height_cm) *
      S *
      1.5;
    return new THREE.Vector3(camDist * 0.8, camDist * 0.6, camDist * 0.8);
  }, [container]);

  if (!container) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: "#B5B5B5" }}
      >
        <p className="text-gray-600">Select or create a project to begin</p>
      </div>
    );
  }

  const rotationButtons: Array<{
    dir: RotateDirection;
    label: string;
    icon: string;
  }> = [
    { dir: "spin-right", label: "Putar Kanan", icon: "↻" },
    { dir: "spin-left", label: "Putar Kiri", icon: "↺" },
    { dir: "tip-forward", label: "Putar Depan Bawah", icon: "⤵" },
    { dir: "tip-backward", label: "Putar Belakang Bawah", icon: "⤴" },
    { dir: "tip-right", label: "Putar Kanan Bawah", icon: "⤸" },
    { dir: "tip-left", label: "Putar Kiri Bawah", icon: "⤹" },
  ];

  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: "#B5B5B5" }}
      ref={containerRef}
    >
      <Canvas
        style={{ width: "100%", height: "100%" }}
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
        gl={{ preserveDrawingBuffer: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={initialCamPos} fov={50} />
        {/* Skip the opaque grey clear color while a capture is in
            progress (see Toolbar's setTransparentBackground calls) so
            the exported PNG/PDF shows only the container, not the grey
            canvas backdrop. Normal on-screen viewing is unaffected. */}
        {!transparentBackground && (
          <color attach="background" args={["#B5B5B5"]} />
        )}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, 5, -10]} intensity={0.3} />

        <ContainerBox
          length={container.length_cm}
          width={container.width_cm}
          height={container.height_cm}
        />

        {placementZones.length > 0 && <PlacementZones zones={placementZones} />}

        {layoutItems.map((item) => (
          <ProductBox
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            isInGroup={
              selectedGroupIds.includes(item.id) && selectedItemId !== item.id
            }
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
        <CameraController
          container={container}
          isDragging={isDragging}
          onControlsReady={setControlsRef}
        />
        {debugOverlayVisible && (
          <XYZDebugOverlay
            controlsRef={controlsRef}
            containerCode={container.code}
          />
        )}
      </Canvas>

      {contextMenu && (
        <div
          className="absolute z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-2 shadow-xl min-w-[200px]">
            <div className="text-xs text-gray-500 px-2 py-1 mb-1 font-medium">
              Rotate
            </div>
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
                  const idsToRemove =
                    store.selectedGroupIds.length > 0
                      ? store.selectedGroupIds
                      : [contextMenu.itemId];
                  const newItems = store.layoutItems.filter(
                    (i) => !idsToRemove.includes(i.id),
                  );
                  usePlannerStore.setState({
                    layoutItems: newItems,
                    selectedItemId: null,
                    selectedGroupIds: [],
                    contextMenu: null,
                  });
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

function darkenColor(hex: string, factor: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((c >> 16) & 255) * (1 - factor));
  const g = Math.round(((c >> 8) & 255) * (1 - factor));
  const b = Math.round((c & 255) * (1 - factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
