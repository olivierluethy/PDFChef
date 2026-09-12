import type { MessageFragment } from '../types';

export const exportUi: MessageFragment = {
  en: {
    // Shared
    'export.title': 'Export',
    'export.close': 'Close',
    'export.pageOne': '1 page',
    'export.pageCount': '{count} pages',
    'export.documentWordOne': 'document',
    'export.documentWordOther': 'documents',
    'export.preparing': 'preparing …',
    'export.ready': 'ready',
    'export.error': 'Error',
    'export.skippedOne': '{count} empty document is skipped.',
    'export.skippedOther': '{count} empty documents are skipped.',

    // ExportDialog
    'export.emptyState': 'There are no filled documents to export yet. Drag pages into a document first.',
    'export.summaryTail': 'total. Names can be edited before export.',
    'export.perDocHint': 'Individual documents can be saved to their own location via the folder icon.',
    'export.documentNameLabel': 'Document name',
    'export.savedToOwnLocation': 'Saved to its own location',
    'export.saved': 'Saved',
    'export.saveToOwnFolderTitle': 'Save this document to its own folder',
    'export.ownFolder': 'Own folder',
    'export.alreadySavedOne': '{count} document already saved individually',
    'export.alreadySavedOther': '{count} documents already saved individually',
    'export.nothingLeftForBatch': ' — nothing left for the batch export.',
    'export.batchWritesOne': '; the batch export below will still write the remaining document.',
    'export.batchWritesOther': '; the batch export below will still write the remaining {count} documents.',
    'export.progressCount': '{done} of {total}',
    'export.cancel': 'Cancel',
    'export.saveToFolder': 'Save to folder',
    'export.downloadZip': 'Download as ZIP',
    'export.footnoteDirectory': 'Save to folder writes the entire structure to a location you choose.',
    'export.footnoteZip':
      'This browser cannot write to a folder directly; the ZIP export contains the complete structure.',

    // PrintPanel
    'export.print.title': 'Print',
    'export.print.emptyState': 'There are no filled documents to print yet. Drag pages into a document first.',
    'export.print.introTail': ' — each becomes its own print job.',
    'export.print.autoPrintHint': "Printing opens your browser's print dialog; nothing is downloaded.",
    'export.print.tabHint':
      'Your browser opens the PDF for printing in a new tab. Use “Download” to also save it if needed.',
    'export.print.sent': 'sent to printer',
    'export.print.openedInTab': 'opened in tab — print there',
    'export.print.downloadLabel': 'Download {name}',
    'export.print.print': 'Print',
    'export.print.printAll': 'Print all one after another',
    'export.print.batchHint': 'Batch printing goes through the documents one after another.',
    'export.print.singleHint': 'The print dialog opens for this document.',

    // SharePanel
    'export.share.title': 'Share',
    'export.share.heading': 'Share & email',
    'export.share.emptyState': 'There are no filled documents to share yet. Drag pages into a document first.',
    'export.share.introCanShare':
      'Use “Share” to open your device’s share dialog (including mail). “Email” downloads the PDF and prepares an email for you to attach it to.',
    'export.share.introNoShare':
      'Your browser cannot share files directly. “Email” downloads the PDF and prepares an email for you to attach it to.',
    'export.share.shared': 'shared',
    'export.share.emailed': 'downloaded — mail opened',
    'export.share.cancelled': 'cancelled',
    'export.share.email': 'Email',
    'export.share.share': 'Share',
    'export.share.mailBody':
      'Please find attached the document "{name}".\n\nNote: The PDF was just downloaded — please attach it to this email.',
  },
  de: {
    // Shared
    'export.title': 'Exportieren',
    'export.close': 'Schliessen',
    'export.pageOne': '1 Seite',
    'export.pageCount': '{count} Seiten',
    'export.documentWordOne': 'Dokument',
    'export.documentWordOther': 'Dokumente',
    'export.preparing': 'wird vorbereitet …',
    'export.ready': 'bereit',
    'export.error': 'Fehler',
    'export.skippedOne': '{count} leeres Dokument wird übersprungen.',
    'export.skippedOther': '{count} leere Dokumente werden übersprungen.',

    // ExportDialog
    'export.emptyState':
      'Es gibt noch keine gefüllten Dokumente zum Exportieren. Zieh zuerst Seiten in ein Dokument.',
    'export.summaryTail': 'insgesamt. Namen sind vor dem Export bearbeitbar.',
    'export.perDocHint': 'Einzelne Dokumente können über das Ordner-Symbol an einen eigenen Ort gespeichert werden.',
    'export.documentNameLabel': 'Dokumentname',
    'export.savedToOwnLocation': 'An eigenen Ort gespeichert',
    'export.saved': 'Gespeichert',
    'export.saveToOwnFolderTitle': 'Dieses Dokument an einen eigenen Ordner speichern',
    'export.ownFolder': 'Eigener Ordner',
    'export.alreadySavedOne': '{count} Dokument bereits einzeln gespeichert',
    'export.alreadySavedOther': '{count} Dokumente bereits einzeln gespeichert',
    'export.nothingLeftForBatch': ' — nichts mehr für den Sammel-Export übrig.',
    'export.batchWritesOne': '; der Sammel-Export unten schreibt noch das übrige Dokument.',
    'export.batchWritesOther': '; der Sammel-Export unten schreibt noch die übrigen {count} Dokumente.',
    'export.progressCount': '{done} von {total}',
    'export.cancel': 'Abbrechen',
    'export.saveToFolder': 'In Ordner speichern',
    'export.downloadZip': 'Als ZIP herunterladen',
    'export.footnoteDirectory': 'In Ordner speichern schreibt die ganze Struktur an einen frei gewählten Ort.',
    'export.footnoteZip':
      'Dieser Browser kann nicht direkt in einen Ordner schreiben; der ZIP-Export enthält die vollständige Struktur.',

    // PrintPanel
    'export.print.title': 'Drucken',
    'export.print.emptyState':
      'Es gibt noch keine gefüllten Dokumente zum Drucken. Zieh zuerst Seiten in ein Dokument.',
    'export.print.introTail': ' — jedes wird ein eigener Druckauftrag.',
    'export.print.autoPrintHint': 'Beim Drucken öffnet sich der Druckdialog deines Browsers; nichts wird heruntergeladen.',
    'export.print.tabHint':
      'Dein Browser öffnet das PDF zum Drucken in einem neuen Tab. Über „Herunterladen“ speicherst du es bei Bedarf zusätzlich.',
    'export.print.sent': 'an Drucker gesendet',
    'export.print.openedInTab': 'im Tab geöffnet — dort drucken',
    'export.print.downloadLabel': '{name} herunterladen',
    'export.print.print': 'Drucken',
    'export.print.printAll': 'Alle nacheinander drucken',
    'export.print.batchHint': 'Reihen-Druck geht die Dokumente einzeln nacheinander durch.',
    'export.print.singleHint': 'Der Druckdialog öffnet sich für dieses Dokument.',

    // SharePanel
    'export.share.title': 'Teilen',
    'export.share.heading': 'Teilen & E-Mail',
    'export.share.emptyState':
      'Es gibt noch keine gefüllten Dokumente zum Teilen. Zieh zuerst Seiten in ein Dokument.',
    'export.share.introCanShare':
      'Über „Teilen“ öffnet sich der Teilen-Dialog deines Geräts (inkl. Mail). „E-Mail“ lädt das PDF herunter und bereitet eine Mail vor, an die du es anhängst.',
    'export.share.introNoShare':
      'Dein Browser kann Dateien nicht direkt teilen. „E-Mail“ lädt das PDF herunter und bereitet eine Mail vor, an die du es anhängst.',
    'export.share.shared': 'geteilt',
    'export.share.emailed': 'heruntergeladen — Mail geöffnet',
    'export.share.cancelled': 'abgebrochen',
    'export.share.email': 'E-Mail',
    'export.share.share': 'Teilen',
    'export.share.mailBody':
      'Anbei das Dokument "{name}".\n\nHinweis: Das PDF wurde soeben heruntergeladen -- bitte haenge es dieser E-Mail an.',
  },
};
