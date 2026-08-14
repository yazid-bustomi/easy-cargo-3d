import type { ContainerType, Product } from '../store/plannerStore';

/**
 * Builds a ready-to-paste command for an external AI image generator
 * (Gemini/GPT/etc image tools), auto-filled with the real container
 * spec and product list from the current project — nothing left as
 * "[...]" placeholders. The AI is asked to produce 4 differently
 * strategized layout variants, each with a right-view and left-view
 * image plus a text summary of what didn't fit.
 *
 * This is a pure formatting helper — it does not call any AI itself,
 * it only builds the text. Copying/sending it is wired up in Toolbar.tsx.
 */
export function buildAiImagePrompt(
  container: ContainerType,
  products: Product[]
): string {
  const boolLabel = (v: boolean, yes: string, no: string) => (v ? yes : no);

  const productLines = products
    .map((p, idx) => {
      const rules = [
        boolLabel(p.stackable, 'boleh ditumpuk', 'TIDAK boleh ditumpuk (jadi alas)'),
        boolLabel(!p.this_side_up, 'boleh dibalik/rebah bebas', 'this-side-up, TIDAK boleh dibalik'),
        boolLabel(p.can_be_laid_down, 'boleh ditidurkan', 'TIDAK boleh ditidurkan, harus berdiri'),
        boolLabel(p.must_be_on_top, 'HARUS di lapisan paling atas', 'posisi bebas (atas/bawah)'),
      ].join(', ');

      return `${idx + 1}. ${p.name} — ${p.length_cm}x${p.width_cm}x${p.height_cm} cm — ${p.weight_kg} kg/pcs — qty ${p.qty} pcs — ${rules}`;
    })
    .join('\n');

  const totalWeight = products.reduce((sum, p) => sum + p.weight_kg * p.qty, 0);

  return `Kamu adalah AI visualisasi cargo loading. Buatkan 4 varian gambar penataan barang di dalam container berikut, masing-masing dengan strategi penyusunan yang berbeda (mis: prioritas berat di bawah, prioritas volume, prioritas grup product, dan campuran).

=== SPESIFIKASI CONTAINER ===
Nama: ${container.name}
Panjang x Lebar x Tinggi: ${container.length_cm} x ${container.width_cm} x ${container.height_cm} cm
Max payload: ${container.max_payload_kg} kg

=== DAFTAR PRODUCT (total ${products.reduce((s, p) => s + p.qty, 0)} pcs, total berat ${totalWeight.toLocaleString()} kg) ===
(format: Nama — P x L x T cm — berat/pcs — qty — aturan)
${productLines}

=== ATURAN PENYUSUNAN ===
- Semua ukuran & posisi harus proporsional/skala terhadap ukuran container asli (jangan asal komposisi).
- Barang boleh diputar berdiri, ditidurkan, atau dibalik HANYA jika aturan product tsb di atas mengizinkan.
- Total berat semua barang yang ditata tidak boleh melebihi max payload container (${container.max_payload_kg} kg).
- Product dengan "HARUS di lapisan paling atas" tidak boleh ditumpuk product lain di atasnya.
- Product dengan "TIDAK boleh ditumpuk" tidak boleh jadi alas product lain.
- Usahakan semaksimal mungkin semua qty product masuk ke dalam container. Kalau ada yang tidak muat, sebutkan namanya + sisa qty yang tidak muat secara eksplisit di keterangan gambar (jangan disembunyikan).

=== OUTPUT YANG DIMINTA ===
Untuk MASING-MASING dari 4 varian, buatkan:
1. Gambar tampak KANAN container (side view kanan), menunjukkan susunan barang secara teknis/blueprint-style, dengan label ukuran container.
2. Gambar tampak KIRI container (side view kiri), sama gayanya.
3. Ringkasan teks singkat di bawah tiap gambar: total barang masuk, total berat terpakai / max payload, dan daftar product yang tidak muat (kalau ada) beserta sisa qty-nya.

Beri judul "Varian 1", "Varian 2", "Varian 3", "Varian 4" untuk membedakan strategi penyusunannya.`;
}
