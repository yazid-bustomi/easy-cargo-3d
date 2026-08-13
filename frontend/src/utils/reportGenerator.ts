/**
 * HTML Report Generator
 * -----------------------------------------------------------------------
 * Generates an HTML report exactly matching BERN288-A-report template
 * and opens it in a new window to use native window.print()
 * -----------------------------------------------------------------------
 */
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
    .filter(p => p.pcs > 0)
    // Group them by the 'group' letter, sorting alphabetically by group
    .sort((a, b) => a.group.localeCompare(b.group));
}

function buildProductTableHtml(productSummary: ReturnType<typeof getProductSummary>): string {
  // Group the products by their group letter
  const groupedProducts: Record<string, typeof productSummary> = {};
  productSummary.forEach(p => {
    if (!groupedProducts[p.group]) groupedProducts[p.group] = [];
    groupedProducts[p.group].push(p);
  });

  let rowsHtml = '';
  let groupCounter = 1;

  for (const [groupLetter, products] of Object.entries(groupedProducts)) {
    // Add Product Rows for this group
    for (const p of products) {
      // Create a badge color based on group if color is empty
      // We will map B -> #d9534f, D -> #4f6fd9, G -> #d9b21a exactly like the template if available,
      // otherwise use the color from the product.
      let badgeStyle = `background: ${p.color};`;
      if (p.group === 'B') badgeStyle = 'background: #d9534f; color: #fff;';
      if (p.group === 'D') badgeStyle = 'background: #4f6fd9; color: #fff;';
      if (p.group === 'G') badgeStyle = 'background: #d9b21a; color: #fff;';

      const restr = p.thisSideUp ? '&#8645; &#9632; &#9650;' : '&#8645;'; // simple representation of restrictions

      rowsHtml += `
        <tr>
          <td><span class="badge" style="${badgeStyle}">${escapeHtml(p.group)}</span>&nbsp; ${escapeHtml(p.name)}</td>
          <td class="num">${p.pcs}</td>
          <td class="num">${p.length_cm.toFixed(1)}</td>
          <td class="num">${p.width_cm.toFixed(1)}</td>
          <td class="num">${p.height_cm.toFixed(1)}</td>
          <td class="num">${p.totalWeight.toLocaleString()}</td>
          <td class="restr">${restr}</td>
        </tr>
      `;
    }
    groupCounter++;
  }

  return `
    <table class="report-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Pieces</th>
          <th class="num">Length</th>
          <th class="num">Width</th>
          <th class="num">Height</th>
          <th class="num">Total Weight</th>
          <th>Restrictions</th>
        </tr>
        <tr class="unit-row">
          <th></th>
          <th></th>
          <th class="num">cm</th>
          <th class="num"></th>
          <th class="num"></th>
          <th class="num">kg</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function buildPageHtml(data: ReportData, viewImage: string, sideTag: string): string {
  const { projectConfig, products, layoutItems, stats, logoBase64 } = data;
  const container = projectConfig.containerType;
  const productSummary = getProductSummary(products, layoutItems);

  const containerStr = `Container ${container.name} ${(container.length_cm * 10).toLocaleString()} mm x ${(container.width_cm * 10).toLocaleString()} mm x ${(container.height_cm * 10).toLocaleString()} mm`;
  const usedVolM3 = (stats.usedVolume / 1_000_000).toFixed(2);
  const dateStr = new Date().toLocaleString('en-US', { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return `
  <!-- ===================== PAGE - ${sideTag} ===================== -->
  <div class="page">
    <div class="timestamp-row">
      <span>${dateStr}</span>
      <span>${escapeHtml(projectConfig.name)} - report</span>
    </div>

    <div class="header">
      <div class="header-left">
        <h1>${escapeHtml(projectConfig.name)}</h1>
        <div class="meta">
          <div class="report-no">Report 001</div>
          <div class="container-line">${escapeHtml(containerStr)}</div>
          <div><span class="label">Total weight</span> ${stats.totalWeight.toLocaleString()} kg (${stats.weightPercent} %)</div>
          <div><span class="label">Total volume</span> ${usedVolM3} m<sup>3</sup> (${stats.volumePercent} %)</div>
          <div><span class="label">Shift to right</span> 0 m</div>
          <div><span class="label">Shift in length</span> 0 m</div>
          <div><span class="label">Free meters</span> ${stats.freeMeters.toFixed(3)} m</div>
        </div>
      </div>
      <div class="header-right">
        <img src="${logoBase64}" alt="Omega Mas logo">
        <div class="side-tag">${sideTag}</div>
      </div>
    </div>

    ${buildProductTableHtml(productSummary)}

    <div class="container-img">
      <img src="${viewImage}" alt="Container loading view - ${sideTag}">
    </div>

  </div>
  `;
}

const CSS = `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #e9e9e9;
      margin: 0;
      padding: 24px 0;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      background: #ffffff;
      width: 850px;
      margin: 0 auto 32px auto;
      padding: 28px 40px 40px 40px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      page-break-after: always;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .page {
        width: 100%;
        margin: 0;
        box-shadow: none;
        padding: 20px;
      }
    }

    .timestamp-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #444;
      margin-bottom: 18px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-left h1 {
      font-size: 26px;
      margin: 0 0 12px 0;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .meta {
      font-size: 13px;
      line-height: 1.65;
    }

    .meta .report-no {
      margin-bottom: 2px;
    }

    .meta .container-line {
      font-weight: 700;
      margin-bottom: 2px;
    }

    .meta .label {
      display: inline-block;
      width: 120px;
    }

    .header-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .header-right img {
      width: 100px;
      max-height: 55px;
      object-fit: contain;
    }

    .side-tag {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      margin-top: 10px;
    }

    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 26px;
      font-size: 12.5px;
      background: #ffffff;
    }

    table.report-table th {
      text-align: left;
      font-weight: 700;
      padding: 6px 8px;
      border-bottom: 1px solid #999;
      background: #ffffff;
    }

    table.report-table th.num,
    table.report-table td.num {
      text-align: right;
    }

    table.report-table .unit-row th {
      font-weight: 400;
      color: #444;
      font-size: 11px;
      padding-top: 0;
      border-bottom: 1px solid #999;
    }

    table.report-table .group-row td {
      font-weight: 700;
      padding: 8px 8px 4px 8px;
      border-bottom: 1px solid #ccc;
      background: #ffffff;
    }

    table.report-table tbody td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e2e2;
      background: #ffffff;
      vertical-align: middle;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      color: #000000;
      font-weight: 700;
      font-size: 11px;
      border-radius: 2px;
    }

    .restr {
      color: #bbb;
      letter-spacing: 2px;
      font-size: 13px;
    }

    .container-img {
      margin-top: 28px;
      text-align: center;
    }

    .container-img img {
      max-width: 100%;
      height: auto;
    }
`;

export async function generatePDFReport(data: ReportData): Promise<void> {
  const leftPageHtml = buildPageHtml(data, data.leftViewImage, 'LEFT');
  const rightPageHtml = buildPageHtml(data, data.rightViewImage, 'RIGHT');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(data.projectConfig.name)} - report</title>
      <style>${CSS}</style>
    </head>
    <body>
      ${leftPageHtml}
      ${rightPageHtml}
    </body>
    </html>
  `;

  // Open a new window
  const win = window.open('', '_blank');
  if (!win) {
    alert("Popup diblokir oleh browser. Tolong izinkan pop-ups untuk website ini agar bisa mencetak report.");
    return;
  }

  win.document.open();
  win.document.write(fullHtml);
  win.document.close();

  // Wait for images to load before printing
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 500);
  };
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
