
import { GoogleGenAI, Type } from "@google/genai";
import { PermitFormData } from "../types";

/**
 * Inicialización del cliente de IA siguiendo las directrices:
 * 1. Uso de process.env.API_KEY exclusivamente.
 * 2. Estructura de parámetros nombrados.
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
console.log("🔑 Gemini API Key configurada:", apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : "NO CONFIGURADA");
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Utiliza Gemini 3 Flash para analizar una solicitud de permiso administrativo o feriado
 * y extraer los datos estructurados necesarios para generar el decreto.
 */
export const extractDataFromPdf = async (base64Pdf: string): Promise<Partial<PermitFormData>> => {
  console.log("📄 Iniciando procesamiento de PDF con IA...");
  console.log("📏 Tamaño del PDF (base64):", base64Pdf.length, "caracteres");

  if (!ai) {
    console.error("❌ Gemini API Key no configurada. Variable VITE_GEMINI_API_KEY está vacía.");
    return {};
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            text: `Actúa como un experto administrativo. Analiza esta SOLICITUD DE PERMISO O FERIADO. 
            Extrae con precisión los siguientes campos del documento:
            - funcionario: Nombre completo del solicitante.
            - rut: RUT del solicitante (con puntos y guion).
            - solicitudType: 'PA' si es Permiso Administrativo, 'FL' si es Feriado Legal.
            - cantidadDias: Número de días solicitados (ej. 1, 0.5, 3).
            - fechaInicio: Fecha de inicio del permiso en formato YYYY-MM-DD.
            - tipoJornada: Identifica si es 'Jornada completa', 'Jornada mañana', o 'Jornada tarde'.
            - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento (zona del encabezado), en formato YYYY-MM-DD. NO uses la fecha de hoy, busca la fecha escrita en el documento.
            
            Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            solicitudType: {
              type: Type.STRING,
              description: "Tipo de solicitud: PA o FL"
            },
            funcionario: {
              type: Type.STRING,
              description: "Nombre completo del funcionario"
            },
            rut: {
              type: Type.STRING,
              description: "RUT del funcionario"
            },
            cantidadDias: {
              type: Type.NUMBER,
              description: "Días solicitados"
            },
            fechaInicio: {
              type: Type.STRING,
              description: "Fecha de inicio del permiso"
            },
            tipoJornada: {
              type: Type.STRING,
              description: "Detalle de la jornada elegida (Jornada mañana/tarde/completa)"
            },
            fechaDecreto: {
              type: Type.STRING,
              description: "Fecha de la solicitud que aparece en la zona superior/encabezado del documento, en formato YYYY-MM-DD"
            }
          },
          required: ["funcionario", "rut", "solicitudType", "cantidadDias", "fechaInicio"]
        }
      }
    });

    /**
     * Acceso directo a .text según directrices (propiedad, no método).
     */
    const textOutput = response.text;
    if (!textOutput) {
      console.warn("La IA no devolvió texto en la respuesta.");
      return {};
    }

    return JSON.parse(textOutput.trim());
  } catch (err) {
    console.error("Error crítico en el procesamiento de IA:", err);
    return {};
  }
};

/**
 * Extrae datos de un formulario de Feriado Legal (FL).
 * Cada formulario corresponde a un período específico con su saldo y días solicitados.
 */
export const extractFLDataFromPdf = async (base64Pdf: string): Promise<{
  funcionario?: string;
  rut?: string;
  periodo?: string;
  saldoDisponible?: number;
  solicitado?: number;
  fechaInicio?: string;
  fechaTermino?: string;
  fechaDecreto?: string;
  cantidadDias?: number;
}> => {
  console.log("📄 Iniciando procesamiento de PDF FL con IA...");

  if (!ai) {
    console.error("❌ Gemini API Key no configurada.");
    return {};
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            text: `Actúa como un experto administrativo. Analiza este FORMULARIO DE SOLICITUD DE FERIADO LEGAL.
            Extrae con precisión los siguientes campos del documento:
            - funcionario: Nombre completo del solicitante.
            - rut: RUT del solicitante (con puntos y guion).
            - periodo: El período al que corresponde el feriado (ej: "2024-2025" o "2025-2026"). Busca texto como "período", "periodo", "año" o similar.
            - saldoDisponible: Días de saldo disponible que tenía el funcionario ANTES de esta solicitud.
            - solicitado: Cantidad de días solicitados en ESTE formulario para ESTE período.
            - cantidadDias: Total de días solicitados (igual que solicitado).
            - fechaInicio: Fecha de inicio del feriado en formato YYYY-MM-DD.
            - fechaTermino: Fecha de término del feriado en formato YYYY-MM-DD.
            - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento (zona del encabezado), en formato YYYY-MM-DD. NO uses la fecha de hoy.
            
            Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            funcionario: {
              type: Type.STRING,
              description: "Nombre completo del funcionario"
            },
            rut: {
              type: Type.STRING,
              description: "RUT del funcionario"
            },
            periodo: {
              type: Type.STRING,
              description: "Período del feriado (ej: 2024-2025)"
            },
            saldoDisponible: {
              type: Type.NUMBER,
              description: "Saldo disponible antes de la solicitud"
            },
            solicitado: {
              type: Type.NUMBER,
              description: "Días solicitados en este formulario"
            },
            cantidadDias: {
              type: Type.NUMBER,
              description: "Total días solicitados"
            },
            fechaInicio: {
              type: Type.STRING,
              description: "Fecha de inicio del feriado"
            },
            fechaTermino: {
              type: Type.STRING,
              description: "Fecha de término del feriado"
            },
            fechaDecreto: {
              type: Type.STRING,
              description: "Fecha de la solicitud en la zona superior del documento"
            }
          },
          required: ["funcionario", "rut", "solicitado"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      console.warn("La IA no devolvió texto en la respuesta FL.");
      return {};
    }

    return JSON.parse(textOutput.trim());
  } catch (err) {
    console.error("Error crítico en el procesamiento FL de IA:", err);
    return {};
  }
};
