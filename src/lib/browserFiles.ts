/** Browser file helpers kept separate from pure project/package builders. */

/** Read a text file selected through an `<input type="file">`. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read file: ${file.name}`));
    };
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of a text file. */
export function downloadText(text: string, fileName: string, mime = "application/json"): void {
  downloadBlob(new Blob([text], { type: mime }), fileName);
}
