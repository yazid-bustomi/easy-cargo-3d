import { PackItem, ContainerDims } from './binPacking';

function describeOrientationRule(item: PackItem): string {
  if (!item.thisSideUp) {
    return 'Boleh diputar/direbahkan bebas ke arah manapun, termasuk dibalik (tidak ada batasan sisi atas).';
  }
  if (item.canBeLaidDown) {
    return 'Boleh DIREBAHKAN/DITIDURKAN (sisi samping menjadi alas), TETAPI sisi atas aslinya (label "Top") TIDAK BOLEH menghadap ke bawah. Dilarang membalik 180° / terbalik.';
  }
  return 'HANYA boleh berdiri tegak dengan sisi atas aslinya (label "Top") menghadap ke atas. TIDAK BOLEH direbahkan/ditidurkan dan TIDAK BOLEH dibalik sama sekali.';
}

function describeStackingRule(item: PackItem): string {
  if (item.mustBeOnTop) {
    return 'WAJIB berada di posisi/lapisan PALING ATAS untuk area (X,Z) yang ditempatinya — tidak boleh ada barang lain di atasnya, dan barang ini sendiri tidak boleh ditumpuk di atas ruang kosong (harus jadi lapisan penutup teratas).';
  }
  if (!item.stackable) {
    return 'TIDAK BOLEH ada barang lain diletakkan di atasnya sama sekali (misalnya karena berupa meja/rak dengan kaki kecil yang tidak kuat menahan beban di atasnya).';
  }
  return 'Boleh ditumpuk barang lain di atasnya, selama tumpuan penuh (bidang atasnya tertutup rata) dan tidak melebihi batas berat kontainer.';
}

export async function aiPackContainer(
  provider: 'gemini' | 'openai',
  apiKey: string,
  container: ContainerDims,
  items: PackItem[],
  customPrompt: string = ''
): Promise<{
  placed: Array<{ productId: string; instanceNo: number; rotX: number; rotY: number; rotZ: number }>;
  unplaced: Array<{ productId: string; qty: number }>;
}> {
  if (!apiKey) {
    throw new Error('API Key is required for AI Auto-Pack.');
  }

  const itemsBlock = items.map((item, idx) => `
${idx + 1}. ID: "${item.productId}" — ${item.name}
   Ukuran asli (L x W x H): ${item.length} x ${item.width} x ${item.height} cm
   Berat per pcs: ${item.weight} kg | Jumlah: ${item.qty} pcs
   Grup: ${item.group || '-'}
   - Orientasi: ${describeOrientationRule(item)}
   - Tumpukan: ${describeStackingRule(item)}`).join('\n');

  const systemPrompt = `
Anda adalah AI ahli 3D Bin Packing untuk perencanaan muat barang ke dalam container pengiriman (seperti software EasyCargo). Tugas Anda: tentukan urutan product dan rotasi 90 derajat terbaik untuk setiap product agar local packing engine dapat menyusun barang RAPI, RAPAT, dan STABIL. JANGAN menghitung koordinat x/y/z, JANGAN mengeluarkan posisi final, dan JANGAN mengeluarkan ukuran hasil rotasi.

=== SPESIFIKASI CONTAINER ===
- Dimensi internal (L x W x H): ${container.length} x ${container.width} x ${container.height} cm
- Kapasitas berat maksimum: ${container.maxPayloadKg} kg
- Dimensi container dipakai hanya sebagai konteks untuk memilih rotasi/urutan.
- Koordinat final dihitung oleh local packing engine dan tidak boleh dikeluarkan AI.

=== DAFTAR BARANG & BATASAN MASING-MASING ===
${itemsBlock}

=== ATURAN WAJIB UNTUK MEMILIH ROTASI/URUTAN ===
1. WAJIB mematuhi this_side_up dan can_be_laid_down.
2. WAJIB mematuhi stackable dan must_be_on_top.
3. Pilih hanya rotasi kelipatan 90 derajat.
4. Prioritaskan rotasi yang membuat footprint efisien untuk local packer.
5. Kelompokkan product dari group yang sama sedekat mungkin.
6. Jangan mengeluarkan koordinat x/y/z.
7. Jangan mengeluarkan ukuran hasil rotasi.

=== ATURAN PENATAAN RAPI (agar hasil terlihat profesional, bukan asal muat) ===
8. Kelompokkan barang dari grup/jenis yang sama menjadi satu blok/kolom yang berdekatan, bukan tersebar acak di seluruh container.
9. Susun barang membentuk lapisan (layer) horizontal yang rata sebelum naik ke lapisan berikutnya — hindari membuat "menara" sempit yang goyah.
10. Prioritaskan barang yang lebih berat dan lebih besar di lapisan bawah untuk kestabilan, kecuali constraint "must_be_on_top" mengharuskan sebaliknya.
11. Minimalkan celah/rongga kosong di antar barang (dorong barang serapat mungkin ke sudut dan ke barang lain) untuk memaksimalkan utilisasi ruang.
12. Sisakan barang yang tidak muat pada array "unplaced" — jangan memaksakan penempatan yang melanggar aturan di atas.
${customPrompt ? `\n=== INSTRUKSI TAMBAHAN DARI USER (prioritas di atas aturan penataan #8-11, TIDAK BOLEH melanggar aturan fisik #1-7) ===\n${customPrompt}\n` : ''}

=== FORMAT OUTPUT ===
JANGAN menghitung koordinat x/y/z dan JANGAN mengeluarkan ukuran hasil rotasi.
Posisi final akan dihitung oleh engine packing lokal yang deterministik.

Keluarkan HANYA JSON valid sesuai skema berikut:
{
  "placed": [
    {
      "productId": "string",
      "instanceNo": 1,
      "rotX": 0,
      "rotY": 0,
      "rotZ": 0
    }
  ],
  "unplaced": [
    { "productId": "string", "qty": 0 }
  ]
}

WAJIB:
- placed berisi TEPAT satu baris per productId unik.
- instanceNo selalu 1.
- rotX/rotY/rotZ hanya 0, 90, atau 180, atau 270.
- unplaced boleh kosong.
- Jangan memasukkan markdown, komentar, atau teks di luar JSON.
- Jawaban harus singkat dan selesai dalam satu JSON.
`;

  const parseAiJson = (raw: string) => {
    const cleaned = String(raw || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!cleaned) {
      throw new Error('AI returned an empty response.');
    }

    try {
      return JSON.parse(cleaned);
    } catch {
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first >= 0 && last > first) {
        try {
          return JSON.parse(cleaned.slice(first, last + 1));
        } catch {
          // fall through to the clearer error below
        }
      }
      throw new Error('AI returned incomplete or invalid JSON.');
    }
  };

  try {
    let parsed: any = null;
    let lastError: any = null;

    if (provider === 'gemini') {
      // Smaller/faster model first. Both models support generateContent and
      // structured JSON output. See Google AI Gemini API docs. 
      const geminiModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];

      const responseSchema = {
        type: 'OBJECT',
        properties: {
          placed: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                productId: { type: 'STRING' },
                instanceNo: { type: 'INTEGER' },
                rotX: { type: 'INTEGER' },
                rotY: { type: 'INTEGER' },
                rotZ: { type: 'INTEGER' },
              },
              required: ['productId', 'instanceNo', 'rotX', 'rotY', 'rotZ'],
            },
          },
          unplaced: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                productId: { type: 'STRING' },
                qty: { type: 'INTEGER' },
              },
              required: ['productId', 'qty'],
            },
          },
        },
        required: ['placed', 'unplaced'],
      };

      for (const model of geminiModels) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [{ text: systemPrompt }],
                }],
                generationConfig: {
                  maxOutputTokens: 4096,
                  thinkingConfig: {
                    thinkingLevel: 'minimal',
                  },
                  responseMimeType: 'application/json',
                  responseSchema,
                },
              }),
            },
          );

          const data = await response.json();
          if (!response.ok || data.error) {
            throw new Error(
              data?.error?.message ||
              `Gemini ${model} request failed with HTTP ${response.status}`,
            );
          }

          const candidate = data.candidates?.[0];
          const resultJson = candidate?.content?.parts
            ?.map((part: any) => part.text || '')
            .join('') || '';

          if (!resultJson) {
            const finishReason = candidate?.finishReason || data.promptFeedback?.blockReason;
            throw new Error(
              finishReason
                ? `Gemini ${model} returned no text (finishReason=${finishReason}).`
                : `Gemini ${model} returned an empty response.`,
            );
          }

          parsed = parseAiJson(resultJson);

          if (!Array.isArray(parsed?.placed) || !Array.isArray(parsed?.unplaced)) {
            throw new Error(`Gemini ${model} returned an invalid packing schema.`);
          }

          break;
        } catch (error) {
          lastError = error;
          parsed = null;
        }
      }
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'system', content: systemPrompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data?.error?.message || `OpenAI request failed with HTTP ${response.status}`);
      }

      parsed = parseAiJson(data.choices?.[0]?.message?.content || '');
    }

    if (!parsed) {
      throw lastError || new Error('AI returned no usable result.');
    }

    return {
      placed: Array.isArray(parsed.placed) ? parsed.placed : [],
      unplaced: Array.isArray(parsed.unplaced) ? parsed.unplaced : [],
    };
  } catch (error: any) {
    console.error('AI Packing Error:', error);
    throw new Error(`AI Auto-Pack failed: ${error?.message || 'Unknown AI error'}`);
  }
}