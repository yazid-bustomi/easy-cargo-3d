import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Send,
  Package,
  RefreshCw,
  Eraser,
} from 'lucide-react';
import { usePlannerStore, Product } from '../store/plannerStore';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getLabelTexture, getUpArrowTexture } from './ContainerViewer3D';

function ProductPreview({ product }: { product: Product }) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  const maxDim = Math.max(product.length_cm, product.width_cm, product.height_cm) || 1;
  const s = 2 / maxDim; // scale to fit in view

  const l = (product.length_cm || 1) * s;
  const w = (product.width_cm || 1) * s;
  const h = (product.height_cm || 1) * s;

  const labelTexture = React.useMemo(() => getLabelTexture(product.name), [product.name]);

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[l, h, w]} />
      <meshStandardMaterial color={product.color_hex} roughness={0.7} />
      {/* Dark bottom indicator */}
      <mesh position={[0, -h/2 + 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[l, w]} />
        <meshBasicMaterial color="#374151" />
      </mesh>

      {/* Labels */}
      <mesh position={[0, h/2 + 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[l * 0.9, w * 0.9]} />
        <meshBasicMaterial map={labelTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, w/2 + 0.001]}>
        <planeGeometry args={[l * 0.9, Math.min(h * 0.5, l * 0.45)]} />
        <meshBasicMaterial map={labelTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -w/2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[l * 0.9, Math.min(h * 0.5, l * 0.45)]} />
        <meshBasicMaterial map={labelTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[-l/2 - 0.001, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
        <planeGeometry args={[w * 0.9, Math.min(h * 0.5, w * 0.45)]} />
        <meshBasicMaterial map={labelTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[l/2 + 0.001, 0, 0]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[w * 0.9, Math.min(h * 0.5, w * 0.45)]} />
        <meshBasicMaterial map={labelTexture} transparent depthWrite={false} />
      </mesh>

      {/* This Side Up Icons */}
      {product.this_side_up && (
        <group>
          <mesh position={[0, h/4, w/2 + 0.002]}>
            <planeGeometry args={[Math.min(l, h)*0.3, Math.min(l, h)*0.3]} />
            <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
          </mesh>
          <mesh position={[0, h/4, -w/2 - 0.002]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[Math.min(l, h)*0.3, Math.min(l, h)*0.3]} />
            <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
          </mesh>
          <mesh position={[-l/2 - 0.002, h/4, 0]} rotation={[0, -Math.PI/2, 0]}>
            <planeGeometry args={[Math.min(w, h)*0.3, Math.min(w, h)*0.3]} />
            <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
          </mesh>
          <mesh position={[l/2 + 0.002, h/4, 0]} rotation={[0, Math.PI/2, 0]}>
            <planeGeometry args={[Math.min(w, h)*0.3, Math.min(w, h)*0.3]} />
            <meshBasicMaterial map={getUpArrowTexture()} transparent depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* Bottom strip indicator on 4 sides */}
      {[
        { pos: [0, -h/2 + Math.min(h*0.08, 0.05), w/2 + 0.002] as [number,number,number], rot: undefined, sz: l },
        { pos: [0, -h/2 + Math.min(h*0.08, 0.05), -w/2 - 0.002] as [number,number,number], rot: [0, Math.PI, 0] as [number,number,number], sz: l },
        { pos: [-l/2 - 0.002, -h/2 + Math.min(h*0.08, 0.05), 0] as [number,number,number], rot: [0, -Math.PI/2, 0] as [number,number,number], sz: w },
        { pos: [l/2 + 0.002, -h/2 + Math.min(h*0.08, 0.05), 0] as [number,number,number], rot: [0, Math.PI/2, 0] as [number,number,number], sz: w },
      ].map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot}>
          <planeGeometry args={[s.sz, Math.min(h * 0.16, 0.1)]} />
          <meshBasicMaterial color="#374151" />
        </mesh>
      ))}
    </mesh>
  );
}

export function ProductGroupManager() {
  const {
    products,
    addProduct,
    updateProduct,
    removeProduct,
    updateAllInstances,
    clearProductInstances,
    insertProductToContainer,
    isAutoPackLoading,
    layoutItems,
  } = usePlannerStore();

  // Keep track of which products are being edited inline
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const handleAddProduct = () => {
    addProduct();
  };

  const handleInsertProduct = (productId: string) => {
    insertProductToContainer(productId);
  };

  return (
    <div className="space-y-3">
      {/* Add Product Button */}
      <div>
        <button
          onClick={handleAddProduct}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No products yet</p>
          <p className="text-gray-500 text-xs mt-1">Add a product to start</p>
        </div>
      )}

      {/* Products List */}
      {products.map((product) => {
        const isEditing = editingProductId === product.id;
        const insertedCount = layoutItems.filter(i => i.product_id === product.id).length;

        return (
          <div
            key={product.id}
            className="bg-gray-800/60 backdrop-blur rounded-xl border border-gray-700/50 overflow-hidden"
          >
            {/* Product Summary / Header */}
            <div className="p-3 flex items-center gap-2">
              <button
                onClick={() => setEditingProductId(isEditing ? null : product.id)}
                className="flex items-center gap-2 flex-1 text-left min-w-0"
              >
                <div
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: product.color_hex }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-white text-sm truncate">{product.name}</h3>
                    <span className="text-xs text-yellow-400 font-bold flex-shrink-0 ml-2">
                      {insertedCount} / {product.qty} pcs
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {product.length_cm}×{product.width_cm}×{product.height_cm} cm · {product.weight_kg} kg
                  </p>
                </div>
              </button>

              {/* Insert to Container */}
              <button
                onClick={() => handleInsertProduct(product.id)}
                disabled={isAutoPackLoading || insertedCount >= product.qty}
                className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 transition-all shadow-sm shadow-green-600/20 flex-shrink-0"
                title="Insert product into container"
              >
                <Send className="w-3.5 h-3.5" />
                Insert
              </button>
            </div>

            {/* Edit form */}
            {isEditing && (
              <div className="px-3 pb-3 border-t border-gray-700/50 pt-3 space-y-2 bg-gray-900/40">
                {/* Name */}
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Product name"
                />

                {/* L, W, H */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">L (cm)</label>
                    <input
                      type="number"
                      value={product.length_cm || ''}
                      onChange={(e) => updateProduct(product.id, { length_cm: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">W (cm)</label>
                    <input
                      type="number"
                      value={product.width_cm || ''}
                      onChange={(e) => updateProduct(product.id, { width_cm: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">H (cm)</label>
                    <input
                      type="number"
                      value={product.height_cm || ''}
                      onChange={(e) => updateProduct(product.id, { height_cm: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                </div>

                {/* 3D Preview */}
                <div className="h-32 bg-gray-950/50 rounded-lg overflow-hidden border border-gray-700/50 relative">
                  <div className="absolute top-1 left-2 text-[10px] text-gray-500 font-medium z-10">3D Preview</div>
                  <Canvas camera={{ position: [2.5, 2, 2.5], fov: 40 }}>
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <ProductPreview product={product} />
                  </Canvas>
                </div>

                {/* Weight, Qty */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Weight (kg)</label>
                    <input
                      type="number"
                      value={product.weight_kg === 0 ? '' : product.weight_kg}
                      onChange={(e) => updateProduct(product.id, { weight_kg: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={0}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Total PCS</label>
                    <input
                      type="number"
                      value={product.qty || ''}
                      onChange={(e) => updateProduct(product.id, { qty: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                </div>

                {/* This Side Up, Color + Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.this_side_up}
                        onChange={(e) => updateProduct(product.id, { this_side_up: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-300">↑ This Side Up</span>
                    </label>
                    <input 
                      type="color" 
                      value={product.color_hex}
                      onChange={(e) => updateProduct(product.id, { color_hex: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                      title="Change color"
                    />
                  </div>
                {/* Actions: Update All, Clear, Delete */}
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-700/50">
                  <button
                    onClick={() => {
                      const res = updateAllInstances(product.id);
                      if (!res.success) alert(res.message);
                    }}
                    className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update All (Terapkan ke Kontainer)
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => clearProductInstances(product.id)}
                      className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      <Eraser className="w-3.5 h-3.5 text-gray-400" />
                      Clear (Kosongkan)
                    </button>
                    <button
                      onClick={() => removeProduct(product.id)}
                      className="flex-1 px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded text-xs font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Product
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
