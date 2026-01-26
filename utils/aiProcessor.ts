
import { GoogleGenAI, Type } from "@google/genai";
import { PermitFormData } from "../types";

/**
 * Inicialización del cliente de IA siguiendo las directrices:
 * 1. Uso de process.env.API_KEY exclusivamente.
 * 2. Estructura de parámetros nombrados.
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Utiliza Gemini 3 Flash para analizar una solicitud de permiso administrativo o feriado
 * y extraer los datos estructurados necesarios para generar el decreto.
 */
export const extractDataFromPdf = async (base64Pdf: string): Promise<Partial<PermitFormData>> => {
  if (!ai) {
    console.error("Gemini API Key no configurada.");
    return {};
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
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
            - tipoJornada: Identifica si es '(Jornada completa)', '(Jornada mañana)', o '(Jornada tarde)'.
            
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
              description: "Detalle de la jornada elegida"
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
