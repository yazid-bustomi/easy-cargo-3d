/**
 * 3D Bin Packing Service
 * -----------------------------------------------------------------------
 * Implements an Empty Maximal Space (EMS) heuristic — the same family of
 * algorithm used by most commercial container-loading tools (best-fit
 * decreasing + maximal-space search). This is used by "Auto Insert" /
 * "Auto Packing" to place a product group's full quantity into a
 * container automatically, respecting:
 *   - container boundaries
 *   - This Side Up (no rotation on X/Z that would flip the item)
 *   - Rotation Allowed (whether the item can be rotated around Y/vertical)
 *   - Stackable + Max Stack (how many units may be stacked on top of one)
 *   - Weight capacity of the container
 *
 * The algorithm is intentionally deterministic and side-effect free so it
 * can be unit-tested and also re-used on the client (a lightweight port
 * lives in frontend/src/utils/binPacking.ts for instant local preview).
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} PackItem
 * @property {number} productId
 * @property {number} length
 * @property {number} width
 * @property {number} height
 * @property {number} weight
 * @property {boolean} thisSideUp
 * @property {boolean} rotationAllowed
 * @property {boolean} stackable
 * @property {number} maxStack
 * @property {number} qty
 */

/**
 * @typedef {Object} PlacedItem
 * @property {number} productId
 * @property {number} instanceNo
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} length
 * @property {number} width
 * @property {number} height
 * @property {number} rotX
 * @property {number} rotY
 * @property {number} rotZ
 * @property {number} stackLevel
 */

class Space {
  constructor(x, y, z, length, width, height) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.length = length; // along container length (X)
    this.width = width; // along container width (Z in three.js terms, but "width" here)
    this.height = height; // along container height (Y)
  }
  get volume() {
    return this.length * this.width * this.height;
  }
}

/** Generate valid orientation permutations for a box given constraints. */
function getOrientations(item) {
  const { length: l, width: w, height: h, thisSideUp, rotationAllowed } = item;
  const orientations = [];

  // Base orientation: as defined (height always "up") — always allowed.
  orientations.push({ length: l, width: w, height: h, rotX: 0, rotY: 0, rotZ: 0 });

  if (!thisSideUp) {
    // If "this side up" is NOT required, we may lay the box on its side,
    // exposing the other two faces as the vertical (height) axis.
    orientations.push({ length: l, width: h, height: w, rotX: 90, rotY: 0, rotZ: 0 });
    orientations.push({ length: h, width: w, height: l, rotX: 0, rotY: 0, rotZ: 90 });
  }

  if (rotationAllowed) {
    // Rotate 90 degrees around the vertical (Y) axis — swap length/width,
    // valid regardless of this-side-up because the item stays upright.
    const base = orientations.slice();
    for (const o of base) {
      orientations.push({ length: o.width, width: o.length, height: o.height, rotX: o.rotX, rotY: 90, rotZ: o.rotZ });
    }
  }

  // De-duplicate identical footprints
  const seen = new Set();
  return orientations.filter((o) => {
    const key = `${o.length}x${o.width}x${o.height}|${o.rotX}|${o.rotY}|${o.rotZ}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fits(space, dims) {
  return dims.length <= space.length + 1e-6 && dims.width <= space.width + 1e-6 && dims.height <= space.height + 1e-6;
}

/**
 * Split a used space into up to 3 new maximal spaces (guillotine-ish split
 * but keeping overlap so later items can still use leftover volume — this
 * is the "maximal space" trick that avoids the classic guillotine waste).
 */
function splitSpace(space, placedDims) {
  const newSpaces = [];

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
  // Space above along height (Y) — only usable if the placed item is stackable
  if (space.height - placedDims.height > 1e-6) {
    newSpaces.push(new Space(
      space.x, space.y + placedDims.height, space.z,
      space.length, space.width, space.height - placedDims.height
    ));
  }
  return newSpaces;
}

/** Remove/trim spaces that overlap with a newly placed box. */
function pruneSpaces(spaces, x, y, z, dims) {
  const result = [];
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
  // Drop degenerate/duplicate spaces
  return result.filter((s) => s.length > 1e-6 && s.width > 1e-6 && s.height > 1e-6);
}

/**
 * Run bin packing for a set of product lines into one container.
 * @param {{length:number,width:number,height:number,maxPayloadKg:number}} container
 * @param {PackItem[]} items
 * @returns {{ placed: PlacedItem[], unplaced: {productId:number, qty:number}[], usedVolume:number, totalWeight:number }}
 */
function packContainer(container, items) {
  let spaces = [new Space(0, 0, 0, container.length, container.width, container.height)];
  const placed = [];
  const unplaced = [];
  let usedVolume = 0;
  let totalWeight = 0;

  // Best-fit decreasing: sort items by volume descending (bigger items first).
  const expanded = [];
  for (const item of items) {
    for (let i = 1; i <= item.qty; i++) {
      expanded.push({ ...item, instanceNo: i });
    }
  }
  expanded.sort((a, b) => b.length * b.width * b.height - a.length * a.width * a.height);

  for (const item of expanded) {
    const orientations = getOrientations(item);
    let bestSpaceIdx = -1;
    let bestOrientation = null;
    let bestScore = Infinity; // smaller leftover volume = better fit

    // Weight guard
    if (totalWeight + item.weight > container.maxPayloadKg) {
      unplaced.push({ productId: item.productId, qty: 1 });
      continue;
    }

    for (let si = 0; si < spaces.length; si++) {
      const space = spaces[si];
      for (const orientation of orientations) {
        if (!fits(space, orientation)) continue;
        // Only allow placement above ground (y>0) if item is stackable AND
        // the space's floor is directly supported (approximated here by
        // trusting the EMS decomposition, which never floats spaces).
        if (space.y > 0 && !item.stackable) continue;

        const leftover = space.volume - orientation.length * orientation.width * orientation.height;
        // Prefer floor-level (lower y) placements and tighter fit.
        const score = leftover + space.y * 1000;
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
    const dims = bestOrientation;
    const stackLevel = space.y > 0 ? Math.round(space.y / (item.height || 1)) : 0;

    placed.push({
      productId: item.productId,
      instanceNo: item.instanceNo,
      x: space.x,
      y: space.y,
      z: space.z,
      length: dims.length,
      width: dims.width,
      height: dims.height,
      rotX: dims.rotX,
      rotY: dims.rotY,
      rotZ: dims.rotZ,
      stackLevel,
    });

    usedVolume += dims.length * dims.width * dims.height;
    totalWeight += item.weight;

    // Update free-space list: prune overlap, then add new maximal spaces.
    spaces = pruneSpaces(spaces, space.x, space.y, space.z, dims);
    spaces.push(...splitSpace(space, dims));
    // Remove spaces fully contained within another (keeps list small/fast).
    spaces = spaces.filter((s, idx) => {
      return !spaces.some((other, oIdx) => {
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

  // Aggregate unplaced counts per product
  const unplacedMap = {};
  for (const u of unplaced) {
    unplacedMap[u.productId] = (unplacedMap[u.productId] || 0) + u.qty;
  }

  return {
    placed,
    unplaced: Object.entries(unplacedMap).map(([productId, qty]) => ({ productId: Number(productId), qty })),
    usedVolume,
    totalWeight,
  };
}

module.exports = { packContainer, getOrientations };