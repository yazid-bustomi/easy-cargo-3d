import React, { useState } from "react";
import { Plus, Trash2, Send, Package, RefreshCw, Eraser } from "lucide-react";
import { usePlannerStore, Product } from "../store/plannerStore";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLabelTexture, getUpArrowTexture } from "./ContainerViewer3D";

function ProductPreview({ product }: { product: Product }) {
  const meshRef = React.useRef<THREE.Mesh>(null);

  useFrame(() => {
    // Auto-rotate disabled: with several previews stacked/grouped on
    // screen, this made the ones underneath spin on their own whenever
    // a group was dragged. Left commented (not deleted) so it can be
    // re-enabled later if needed.
    // if (meshRef.current) {
    //   meshRef.current.rotation.y += 0.01;
    // }
  });

  const maxDim =
    Math.max(product.length_cm, product.width_cm, product.height_cm) || 1;
  const s = 2 / maxDim; // scale to fit in view

  const l = (product.length_cm || 1) * s;
  const w = (product.width_cm || 1) * s;
  const h = (product.height_cm || 1) * s;
  const darkColor = darkenColor(product.color_hex || "#fde047", 0.6);

  const texTop = React.useMemo(
    () =>
      getLabelTexture(
        product.name,
        product.length_cm * 0.9,
        product.width_cm * 0.9,
      ),
    [product.name, product.length_cm, product.width_cm],
  );
  const texFront = React.useMemo(
    () =>
      getLabelTexture(
        product.name,
        product.length_cm * 0.9,
        Math.min(product.height_cm * 0.5, product.length_cm * 0.45),
      ),
    [product.name, product.length_cm, product.height_cm],
  );
  const texSide = React.useMemo(
    () =>
      getLabelTexture(
        product.name,
        product.width_cm * 0.9,
        Math.min(product.height_cm * 0.5, product.width_cm * 0.45),
      ),
    [product.name, product.width_cm, product.height_cm],
  );

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[l, h, w]} />
      <meshStandardMaterial color={product.color_hex} roughness={0.7} />
      {/* Dark bottom indicator — rotation +Math.PI/2 (not -Math.PI/2) so
          the normal faces down, AND the epsilon pushes outward
          (-h/2 - 0.001, not +0.001) so it isn't hidden behind the
          box's own opaque bottom surface. See the matching fix/comment
          in ContainerViewer3D.tsx. */}
      <mesh position={[0, -h / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[l, w]} />
        <meshBasicMaterial color={darkColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Labels */}
      <mesh position={[0, h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[l * 0.9, w * 0.9]} />
        <meshBasicMaterial map={texTop} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, w / 2 + 0.001]}>
        <planeGeometry args={[l * 0.9, Math.min(h * 0.5, l * 0.45)]} />
        <meshBasicMaterial map={texFront} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -w / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[l * 0.9, Math.min(h * 0.5, l * 0.45)]} />
        <meshBasicMaterial map={texFront} transparent depthWrite={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.001, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[w * 0.9, Math.min(h * 0.5, w * 0.45)]} />
        <meshBasicMaterial map={texSide} transparent depthWrite={false} />
      </mesh>
      <mesh position={[l / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w * 0.9, Math.min(h * 0.5, w * 0.45)]} />
        <meshBasicMaterial map={texSide} transparent depthWrite={false} />
      </mesh>

      {/* This Side Up Icons */}
      {product.this_side_up && (
        <group>
          <mesh position={[0, h / 4, w / 2 + 0.002]}>
            <planeGeometry
              args={[Math.min(l, h) * 0.3, Math.min(l, h) * 0.3]}
            />
            <meshBasicMaterial
              map={getUpArrowTexture()}
              transparent
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[0, h / 4, -w / 2 - 0.002]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry
              args={[Math.min(l, h) * 0.3, Math.min(l, h) * 0.3]}
            />
            <meshBasicMaterial
              map={getUpArrowTexture()}
              transparent
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[-l / 2 - 0.002, h / 4, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry
              args={[Math.min(w, h) * 0.3, Math.min(w, h) * 0.3]}
            />
            <meshBasicMaterial
              map={getUpArrowTexture()}
              transparent
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[l / 2 + 0.002, h / 4, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry
              args={[Math.min(w, h) * 0.3, Math.min(w, h) * 0.3]}
            />
            <meshBasicMaterial
              map={getUpArrowTexture()}
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Solid edge outline for visual separation (matches main 3D viewer) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(l, h, w)]} />
        <lineBasicMaterial color="#000000" />
      </lineSegments>
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
        const insertedCount = layoutItems.filter(
          (i) => i.product_id === product.id,
        ).length;

        return (
          <div
            key={product.id}
            className="bg-gray-800/60 backdrop-blur rounded-xl border border-gray-700/50 overflow-hidden"
          >
            {/* Product Summary / Header */}
            <div className="p-3 flex items-center gap-2">
              <button
                onClick={() =>
                  setEditingProductId(isEditing ? null : product.id)
                }
                className="flex items-center gap-2 flex-1 text-left min-w-0"
              >
                {/* Group Badge */}
                <div
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: product.color_hex, color: "#111" }}
                >
                  {product.group || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-white text-sm truncate">
                      {product.name}
                    </h3>
                    <span className="text-xs text-yellow-400 font-bold flex-shrink-0 ml-2">
                      {insertedCount} / {product.qty} pcs
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {product.length_cm}×{product.width_cm}×{product.height_cm}{" "}
                    cm · {product.weight_kg} kg
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
                {/* Name + Group */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Name
                    </label>
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) =>
                        updateProduct(product.id, { name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      placeholder="Product name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Group
                    </label>
                    <input
                      type="text"
                      value={product.group}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          group: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      placeholder="A"
                      maxLength={4}
                    />
                  </div>
                </div>

                {/* L, W, H */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      L (cm)
                    </label>
                    <input
                      type="number"
                      value={product.length_cm || ""}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          length_cm: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      W (cm)
                    </label>
                    <input
                      type="number"
                      value={product.width_cm || ""}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          width_cm: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      H (cm)
                    </label>
                    <input
                      type="number"
                      value={product.height_cm || ""}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          height_cm: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                </div>

                {/* 3D Preview */}
                <div className="h-32 bg-gray-950/50 rounded-lg overflow-hidden border border-gray-700/50 relative">
                  <div className="absolute top-1 left-2 text-[10px] text-gray-500 font-medium z-10">
                    3D Preview
                  </div>
                  <Canvas camera={{ position: [2.5, 2, 2.5], fov: 40 }}>
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <ProductPreview product={product} />
                  </Canvas>
                </div>

                {/* Weight, Qty */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Weight / pc (kg)
                    </label>
                    <input
                      type="number"
                      value={product.weight_kg === 0 ? "" : product.weight_kg}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          weight_kg: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={0}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Total PCS
                    </label>
                    <input
                      type="number"
                      value={product.qty || ""}
                      onChange={(e) =>
                        updateProduct(product.id, {
                          qty: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      min={1}
                    />
                  </div>
                </div>

                {/* Constraints + Color */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs text-gray-500 font-medium">
                    Constraints (untuk Auto Pack &amp; AI Pack)
                  </div>
                  <div className="grid grid-cols-1 gap-y-1.5">
                    <label
                      className="flex items-start gap-2 cursor-pointer"
                      title="Sisi atas produk (label 'Top') harus selalu menghadap ke atas. Produk tidak boleh dibalik terbalik."
                    >
                      <input
                        type="checkbox"
                        checked={product.this_side_up}
                        onChange={(e) =>
                          updateProduct(product.id, {
                            this_side_up: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-300">
                        ↑ This Side Up
                        <span className="block text-[10px] text-gray-500">
                          Sisi atas wajib tetap di atas — tidak boleh dibalik
                        </span>
                      </span>
                    </label>

                    <label
                      className={`flex items-start gap-2 ${product.this_side_up ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                      title="Boleh direbahkan/ditidurkan (sisi samping jadi alas), tetapi sisi atas asli tidak boleh menghadap ke bawah. Hanya berlaku jika 'This Side Up' aktif."
                    >
                      <input
                        type="checkbox"
                        checked={product.can_be_laid_down}
                        disabled={!product.this_side_up}
                        onChange={(e) =>
                          updateProduct(product.id, {
                            can_be_laid_down: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
                      />
                      <span className="text-xs text-gray-300">
                        ↔ Boleh Ditidurkan
                        <span className="block text-[10px] text-gray-500">
                          {product.this_side_up
                            ? "Boleh rebah miring, tapi sisi atas asli tetap tidak boleh menghadap bawah"
                            : 'Aktifkan "This Side Up" dulu agar aturan ini berlaku'}
                        </span>
                      </span>
                    </label>

                    <label
                      className="flex items-start gap-2 cursor-pointer"
                      title="Jika dimatikan, tidak boleh ada produk lain diletakkan di atasnya (misal: meja dengan kaki kecil)."
                    >
                      <input
                        type="checkbox"
                        checked={product.stackable}
                        onChange={(e) =>
                          updateProduct(product.id, {
                            stackable: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-300">
                        📦 Boleh Ditumpuk (Stackable)
                        <span className="block text-[10px] text-gray-500">
                          Matikan jika TIDAK BOLEH ada barang di atasnya
                        </span>
                      </span>
                    </label>

                    <label
                      className="flex items-start gap-2 cursor-pointer"
                      title="Produk ini harus selalu ditempatkan di lapisan/posisi paling atas dalam kontainer, tidak boleh ada yang ditumpuk di atasnya."
                    >
                      <input
                        type="checkbox"
                        checked={product.must_be_on_top}
                        onChange={(e) =>
                          updateProduct(product.id, {
                            must_be_on_top: e.target.checked,
                            stackable: e.target.checked
                              ? false
                              : product.stackable,
                          })
                        }
                        className="w-3.5 h-3.5 mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-300">
                        ⬆ Harus Di Atas (Must Be On Top)
                        <span className="block text-[10px] text-gray-500">
                          Wajib di posisi teratas — misal barang
                          ringan/rapuh/meja kaki kecil
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-500">Color:</span>
                    <input
                      type="color"
                      value={product.color_hex}
                      onChange={(e) =>
                        updateProduct(product.id, { color_hex: e.target.value })
                      }
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                      title="Change color"
                    />
                  </div>
                </div>

                {/* Actions: Update All, Clear, Delete */}
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

function darkenColor(hex: string, factor: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((c >> 16) & 255) * (1 - factor));
  const g = Math.round(((c >> 8) & 255) * (1 - factor));
  const b = Math.round((c & 255) * (1 - factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
