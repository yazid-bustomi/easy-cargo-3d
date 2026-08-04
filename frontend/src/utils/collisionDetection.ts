/**
 * Collision Detection & Validation Utilities
 * For 3D container packing
 */

export interface Box3D {
  x: number;
  y: number;
  z: number;
  length: number; // width along X
  width: number;  // depth along Z
  height: number; // height along Y
}

/**
 * Check if two boxes overlap in 3D space
 */
export function boxesOverlap(box1: Box3D, box2: Box3D): boolean {
  return (
    box1.x < box2.x + box2.length &&
    box1.x + box1.length > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y &&
    box1.z < box2.z + box2.width &&
    box1.z + box1.width > box2.z
  );
}

/**
 * Check if box is within container bounds
 */
export function isWithinContainer(box: Box3D, container: Box3D): boolean {
  return (
    box.x >= 0 &&
    box.x + box.length <= container.length &&
    box.y >= 0 &&
    box.y + box.height <= container.height &&
    box.z >= 0 &&
    box.z + box.width <= container.width
  );
}

/**
 * Check if item collides with any existing items
 */
export function hasCollision(newItem: Box3D, existingItems: Box3D[]): boolean {
  return existingItems.some((item) => boxesOverlap(newItem, item));
}

/**
 * Validate item position in container
 */
export function validateItemPosition(
  item: Box3D,
  container: Box3D,
  otherItems: Box3D[] = []
): {
  valid: boolean;
  reason?: string;
} {
  // Check container bounds
  if (!isWithinContainer(item, container)) {
    return {
      valid: false,
      reason: 'Item exceeds container boundaries',
    };
  }

  // Check collisions with other items
  if (hasCollision(item, otherItems)) {
    return {
      valid: false,
      reason: 'Item collides with existing items',
    };
  }

  return { valid: true };
}

/**
 * Snap box to grid (for snapping feature)
 */
export function snapToGrid(value: number, gridSize: number = 5): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Get closest valid position (snapping to grid and avoiding collisions)
 */
export function getClosestValidPosition(
  proposedItem: Box3D,
  container: Box3D,
  otherItems: Box3D[],
  gridSize: number = 10
): Box3D | null {
  // Try snapping to grid first
  const snappedItem = {
    ...proposedItem,
    x: snapToGrid(proposedItem.x, gridSize),
    y: snapToGrid(proposedItem.y, gridSize),
    z: snapToGrid(proposedItem.z, gridSize),
  };

  const validation = validateItemPosition(snappedItem, container, otherItems);
  if (validation.valid) {
    return snappedItem;
  }

  // If snapped position doesn't work, try nearby positions
  const searchRadius = gridSize * 3;
  const step = gridSize;

  for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
    for (let dy = -searchRadius; dy <= searchRadius; dy += step) {
      for (let dz = -searchRadius; dz <= searchRadius; dz += step) {
        const testItem = {
          ...proposedItem,
          x: Math.max(0, proposedItem.x + dx),
          y: Math.max(0, proposedItem.y + dy),
          z: Math.max(0, proposedItem.z + dz),
        };

        const testValidation = validateItemPosition(testItem, container, otherItems);
        if (testValidation.valid) {
          return testItem;
        }
      }
    }
  }

  return null; // No valid position found
}

/**
 * Calculate distance between two points
 */
export function distance3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Find snap points around items (for visual snapping guides)
 */
export function getSnapPoints(item: Box3D, otherItems: Box3D[]): number[] {
  const snapPoints: number[] = [0];

  // Collect all edge positions from other items
  for (const other of otherItems) {
    snapPoints.push(other.x);
    snapPoints.push(other.x + other.length);
    snapPoints.push(other.z);
    snapPoints.push(other.z + other.width);
    snapPoints.push(other.y);
    snapPoints.push(other.y + other.height);
  }

  return snapPoints;
}
