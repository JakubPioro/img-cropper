import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function downloadZip(
  files: Array<{ fileName: string; blob: Blob }>,
  zipName: string,
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.fileName, file.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, zipName);
}
