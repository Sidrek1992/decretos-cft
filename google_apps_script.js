/**
 * SGP CLOUD - MOTOR UNIFICADO v4.1 (Versión Estable)
 * Soporta: Lectura de Datos, Sincronización y Generación de PDFs/Documentos.
 * Corregido: Error de permisos Drive (migrado a standard DriveApp).
 */

const TEMPLATE_DOC_ID = '1BvJanZb0936sPvV0oEZw-E0sro_02ibm_BFQuXa6F24';
const FOLDER_DESTINATION_ID = '1sX722eJuMnnrhqPO-zJF9ccCqlktLDo8';
const DEFAULT_SHEET_ID = '1BmMABAHk8ZgpUlXzsyI33qQGtsk5mrKnf5qzgQp4US0';

/**
 * LECTURA DE DATOS (doGet)
 * Lee los datos desde la fila 2 (la fila 1 es encabezado)
 * Soporta tanto el sheet de decretos (15 cols) como el de empleados (5 cols)
 */
function doGet(e) {
  try {
    var sheetId = (e && e.parameter && e.parameter.sheetId) ? e.parameter.sheetId : DEFAULT_SHEET_ID;
    var isEmployees = (e && e.parameter && e.parameter.type === 'employees');

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();

    // Verificar si hay datos (mínimo fila 2 para tener al menos un registro)
    if (lastRow < 2) return createJsonResponse({ success: true, data: [] });

    // Leer todas las columnas con datos (sin limitar a un número fijo)
    var lastCol = sheet.getLastColumn();
    var numCols = isEmployees ? 5 : lastCol;

    // Leer desde fila 2 hasta la última fila
    var rows = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

    // Filtrar filas vacías y formatear fechas
    var formattedData = rows
      .filter(function (row) {
        // Para empleados: verificar que tenga nombre (col 1)
        if (isEmployees) return row[1];
        // Para decretos: verificar columnas clave
        return row[0] || row[1] || row[4];
      })
      .map(function (row) {
        return row.map(function (cell) {
          if (cell instanceof Date) return Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd");
          return cell;
        });
      });

    return createJsonResponse({ success: true, data: formattedData });
  } catch (err) {
    return createJsonResponse({ success: false, error: "Error de lectura: " + err.toString() });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.sheetId) return handleSpreadsheetSync(payload);
    return handleDocumentCreation(payload);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Error POST: " + err.toString() });
  }
}

function handleSpreadsheetSync(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(payload.sheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();

    // Detectar tipo de sheet por el payload
    var isEmployees = payload.type === 'employees';
    var lastCol = sheet.getLastColumn();
    var numCols = isEmployees ? 5 : Math.max(lastCol, payload.data && payload.data[0] ? payload.data[0].length : lastCol);

    // Limpiar datos desde fila 2 (preservar encabezado en fila 1)
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
    }

    // Escribir nuevos datos desde fila 2
    if (payload.data && payload.data.length > 0) {
      sheet.getRange(2, 1, payload.data.length, payload.data[0].length).setValues(payload.data);
    }

    SpreadsheetApp.flush();
    lock.releaseLock();
    return createJsonResponse({ success: true, message: "Sincronizado" });
  } catch (error) {
    if (lock.hasLock()) lock.releaseLock();
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function handleDocumentCreation(data) {
  try {
    // Usar plantilla específica si se envía en el payload, sino la por defecto
    var templateId = data.templateId || TEMPLATE_DOC_ID;
    var templateFile = DriveApp.getFileById(templateId);
    var destinationFolder = DriveApp.getFolderById(FOLDER_DESTINATION_ID);
    var fileName = data.fileName || "DECRETO_" + new Date().getTime();

    // Crear copia
    var copy = templateFile.makeCopy(fileName, destinationFolder);
    var doc = DocumentApp.openById(copy.getId());
    var body = doc.getBody();

    // Reemplazar campos
    for (var key in data) {
      if (key === "fileName" || key === "templateId") continue;
      var val = (data[key] !== undefined && data[key] !== null) ? data[key].toString() : "";

      // Soporta formatos {{campo}} y «campo»
      body.replaceText('«' + key + '»', val);
      body.replaceText('{{' + key + '}}', val);

      var keyWithSpaces = key.replace(/_/g, ' ');
      if (key !== keyWithSpaces) {
        body.replaceText('«' + keyWithSpaces + '»', val);
        body.replaceText('{{' + keyWithSpaces + '}}', val);
      }
    }

    doc.saveAndClose();

    // Exportar como PDF
    var docId = copy.getId();
    var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    // Configurar permisos de visualización
    var file = DriveApp.getFileById(docId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return createJsonResponse({
      success: true,
      url: file.getUrl(),
      id: docId,
      pdfBase64: pdfBase64
    });
  } catch (e) {
    return createJsonResponse({ success: false, error: "Fallo en motor Drive: " + e.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * IMPORTANTE: Ejecuta esta función una vez en el editor de Apps Script 
 * para autorizar los permisos de Drive y DocumentApp.
 * Incluye makeCopy para forzar el scope completo de Drive.
 */
function AUTORIZAR_CON_UN_CLIC() {
  // Forzar autorización de lectura
  var file = DriveApp.getFileById(TEMPLATE_DOC_ID);
  var folder = DriveApp.getFolderById(FOLDER_DESTINATION_ID);
  
  // Forzar autorización de escritura/copia
  var testCopy = file.makeCopy("_TEST_AUTORIZACION_BORRAR", folder);
  DriveApp.getFileById(testCopy.getId()).setTrashed(true); // Eliminar copia de prueba
  
  // Forzar autorización de DocumentApp
  DocumentApp.openById(TEMPLATE_DOC_ID);
  
  Logger.log("✅ Autorización completa (lectura, copia y documentos) exitosa");
}
