const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_FILES = 50;
export const MAX_FILE_SIZE_MB = 20;

export interface ValidationError {
  fileName: string;
  reason: string;
}

export interface ValidationResult {
  accepted: File[];
  rejected: ValidationError[];
}

export function validateFiles(
  inputFiles: File[],
  existingCount: number,
): ValidationResult {
  const accepted: File[] = [];
  const rejected: ValidationError[] = [];
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

  for (const file of inputFiles) {
    if (existingCount + accepted.length >= MAX_FILES) {
      rejected.push({
        fileName: file.name,
        reason: `Przekroczono limit ${MAX_FILES} plikow na sesje.`,
      });
      continue;
    }

    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      rejected.push({
        fileName: file.name,
        reason: "Nieobslugiwany format. Dodaj JPG, PNG lub WebP.",
      });
      continue;
    }

    if (file.size > maxBytes) {
      rejected.push({
        fileName: file.name,
        reason: `Plik ma ponad ${MAX_FILE_SIZE_MB}MB.`,
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
