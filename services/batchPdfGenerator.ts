/**
 * Servicio de Generación Masiva de PDFs
 */

import { PermitRecord } from '../types';
import { formatLongDate, formatSimpleDate, toProperCase } from '../utils/formatters';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';

const batchLogger = logger.create('BatchPDF');

interface BatchResult {
  success: number;
  failed: number;
  errors: { id: string; error: string }[];
}

/**
 * Genera un PDF individual sin abrir ventana (modo silencioso)
 * Retorna el base64 del PDF para descarga directa
 */
const generatePDFSilent = async (record: PermitRecord): Promise<{ pdfBase64: string; fileName: string } | null> => {
  const typeCode = record.solicitudType;
  const nombreMayuscula = record.funcionario.toUpperCase().trim();
  const nombreProperCase = toProperCase(record.funcionario);
  const actoOficial = record.acto.trim();
  const finalFileName = `SGDP-${typeCode} N° ${actoOficial} - ${nombreMayuscula}`;

  const basePayload = {
    "fileName": finalFileName,
    "Decreto": actoOficial,
    "FUNCIONARIO": nombreMayuscula,
    "Funcionario": nombreProperCase,
    "solicitudType": typeCode,
    "RUT": record.rut.trim(),
    "Fecha": formatSimpleDate(record.fechaDecreto),
    "Cantidad_de_días": record.cantidadDias.toString().replace('.', ','),
    "Fecha_de_inicio": formatLongDate(record.fechaInicio),
    "RA": record.ra,
    "Emite": record.emite
  };

  const hasTwoPeriods = typeCode === 'FL' && record.periodo2 && (record.solicitadoP2 || 0) > 0;

  const payload = typeCode === 'FL' ? {
    ...basePayload,
    "templateId": hasTwoPeriods ? CONFIG.TEMPLATE_FL_2P_DOC_ID : CONFIG.TEMPLATE_FL_1P_DOC_ID,
    "Fecha_de_Término": formatLongDate(record.fechaTermino || ''),
    "Período_1": record.periodo1 || '',
    "Saldo_Disponible_Periodo_1": (record.saldoDisponibleP1 || 0).toString().replace('.', ','),
    "Solicitados_Periodo_1": (record.solicitadoP1 || 0).toString().replace('.', ','),
    "Saldo_Final_Periodo_1": ((record.saldoDisponibleP1 || 0) - (record.solicitadoP1 || 0)).toString().replace('.', ','),
    ...(hasTwoPeriods ? {
      "Período_2": record.periodo2 || '',
      "Saldo_Disponible_Periodo_2": (record.saldoDisponibleP2 || 0).toString().replace('.', ','),
      "Solicitados_Periodo_2": (record.solicitadoP2 || 0).toString().replace('.', ','),
      "Saldo_Final_Periodo_2": ((record.saldoDisponibleP2 || 0) - (record.solicitadoP2 || 0)).toString().replace('.', ','),
    } : {}),
  } : {
    ...basePayload,
    "Tipo_de_Jornada": record.tipoJornada.replace(/[()]/g, '').trim(),
    "Días_a_su_haber": record.diasHaber.toFixed(1).replace('.', ','),
    "Saldo_final": (record.diasHaber - record.cantidadDias).toFixed(1).replace('.', ','),
  };

  const scriptUrl = typeCode === 'FL'
    ? (hasTwoPeriods ? CONFIG.WEB_APP_URL_FL_2P : CONFIG.WEB_APP_URL_FL)
    : CONFIG.WEB_APP_URL;

  const response = await fetch(scriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

  const result = await response.json();

  if (result.success && result.pdfBase64) {
    return { pdfBase64: result.pdfBase64, fileName: finalFileName.replace(/\//g, '_') };
  } else if (result.success && result.url) {
    // Si no hay base64 pero hay URL, intentar obtener el PDF desde la URL
    return null; // El servidor no devolvió el PDF en base64
  }

  throw new Error(result.error || 'Respuesta inválida');
};

/**
 * Descarga un PDF desde base64
 */
const downloadPDFFromBase64 = (pdfBase64: string, fileName: string) => {
  const byteCharacters = atob(pdfBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${fileName}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
};

/**
 * Genera PDFs para múltiples registros
 * Abre una sola ventana con progreso y todos los enlaces de descarga al final
 */
export const generateBatchPDFs = async (
  records: PermitRecord[],
  onProgress?: (current: number, total: number) => void
): Promise<BatchResult> => {
  const result: BatchResult = { success: 0, failed: 0, errors: [] };
  const total = records.length;
  const generatedPDFs: { fileName: string; pdfBase64?: string; url?: string }[] = [];

  batchLogger.info(`Iniciando generación masiva de ${total} PDFs`);

  // Abrir ventana de progreso
  const progressWindow = window.open('about:blank', '_blank', 'width=650,height=600');
  if (progressWindow) {
    progressWindow.document.write(`
      <html>
      <head>
        <title>GDP Cloud - Generando PDFs</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; padding: 40px; margin: 0; min-height: 100vh; box-sizing: border-box; }
          .container { max-width: 550px; margin: 0 auto; }
          h2 { text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; color: #64748b; margin-bottom: 20px; }
          .progress-bar { background: #1e293b; border-radius: 12px; height: 24px; overflow: hidden; margin-bottom: 15px; }
          .progress-fill { background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7); height: 100%; transition: width 0.3s ease; width: 0%; }
          .status { font-size: 32px; font-weight: 900; margin-bottom: 5px; }
          .current-file { font-size: 11px; color: #94a3b8; background: #1e293b; padding: 12px 16px; border-radius: 10px; margin-top: 15px; word-break: break-all; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>⚡ GDP Cloud Engine v${CONFIG.APP_VERSION}</h2>
          <div class="status" id="status">0 / ${total}</div>
          <div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
          <div class="current-file" id="current">Iniciando generación masiva...</div>
        </div>
      </body>
      </html>
    `);
  }

  // Procesar cada registro secuencialmente
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Actualizar ventana de progreso
    if (progressWindow && !progressWindow.closed) {
      try {
        const percent = Math.round(((i + 1) / total) * 100);
        const statusEl = progressWindow.document.getElementById('status');
        const progressEl = progressWindow.document.getElementById('progress');
        const currentEl = progressWindow.document.getElementById('current');

        if (statusEl) statusEl.textContent = `${i + 1} / ${total}`;
        if (progressEl) progressEl.style.width = `${percent}%`;
        if (currentEl) currentEl.textContent = `📄 ${record.funcionario} — ${record.solicitudType} ${record.acto}`;
      } catch { /* ventana cerrada */ }
    }

    try {
      const pdfData = await generatePDFSilent(record);
      if (pdfData) {
        generatedPDFs.push(pdfData);
        result.success++;
      } else {
        result.success++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: record.id, error: error instanceof Error ? error.message : 'Error' });
    }

    if (onProgress) onProgress(i + 1, total);

    // Pausa entre llamadas
    if (i < records.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  batchLogger.info(`Completado: ${result.success} éxitos, ${result.failed} fallos`);

  // Mostrar resultados finales
  if (progressWindow && !progressWindow.closed) {
    const pdfDataEntries = generatedPDFs.filter(p => p.pdfBase64).map((pdf, idx) =>
      `pdfData["${idx}"] = { b64: "${pdf.pdfBase64}", name: "${pdf.fileName}" };`
    ).join('\n');

    const pdfListHtml = generatedPDFs.map((pdf, idx) => `
      <div class="pdf-item">
        <div class="pdf-icon">📄</div>
        <div class="pdf-name">${pdf.fileName}</div>
        <div class="pdf-actions">
          ${pdf.pdfBase64 ? `<button class="btn btn-download" onclick="downloadPDF('${idx}')">⬇️ PDF</button>` : ''}
          ${pdf.url ? `<a href="${pdf.url}" target="_blank" class="btn btn-drive">📂 Drive</a>` : ''}
        </div>
      </div>
    `).join('');

    const errorsHtml = result.errors.map(e => `
      <div class="pdf-item error"><div class="pdf-icon">❌</div><div class="pdf-name">${e.error}</div></div>
    `).join('');

    progressWindow.document.body.innerHTML = `
      <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; padding: 30px; margin: 0; }
        .container { max-width: 580px; margin: 0 auto; }
        h2 { text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; color: #64748b; margin-bottom: 10px; }
        .summary { font-size: 36px; font-weight: 900; margin-bottom: 5px; color: #10b981; }
        .summary-sub { font-size: 13px; color: #64748b; margin-bottom: 25px; }
        .btn-all { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 25px; }
        .btn-all:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3); }
        .pdf-list { max-height: 300px; overflow-y: auto; }
        .pdf-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #1e293b; border-radius: 10px; margin-bottom: 6px; border: 1px solid #334155; }
        .pdf-item.error { border-color: #ef4444; }
        .pdf-icon { font-size: 16px; }
        .pdf-name { flex: 1; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pdf-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn { padding: 5px 10px; border-radius: 6px; font-size: 9px; font-weight: 700; text-decoration: none; cursor: pointer; border: none; }
        .btn-download { background: #ef4444; color: white; }
        .btn-drive { background: #3b82f6; color: white; }
        .close-btn { margin-top: 20px; padding: 10px 20px; background: #334155; color: #94a3b8; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 11px; }
      </style>
      <script>
        var pdfData = {};
        ${pdfDataEntries}
        
        function downloadPDF(idx) {
          var d = pdfData[idx]; if (!d) return;
          var bc = atob(d.b64), bn = new Array(bc.length);
          for (var i = 0; i < bc.length; i++) bn[i] = bc.charCodeAt(i);
          var blob = new Blob([new Uint8Array(bn)], {type: 'application/pdf'});
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = d.name + '.pdf';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        
        function downloadAll() {
          var keys = Object.keys(pdfData), i = 0;
          function next() { if (i < keys.length) { downloadPDF(keys[i++]); setTimeout(next, 800); } }
          next();
        }
      </script>
      <div class="container">
        <h2>⚡ GDP Cloud Engine</h2>
        <div class="summary">✓ ${result.success} PDFs</div>
        <div class="summary-sub">${result.failed > 0 ? `⚠️ ${result.failed} con errores` : 'Todos generados correctamente'}</div>
        ${generatedPDFs.some(p => p.pdfBase64) ? `<button class="btn-all" onclick="downloadAll()">⬇️ Descargar Todos</button>` : '<p style="color:#f59e0b;font-size:12px;">⚠️ El servidor no devolvió los PDFs en base64. Revisa tu Google Apps Script.</p>'}
        <div class="pdf-list">${pdfListHtml}${errorsHtml}</div>
        <button class="close-btn" onclick="window.close()">Cerrar ventana</button>
      </div>
    `;
  }

  return result;
};

/**
 * Exporta el Dashboard a PDF usando una ventana de impresión
 */
export const exportDashboardToPDF = async (
  elementId: string,
  title: string = 'Reporte Dashboard GDP Cloud'
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Elemento del dashboard no encontrado');
  }

  // Crear una ventana de impresión con estilos
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    throw new Error('No se pudo abrir ventana de impresión');
  }

  const currentDate = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Clonar estilos
  const styles = Array.from(document.styleSheets)
    .map(styleSheet => {
      try {
        return Array.from(styleSheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        ${styles}
        
        @media print {
          body { 
            padding: 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          color: #1e293b;
          padding: 40px;
        }
        
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .report-title {
          font-size: 24px;
          font-weight: 800;
          color: #1e293b;
        }
        
        .report-date {
          font-size: 12px;
          color: #64748b;
        }
        
        .report-content {
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div>
          <h1 class="report-title">${title}</h1>
          <p class="report-date">Generado el ${currentDate}</p>
        </div>
        <div>
          <img src="/logo.png" alt="GDP Cloud" style="height: 40px; opacity: 0.7;" onerror="this.style.display='none'" />
        </div>
      </div>
      <div class="report-content">
        ${element.innerHTML}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
};

/**
 * Genera un reporte resumen en texto plano
 */
export const generateSummaryReport = (
  records: PermitRecord[],
  employees: { nombre: string; rut: string }[]
): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Filtrar por año actual
  const yearRecords = records.filter(r => {
    const date = new Date(r.fechaInicio + 'T12:00:00');
    return date.getFullYear() === currentYear;
  });

  // Calcular estadísticas
  const totalPA = yearRecords.filter(r => r.solicitudType === 'PA').reduce((sum, r) => sum + r.cantidadDias, 0);
  const totalFL = yearRecords.filter(r => r.solicitudType === 'FL').reduce((sum, r) => sum + r.cantidadDias, 0);
  const totalDecrees = yearRecords.length;

  // Empleados con más uso
  const employeeUsage = records.reduce((acc, r) => {
    if (!acc[r.rut]) acc[r.rut] = { nombre: r.funcionario, pa: 0, fl: 0 };
    if (r.solicitudType === 'PA') acc[r.rut].pa += r.cantidadDias;
    else acc[r.rut].fl += r.cantidadDias;
    return acc;
  }, {} as Record<string, { nombre: string; pa: number; fl: number }>);

  const topUsers = Object.values(employeeUsage)
    .sort((a, b) => (b.pa + b.fl) - (a.pa + a.fl))
    .slice(0, 5);

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return `
═══════════════════════════════════════════════════════════════
                    REPORTE GDP CLOUD
                   ${months[currentMonth]} ${currentYear}
═══════════════════════════════════════════════════════════════

📊 RESUMEN DEL AÑO ${currentYear}
───────────────────────────────────────────────────────────────
  Total Decretos:     ${totalDecrees}
  Días PA:            ${totalPA}
  Días FL:            ${totalFL}
  Total Empleados:    ${employees.length}

📈 TOP 5 FUNCIONARIOS CON MÁS PERMISOS
───────────────────────────────────────────────────────────────
${topUsers.map((u, i) => `  ${i + 1}. ${u.nombre.padEnd(30)} PA: ${u.pa}d | FL: ${u.fl}d`).join('\n')}

📅 Generado: ${now.toLocaleString('es-CL')}
═══════════════════════════════════════════════════════════════
  `.trim();
};
