/**
 * Procesador de IA para extracción de datos de PDFs
 * Soporta tanto procesamiento en backend (GAS) como frontend (fallback)
 */

import { GoogleGenAI, Type } from "@google/genai";
import { PermitFormData } from "../types";
import { CONFIG } from "../config";
import { logger } from "./logger";

const aiLogger = logger.create('AI');

// Tipos para respuestas estructuradas
export interface AIProcessResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FLExtractedData {
  funcionario?: string;
  rut?: string;
  periodo?: string;
  saldoDisponible?: number;
  solicitado?: number;
  fechaInicio?: string;
  fechaTermino?: string;
  fechaDecreto?: string;
  cantidadDias?: number;
}

// Flag para usar backend (más seguro) o frontend (fallback)
const USE_BACKEND_AI = import.meta.env.VITE_USE_BACKEND_AI !== 'false';

// API Key solo se usa como fallback si el backend no está disponible
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Procesa un PDF usando el backend de Google Apps Script (recomendado)
 * Esto mantiene la API key segura en el servidor
 */
const processWithBackend = async (base64Pdf: string, solicitudType: 'PA' | 'FL'): Promise<Record<string, unknown>> => {
  aiLogger.info('Procesando PDF con backend GAS...');
  
  const url = solicitudType === 'PA' ? CONFIG.WEB_APP_URL : CONFIG.WEB_APP_URL_FL;
  
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'processAI',
      pdfBase64: base64Pdf,
      solicitudType
    })
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Error procesando con backend');
  }
  
  return result.data;
};

/**
 * Procesa un PDF usando la API de Gemini directamente (fallback)
 * Solo se usa si el backend no está disponible
 */
const processWithFrontend = async (base64Pdf: string, solicitudType: 'PA' | 'FL'): Promise<Record<string, unknown>> => {
  aiLogger.info('Procesando PDF con frontend (fallback)...');
  
  if (!ai) {
    aiLogger.error('Gemini API Key no configurada');
    return {};
  }

  const prompt = solicitudType === 'PA' 
    ? `Actúa como un experto administrativo. Analiza esta SOLICITUD DE PERMISO O FERIADO. 
       Extrae con precisión los siguientes campos del documento:
       - funcionario: Nombre completo del solicitante.
       - rut: RUT del solicitante (con puntos y guion).
       - solicitudType: 'PA' si es Permiso Administrativo, 'FL' si es Feriado Legal.
       - cantidadDias: Número de días solicitados (ej. 1, 0.5, 3).
       - fechaInicio: Fecha de inicio del permiso en formato YYYY-MM-DD.
       - tipoJornada: Identifica si es 'Jornada completa', 'Jornada mañana', o 'Jornada tarde'.
       - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.
       
       Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`
    : `Actúa como un experto administrativo. Analiza este FORMULARIO DE SOLICITUD DE FERIADO LEGAL.
       Extrae con precisión los siguientes campos del documento:
       - funcionario: Nombre completo del solicitante.
       - rut: RUT del solicitante (con puntos y guion).
       - periodo: El período al que corresponde el feriado (ej: "2024-2025" o "2025-2026").
       - saldoDisponible: Días de saldo disponible que tenía el funcionario ANTES de esta solicitud.
       - solicitado: Cantidad de días solicitados en ESTE formulario para ESTE período.
       - cantidadDias: Total de días solicitados (igual que solicitado).
       - fechaInicio: Fecha de inicio del feriado en formato YYYY-MM-DD.
       - fechaTermino: Fecha de término del feriado en formato YYYY-MM-DD.
       - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.
       
       Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`;

  const schema = solicitudType === 'PA' 
    ? {
        type: Type.OBJECT,
        properties: {
          solicitudType: { type: Type.STRING, description: "Tipo de solicitud: PA o FL" },
          funcionario: { type: Type.STRING, description: "Nombre completo del funcionario" },
          rut: { type: Type.STRING, description: "RUT del funcionario" },
          cantidadDias: { type: Type.NUMBER, description: "Días solicitados" },
          fechaInicio: { type: Type.STRING, description: "Fecha de inicio del permiso" },
          tipoJornada: { type: Type.STRING, description: "Detalle de la jornada elegida" },
          fechaDecreto: { type: Type.STRING, description: "Fecha de la solicitud en formato YYYY-MM-DD" }
        },
        required: ["funcionario", "rut", "solicitudType", "cantidadDias", "fechaInicio"]
      }
    : {
        type: Type.OBJECT,
        properties: {
          funcionario: { type: Type.STRING, description: "Nombre completo del funcionario" },
          rut: { type: Type.STRING, description: "RUT del funcionario" },
          periodo: { type: Type.STRING, description: "Período del feriado (ej: 2024-2025)" },
          saldoDisponible: { type: Type.NUMBER, description: "Saldo disponible antes de la solicitud" },
          solicitado: { type: Type.NUMBER, description: "Días solicitados en este formulario" },
          cantidadDias: { type: Type.NUMBER, description: "Total días solicitados" },
          fechaInicio: { type: Type.STRING, description: "Fecha de inicio del feriado" },
          fechaTermino: { type: Type.STRING, description: "Fecha de término del feriado" },
          fechaDecreto: { type: Type.STRING, description: "Fecha de la solicitud" }
        },
        required: ["funcionario", "rut", "solicitado"]
      };

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf
          }
        },
        { text: prompt }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const textOutput = response.text;
  if (!textOutput) {
    aiLogger.warn('La IA no devolvió texto en la respuesta');
    return {};
  }

  return JSON.parse(textOutput.trim());
};

/**
 * Extrae datos de un PDF de Permiso Administrativo
 * @returns Resultado estructurado con success, data y error
 */
export const extractDataFromPdf = async (base64Pdf: string): Promise<AIProcessResult<Partial<PermitFormData>>> => {
  aiLogger.info('Iniciando procesamiento de PDF PA...');
  aiLogger.debug('Tamaño del PDF (base64):', base64Pdf.length, 'caracteres');

  try {
    // Intentar con backend primero (más seguro)
    if (USE_BACKEND_AI) {
      try {
        const data = await processWithBackend(base64Pdf, 'PA');
        return { success: true, data: data as Partial<PermitFormData> };
      } catch (backendError) {
        aiLogger.warn('Backend no disponible, usando fallback frontend:', backendError);
      }
    }
    
    // Fallback a frontend
    const data = await processWithFrontend(base64Pdf, 'PA');
    
    // Verificar que se extrajo al menos algún dato útil
    if (Object.keys(data).length === 0) {
      return { success: false, error: 'No se pudieron extraer datos del PDF' };
    }
    
    return { success: true, data: data as Partial<PermitFormData> };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    aiLogger.error('Error crítico en el procesamiento de IA:', err);
    return { success: false, error: errorMessage };
  }
};

/**
 * Extrae datos de un PDF de Feriado Legal
 * @returns Resultado estructurado con success, data y error
 */
export const extractFLDataFromPdf = async (base64Pdf: string): Promise<AIProcessResult<FLExtractedData>> => {
  aiLogger.info('Iniciando procesamiento de PDF FL...');

  try {
    // Intentar con backend primero (más seguro)
    if (USE_BACKEND_AI) {
      try {
        const data = await processWithBackend(base64Pdf, 'FL');
        return { success: true, data: data as FLExtractedData };
      } catch (backendError) {
        aiLogger.warn('Backend no disponible, usando fallback frontend:', backendError);
      }
    }
    
    // Fallback a frontend
    const data = await processWithFrontend(base64Pdf, 'FL');
    
    // Verificar que se extrajo al menos algún dato útil
    if (Object.keys(data).length === 0) {
      return { success: false, error: 'No se pudieron extraer datos del PDF' };
    }
    
    return { success: true, data: data as FLExtractedData };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    aiLogger.error('Error crítico en el procesamiento FL de IA:', err);
    return { success: false, error: errorMessage };
  }
};
