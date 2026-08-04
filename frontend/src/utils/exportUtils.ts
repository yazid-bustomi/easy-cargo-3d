import html2canvas from 'html2canvas';

/**
 * Export 3D canvas as PNG screenshot
 */
export async function exportCanvasToPNG(
  canvasElement: HTMLCanvasElement,
  filename: string = 'container-layout.png'
): Promise<void> {
  try {
    const link = document.createElement('a');
    link.href = canvasElement.toDataURL('image/png');
    link.download = filename;
    link.click();
  } catch (error) {
    console.error('Error exporting PNG:', error);
    throw error;
  }
}

/**
 * Export layout information as PDF
 */
export async function exportLayoutToPDF(
  layoutData: any,
  containerData: any,
  stats: any,
  filename: string = 'container-layout.pdf'
): Promise<void> {
  try {
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: white;
              color: #333;
            }
            .header {
              border-bottom: 2px solid #1f2937;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0 0 5px 0;
              color: #1f2937;
            }
            .header p {
              margin: 5px 0;
              color: #666;
              font-size: 14px;
            }
            .container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .section {
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 8px;
              background: #f9fafb;
            }
            .section h2 {
              margin: 0 0 10px 0;
              font-size: 16px;
              color: #1f2937;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 8px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
              border-bottom: 1px solid #efefef;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #4b5563;
            }
            .info-value {
              color: #1f2937;
            }
            .progress-bar {
              width: 100%;
              height: 20px;
              background: #e5e7eb;
              border-radius: 4px;
              overflow: hidden;
              margin-top: 8px;
            }
            .progress-fill {
              height: 100%;
              background: #3b82f6;
              transition: width 0.3s ease;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              font-size: 13px;
            }
            .items-table th {
              background: #f3f4f6;
              padding: 10px;
              text-align: left;
              font-weight: bold;
              border-bottom: 2px solid #d1d5db;
              color: #1f2937;
            }
            .items-table td {
              padding: 8px 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 Container Loading Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>

          <div class="container">
            <div class="section">
              <h2>Container Information</h2>
              <div class="info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${containerData.name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Code:</span>
                <span class="info-value">${containerData.code}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Dimensions:</span>
                <span class="info-value">${containerData.length_cm} × ${containerData.width_cm} × ${containerData.height_cm} cm</span>
              </div>
              <div class="info-row">
                <span class="info-label">Volume:</span>
                <span class="info-value">${(containerData.length_cm * containerData.width_cm * containerData.height_cm / 1000000).toFixed(2)} m³</span>
              </div>
              <div class="info-row">
                <span class="info-label">Max Payload:</span>
                <span class="info-value">${containerData.max_payload_kg} kg</span>
              </div>
            </div>

            <div class="section">
              <h2>Layout Statistics</h2>
              <div class="info-row">
                <span class="info-label">Items Loaded:</span>
                <span class="info-value">${stats.itemCount}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Weight:</span>
                <span class="info-value">${stats.totalWeight} kg</span>
              </div>
              <div class="info-row">
                <span class="info-label">Volume Used:</span>
                <span class="info-value">${(stats.usedVolume / 1000000).toFixed(2)} m³ (${stats.volumePercent}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, Number(stats.volumePercent))}%"></div>
              </div>
              <div class="info-row" style="margin-top: 12px;">
                <span class="info-label">Weight Usage:</span>
                <span class="info-value">${stats.weightPercent}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, Number(stats.weightPercent))}%; background: #f59e0b;"></div>
              </div>
            </div>
          </div>

          ${
            layoutData.items && layoutData.items.length > 0
              ? `
                <div class="section">
                  <h2>Loaded Items</h2>
                  <table class="items-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Weight (kg)</th>
                        <th>Position (X,Y,Z)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${layoutData.items
                        .map(
                          (item: any) => `
                        <tr>
                          <td>${item.product?.sku || 'N/A'}</td>
                          <td>${item.product?.name || 'Unknown'}</td>
                          <td>1</td>
                          <td>${item.product?.weight_kg || 0}</td>
                          <td>${item.pos_x.toFixed(1)}, ${item.pos_y.toFixed(1)}, ${item.pos_z.toFixed(1)}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              : '<div class="section"><p>No items loaded</p></div>'
          }

          <div class="footer">
            <p>Container Loading Planner 3D | Report generated automatically</p>
          </div>
        </body>
      </html>
    `;

    // Convert HTML to canvas then to image
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    element.style.display = 'none';
    document.body.appendChild(element);

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    document.body.removeChild(element);

    // Create PDF-like image
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename.replace('.pdf', '.png');
    link.click();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
}

/**
 * Export layout data as JSON
 */
export function exportLayoutAsJSON(layoutData: any, filename: string = 'layout.json'): void {
  try {
    const dataStr = JSON.stringify(layoutData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Error exporting JSON:', error);
    throw error;
  }
}
