import { useRef, useState } from "react";
import type { UiLanguage } from "./uiLanguage";

const COPY = {
  en: {
    backupDownloaded: "Backup downloaded.",
    backupImportFailed: "Could not import that file.",
    backupImported: "Data imported.",
    backupIntro: "Download or restore a copy of the data saved in this browser.",
    dataBackup: "Save my data",
    downloadData: "Download data",
    importData: "Import data",
  },
  es: {
    backupDownloaded: "Copia descargada.",
    backupImportFailed: "No se pudo importar ese archivo.",
    backupImported: "Datos importados.",
    backupIntro: "Descarga o restaura una copia de los datos guardados en este navegador.",
    dataBackup: "Guardar mis datos",
    downloadData: "Descargar datos",
    importData: "Importar datos",
  },
  fr: {
    backupDownloaded: "Sauvegarde telechargee.",
    backupImportFailed: "Impossible d'importer ce fichier.",
    backupImported: "Donnees importees.",
    backupIntro: "Telechargez ou restaurez une copie des donnees enregistrees dans ce navigateur.",
    dataBackup: "Sauvegarder mes donnees",
    downloadData: "Telecharger les donnees",
    importData: "Importer les donnees",
  },
};
function tUi(language: UiLanguage, key: keyof typeof COPY.en) { return COPY[language][key]; }

function collectBrowserStorage(storage: Storage): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) {
      entries[key] = storage.getItem(key) ?? "";
    }
  }
  return entries;
}

function restoreBrowserStorage(storage: Storage, values: unknown): void {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return;
  }

  Object.entries(values as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "string") {
      storage.setItem(key, value);
    }
  });
}

export function StorageBackupSettingsPanel({
  interfaceLanguage,
  onBackupImported,
}: {
  interfaceLanguage: UiLanguage;
  onBackupImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState("");

  const downloadBackup = () => {
    if (typeof window === "undefined") {
      return;
    }

    const backup = {
      app: "Habitro",
      version: 1,
      exportedAt: new Date().toISOString(),
      origin: window.location.origin,
      localStorage: collectBrowserStorage(window.localStorage),
      sessionStorage: collectBrowserStorage(window.sessionStorage),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `habitro-data-${dateStamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setImportStatus(tUi(interfaceLanguage, "backupDownloaded"));
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      restoreBrowserStorage(window.localStorage, parsed.localStorage);
      restoreBrowserStorage(window.sessionStorage, parsed.sessionStorage);
      onBackupImported();
      setImportStatus(tUi(interfaceLanguage, "backupImported"));
    } catch {
      setImportStatus(tUi(interfaceLanguage, "backupImportFailed"));
    }
  };

  return (
    <section className="panel compact-settings-panel">
      <h3>{tUi(interfaceLanguage, "dataBackup")}</h3>
      <p className="muted-line">{tUi(interfaceLanguage, "backupIntro")}</p>
      <div className="backup-actions">
        <button className="primary-btn" type="button" onClick={downloadBackup}>
          {tUi(interfaceLanguage, "downloadData")}
        </button>
        <button className="ghost-btn" type="button" onClick={() => fileInputRef.current?.click()}>
          {tUi(interfaceLanguage, "importData")}
        </button>
      </div>
      <input
        ref={fileInputRef}
        accept="application/json,.json"
        className="hidden-file-input"
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void importBackup(file);
          }
        }}
      />
      {importStatus ? <p className="muted-line">{importStatus}</p> : null}
    </section>
  );
}
