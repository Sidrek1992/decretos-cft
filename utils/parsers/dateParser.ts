/**
 * Utilidades de parseo de fechas
 * Extraído de useCloudSync.ts para mejor modularidad
 */

const MONTHS: Record<string, string> = {
  'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
  'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
  'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
};

/**
 * Parsea fechas del Sheet en varios formatos posibles
 * @param dateStr - String de fecha en formato variado
 * @returns Fecha en formato ISO (YYYY-MM-DD) o string vacío si no es válida
 */
export const parseDateFromSheet = (dateStr: string): string => {
  if (!dateStr) return '';

  // Si ya está en formato ISO (YYYY-MM-DD), devolverlo
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }

  // Formato numérico: DD/MM/YYYY o DD-MM-YYYY
  const numericMatch = dateStr.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (numericMatch) {
    const dia = numericMatch[1].padStart(2, '0');
    const mes = numericMatch[2].padStart(2, '0');
    const año = numericMatch[3];
    return `${año}-${mes}-${dia}`;
  }

  // Formato largo: "martes, 06 de enero de 2026" o "06 de enero de 2026"
  const match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = MONTHS[match[2].toLowerCase()] || '01';
    const año = match[3];
    return `${año}-${mes}-${dia}`;
  }

  return '';
};

/**
 * Normaliza un valor de fecha
 */
export const normalizeDateValue = (value: string): string => {
  return parseDateFromSheet(String(value || ''));
};

/**
 * Normaliza un valor numérico con fallback.
 * 
 * Detecta y corrige el caso en que Google Sheets auto-interpreta un número
 * pequeño (ej: 15) como fecha serial y GAS lo devuelve como "1900-01-15".
 * En ese escenario, parseFloat("1900-01-15") retornaría 1900 erróneamente.
 * La heurística: si el string tiene formato de fecha ISO y el año es <= 1900,
 * es casi seguro un número que fue corrompido por Sheets; extraemos el día.
 */
export const normalizeNumberValue = (value: string | number, fallback: number): number => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : value;
  }

  const str = String(value || '').trim();
  if (!str) return fallback;

  // Detectar fecha ISO corrupta: "1899-12-DD" o "1900-01-DD" (base serial de Sheets)
  const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    // Google Sheets fecha serial: día 1 = 1900-01-01, día 60 = 1900-02-29 (Lotus bug)
    // Si el año es 1899 o 1900, es casi seguro un número pequeño convertido a fecha.
    // Reconstruimos el valor original: días desde 1899-12-31 (serial 1 = jan 1 1900)
    if (year <= 1900) {
      const serialDate = new Date(Date.UTC(year, parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10)));
      const baseDate = new Date(Date.UTC(1899, 11, 31)); // serial 1 = 1900-01-01
      const daysDiff = Math.round((serialDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      return Number.isNaN(daysDiff) ? fallback : daysDiff;
    }
    // Si el año es reciente (ej: 2024-01-15), no es un número — retornar fallback
    return fallback;
  }

  const num = parseFloat(str.replace(',', '.'));
  return Number.isNaN(num) ? fallback : num;
};

/**
 * Normaliza el valor de período
 */
export const normalizePeriodoValue = (value: string): string => {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return new Date().getFullYear().toString();
};

/**
 * Valida si una fecha está dentro del rango permitido
 */
export const isValidDateRange = (dateString: string, minYear = 2020, maxYear = 2030): boolean => {
  if (!dateString) return false;

  // Extraer el año directamente del string para evitar problemas de timezone
  const yearMatch = dateString.match(/^(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return year >= minYear && year <= maxYear;
  }

  // Fallback: intentar parsear como Date
  const date = new Date(dateString + 'T12:00:00');
  return !isNaN(date.getTime()) && date.getFullYear() >= minYear && date.getFullYear() <= maxYear;
};
