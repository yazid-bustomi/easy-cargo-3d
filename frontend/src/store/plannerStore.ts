import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as THREE from 'three';
import { aiPackContainer } from '../utils/aiPackService';
import { projectService } from '../services/api';

// ── Types ────────────────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface ContainerType {
  id: number;
  code: string;
  name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  max_payload_kg: number;
  tare_weight_kg: number;
  is_system: boolean;
}

export interface Product {
  id: string;
  name: string;
  group: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
  qty: number;
  this_side_up: boolean;
  stackable: boolean;
  must_be_on_top: boolean;
  can_be_laid_down: boolean;
  color_hex: string;
}

export interface LayoutItem {
  id: string;
  product_id: string;
  product_name: string;
  instance_no: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rot_x: number;
  rot_y: number;
  rot_z: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
  color_hex: string;
  this_side_up: boolean;
  can_be_laid_down: boolean;
  stackable: boolean;
  must_be_on_top: boolean;
}

export interface ProjectConfig {
  name: string;
  containerType: ContainerType;
}

export interface LayoutStats {
  totalWeight: number;
  usedVolume: number;
  containerVolume: number;
  volumePercent: number;
  weightPercent: number;
  itemCount: number;
  freeMeters: number;
}

// ── Physics & Collision Helpers ──────────────────────────────────────

const TOLERANCE = 0.01;

/**
 * Centralized orientation rules — every place that needs "which
 * orientations are this item allowed to be placed in" must go through
 * this function so the three constraint flags are interpreted the
 * same way everywhere (auto-pack, manual placement zones, and manual
 * right-click rotation).
 *
 * Rules (as specified by the product owner):
 *  - this_side_up = true  -> the box's original "up" face must always
 *                             face up. It must NEVER be flipped upside
 *                             down or rotated onto its side.
 *  - this_side_up = true AND can_be_laid_down = true -> the box MAY be
 *                             laid on its side (rotated 90° so a side
 *                             face becomes the "floor"), but it must
 *                             never be turned upside down. Both the
 *                             standing orientation and the laid-down
 *                             orientation keep the original "up" face
 *                             pointing away from the ground, never
 *                             flipped/inverted.
 *  - this_side_up = false -> item can be freely rotated on any axis
 *                             (both laid down and flipped), independent
 *                             of can_be_laid_down.
 */
export interface OrientationOption {
  l: number; w: number; h: number;
  rx: number; ry: number; rz: number;
}

export function getAllowedOrientations(
  origL: number, origW: number, origH: number,
  thisSideUp: boolean, canBeLaidDown: boolean
): OrientationOption[] {
  const orientations: OrientationOption[] = [
    // Upright, facing the original direction
    { l: origL, w: origW, h: origH, rx: 0, ry: 0, rz: 0 },
    // Upright, rotated 90° around the vertical (Y) axis — always safe,
    // it never changes which face is up.
    { l: origW, w: origL, h: origH, rx: 0, ry: 90, rz: 0 },
  ];

  if (!thisSideUp) {
    // No "up face" restriction at all: every orientation, including
    // upside-down, is allowed.
    orientations.push(
      { l: origL, w: origH, h: origW, rx: 90, ry: 0, rz: 0 },
      { l: origH, w: origW, h: origL, rx: 0, ry: 0, rz: 90 },
      { l: origW, w: origH, h: origL, rx: 90, ry: 0, rz: 90 },
      { l: origH, w: origL, h: origW, rx: 0, ry: 90, rz: 90 },
      // 180° flips (upside down) at various headings
      { l: origL, w: origW, h: origH, rx: 180, ry: 0, rz: 0 },
      { l: origW, w: origL, h: origH, rx: 180, ry: 90, rz: 0 },
    );
  } else if (canBeLaidDown) {
    // Allowed to lie on a side face, but the original "up" face must
    // keep pointing outward/up — i.e. only 90° tips, never a 180° flip.
    orientations.push(
      { l: origL, w: origH, h: origW, rx: 90, ry: 0, rz: 0 },
      { l: origH, w: origW, h: origL, rx: 0, ry: 0, rz: 90 },
      { l: origW, w: origH, h: origL, rx: 90, ry: 0, rz: 90 },
      { l: origH, w: origL, h: origW, rx: 0, ry: 90, rz: 90 },
    );
  }
  // else: thisSideUp && !canBeLaidDown -> only the two upright
  // orientations above are allowed (never laid down, never flipped).

  // De-duplicate identical (footprint + rotation) combinations
  const seen = new Set<string>();
  return orientations.filter((o) => {
    const key = `${o.l}x${o.w}x${o.h}|${o.rx}|${o.ry}|${o.rz}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Whether a specific rotation (in degrees, Euler XYZ as stored on
 * LayoutItem) is allowed for an item with the given constraints.
 * Used to validate manual right-click rotation.
 */
export function isRotationAllowed(
  rotXDeg: number, rotYDeg: number, rotZDeg: number,
  thisSideUp: boolean, canBeLaidDown: boolean
): boolean {
  const norm = (d: number) => ((Math.round(d / 90) * 90) % 360 + 360) % 360;
  const rx = norm(rotXDeg);
  const rz = norm(rotZDeg);

  if (!thisSideUp) return true; // no restriction at all

  // this_side_up: the "up" face may only be reached by 0° or 90° tips
  // on X/Z (never 180°, which would flip it upside down).
  const isUpright = rx === 0 && rz === 0;
  const isNinetyTip = (rx === 90 || rx === 270 || rz === 90 || rz === 270) && !(rx !== 0 && rz !== 0);

  if (isUpright) return true;
  if (canBeLaidDown && isNinetyTip) return true;
  return false;
}

export function checkCollision(
  testItem: { id?: string; pos_x: number; pos_y: number; pos_z: number; length_cm: number; height_cm: number; width_cm: number },
  allItems: LayoutItem[],
  container?: ContainerType,
  ignoreIds?: string[]
): boolean {
  if (container) {
    if (
      testItem.pos_x < -TOLERANCE ||
      testItem.pos_y < -TOLERANCE ||
      testItem.pos_z < -TOLERANCE ||
      testItem.pos_x + testItem.length_cm > container.length_cm + TOLERANCE ||
      testItem.pos_y + testItem.height_cm > container.height_cm + TOLERANCE ||
      testItem.pos_z + testItem.width_cm > container.width_cm + TOLERANCE
    ) {
      return true;
    }
  }

  const txMin = testItem.pos_x;
  const txMax = testItem.pos_x + testItem.length_cm;
  const tyMin = testItem.pos_y;
  const tyMax = testItem.pos_y + testItem.height_cm;
  const tzMin = testItem.pos_z;
  const tzMax = testItem.pos_z + testItem.width_cm;

  for (const other of allItems) {
    if (testItem.id && other.id === testItem.id) continue;
    if (ignoreIds && ignoreIds.includes(other.id)) continue;

    const oxMin = other.pos_x;
    const oxMax = other.pos_x + other.length_cm;
    const oyMin = other.pos_y;
    const oyMax = other.pos_y + other.height_cm;
    const ozMin = other.pos_z;
    const ozMax = other.pos_z + other.width_cm;

    const xOverlap = txMin + TOLERANCE < oxMax && txMax - TOLERANCE > oxMin;
    const yOverlap = tyMin + TOLERANCE < oyMax && tyMax - TOLERANCE > oyMin;
    const zOverlap = tzMin + TOLERANCE < ozMax && tzMax - TOLERANCE > ozMin;

    if (xOverlap && yOverlap && zOverlap) {
      return true;
    }
  }

  return false;
}

export function calculateDropY(
  x: number,
  z: number,
  l: number,
  w: number,
  ignoreId: string | undefined,
  allItems: LayoutItem[],
  ignoreIds?: string[]
): number {
  let maxY = 0;
  const txMin = x;
  const txMax = x + l;
  const tzMin = z;
  const tzMax = z + w;

  for (const other of allItems) {
    if (ignoreId && other.id === ignoreId) continue;
    if (ignoreIds && ignoreIds.includes(other.id)) continue;

    const oxMin = other.pos_x;
    const oxMax = other.pos_x + other.length_cm;
    const ozMin = other.pos_z;
    const ozMax = other.pos_z + other.width_cm;

    const xOverlap = txMin + TOLERANCE < oxMax && txMax - TOLERANCE > oxMin;
    const zOverlap = tzMin + TOLERANCE < ozMax && tzMax - TOLERANCE > ozMin;

    if (xOverlap && zOverlap) {
      const topY = other.pos_y + other.height_cm;
      if (topY > maxY) {
        maxY = topY;
      }
    }
  }
  return Math.round(maxY * 100) / 100;
}

export function checkFullSupport(
  x: number,
  y: number,
  z: number,
  l: number,
  w: number,
  ignoreId: string | undefined,
  allItems: LayoutItem[],
  ignoreIds?: string[]
): boolean {
  if (y <= TOLERANCE) return true;

  let supportedArea = 0;
  const totalArea = l * w;

  const txMin = x;
  const txMax = x + l;
  const tzMin = z;
  const tzMax = z + w;

  for (const other of allItems) {
    if (ignoreId && other.id === ignoreId) continue;
    if (ignoreIds && ignoreIds.includes(other.id)) continue;

    const topY = other.pos_y + other.height_cm;
    if (Math.abs(topY - y) <= TOLERANCE) {
      // An item marked non-stackable (e.g. a thin-legged table) can
      // never provide support for something resting on top of it.
      if (other.stackable === false) continue;

      const oxMin = other.pos_x;
      const oxMax = other.pos_x + other.length_cm;
      const ozMin = other.pos_z;
      const ozMax = other.pos_z + other.width_cm;

      const ixMin = Math.max(txMin, oxMin);
      const ixMax = Math.min(txMax, oxMax);
      const izMin = Math.max(tzMin, ozMin);
      const izMax = Math.min(tzMax, ozMax);

      if (ixMax > ixMin && izMax > izMin) {
        supportedArea += (ixMax - ixMin) * (izMax - izMin);
      }
    }
  }

  return supportedArea >= totalArea * 0.99;
}

/**
 * Whether it's valid for something to rest ON TOP of `below` at all.
 *  - stackable = false  -> nothing may be placed above it (e.g. a table
 *                          with thin legs — items on top would crush it
 *                          or simply have nothing solid to rest on).
 *  - must_be_on_top = true on the item being placed -> that item must
 *                          sit at the highest free position for its
 *                          footprint (checked separately in the
 *                          placement search, not here).
 */
export function canRestOn(below: { stackable: boolean }): boolean {
  return below.stackable !== false;
}

// ── Keyboard Nudge (Ctrl+Arrow) ──────────────────────────────────────

// Distance (cm) a single Ctrl+Arrow press slides the selected product.
const NUDGE_STEP_CM = 5;

/**
 * Maximum distance an item can slide along a single horizontal axis
 * ("x" = container length, "z" = container width) in the given
 * direction before it would overlap the container wall or another
 * item. Only the perpendicular footprint + the vertical (Y) band are
 * checked, since sliding only ever changes one horizontal coordinate
 * and never the item's height/position on the Y axis.
 *
 * Used by nudgeItem so a keyboard slide always clamps to the nearest
 * obstacle instead of overshooting into it — the item lands flush
 * ("nempel") against the wall/neighbor exactly when it gets there.
 */
function computeMaxSlideDistance(
  item: LayoutItem,
  axis: 'x' | 'z',
  direction: 1 | -1,
  container: ContainerType,
  allItems: LayoutItem[],
  excludeIds: string[]
): number {
  const yMin = item.pos_y;
  const yMax = item.pos_y + item.height_cm;

  let limit: number;
  if (axis === 'x') {
    limit = direction > 0
      ? container.length_cm - (item.pos_x + item.length_cm)
      : item.pos_x;
  } else {
    limit = direction > 0
      ? container.width_cm - (item.pos_z + item.width_cm)
      : item.pos_z;
  }
  if (limit < 0) limit = 0;

  for (const other of allItems) {
    if (excludeIds.includes(other.id)) continue;

    const oyMin = other.pos_y;
    const oyMax = other.pos_y + other.height_cm;
    const yOverlap = yMin + TOLERANCE < oyMax && yMax - TOLERANCE > oyMin;
    if (!yOverlap) continue;

    if (axis === 'x') {
      const zMin = item.pos_z, zMax = item.pos_z + item.width_cm;
      const ozMin = other.pos_z, ozMax = other.pos_z + other.width_cm;
      const zOverlap = zMin + TOLERANCE < ozMax && zMax - TOLERANCE > ozMin;
      if (!zOverlap) continue;

      const gap = direction > 0
        ? other.pos_x - (item.pos_x + item.length_cm)
        : item.pos_x - (other.pos_x + other.length_cm);
      if (gap >= -TOLERANCE) {
        limit = Math.min(limit, Math.max(0, gap));
      }
    } else {
      const xMin = item.pos_x, xMax = item.pos_x + item.length_cm;
      const oxMin = other.pos_x, oxMax = other.pos_x + other.length_cm;
      const xOverlap = xMin + TOLERANCE < oxMax && xMax - TOLERANCE > oxMin;
      if (!xOverlap) continue;

      const gap = direction > 0
        ? other.pos_z - (item.pos_z + item.width_cm)
        : item.pos_z - (other.pos_z + other.width_cm);
      if (gap >= -TOLERANCE) {
        limit = Math.min(limit, Math.max(0, gap));
      }
    }
  }

  return limit;
}

// ── Column Grouping ──────────────────────────────────────────────────

export function getColumnGroup(itemId: string, allItems: LayoutItem[]): string[] {
  const baseItem = allItems.find(i => i.id === itemId);
  if (!baseItem) return [itemId];

  const group: string[] = [itemId];

  // Walk upward: find items stacked directly on top
  const findAbove = (currentItem: LayoutItem) => {
    const topY = currentItem.pos_y + currentItem.height_cm;
    
    for (const other of allItems) {
      if (group.includes(other.id)) continue;
      
      // Check if other sits exactly on top
      if (Math.abs(other.pos_y - topY) > TOLERANCE) continue;
      
      // Check XZ overlap (must overlap significantly)
      const ixMin = Math.max(currentItem.pos_x, other.pos_x);
      const ixMax = Math.min(currentItem.pos_x + currentItem.length_cm, other.pos_x + other.length_cm);
      const izMin = Math.max(currentItem.pos_z, other.pos_z);
      const izMax = Math.min(currentItem.pos_z + currentItem.width_cm, other.pos_z + other.width_cm);
      
      if (ixMax - ixMin > TOLERANCE && izMax - izMin > TOLERANCE) {
        const overlapArea = (ixMax - ixMin) * (izMax - izMin);
        const otherArea = other.length_cm * other.width_cm;
        
        // Must be fully supported by this item (or by the group)
        if (overlapArea >= otherArea * 0.99) {
          group.push(other.id);
          findAbove(other); // Recursively find items above this one
        }
      }
    }
  };

  findAbove(baseItem);
  
  return group;
}

// ── Placement Zone Calculator ────────────────────────────────────────

export interface PlacementZone {
  x: number;
  y: number;
  z: number;
  rot_x: number;
  rot_y: number;
  rot_z: number;
  l: number;
  w: number;
  h: number;
}

export function calculatePlacementZones(
  selectedItem: LayoutItem,
  allItems: LayoutItem[],
  container: ContainerType,
  ignoreIds: string[]
): PlacementZone[] {
  const zones: PlacementZone[] = [];
  
  const product = usePlannerStore.getState().products.find(p => p.id === selectedItem.product_id);
  if (!product) return [];

  const oL = product.length_cm;
  const oW = product.width_cm;
  const oH = product.height_cm;

  const orientations = getAllowedOrientations(
    oL, oW, oH,
    selectedItem.this_side_up,
    selectedItem.can_be_laid_down
  ).map(o => ({ l: o.l, w: o.w, h: o.h, rx: o.rx, ry: o.ry, rz: o.rz }));

  const filteredItems = allItems.filter(i => !ignoreIds.includes(i.id));

  for (const orient of orientations) {
    const { l, w, h, rx, ry, rz } = orient;
    
    // 0-Gap Edge Snapping Logic (Coordinate Compression)
    const xSet = new Set<number>([0]);
    const zSet = new Set<number>([0]);
    
    // Grid baseline
    for (let x = 0; x <= container.length_cm - l; x += 10) xSet.add(x);
    for (let z = 0; z <= container.width_cm - w; z += 10) zSet.add(z);
    
    // Exact edges from existing items
    for (const other of filteredItems) {
      if (other.pos_x >= 0 && other.pos_x <= container.length_cm - l) xSet.add(other.pos_x);
      if (other.pos_x + other.length_cm <= container.length_cm - l) xSet.add(other.pos_x + other.length_cm);
      if (other.pos_x - l >= 0) xSet.add(other.pos_x - l);
      
      if (other.pos_z >= 0 && other.pos_z <= container.width_cm - w) zSet.add(other.pos_z);
      if (other.pos_z + other.width_cm <= container.width_cm - w) zSet.add(other.pos_z + other.width_cm);
      if (other.pos_z - w >= 0) zSet.add(other.pos_z - w);
    }
    
    const xCandidates = Array.from(xSet).sort((a, b) => a - b);
    const zCandidates = Array.from(zSet).sort((a, b) => a - b);

    for (const x of xCandidates) {
      for (const z of zCandidates) {
        const dropY = calculateDropY(x, z, l, w, undefined, filteredItems);
        
        if (dropY + h > container.height_cm + TOLERANCE) continue;
        if (!checkFullSupport(x, dropY, z, l, w, undefined, filteredItems)) continue;
        
        const testItem = { pos_x: x, pos_y: dropY, pos_z: z, length_cm: l, width_cm: w, height_cm: h };
        if (!checkCollision(testItem, filteredItems, container)) {
          // Check if we already have a zone very close to this (deduplication)
          const isDuplicate = zones.some(z2 => 
            z2.l === l && z2.w === w && z2.h === h &&
            Math.abs(z2.x - x) < 0.1 && Math.abs(z2.z - z) < 0.1 && Math.abs(z2.y - dropY) < 0.1
          );
          
          if (!isDuplicate) {
            zones.push({ x, y: dropY, z, rot_x: rx, rot_y: ry, rot_z: rz, l, w, h });
          }
        }
      }
    }
  }

  return zones;
}

// ── Preset containers ────────────────────────────────────────────────

export const PRESET_CONTAINERS: ContainerType[] = [
  {
    id: 1, code: '20FT', name: "20' Standard",
    length_cm: 590, width_cm: 235, height_cm: 239,
    max_payload_kg: 28200, tare_weight_kg: 2300, is_system: true,
  },
  {
    id: 2, code: '40FT', name: "40' Standard",
    length_cm: 1203, width_cm: 235, height_cm: 239,
    max_payload_kg: 26680, tare_weight_kg: 3800, is_system: true,
  },
  {
    id: 3, code: '40HC', name: "40' High Cube",
    length_cm: 1203, width_cm: 235, height_cm: 269,
    max_payload_kg: 26460, tare_weight_kg: 4020, is_system: true,
  },
  {
    id: 4, code: '45HC', name: "45' High Cube",
    length_cm: 1351, width_cm: 235, height_cm: 269,
    max_payload_kg: 25600, tare_weight_kg: 4800, is_system: true,
  },
];

const PRODUCT_COLORS = [
  '#FDE047', '#86EFAC', '#93C5FD', '#FCA5A5', '#D8B4FE',
  '#F9A8D4', '#67E8F9', '#FDBA74', '#5EEAD4', '#A5B4FC',
];

let _idCounter = Date.now();
export function genId(): string {
  return (++_idCounter).toString(36);
}

// ── Rotation Direction Types ─────────────────────────────────────────

export type RotateDirection = 'spin-right' | 'spin-left' | 'tip-forward' | 'tip-backward' | 'tip-right' | 'tip-left';


// ── Rotation placement helper ─────────────────────────────────────────
// When a product is tipped/laid down, its footprint can grow into another
// item even though there is free space a little behind/in front/side of it.
// Search nearby X/Z positions instead of failing immediately at the old spot.
function findNearestValidPlacement(
  item: LayoutItem,
  testL: number,
  testW: number,
  testH: number,
  container: ContainerType,
  allItems: LayoutItem[],
): { x: number; y: number; z: number } | null {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const maxX = container.length_cm - testL;
  const maxZ = container.width_cm - testW;
  if (maxX < -TOLERANCE || maxZ < -TOLERANCE || testH > container.height_cm + TOLERANCE) {
    return null;
  }

  const startX = clamp(item.pos_x, 0, Math.max(0, maxX));
  const startZ = clamp(item.pos_z, 0, Math.max(0, maxZ));

  const candidates = new Map<string, { x: number; z: number; d2: number }>();
  const addCandidate = (x: number, z: number) => {
    x = clamp(x, 0, Math.max(0, maxX));
    z = clamp(z, 0, Math.max(0, maxZ));
    const key = `${Math.round(x * 100) / 100}|${Math.round(z * 100) / 100}`;
    if (!candidates.has(key)) {
      const dx = x - startX;
      const dz = z - startZ;
      candidates.set(key, { x, z, d2: dx * dx + dz * dz });
    }
  };

  // First test the original position.
  addCandidate(startX, startZ);

  // Search outward. A 5 cm grid gives smooth movement while remaining
  // practical for furniture-sized boxes.
  const maxRadius = Math.min(
    Math.max(container.length_cm, container.width_cm),
    300,
  );
  for (let r = 5; r <= maxRadius; r += 5) {
    addCandidate(startX - r, startZ);
    addCandidate(startX + r, startZ);
    addCandidate(startX, startZ - r);
    addCandidate(startX, startZ + r);
    addCandidate(startX - r, startZ - r);
    addCandidate(startX + r, startZ - r);
    addCandidate(startX - r, startZ + r);
    addCandidate(startX + r, startZ + r);
    if (r >= 100) break;
  }

  // Also try exact packing edges around existing products and container walls.
  addCandidate(0, startZ);
  addCandidate(maxX, startZ);
  addCandidate(startX, 0);
  addCandidate(startX, maxZ);

  for (const other of allItems) {
    if (other.id === item.id) continue;
    addCandidate(other.pos_x - testL, other.pos_z);
    addCandidate(other.pos_x + other.length_cm, other.pos_z);
    addCandidate(other.pos_x, other.pos_z - testW);
    addCandidate(other.pos_x, other.pos_z + other.width_cm);
  }

  const ordered = [...candidates.values()].sort((a, b) => a.d2 - b.d2);

  for (const c of ordered) {
    const y = calculateDropY(
      c.x,
      c.z,
      testL,
      testW,
      item.id,
      allItems,
    );

    if (y + testH > container.height_cm + TOLERANCE) continue;

    const testItem = {
      ...item,
      pos_x: c.x,
      pos_y: y,
      pos_z: c.z,
      length_cm: testL,
      width_cm: testW,
      height_cm: testH,
    };

    if (checkCollision(testItem, allItems, container)) continue;
    if (!checkFullSupport(c.x, y, c.z, testL, testW, item.id, allItems)) continue;

    return { x: c.x, y, z: c.z };
  }

  return null;
}

// ── Store ────────────────────────────────────────────────────────────

export interface PlannerState {
  user: { id: number; name: string; email: string; role: string } | null;
  projectPhase: 'setup' | 'working';
  projectConfig: ProjectConfig | null;
  products: Product[];
  layoutItems: LayoutItem[];
  selectedItemId: string | null;
  selectedGroupIds: string[];
  isPlacing: boolean;
  contextMenu: { x: number; y: number; itemId: string } | null;
  history: LayoutItem[][];
  historyIndex: number;
  isAutoPackLoading: boolean;
  cameraView: 'default' | 'top' | 'left' | 'right';
  aiApiKey: string;
  aiProvider: 'gemini' | 'openai';
  isGeneratingReport: boolean;
  transparentBackground: boolean;
  viewRotateLocked: boolean;
  debugOverlayVisible: boolean;
  lastSavedAt: number | null;
  // Project save/load state
  currentProjectId: number | null;
  isSaving: boolean;
  autoSaveEnabled: boolean;

  setProjectPhase: (phase: 'setup' | 'working') => void;
  setProjectConfig: (config: ProjectConfig) => void;
  goBackToSetup: () => void;

  addProduct: (product?: Partial<Product>) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  removeProduct: (productId: string) => void;
  updateAllInstances: (productId: string) => { success: boolean; message: string };
  clearProductInstances: (productId: string) => void;

  insertProductToContainer: (productId: string) => void;
  addLayoutItem: (item: LayoutItem) => void;
  updateLayoutItem: (itemId: string, updates: Partial<LayoutItem>) => void;
  removeLayoutItem: (itemId: string) => void;
  clearLayoutItems: () => void;
  selectItem: (id: string | null) => void;
  setPlacing: (isPlacing: boolean) => void;

  showContextMenu: (x: number, y: number, itemId: string) => void;
  hideContextMenu: () => void;

  rotateItem: (itemId: string, direction: RotateDirection) => void;
  nudgeItem: (itemId: string, axis: 'x' | 'z', direction: 1 | -1) => void;

  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
  setAutoPackLoading: (loading: boolean) => void;
  setCameraView: (view: 'default' | 'top' | 'left' | 'right') => void;
  setAiApiKey: (key: string) => void;
  setAiProvider: (provider: 'gemini' | 'openai') => void;
  setIsGeneratingReport: (val: boolean) => void;
  setTransparentBackground: (val: boolean) => void;
  setViewRotateLocked: (val: boolean) => void;
  setDebugOverlayVisible: (val: boolean) => void;
  markSaved: () => void;
  autoPackAll: () => void;
  aiAutoPack: (customPrompt?: string) => Promise<void>;
  getLayoutStats: () => LayoutStats;
  // Project save/load actions
  saveProject: () => Promise<void>;
  loadProject: (id: number) => Promise<void>;
  setCurrentProjectId: (id: number | null) => void;
  updateProjectName: (name: string) => void;
  duplicateProject: () => Promise<void>;
  setUser: (user: any) => void;
  logout: () => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
  projectPhase: 'setup',
  projectConfig: null,
  products: [],
  layoutItems: [],
  selectedItemId: null,
  selectedGroupIds: [],
  isPlacing: false,
  contextMenu: null,
  history: [[]],
  historyIndex: 0,
  isAutoPackLoading: false,
  cameraView: 'default',
  aiApiKey: '',
  aiProvider: 'gemini' as const,
  isGeneratingReport: false,
  transparentBackground: false,
  viewRotateLocked: false,
  // For production, either flip this to `false`, or leave it and rely
  // on the in-app Shift+D shortcut to hide it — either works, no other
  // code needs to change.
  debugOverlayVisible: true,
  lastSavedAt: null,
  currentProjectId: null,
  isSaving: false,
  autoSaveEnabled: true,
  user: null,

  setUser: (user) => set({ user }),
  logout: () => set({ user: null, projectPhase: 'setup', projectConfig: null }),

  setProjectPhase: (phase) => set({ projectPhase: phase }),

  setProjectConfig: (config) =>
    set({
      projectConfig: config,
      projectPhase: 'working',
      layoutItems: [],
      products: [],
    }),

  goBackToSetup: () =>
    set({
      projectPhase: 'setup',
      projectConfig: null,
      layoutItems: [],
      selectedItemId: null,
      selectedGroupIds: [],
      contextMenu: null,
      currentProjectId: null,
    }),

  addProduct: (productInfo) =>
    set((state) => {
      const colorIdx = state.products.length % PRODUCT_COLORS.length;
      const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const groupLetter = groupLetters[state.products.length % groupLetters.length];
      const newProduct: Product = {
        id: genId(),
        name: `Product ${state.products.length + 1}`,
        group: groupLetter,
        length_cm: 60,
        width_cm: 40,
        height_cm: 40,
        weight_kg: 15,
        qty: 1,
        this_side_up: false,
        stackable: true,
        must_be_on_top: false,
        can_be_laid_down: true,
        color_hex: PRODUCT_COLORS[colorIdx],
        ...productInfo,
      };
      return { products: [...state.products, newProduct] };
    }),

  updateProduct: (productId, updates) =>
    set((state) => {
      // Just update the product config. The actual layout items are unchanged until user hits Update All
      return {
        products: state.products.map((p) =>
          p.id === productId ? { ...p, ...updates } : p
        ),
      };
    }),

  removeProduct: (productId) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== productId),
      layoutItems: state.layoutItems.filter((i) => i.product_id !== productId),
    })),

  clearProductInstances: (productId) =>
    set((state) => {
      const updatedItems = state.layoutItems.filter((i) => i.product_id !== productId);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(updatedItems)));
      return { layoutItems: updatedItems, history: newHistory, historyIndex: newHistory.length - 1, selectedItemId: null, selectedGroupIds: [] };
    }),

  updateAllInstances: (productId) => {
    const state = get();
    const product = state.products.find(p => p.id === productId);
    const container = state.projectConfig?.containerType;
    if (!product || !container) return { success: false, message: "Invalid product or container." };

    // Check if new dimensions cause collision
    let hasCollision = false;
    const testItems = state.layoutItems.map(i => {
      if (i.product_id === productId) {
        // Assume default orientation for simplicity when updating
        return {
          ...i,
          product_name: product.name,
          color_hex: product.color_hex,
          this_side_up: product.this_side_up,
          can_be_laid_down: product.can_be_laid_down,
          stackable: product.stackable,
          must_be_on_top: product.must_be_on_top,
          length_cm: product.length_cm,
          width_cm: product.width_cm,
          height_cm: product.height_cm,
          weight_kg: product.weight_kg,
          rot_x: 0, rot_y: 0, rot_z: 0 // Reset rotation
        };
      }
      return i;
    });

    for (const testItem of testItems) {
      if (testItem.product_id === productId) {
        // Verify collision against everything else in testItems
        if (checkCollision(testItem, testItems, container)) {
          hasCollision = true;
          break;
        }
      }
    }

    if (hasCollision) {
      return { success: false, message: "Gagal merubah: Tidak cukup ruang / bentrok dengan posisi saat ini. Silakan hapus produk dari kontainer (Clear) terlebih dahulu." };
    }

    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(testItems)));
      return { layoutItems: testItems, history: newHistory, historyIndex: newHistory.length - 1 };
    });
    
    return { success: true, message: "Berhasil update ukuran di dalam kontainer." };
  },

  insertProductToContainer: (productId) =>
    set((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product || !state.projectConfig) return state;

      const insertedCount = state.layoutItems.filter((i) => i.product_id === productId).length;
      if (insertedCount >= product.qty) return state;

      const container = state.projectConfig.containerType;

      const orientations = getAllowedOrientations(
        product.length_cm,
        product.width_cm,
        product.height_cm,
        product.this_side_up,
        product.can_be_laid_down,
      );

      // Coordinate-compression candidates: use exact existing product edges
      // instead of a fixed 2 cm grid. This guarantees zero-gap placement
      // from the front-left corner and between neighboring products.
      let bestResult: {
        x: number;
        y: number;
        z: number;
        oi: number;
        score: [number, number, number];
      } | null = null;

      const addCandidate = (set: Set<number>, value: number, max: number) => {
        if (value >= -TOLERANCE && value <= max + TOLERANCE) {
          set.add(Math.max(0, Math.min(max, value)));
        }
      };

      for (let oi = 0; oi < orientations.length; oi++) {
        const { l, w, h } = orientations[oi];
        if (
          l > container.length_cm ||
          w > container.width_cm ||
          h > container.height_cm
        ) {
          continue;
        }

        const xSet = new Set<number>();
        const zSet = new Set<number>();
        const maxX = container.length_cm - l;
        const maxZ = container.width_cm - w;

        addCandidate(xSet, 0, maxX);
        addCandidate(zSet, 0, maxZ);

        for (const other of state.layoutItems) {
          addCandidate(xSet, other.pos_x, maxX);
          addCandidate(xSet, other.pos_x + other.length_cm, maxX);
          addCandidate(xSet, other.pos_x - l, maxX);

          addCandidate(zSet, other.pos_z, maxZ);
          addCandidate(zSet, other.pos_z + other.width_cm, maxZ);
          addCandidate(zSet, other.pos_z - w, maxZ);
        }

        const xCandidates = [...xSet].sort((a, b) => a - b);
        const zCandidates = [...zSet].sort((a, b) => a - b);

        for (const x of xCandidates) {
          for (const z of zCandidates) {
            const dropY = calculateDropY(
              x,
              z,
              l,
              w,
              undefined,
              state.layoutItems,
            );

            if (dropY + h > container.height_cm + TOLERANCE) continue;
            if (!checkFullSupport(
              x,
              dropY,
              z,
              l,
              w,
              undefined,
              state.layoutItems,
            )) continue;

            const testItem = {
              pos_x: x,
              pos_y: dropY,
              pos_z: z,
              length_cm: l,
              width_cm: w,
              height_cm: h,
            };

            if (checkCollision(testItem, state.layoutItems, container)) continue;

            // Priority:
            // 1. closest to front/deepest (X)
            // 2. closest to left (Z)
            // 3. lowest layer (Y)
            const score: [number, number, number] = [x, z, dropY];

            if (
              !bestResult ||
              score[0] < bestResult.score[0] - TOLERANCE ||
              (
                Math.abs(score[0] - bestResult.score[0]) <= TOLERANCE &&
                (
                  score[1] < bestResult.score[1] - TOLERANCE ||
                  (
                    Math.abs(score[1] - bestResult.score[1]) <= TOLERANCE &&
                    score[2] < bestResult.score[2] - TOLERANCE
                  )
                )
              )
            ) {
              bestResult = { x, y: dropY, z, oi, score };
            }
          }
        }
      }

      if (!bestResult) {
        alert("Ruang tidak cukup untuk produk ini!");
        return state;
      }

      const orient = orientations[bestResult.oi];

      const newItem: LayoutItem = {
        id: genId(),
        product_id: product.id,
        product_name: product.name,
        instance_no: insertedCount + 1,
        pos_x: bestResult.x,
        pos_y: bestResult.y,
        pos_z: bestResult.z,
        rot_x: orient.rx,
        rot_y: orient.ry,
        rot_z: orient.rz,
        length_cm: orient.l,
        width_cm: orient.w,
        height_cm: orient.h,
        weight_kg: product.weight_kg,
        color_hex: product.color_hex,
        this_side_up: product.this_side_up,
        can_be_laid_down: product.can_be_laid_down,
        stackable: product.stackable,
        must_be_on_top: product.must_be_on_top,
      };

      const updatedItems = [...state.layoutItems, newItem];
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(updatedItems)));

      return {
        layoutItems: updatedItems,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  addLayoutItem: (item) =>
    set((state) => ({
      layoutItems: [...state.layoutItems, item],
    })),

  updateLayoutItem: (itemId, updates) =>
    set((state) => ({
      layoutItems: state.layoutItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    })),

  removeLayoutItem: (itemId) =>
    set((state) => ({
      layoutItems: state.layoutItems.filter((item) => item.id !== itemId),
      selectedItemId: state.selectedItemId === itemId ? null : state.selectedItemId,
      selectedGroupIds: state.selectedGroupIds.filter(id => id !== itemId),
    })),

  clearLayoutItems: () =>
    set({ layoutItems: [], selectedItemId: null, selectedGroupIds: [], contextMenu: null }),

  selectItem: (id) => set({ selectedItemId: id, selectedGroupIds: id ? getColumnGroup(id, get().layoutItems) : [] }),
  setPlacing: (isPlacing) => set({ isPlacing }),

  showContextMenu: (x, y, itemId) => {
    const state = get();
    const groupIds = getColumnGroup(itemId, state.layoutItems);
    set({ contextMenu: { x, y, itemId }, selectedItemId: itemId, selectedGroupIds: groupIds });
  },

  hideContextMenu: () => set({ contextMenu: null }),

  rotateItem: (itemId, direction) =>
    set((state) => {
      const item = state.layoutItems.find((i) => i.id === itemId);
      const container = state.projectConfig?.containerType;
      const product = state.products.find((p) => p.id === item?.product_id);
      if (!item || !container || !product) return state;

      const origL = product.length_cm;
      const origW = product.width_cm;
      const origH = product.height_cm;

      const euler = new THREE.Euler(
        item.rot_x * Math.PI / 180,
        item.rot_y * Math.PI / 180,
        item.rot_z * Math.PI / 180,
        'XYZ'
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      const deltaQ = new THREE.Quaternion();
      switch (direction) {
        case 'spin-right':
          deltaQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
          break;
        case 'spin-left':
          deltaQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
          break;
        case 'tip-forward':
          deltaQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
          break;
        case 'tip-backward':
          deltaQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          break;
        case 'tip-right':
          deltaQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
          break;
        case 'tip-left':
          deltaQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
          break;
      }

      // Local-space rotation: keep the existing heading, then apply the
      // requested 90-degree spin/tip.
      quaternion.multiply(deltaQ);

      const newEuler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
      const normalizeDeg = (deg: number) => {
        const n = Math.round(deg / 90) * 90;
        return ((n % 360) + 360) % 360;
      };

      const newRotX = normalizeDeg(newEuler.x * 180 / Math.PI);
      const newRotY = normalizeDeg(newEuler.y * 180 / Math.PI);
      const newRotZ = normalizeDeg(newEuler.z * 180 / Math.PI);

      if (!isRotationAllowed(
        newRotX,
        newRotY,
        newRotZ,
        item.this_side_up,
        item.can_be_laid_down,
      )) {
        return { contextMenu: null };
      }

      // Compute the new axis-aligned footprint after the rotation.
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

      const testL = Math.round(
        Math.abs(right.x * origL) +
        Math.abs(up.x * origH) +
        Math.abs(forward.x * origW)
      );
      const testH = Math.round(
        Math.abs(right.y * origL) +
        Math.abs(up.y * origH) +
        Math.abs(forward.y * origW)
      );
      const testW = Math.round(
        Math.abs(right.z * origL) +
        Math.abs(up.z * origH) +
        Math.abs(forward.z * origW)
      );

      // Critical fix: do not require the rotated box to fit exactly where it
      // stood before. Search the nearest valid X/Z position and drop it onto
      // the floor / a fully supporting item. This allows a product in the
      // middle of a layout to be laid down into free space behind it.
      const placement = findNearestValidPlacement(
        item,
        testL,
        testW,
        testH,
        container,
        state.layoutItems,
      );

      if (!placement) {
        return { contextMenu: null };
      }

      const updatedItems = state.layoutItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              pos_x: placement.x,
              pos_y: placement.y,
              pos_z: placement.z,
              length_cm: testL,
              width_cm: testW,
              height_cm: testH,
              rot_x: newRotX,
              rot_y: newRotY,
              rot_z: newRotZ,
            }
          : i
      );

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(updatedItems)));
      if (newHistory.length > 50) newHistory.shift();

      return {
        layoutItems: updatedItems,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        contextMenu: null,
        selectedItemId: itemId,
        selectedGroupIds: getColumnGroup(itemId, updatedItems),
      };
    }),

  nudgeItem: (itemId, axis, direction) =>
    set((state) => {
      const container = state.projectConfig?.containerType;
      const item = state.layoutItems.find((i) => i.id === itemId);
      if (!item || !container) return state;

      const maxSlide = computeMaxSlideDistance(
        item, axis, direction, container, state.layoutItems, [itemId]
      );
      // Already flush against the wall/neighbor in this direction —
      // nothing to do.
      if (maxSlide <= TOLERANCE) return state;

      const delta = Math.min(NUDGE_STEP_CM, maxSlide);

      const updatedItems = state.layoutItems.map((i) =>
        i.id === itemId
          ? axis === 'x'
            ? { ...i, pos_x: Math.round((i.pos_x + direction * delta) * 100) / 100 }
            : { ...i, pos_z: Math.round((i.pos_z + direction * delta) * 100) / 100 }
          : i
      );

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(updatedItems)));
      if (newHistory.length > 50) newHistory.shift();

      return {
        layoutItems: updatedItems,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  pushToHistory: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(state.layoutItems)));
      if (newHistory.length > 50) newHistory.shift();
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          historyIndex: newIndex,
          layoutItems: JSON.parse(JSON.stringify(state.history[newIndex])),
          selectedItemId: null,
          selectedGroupIds: [],
          contextMenu: null,
        };
      }
      return state;
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          historyIndex: newIndex,
          layoutItems: JSON.parse(JSON.stringify(state.history[newIndex])),
          selectedItemId: null,
          selectedGroupIds: [],
          contextMenu: null,
        };
      }
      return state;
    }),

  setAutoPackLoading: (loading) => set({ isAutoPackLoading: loading }),

  setCameraView: (view) => set({ cameraView: view }),

  setAiApiKey: (key) => set({ aiApiKey: key }),
  setAiProvider: (provider) => set({ aiProvider: provider }),
  setIsGeneratingReport: (val) => set({ isGeneratingReport: val }),
  setTransparentBackground: (val) => set({ transparentBackground: val }),
  setViewRotateLocked: (val) => set({ viewRotateLocked: val }),
  setDebugOverlayVisible: (val) => set({ debugOverlayVisible: val }),
  markSaved: () => set({ lastSavedAt: Date.now() }),
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  saveProject: async () => {
    const state = get();
    if (!state.projectConfig || state.isSaving) return;

    set({ isSaving: true });
    try {
      const stats = state.getLayoutStats();
      const response = await projectService.save({
        id: state.currentProjectId,
        name: state.projectConfig.name,
        containerType: state.projectConfig.containerType,
        products: state.products,
        layoutItems: state.layoutItems,
        itemCount: stats.itemCount,
        totalWeightKg: stats.totalWeight,
        volumePercent: stats.volumePercent,
      });

      if (response.data.success) {
        set({
          currentProjectId: response.data.data.id,
          lastSavedAt: Date.now(),
          isSaving: false,
        });
      } else {
        console.error('Save failed:', response.data.error);
        set({ isSaving: false });
      }
    } catch (error) {
      console.error('Save project error:', error);
      set({ isSaving: false });
    }
  },

  loadProject: async (id: number) => {
    try {
      const response = await projectService.getById(id);
      if (!response.data.success) {
        alert('Gagal memuat project: ' + response.data.error);
        return;
      }

      const project = response.data.data;
      const containerType: ContainerType = project.containerType;

      set({
        projectPhase: 'working',
        projectConfig: {
          name: project.name,
          containerType,
        },
        products: project.products || [],
        layoutItems: project.layoutItems || [],
        currentProjectId: project.id,
        lastSavedAt: Date.now(),
        selectedItemId: null,
        selectedGroupIds: [],
        contextMenu: null,
        history: [JSON.parse(JSON.stringify(project.layoutItems || []))],
        historyIndex: 0,
      });
    } catch (error) {
      console.error('Load project error:', error);
      alert('Gagal memuat project dari database.');
    }
  },

  updateProjectName: (name) =>
    set((state) => ({
      projectConfig: state.projectConfig ? { ...state.projectConfig, name } : null,
    })),

  duplicateProject: async () => {
    const state = get();
    if (!state.projectConfig) return;
    set({
      currentProjectId: null,
      projectConfig: { ...state.projectConfig, name: state.projectConfig.name + " (Copy)" },
    });
    await get().saveProject();
    alert("Project berhasil diduplikasi!");
  },

  autoPackAll: () => {
    const state = get();
    const container = state.projectConfig?.containerType;
    if (!container || state.products.length === 0) return;

    set({ isAutoPackLoading: true });

    // Import and run bin packing (done async to not block UI)
    setTimeout(() => {
      try {
        const { packContainer } = require('../utils/binPacking');

        const packItems = state.products.map(p => ({
          productId: p.id,
          name: p.name,
          group: p.group,
          length: p.length_cm,
          width: p.width_cm,
          height: p.height_cm,
          weight: p.weight_kg,
          thisSideUp: p.this_side_up,
          stackable: p.stackable,
          mustBeOnTop: p.must_be_on_top,
          canBeLaidDown: p.can_be_laid_down,
          qty: p.qty,
          colorHex: p.color_hex,
        }));

        const result = packContainer(
          {
            length: container.length_cm,
            width: container.width_cm,
            height: container.height_cm,
            maxPayloadKg: container.max_payload_kg,
          },
          packItems
        );

        const newLayoutItems: LayoutItem[] = result.placed.map((p: any) => {
          const product = state.products.find(prod => prod.id === p.productId);
          return {
            id: genId(),
            product_id: p.productId,
            product_name: product?.name || 'Unknown',
            instance_no: p.instanceNo,
            pos_x: p.x,
            pos_y: p.y,
            pos_z: p.z,
            rot_x: p.rotX,
            rot_y: p.rotY,
            rot_z: p.rotZ,
            length_cm: p.length,
            width_cm: p.width,
            height_cm: p.height,
            weight_kg: product?.weight_kg || 0,
            color_hex: product?.color_hex || '#fde047',
            this_side_up: product?.this_side_up || false,
            can_be_laid_down: product?.can_be_laid_down ?? true,
            stackable: product?.stackable ?? true,
            must_be_on_top: product?.must_be_on_top || false,
          };
        });

        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newLayoutItems)));

        set({
          layoutItems: newLayoutItems,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isAutoPackLoading: false,
          selectedItemId: null,
          selectedGroupIds: [],
        });

        if (result.unplaced.length > 0) {
          const unplacedNames = result.unplaced.map((u: any) => {
            const prod = state.products.find(p => p.id === u.productId);
            return `${prod?.name || u.productId} (${u.qty} pcs)`;
          }).join(', ');
          alert(`Auto Pack selesai!\n\nTidak muat: ${unplacedNames}`);
        }
      } catch (error) {
        console.error('Auto pack error:', error);
        alert('Gagal melakukan auto pack: ' + (error as any).message);
        set({ isAutoPackLoading: false });
      }
    }, 50);
  },

  aiAutoPack: async (customPrompt: string = '') => {
    const state = get();
    const container = state.projectConfig?.containerType;
    if (!container || state.products.length === 0) return;
    if (!state.aiApiKey) {
      alert('Please set your AI API Key first.');
      return;
    }

    set({ isAutoPackLoading: true });

    try {
      const packItems = state.products.map(p => ({
        productId: p.id,
        name: p.name,
        group: p.group,
        length: p.length_cm,
        width: p.width_cm,
        height: p.height_cm,
        weight: p.weight_kg,
        thisSideUp: p.this_side_up,
        stackable: p.stackable,
        mustBeOnTop: p.must_be_on_top,
        canBeLaidDown: p.can_be_laid_down,
        qty: p.qty,
        colorHex: p.color_hex,
      }));

      const result = await aiPackContainer(
        state.aiProvider,
        state.aiApiKey,
        {
          length: container.length_cm,
          width: container.width_cm,
          height: container.height_cm,
          maxPayloadKg: container.max_payload_kg,
        },
        packItems,
        customPrompt
      );

      // Gemini is used as a planning layer. It suggests an orientation and
      // product order; the deterministic local packer is the final executor.
      // This prevents an LLM-generated coordinate from ever creating overlap,
      // floating items, or boxes outside the container.
      const preferredRotations: Record<string, { rotX: number; rotY: number; rotZ: number }> = {};
      const preferredProductOrder: string[] = [];

      for (const planned of result.placed || []) {
        if (!preferredProductOrder.includes(planned.productId)) {
          preferredProductOrder.push(planned.productId);
        }

        const product = state.products.find(prod => prod.id === planned.productId);
        if (!product) continue;

        const rotX = Number(planned.rotX) || 0;
        const rotY = Number(planned.rotY) || 0;
        const rotZ = Number(planned.rotZ) || 0;

        if (isRotationAllowed(
          rotX,
          rotY,
          rotZ,
          product.this_side_up,
          product.can_be_laid_down,
        )) {
          preferredRotations[planned.productId] = {
            rotX: ((Math.round(rotX / 90) * 90) % 360 + 360) % 360,
            rotY: ((Math.round(rotY / 90) * 90) % 360 + 360) % 360,
            rotZ: ((Math.round(rotZ / 90) * 90) % 360 + 360) % 360,
          };
        }
      }

      const { packContainer } = require('../utils/binPacking');

      const deterministicResult = packContainer(
        {
          length: container.length_cm,
          width: container.width_cm,
          height: container.height_cm,
          maxPayloadKg: container.max_payload_kg,
        },
        packItems,
        { preferredRotations, preferredProductOrder }
      );

      const newLayoutItems: LayoutItem[] = deterministicResult.placed.map((p: any) => {
        const product = state.products.find(prod => prod.id === p.productId);
        return {
          id: genId(),
          product_id: p.productId,
          product_name: product?.name || 'Unknown',
          instance_no: p.instanceNo,
          pos_x: p.x,
          pos_y: p.y,
          pos_z: p.z,
          rot_x: p.rotX,
          rot_y: p.rotY,
          rot_z: p.rotZ,
          length_cm: p.length,
          width_cm: p.width,
          height_cm: p.height,
          weight_kg: product?.weight_kg || 0,
          color_hex: product?.color_hex || '#fde047',
          this_side_up: product?.this_side_up || false,
          can_be_laid_down: product?.can_be_laid_down ?? true,
          stackable: product?.stackable ?? true,
          must_be_on_top: product?.must_be_on_top || false,
        };
      });

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newLayoutItems)));
      if (newHistory.length > 50) newHistory.shift();

      set({
        layoutItems: newLayoutItems,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isAutoPackLoading: false,
        selectedItemId: null,
        selectedGroupIds: [],
      });

      if (deterministicResult.unplaced.length > 0) {
        const uniqueNames = deterministicResult.unplaced.map((u: any) => {
          const prod = state.products.find(prod => prod.id === u.productId);
          return `${prod?.name || u.productId} (${u.qty} pcs)`;
        }).join(', ');
        alert(
          `AI Pack selesai dengan validasi geometris.\n\nTidak muat: ${uniqueNames}\n\n` +
          `Gemini dipakai untuk memilih orientasi/urutan; posisi final dihitung oleh solver lokal.`
        );
      } else {
        alert('AI Pack berhasil mengatur semua barang ke dalam container.');
      }
    } catch (error: any) {
      console.error('AI Auto Pack error:', error);
      alert('Gagal melakukan AI auto pack: ' + error.message);
      set({ isAutoPackLoading: false });
    }
  },

  getLayoutStats: () => {
    const state = get();
    const container = state.projectConfig?.containerType;
    if (!container) {
      return {
        totalWeight: 0, usedVolume: 0, containerVolume: 0,
        volumePercent: 0, weightPercent: 0, itemCount: 0, freeMeters: 0,
      };
    }

    const containerVolume = container.length_cm * container.width_cm * container.height_cm;
    const totalWeight = state.layoutItems.reduce((sum, item) => sum + item.weight_kg, 0);
    const usedVolume = state.layoutItems.reduce((sum, item) => sum + item.length_cm * item.width_cm * item.height_cm, 0);

    let maxUsedX = 0;
    state.layoutItems.forEach(item => {
      if (item.pos_x + item.length_cm > maxUsedX) {
        maxUsedX = item.pos_x + item.length_cm;
      }
    });

    const freeMeters = (container.length_cm - maxUsedX) / 100;

    return {
      totalWeight: Math.round(totalWeight * 100) / 100,
      usedVolume,
      containerVolume,
      volumePercent: containerVolume > 0 ? Math.round((usedVolume / containerVolume) * 10000) / 100 : 0,
      weightPercent: container.max_payload_kg > 0 ? Math.round((totalWeight / container.max_payload_kg) * 10000) / 100 : 0,
      itemCount: state.layoutItems.length,
      freeMeters: freeMeters > 0 ? freeMeters : 0,
    };
  },
  }),
    {
      name: 'easycargo3d-planner-v2',
      version: 2,
      partialize: (state) => ({
        projectPhase: state.projectPhase,
        projectConfig: state.projectConfig,
        products: state.products,
        layoutItems: state.layoutItems,
        selectedItemId: state.selectedItemId,
        selectedGroupIds: state.selectedGroupIds,
        cameraView: 'default' as const,
        aiProvider: state.aiProvider,
        transparentBackground: false,
        viewRotateLocked: state.viewRotateLocked,
        debugOverlayVisible: state.debugOverlayVisible,
        lastSavedAt: state.lastSavedAt,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);