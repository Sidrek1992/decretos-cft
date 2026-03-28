import { PermitRecord } from '../types';
import { CONFIG } from '../config';

type FLBalanceRecord = Pick<PermitRecord, 'periodo2' | 'saldoFinalP1' | 'saldoFinalP2' | 'solicitadoP2' | 'saldoDisponibleP2'>;

/**
 * Determina si un registro FL tiene segundo período activo.
 * Requiere que periodo2 tenga texto Y que existan datos numéricos de P2
 * (solicitadoP2 > 0 o saldoDisponibleP2 > 0), para evitar falsos positivos
 * cuando periodo2 tiene un valor por defecto pero no se usa realmente.
 */
export const hasFLSecondPeriod = (record: Pick<PermitRecord, 'periodo2' | 'solicitadoP2' | 'saldoDisponibleP2'>): boolean => {
  if (!record.periodo2 || record.periodo2.trim() === '') return false;
  return (record.solicitadoP2 || 0) > 0 || (record.saldoDisponibleP2 || 0) > 0;
};

export function getFLSaldoFinal(record: FLBalanceRecord): number | null;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: number): number;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: null): number | null;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: number | null = null): number | null {
  const saldo = hasFLSecondPeriod(record)
    ? (record.saldoFinalP2 ?? record.saldoFinalP1)
    : (record.saldoFinalP1 ?? record.saldoFinalP2);

  return saldo ?? fallback;
}

/**
 * Sanitiza valores FL que Google Sheets puede corromper.
 * Números pequeños (ej: 15) a veces se interpretan como fechas seriales (~1900).
 * Si el valor supera MAX_SALDO_DIAS (imposible para feriado legal), usa el fallback.
 */
export const safeFLValue = (raw: number | undefined, fallback: number): number => {
  const val = raw || 0;
  return val > CONFIG.MAX_SALDO_DIAS ? fallback : val;
};
