import { PackItem, PlacedItem, ContainerDims } from './binPacking';

export async function aiPackContainer(
  provider: 'gemini' | 'openai',
  apiKey: string,
  container: ContainerDims,
  items: PackItem[],
  customPrompt: string = ''
): Promise<{ placed: PlacedItem[], unplaced: Array<{ productId: string; qty: number }> }> {
  if (!apiKey) {
    throw new Error('API Key is required for AI Auto-Pack.');
  }

  const systemPrompt = `
You are an expert 3D Bin Packing AI. Your task is to calculate the optimal coordinates and rotations for placing a list of items into a shipping container.

CONTAINER SPECS:
- Dimensions (L x W x H): ${container.length} x ${container.width} x ${container.height} cm
- Max Payload: ${container.maxPayloadKg} kg

ITEMS TO PACK:
${items.map(item => `- ID: ${item.productId} | Name: ${item.name} | Qty: ${item.qty} | LxWxH: ${item.length}x${item.width}x${item.height} cm | Weight: ${item.weight} kg
  Constraints: Stackable: ${item.stackable}, This Side Up: ${item.thisSideUp}, Must Be On Top: ${item.mustBeOnTop}, Can Be Laid Down: ${item.canBeLaidDown}`).join('\n')}

RULES:
1. No items can overlap in 3D space (x, y, z are coordinates from bottom-left-back corner: 0, 0, 0).
2. X is along length (0 to ${container.length}), Y is along height (0 to ${container.height}), Z is along width (0 to ${container.width}).
3. Total weight cannot exceed ${container.maxPayloadKg} kg.
4. If "Stackable" is false, no other item can be placed on top of it.
5. If "This Side Up" is true, it MUST NOT be rotated along X or Z axes (only Y rotation allowed).
6. If "Must Be On Top" is true, it must be placed at the highest Y position for its X,Z footprint (nothing on top of it).
7. If "Can Be Laid Down" is false, it must remain upright.
8. ${customPrompt ? `CUSTOM RULE: ${customPrompt}` : 'Optimize for density and stability.'}

Output ONLY valid JSON matching this schema exactly (no markdown, no explanations):
{
  "placed": [
    {
      "productId": "string",
      "instanceNo": 1,
      "x": 0, "y": 0, "z": 0,
      "length": 0, "width": 0, "height": 0,
      "rotX": 0, "rotY": 0, "rotZ": 0
    }
  ],
  "unplaced": [
    { "productId": "string", "qty": 0 }
  ]
}
`;

  try {
    let resultJson = '';

    if (provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      resultJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview', // or gpt-3.5-turbo
          messages: [{ role: 'system', content: systemPrompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      resultJson = data.choices?.[0]?.message?.content || '';
    }

    // Clean up markdown block if present
    resultJson = resultJson.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(resultJson);
  } catch (error: any) {
    console.error('AI Packing Error:', error);
    throw new Error(`AI Auto-Pack failed: ${error.message}`);
  }
}
