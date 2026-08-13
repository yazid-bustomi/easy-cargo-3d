import { create } from 'zustand';
import * as THREE from 'three';
import { aiPackContainer } from '../utils/aiPackService';

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

  const orientations = [
    { l: oL, w: oW, h: oH, rx: 0, ry: 0, rz: 0 },
    { l: oW, w: oL, h: oH, rx: 0, ry: 90, rz: 0 },
  ];

  if (!selectedItem.this_side_up) {
    orientations.push(
      { l: oL, w: oH, h: oW, rx: 90, ry: 0, rz: 0 },
      { l: oH, w: oW, h: oL, rx: 0, ry: 0, rz: 90 },
      { l: oW, w: oH, h: oL, rx: 90, ry: 0, rz: 90 },
      { l: oH, w: oL, h: oW, rx: 0, ry: 90, rz: 90 }
    );
  }

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

// ── Store ────────────────────────────────────────────────────────────

export interface PlannerState {
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

  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
  setAutoPackLoading: (loading: boolean) => void;
  setCameraView: (view: 'default' | 'top' | 'left' | 'right') => void;
  setAiApiKey: (key: string) => void;
  setAiProvider: (provider: 'gemini' | 'openai') => void;
  autoPackAll: () => void;
  aiAutoPack: (customPrompt?: string) => Promise<void>;
  getLayoutStats: () => LayoutStats;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
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

      const insertedCount = state.layoutItems.filter(i => i.product_id === productId).length;
      if (insertedCount >= product.qty) return state;

      const container = state.projectConfig.containerType;

      // Try multiple orientations
      const orientations: Array<{ l: number; w: number; h: number; rx: number; ry: number; rz: number }> = [
        // Default orientation (lying flat)
        { l: product.length_cm, w: product.width_cm, h: product.height_cm, rx: 0, ry: 0, rz: 0 },
        // Rotated 90° horizontally
        { l: product.width_cm, w: product.length_cm, h: product.height_cm, rx: 0, ry: 90, rz: 0 },
      ];

      // Only add standing orientations if this_side_up is NOT set
      if (!product.this_side_up) {
        orientations.push(
          // Standing on width side
          { l: product.length_cm, w: product.height_cm, h: product.width_cm, rx: 90, ry: 0, rz: 0 },
          // Standing on length side
          { l: product.height_cm, w: product.width_cm, h: product.length_cm, rx: 0, ry: 0, rz: 90 },
        );
      }

      const step = 2;
      let bestResult: { x: number; y: number; z: number; oi: number } | null = null;
      let lowestY = Infinity;

      for (let oi = 0; oi < orientations.length; oi++) {
        const { l, w, h } = orientations[oi];
        
        if (l > container.length_cm || w > container.width_cm || h > container.height_cm) continue;

        for (let x = 0; x <= container.length_cm - l; x += step) {
          for (let z = 0; z <= container.width_cm - w; z += step) {
            const dropY = calculateDropY(x, z, l, w, undefined, state.layoutItems);
            
            if (dropY + h > container.height_cm) continue;
            if (dropY >= lowestY) continue;
            if (!checkFullSupport(x, dropY, z, l, w, undefined, state.layoutItems)) continue;

            const testItem = { pos_x: x, pos_y: dropY, pos_z: z, length_cm: l, width_cm: w, height_cm: h };
            if (!checkCollision(testItem, state.layoutItems, container)) {
              lowestY = dropY;
              bestResult = { x, y: dropY, z, oi };
              if (lowestY === 0) break;
            }
          }
          if (bestResult && lowestY === 0) break;
        }
        if (bestResult && lowestY === 0) break;
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
      const product = state.products.find(p => p.id === item?.product_id);
      if (!item || !container || !product) return state;

      const origL = product.length_cm;
      const origW = product.width_cm;
      const origH = product.height_cm;

      // Current rotation as quaternion
      const euler = new THREE.Euler(item.rot_x * Math.PI / 180, item.rot_y * Math.PI / 180, item.rot_z * Math.PI / 180, 'XYZ');
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Apply relative rotation delta
      const deltaQ = new THREE.Quaternion();
      switch (direction) {
        case 'spin-right': deltaQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); break;
        case 'spin-left': deltaQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); break;
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
      
      // We apply rotation in local space by multiplying quaternion
      quaternion.multiply(deltaQ);

      // Extract new Euler angles in degrees
      const newEuler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
      const newRotX = Math.round(newEuler.x * 180 / Math.PI);
      const newRotY = Math.round(newEuler.y * 180 / Math.PI);
      const newRotZ = Math.round(newEuler.z * 180 / Math.PI);

      // Calculate new physical dimensions (AABB) based on the rotated original dimensions
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

      const testL = Math.round(Math.abs(right.x * origL) + Math.abs(up.x * origH) + Math.abs(forward.x * origW));
      const testH = Math.round(Math.abs(right.y * origL) + Math.abs(up.y * origH) + Math.abs(forward.y * origW));
      const testW = Math.round(Math.abs(right.z * origL) + Math.abs(up.z * origH) + Math.abs(forward.z * origW));

      let testX = item.pos_x;
      let testZ = item.pos_z;

      // Auto-shift if exceeding bounds
      if (testX + testL > container.length_cm) {
        testX = container.length_cm - testL;
      }
      if (testZ + testW > container.width_cm) {
        testZ = container.width_cm - testW;
      }
      if (testX < 0 || testZ < 0 || testL > container.length_cm || testW > container.width_cm || testH > container.height_cm) {
        return { contextMenu: null };
      }

      // Calculate gravity drop at the new position with new dimensions
      const dropY = calculateDropY(testX, testZ, testL, testW, item.id, state.layoutItems);

      if (dropY + testH > container.height_cm) {
        return { contextMenu: null };
      }

      const testItem = {
        ...item,
        pos_x: testX,
        pos_y: dropY,
        pos_z: testZ,
        length_cm: testL,
        width_cm: testW,
        height_cm: testH,
      };
      
      if (checkCollision(testItem, state.layoutItems, container)) {
        return { contextMenu: null };
      }

      if (!checkFullSupport(testX, dropY, testZ, testL, testW, item.id, state.layoutItems)) {
        return { contextMenu: null };
      }

      return {
        layoutItems: state.layoutItems.map((i) =>
          i.id === itemId
            ? { ...i, pos_x: testX, pos_y: dropY, pos_z: testZ, length_cm: testL, width_cm: testW, height_cm: testH, rot_x: newRotX, rot_y: newRotY, rot_z: newRotZ }
            : i
        ),
        contextMenu: null,
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

      if (result.unplaced && result.unplaced.length > 0) {
        const unplacedNames = result.unplaced.map((u: any) => {
          const prod = state.products.find(prod => prod.id === u.productId);
          return `${prod?.name || u.productId} (${u.qty} pcs)`;
        }).join(', ');
        alert(`AI Pack selesai!\n\nTidak muat: ${unplacedNames}`);
      } else {
        alert('AI Pack berhasil mengatur semua barang!');
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
}));
