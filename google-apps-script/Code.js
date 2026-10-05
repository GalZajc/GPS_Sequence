/**
 * Google Apps Script Web App za prejemanje GPS točk iz Android aplikacije "GPS Sequence".
 * 
 * Ta skripta sprejme paket (batch) točk v JSON obliki preko HTTP POST zahteve
 * in jih dopiše v datoteko na vašem Google Drive (gps_tracks/gps_track_YYYY-MM-DD.jsonl).
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Prazen zahtevek"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var points = payload.points || [];

    if (!Array.isArray(points) || points.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        count: 0,
        message: "Ni novih točk"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Poišči ali ustvari mapo 'gps_tracks' na Google Drive
    var folderName = "gps_tracks";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    // Določi ime datoteke glede na današnji datum (UTC)
    var now = new Date();
    var dateStr = Utilities.formatDate(now, "UTC", "yyyy-MM-dd");
    var fileName = "gps_track_" + dateStr + ".jsonl";

    // Pripravi vrstice za zapis (vsaka točka v svoji vrstici kot JSON)
    var linesToAdd = "";
    for (var i = 0; i < points.length; i++) {
      linesToAdd += JSON.stringify(points[i]) + "\n";
    }

    // Poišči obstoječo datoteko ali ustvari novo
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      var file = files.next();
      var existingContent = file.getBlob().getDataAsString();
      file.setContent(existingContent + linesToAdd);
    } else {
      folder.createFile(fileName, linesToAdd, MimeType.PLAIN_TEXT);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      count: points.length,
      saved_at: now.toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "GPS Sequence Webhook je aktiven in pripravljen za sprejem podatkov."
  })).setMimeType(ContentService.MimeType.JSON);
}
