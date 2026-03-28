/**
 * Servicio de Generación Masiva de PDFs
 * Soporta:
 * - Descarga individual progresiva (cada PDF se descarga apenas se genera)
 * - Descarga masiva como ZIP
 */

import { PermitRecord } from '../types';
import { formatLongDate, formatSimpleDate, toProperCase } from '../utils/formatters';
import { CONFIG } from '../config';
import { safeFLValue } from '../utils/flBalance';
import { logger } from '../utils/logger';
import JSZip from 'jszip';

const batchLogger = logger.create('BatchPDF');

export interface BatchResult {
  success: number;
  failed: number;
  errors: { id: string; decreto: string; funcionario: string; error: string }[];
}

export type BatchMode = 'individual' | 'zip';

export interface BatchProgressInfo {
  current: number;
  total: number;
  currentFile: string;
  status: 'generating' | 'downloading' | 'zipping' | 'done' | 'error';
  result?: BatchResult;
}

/**
 * Genera un PDF individual sin abrir ventana (modo silencioso)
 * Retorna el blob + nombre del archivo para descarga directa
 */
const generatePDFSilent = async (record: PermitRecord): Promise<{ blob: Blob; fileName: string } | null> => {
  const typeCode = record.solicitudType || 'PA';
  const nombreMayuscula = (record.funcionario || '').toUpperCase().trim();
  const nombreProperCase = toProperCase(record.funcionario || '');
  const actoOficial = (record.acto || '').trim();
  const finalFileName = `SGDP-${typeCode} N° ${actoOficial} - ${nombreMayuscula}`;

  const basePayload = {
    "fileName": finalFileName,
    "Decreto": actoOficial,
    "FUNCIONARIO": nombreMayuscula,
    "Funcionario": nombreProperCase,
    "solicitudType": typeCode,
    "RUT": (record.rut || '').trim(),
    "Fecha": formatSimpleDate(record.fechaDecreto || ''),
    "Cantidad_de_días": Number(record.cantidadDias || 0).toString().replace('.', ','),
    "Fecha_de_inicio": formatLongDate(record.fechaInicio || ''),
    "RA": record.ra || '',
    "Emite": record.emite || ''
  };

  // Detectar si FL usa 2 períodos: requiere periodo2 con texto Y al menos un dato numérico de P2
  const hasP2Data = (record.solicitadoP2 || 0) > 0 || (record.saldoDisponibleP2 || 0) > 0;
  const hasTwoPeriods = typeCode === 'FL' && Boolean(record.periodo2 && record.periodo2.trim() !== '') && hasP2Data;

  const solP1 = Number(safeFLValue(Number(record.solicitadoP1), Number(record.cantidadDias || 0)));
  const saldoFinP1 = Number(safeFLValue(Number(record.saldoFinalP1), 0));
  const saldoDispP1 = Number(safeFLValue(Number(record.saldoDisponibleP1), saldoFinP1 + solP1));
  const solP2 = Number(safeFLValue(Number(record.solicitadoP2), 0));
  const saldoFinP2 = Number(safeFLValue(Number(record.saldoFinalP2), 0));
  const saldoDispP2 = Number(safeFLValue(Number(record.saldoDisponibleP2), saldoFinP2 + solP2));

  const payload = typeCode === 'FL' ? {
    ...basePayload,
    "templateId": hasTwoPeriods ? CONFIG.TEMPLATE_FL_2P_DOC_ID : CONFIG.TEMPLATE_FL_1P_DOC_ID,
    "Fecha_de_Término": formatLongDate(record.fechaTermino || ''),
    "Período_1": record.periodo1 || '',
    "Saldo_Disponible_Periodo_1": saldoDispP1.toString().replace('.', ','),
    "Solicitados_Periodo_1": solP1.toString().replace('.', ','),
    "Saldo_Final_Periodo_1": saldoFinP1.toString().replace('.', ','),
    ...(hasTwoPeriods ? {
      "Período_2": record.periodo2 || '',
      "Saldo_Disponible_Periodo_2": saldoDispP2.toString().replace('.', ','),
      "Solicitados_Periodo_2": solP2.toString().replace('.', ','),
      "Saldo_Final_Periodo_2": saldoFinP2.toString().replace('.', ','),
    } : {}),
  } : {
    ...basePayload,
    "Tipo_de_Jornada": (record.tipoJornada || '').replace(/[()]/g, '').trim(),
    "Días_a_su_haber": Number(record.diasHaber || 0).toFixed(1).replace('.', ','),
    "Saldo_final": (Number(record.diasHaber || 0) - Number(record.cantidadDias || 0)).toFixed(1).replace('.', ','),
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
    const byteCharacters = atob(result.pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return { blob, fileName: finalFileName.replace(/\//g, '_') };
  }

  throw new Error(result.error || 'El servidor no devolvió el PDF');
};

/**
 * Descarga un blob como archivo
 */
const downloadBlob = (blob: Blob, fileName: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Limpiar después de un breve delay
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 500);
};

/**
 * Genera PDFs para múltiples registros con descarga individual progresiva
 * Cada PDF se descarga automáticamente apenas se genera
 */
export const generateBatchPDFs = async (
  records: PermitRecord[],
  mode: BatchMode,
  onProgress?: (info: BatchProgressInfo) => void
): Promise<BatchResult> => {
  const result: BatchResult = { success: 0, failed: 0, errors: [] };
  const total = records.length;
  const collectedPDFs: { blob: Blob; fileName: string }[] = [];

  batchLogger.info(`Iniciando generación masiva de ${total} PDFs (modo: ${mode})`);

  // Procesar cada registro secuencialmente
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const currentFile = `${record.solicitudType} ${record.acto} — ${record.funcionario}`;

    onProgress?.({
      current: i + 1,
      total,
      currentFile,
      status: 'generating',
    });

    try {
      const pdfData = await generatePDFSilent(record);

      if (pdfData) {
        result.success++;

        if (mode === 'individual') {
          // Descargar inmediatamente
          onProgress?.({
            current: i + 1,
            total,
            currentFile,
            status: 'downloading',
          });
          downloadBlob(pdfData.blob, `${pdfData.fileName}.pdf`);
        }

        // Siempre recopilar para posible ZIP
        collectedPDFs.push(pdfData);
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: record.id,
        decreto: record.acto,
        funcionario: record.funcionario,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }

    // Pausa entre llamadas para no saturar la API
    if (i < records.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  // Si es modo ZIP, generar y descargar el archivo ZIP
  if (mode === 'zip' && collectedPDFs.length > 0) {
    onProgress?.({
      current: total,
      total,
      currentFile: 'Comprimiendo archivos...',
      status: 'zipping',
    });

    try {
      const zip = new JSZip();
      const folder = zip.folder('Decretos-GDP');

      collectedPDFs.forEach(pdf => {
        folder?.file(`${pdf.fileName}.pdf`, pdf.blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const today = new Date().toISOString().split('T')[0];
      downloadBlob(zipBlob, `Decretos-GDP_${today}.zip`);
    } catch (error) {
      batchLogger.error('Error al generar ZIP:', error);
    }
  }

  batchLogger.info(`Completado: ${result.success} éxitos, ${result.failed} fallos`);

  onProgress?.({
    current: total,
    total,
    currentFile: '',
    status: 'done',
    result,
  });

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

