
import * as XLSX from 'xlsx';
import { PermitRecord } from '../types';
import { APP_TITLE, TABLE_COLUMNS } from '../constants';
import { formatLongDate, formatExcelDate } from '../utils/formatters';

export const exportToExcel = (data: PermitRecord[]) => {
  if (data.length === 0) return;

  // Seguimos el orden exacto de la imagen JPG
  const rows = data.map((record, idx) => [
    idx + 1, // #
    record.solicitudType, // Decreto
    record.acto, // Materia (correlativo)
    'Decreto Exento', // Acto
    record.funcionario, // Funcionario
    record.rut, // RUT
    record.periodo, // Periodo
    record.cantidadDias, // Cantidad de días
    formatLongDate(record.fechaInicio), // Fecha de inicio
    record.tipoJornada, // Tipo de Jornada
    record.diasHaber, // Días a su haber
    formatExcelDate(record.fechaDecreto), // Fecha
    record.diasHaber - record.cantidadDias, // Saldo final
    record.ra, // R.A
    record.emite // Emite
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [APP_TITLE],
    [`Generado el ${new Date().toLocaleString()}`],
    [],
    TABLE_COLUMNS,
    ...rows
  ]);

  // Aplicar formatos numéricos básicos para que Excel trate los números como tales
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:O1');
  for (let R = 4; R <= range.e.r; ++R) {
    // Columna H (index 7): Cantidad de días
    const cellH = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
    if (cellH) cellH.t = 'n';

    // Columna K (index 10): Días a su haber
    const cellK = ws[XLSX.utils.encode_cell({ r: R, c: 10 })];
    if (cellK) cellK.t = 'n';

    // Columna M (index 12): Saldo final
    const cellM = ws[XLSX.utils.encode_cell({ r: R, c: 12 })];
    if (cellM) cellM.t = 'n';
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planilla Institucional");

  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Planilla_Decretos_PA_${timestamp}.xlsx`);
};
