/**
 * 3D Bin Packing — TypeScript (Frontend)
 * -----------------------------------------------------------------------
 * Empty Maximal Space (EMS) heuristic, enhanced with:
 *   - this_side_up: no non-upright orientations during auto-pack
 *   - stackable: whether items can be placed above ground level
 *   - must_be_on_top: item is placed LAST and only at highest Y
 *   - can_be_laid_down: whether non-upright orientations are allowed
 *   - weight capacity check
 * -----------------------------------------------------------------------
 */

export interface PackItem {
  productId: string;
  name: string;
  group: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  thisSideUp: boolean;
  stackable: boolean;
  mustBeOnTop: boolean;
  canBeLaidDown: boolean;
  qty: number;
  colorHex: string;
}

export interface PlacedItem {
  productId: string;
  instanceNo: number;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export interface PackResult {
  placed: PlacedItem[];
  unplaced: Array<{ productId: string; qty: number }>;
  usedVolume: number;
  totalWeight: number;
}

export interface PackPreferences {
  preferredRotations?: Record<string, { rotX: number; rotY: number; rotZ: number }>;
  preferredProductOrder?: string[];
}

export interface ContainerDims {
  length: number;
  width: number;
  height: number;
  maxPayloadKg: number;
}

class Space {
  x: number; y: number; z: number;
  length: number; width: number; height: number;

  constructor(x: number, y: number, z: number, length: number, width: number, height: number) {
    this.x = x; this.y = y; this.z = z;
    this.length = length; this.width = width; this.height = height;
  }

  get volume(): number {
    return this.length * this.width * this.height;
  }
}

interface Orientation {
  length: number;
  width: number;
  height: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

/**
 * Generate valid orientation permutations for a box given constraints.
 *
 * Rules:
 *  - thisSideUp = true, canBeLaidDown = false -> ONLY upright orientations
 *    (never laid down, never flipped upside down).
 *  - thisSideUp = true, canBeLaidDown = true  -> upright OR laid on a side
 *    face, but NEVER flipped upside down (the original "up" face must
 *    always end up pointing away from the ground).
 *  - thisSideUp = false -> fully free rotation, including upside down.
 */
function getOrientations(item: PackItem, preferences?: PackPreferences): Orientation[] {
  const { length: l, width: w, height: h, thisSideUp, canBeLaidDown } = item;
  const orientations: Orientation[] = [];

  // Base orientation: as defined (height always "up") — always allowed.
  orientations.push({ length: l, width: w, height: h, rotX: 0, rotY: 0, rotZ: 0 });

  // Rotate 90° around Y (swap length/width) — always valid for upright
  if (l !== w) {
    orientations.push({ length: w, width: l, height: h, rotX: 0, rotY: 90, rotZ: 0 });
  }

  if (!thisSideUp) {
    // No "up face" restriction: every orientation is allowed, including
    // laid down on any side AND fully flipped upside down.
    orientations.push(
      { length: l, width: h, height: w, rotX: 90, rotY: 0, rotZ: 0 },
      { length: h, width: w, height: l, rotX: 0, rotY: 0, rotZ: 90 },
      { length: h, width: l, height: w, rotX: 90, rotY: 90, rotZ: 0 },
      { length: w, width: h, height: l, rotX: 0, rotY: 90, rotZ: 90 },
      // 180° flips (upside down)
      { length: l, width: w, height: h, rotX: 180, rotY: 0, rotZ: 0 },
      { length: w, width: l, height: h, rotX: 180, rotY: 90, rotZ: 0 },
    );
  } else if (canBeLaidDown) {
    // May lie on a side face (90° tip), but never a 180° flip — the
    // original top face must always stay facing up/outward.
    orientations.push(
      { length: l, width: h, height: w, rotX: 90, rotY: 0, rotZ: 0 },
      { length: h, width: w, height: l, rotX: 0, rotY: 0, rotZ: 90 },
      { length: h, width: l, height: w, rotX: 90, rotY: 90, rotZ: 0 },
      { length: w, width: h, height: l, rotX: 0, rotY: 90, rotZ: 90 },
    );
  }
  // else: thisSideUp && !canBeLaidDown -> only the two upright
  // orientations pushed above are allowed.

  // De-duplicate identical footprints
  const seen = new Set<string>();
  const unique = orientations.filter((o) => {
    const key = `${o.length}x${o.width}x${o.height}|${o.rotX}|${o.rotY}|${o.rotZ}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const preferred = preferences?.preferredRotations?.[item.productId];
  if (!preferred) return unique;

  // Put the AI-preferred orientation first. The local geometry solver still
  // validates the fit/support and is free to choose another legal orientation
  // when the preferred one does not fit.
  return [...unique].sort((a, b) => {
    const score = (o: Orientation) =>
      o.rotX === preferred.rotX &&
      o.rotY === preferred.rotY &&
      o.rotZ === preferred.rotZ ? 0 : 1;
    return score(a) - score(b);
  });
}

function fits(space: Space, dims: Orientation): boolean {
  return dims.length <= space.length + 1e-6 && dims.width <= space.width + 1e-6 && dims.height <= space.height + 1e-6;
}

/** Split a used space into up to 3 new maximal spaces. */
function splitSpace(space: Space, placedDims: Orientation): Space[] {
  const newSpaces: Space[] = [];

  // Space to the right along length (X)
  if (space.length - placedDims.length > 1e-6) {
    newSpaces.push(new Space(
      space.x + placedDims.length, space.y, space.z,
      space.length - placedDims.length, space.width, space.height
    ));
  }
  // Space in front along width (Z)
  if (space.width - placedDims.width > 1e-6) {
    newSpaces.push(new Space(
      space.x, space.y, space.z + placedDims.width,
      space.length, space.width - placedDims.width, space.height
    ));
  }
  // Space above along height (Y)
  if (space.height - placedDims.height > 1e-6) {
    newSpaces.push(new Space(
      space.x, space.y + placedDims.height, space.z,
      space.length, space.width, space.height - placedDims.height
    ));
  }
  return newSpaces;
}

/** Remove/trim spaces that overlap with a newly placed box. */
function pruneSpaces(spaces: Space[], x: number, y: number, z: number, dims: Orientation): Space[] {
  const result: Space[] = [];
  const bx2 = x + dims.length, by2 = y + dims.height, bz2 = z + dims.width;

  for (const s of spaces) {
    const sx2 = s.x + s.length, sy2 = s.y + s.height, sz2 = s.z + s.width;
    const overlap = x < sx2 && bx2 > s.x && y < sy2 && by2 > s.y && z < sz2 && bz2 > s.z;
    if (!overlap) {
      result.push(s);
      continue;
    }
    // Trim the overlapping space into up-to-6 non-overlapping remainder boxes.
    if (s.x < x) result.push(new Space(s.x, s.y, s.z, x - s.x, s.width, s.height));
    if (sx2 > bx2) result.push(new Space(bx2, s.y, s.z, sx2 - bx2, s.width, s.height));
    if (s.z < z) result.push(new Space(s.x, s.y, s.z, s.length, z - s.z, s.height));
    if (sz2 > bz2) result.push(new Space(s.x, s.y, bz2, s.length, sz2 - bz2, s.height));
    if (s.y < y) result.push(new Space(s.x, s.y, s.z, s.length, s.width, y - s.y));
    if (sy2 > by2) result.push(new Space(s.x, by2, s.z, s.length, s.width, sy2 - by2));
  }
  // Drop degenerate spaces
  return result.filter((s) => s.length > 1e-6 && s.width > 1e-6 && s.height > 1e-6);
}

/**
 * Run bin packing for a set of product lines into one container.
 */
export function packContainer(container: ContainerDims, items: PackItem[], preferences?: PackPreferences): PackResult {
  let spaces = [new Space(0, 0, 0, container.length, container.width, container.height)];
  const placed: PlacedItem[] = [];
  const unplaced: Array<{ productId: string; qty: number }> = [];
  let usedVolume = 0;
  let totalWeight = 0;

  // Separate must_be_on_top items — they are placed LAST
  const normalItems: PackItem[] = [];
  const topItems: PackItem[] = [];

  for (const item of items) {
    if (item.mustBeOnTop) {
      topItems.push(item);
    } else {
      normalItems.push(item);
    }
  }

  // Best-fit decreasing: expand and sort by volume descending (bigger items first)
  function expandItems(itemList: PackItem[]): Array<PackItem & { instanceNo: number }> {
    const expanded: Array<PackItem & { instanceNo: number }> = [];
    for (const item of itemList) {
      for (let i = 1; i <= item.qty; i++) {
        expanded.push({ ...item, instanceNo: i });
      }
    }
    const preferredOrder = new Map(
      (preferences?.preferredProductOrder || []).map((id, index) => [id, index])
    );

    expanded.sort((a, b) => {
      const aOrder = preferredOrder.has(a.productId)
        ? preferredOrder.get(a.productId)!
        : Number.MAX_SAFE_INTEGER;
      const bOrder = preferredOrder.has(b.productId)
        ? preferredOrder.get(b.productId)!
        : Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) return aOrder - bOrder;

      return b.length * b.width * b.height - a.length * a.width * a.height;
    });
    return expanded;
  }

  function placeItems(expanded: Array<PackItem & { instanceNo: number }>) {
    for (const item of expanded) {
      const orientations = getOrientations(item, preferences);
      let bestSpaceIdx = -1;
      let bestOrientation: Orientation | null = null;
      let bestScore = Infinity;

      // Weight guard
      if (totalWeight + item.weight > container.maxPayloadKg) {
        unplaced.push({ productId: item.productId, qty: 1 });
        continue;
      }

      for (let si = 0; si < spaces.length; si++) {
        const space = spaces[si];
        for (const orientation of orientations) {
          if (!fits(space, orientation)) continue;

          // Only allow placement above ground (y>0) if item is stackable
          if (space.y > 0 && !item.stackable) continue;

          // Prefer bottom-left-back placements to create flat layers and tight packing
          const baseScore = space.y * 100000 + space.x * 1000 + space.z;
          const yPenalty = item.mustBeOnTop ? -space.y * 1000000 : 0;
          const score = baseScore + yPenalty;
          
          if (score < bestScore) {
            bestScore = score;
            bestSpaceIdx = si;
            bestOrientation = orientation;
          }
        }
      }

      if (bestSpaceIdx === -1) {
        unplaced.push({ productId: item.productId, qty: 1 });
        continue;
      }

      const space = spaces[bestSpaceIdx];
      const dims = bestOrientation!;

      placed.push({
        productId: item.productId,
        instanceNo: item.instanceNo,
        x: Math.round(space.x * 100) / 100,
        y: Math.round(space.y * 100) / 100,
        z: Math.round(space.z * 100) / 100,
        length: dims.length,
        width: dims.width,
        height: dims.height,
        rotX: dims.rotX,
        rotY: dims.rotY,
        rotZ: dims.rotZ,
      });

      usedVolume += dims.length * dims.width * dims.height;
      totalWeight += item.weight;

      // Update free-space list
      spaces = pruneSpaces(spaces, space.x, space.y, space.z, dims);
      spaces.push(...splitSpace(space, dims));
      // Remove spaces fully contained within another
      spaces = spaces.filter((s, idx, arr) => {
        return !arr.some((other, oIdx) => {
          if (oIdx === idx) return false;
          return (
            s.x >= other.x && s.y >= other.y && s.z >= other.z &&
            s.x + s.length <= other.x + other.length &&
            s.y + s.height <= other.y + other.height &&
            s.z + s.width <= other.z + other.width &&
            s.volume <= other.volume
          );
        });
      });
    }
  }

  // Place normal items first, then must_be_on_top items
  placeItems(expandItems(normalItems));
  placeItems(expandItems(topItems));

  // Aggregate unplaced counts per product
  const unplacedMap: Record<string, number> = {};
  for (const u of unplaced) {
    unplacedMap[u.productId] = (unplacedMap[u.productId] || 0) + u.qty;
  }

  return {
    placed,
    unplaced: Object.entries(unplacedMap).map(([productId, qty]) => ({ productId, qty })),
    usedVolume,
    totalWeight,
  };
}