/**
 * PDF Report Generator — EasyCargo-style
 * -----------------------------------------------------------------------
 * Generates a 2-page PDF report using jsPDF + html2canvas:
 *   Page 1: Right side view + product table
 *   Page 2: Left side view + product table
 * -----------------------------------------------------------------------
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Product, LayoutItem, ProjectConfig, LayoutStats } from '../store/plannerStore';

interface ReportData {
  projectConfig: ProjectConfig;
  products: Product[];
  layoutItems: LayoutItem[];
  stats: LayoutStats;
  rightViewImage: string; // base64 data URL
  leftViewImage: string;  // base64 data URL
  logoBase64: string;     // base64 data URL
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Group layoutItems by product and compute aggregate data */
function getProductSummary(products: Product[], layoutItems: LayoutItem[]) {
  return products
    .map((p) => {
      const placed = layoutItems.filter(li => li.product_id === p.id);
      const pcs = placed.length;
      const totalWeight = Math.round(p.weight_kg * pcs * 100) / 100;
      return {
        group: p.group || '',
        color: p.color_hex,
        name: p.name,
        pcs,
        length_cm: p.length_cm,
        width_cm: p.width_cm,
        height_cm: p.height_cm,
        totalWeight,
        thisSideUp: p.this_side_up,
      };
    })
    .filter(p => p.pcs > 0);
}

function buildContainerInfoHTML(container: any, stats: LayoutStats): string {
  const containerVolM3 = (container.length_cm * container.width_cm * container.height_cm / 1_000_000).toFixed(2);
  const usedVolM3 = (stats.usedVolume / 1_000_000).toFixed(2);

  return `
    <div class="container-detail">
      <div class="detail-row"><span class="detail-label">Container:</span> <span class="detail-value">${escapeHtml(container.name)}</span></div>
      <div class="detail-row"><span class="detail-label">Dimensions:</span> <span class="detail-value">${container.length_cm} × ${container.width_cm} × ${container.height_cm} cm</span></div>
      <div class="detail-row"><span class="detail-label">Max Payload:</span> <span class="detail-value">${container.max_payload_kg.toLocaleString()} kg</span></div>
      <div class="detail-row"><span class="detail-label">Volume:</span> <span class="detail-value">${containerVolM3} m³</span></div>
    </div>
    <table class="stats-table">
      <thead>
        <tr>
          <th></th>
          <th>Weight</th>
          <th>Volume</th>
          <th>Free meters</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="icon-cell">🚛</td>
          <td>${container.max_payload_kg.toLocaleString()} kg</td>
          <td>${containerVolM3} m³</td>
          <td>${(container.length_cm / 100).toFixed(2)} m</td>
        </tr>
        <tr>
          <td class="icon-cell">📦</td>
          <td>${stats.totalWeight.toLocaleString()} kg</td>
          <td>${usedVolM3} m³</td>
          <td></td>
        </tr>
        <tr class="total-row">
          <td class="icon-cell">📊</td>
          <td>${stats.weightPercent}%</td>
          <td>${stats.volumePercent}%</td>
          <td>${stats.freeMeters.toFixed(2)} m</td>
        </tr>
      </tbody>
    </table>
  `;
}

function buildProductTable(productSummary: ReturnType<typeof getProductSummary>): string {
  const rows = productSummary.map((p) => `
    <tr>
      <td class="group-cell">
        <span class="group-badge" style="background-color: ${p.color}; color: #000;">${escapeHtml(p.group)}</span>
      </td>
      <td class="desc-cell">${escapeHtml(p.name)}</td>
      <td class="num-cell">${p.pcs}</td>
      <td class="num-cell">${p.length_cm}</td>
      <td class="num-cell">${p.width_cm}</td>
      <td class="num-cell">${p.height_cm}</td>
      <td class="num-cell">${p.totalWeight}</td>
    </tr>
  `).join('');

  const totalPcs = productSummary.reduce((s, p) => s + p.pcs, 0);
  const totalWt = Math.round(productSummary.reduce((s, p) => s + p.totalWeight, 0) * 100) / 100;

  return `
    <table class="product-table">
      <thead>
        <tr>
          <th class="group-th">Group</th>
          <th class="desc-th">Description</th>
          <th class="num-th">Pcs</th>
          <th class="num-th">Length</th>
          <th class="num-th">Width</th>
          <th class="num-th">Height</th>
          <th class="num-th">Tot. Weight</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td></td>
          <td class="desc-cell"><strong>Total</strong></td>
          <td class="num-cell"><strong>${totalPcs}</strong></td>
          <td></td>
          <td></td>
          <td></td>
          <td class="num-cell"><strong>${totalWt} kg</strong></td>
        </tr>
      </tfoot>
    </table>
  `;
}

function buildPage(data: ReportData, viewImage: string, viewLabel: string): string {
  const { projectConfig, products, layoutItems, stats, logoBase64 } = data;
  const container = projectConfig.containerType;
  const productSummary = getProductSummary(products, layoutItems);

  return `
    <div class="page">
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <img src="${logoBase64}" class="logo" alt="Logo" />
        </div>
        <div class="header-right">
          <h1 class="project-name">${escapeHtml(projectConfig.name)}</h1>
          <div class="container-info">
            ${escapeHtml(container.name)} (${container.length_cm} × ${container.width_cm} × ${container.height_cm} cm)
            &nbsp;|&nbsp; ${layoutItems.length} items loaded
          </div>
        </div>
      </div>

      <!-- Container Info + Stats (left column style) -->
      ${buildContainerInfoHTML(container, stats)}

      <!-- Product Table -->
      ${buildProductTable(productSummary)}

      <!-- 3D View Image -->
      <div class="view-container">
        <div class="view-label">${viewLabel}</div>
        <img src="${viewImage}" class="view-image" alt="${viewLabel}" />
      </div>

      <!-- Footer -->
      <div class="footer">
        <span>Easy Cargo 3D</span>
        <span>${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  `;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1f2937;
    background: #fff;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18px 24px;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  .page:last-child {
    page-break-after: auto;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 10px;
    margin-bottom: 10px;
  }

  .header-left { display: flex; align-items: center; }

  .logo {
    height: 48px;
    width: auto;
    object-fit: contain;
  }

  .header-right { text-align: right; }

  .project-name {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: #111827;
  }

  .container-info {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
  }

  /* Container Detail */
  .container-detail {
    margin-bottom: 8px;
    padding: 6px 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }

  .detail-row {
    font-size: 10px;
    padding: 2px 0;
  }

  .detail-label {
    font-weight: 600;
    color: #4b5563;
  }

  .detail-value {
    color: #1f2937;
  }

  /* 3D View */
  .view-container {
    position: relative;
    margin-top: 8px;
    margin-bottom: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    text-align: center;
    flex: 1;
    min-height: 200px;
  }

  .view-label {
    position: absolute;
    top: 6px;
    left: 10px;
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    background: rgba(255,255,255,0.8);
    padding: 2px 8px;
    border-radius: 3px;
    z-index: 1;
  }

  .view-image {
    width: 100%;
    height: 100%;
    max-height: 340px;
    object-fit: contain;
  }

  /* Stats Table */
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 10px;
  }

  .stats-table th, .stats-table td {
    padding: 4px 8px;
    text-align: right;
    border: 1px solid #d1d5db;
  }

  .stats-table th {
    background: #f3f4f6;
    font-weight: 600;
    color: #4b5563;
    font-size: 9px;
    text-transform: uppercase;
  }

  .stats-table .icon-cell {
    text-align: center;
    width: 30px;
  }

  .stats-table .total-row {
    font-weight: 700;
    background: #f9fafb;
  }

  /* Product Table */
  .product-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    font-size: 10px;
  }

  .product-table th, .product-table td {
    padding: 4px 6px;
    border: 1px solid #d1d5db;
    text-align: left;
  }

  .product-table th {
    background: #f3f4f6;
    font-weight: 600;
    color: #374151;
    font-size: 9px;
    text-transform: uppercase;
  }

  .group-th { width: 50px; text-align: center; }
  .desc-th { }
  .num-th { width: 55px; text-align: center; }

  .group-cell { text-align: center; vertical-align: middle; }

  .group-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-weight: 700;
    font-size: 10px;
    min-width: 24px;
    text-align: center;
  }

  .desc-cell { text-align: left; }
  .num-cell { text-align: center; }

  .product-table .total-row td {
    border-top: 2px solid #374151;
    background: #f9fafb;
  }

  /* Footer */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 6px;
    border-top: 1px solid #d1d5db;
    font-size: 9px;
    color: #9ca3af;
    margin-top: auto;
  }
`;

export async function generatePDFReport(data: ReportData): Promise<void> {
  const page1Html = buildPage(data, data.rightViewImage, 'Right Side View');
  const page2Html = buildPage(data, data.leftViewImage, 'Left Side View');

  // Create off-screen wrapper for rendering
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '-9999px';
  wrapper.style.width = '210mm';
  wrapper.style.background = '#fff';
  wrapper.style.zIndex = '-9999';
  document.body.appendChild(wrapper);

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;

    for (let i = 0; i < 2; i++) {
      const pageHtml = i === 0 ? page1Html : page2Html;

      // Set wrapper content with CSS
      wrapper.innerHTML = `<style>${CSS}</style>${pageHtml}`;

      // Wait for images (logo + 3D capture) to load
      const images = wrapper.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }));

      // Small delay for font loading
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Calculate dimensions to fit A4
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      if (i > 0) pdf.addPage();

      // If the image is taller than the page, scale it down
      if (imgHeight > pageHeight) {
        const scaledWidth = (canvas.width * pageHeight) / canvas.height;
        pdf.addImage(imgData, 'JPEG', (pageWidth - scaledWidth) / 2, 0, scaledWidth, pageHeight);
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      }
    }

    pdf.save(`${data.projectConfig.name} - EasyCargo report.pdf`);
  } catch (err) {
    console.error('PDF Generation failed', err);
    throw err;
  } finally {
    document.body.removeChild(wrapper);
  }
}

/** Convert an image URL to base64 data URL */
export async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
