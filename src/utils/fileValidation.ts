const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_FILES = 50;
export const MAX_FILE_SIZE_MB = 20;

export type RejectionReason =
  | "tooManyFiles"
  | "unsupportedFormat"
  | "fileTooLarge";
export interface ValidationError {
  fileName: string;
  reason: RejectionReason;
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
        reason: "tooManyFiles",
      });
      continue;
    }

    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      rejected.push({
        fileName: file.name,
        reason: "unsupportedFormat",
      });
      continue;
    }

    if (file.size > maxBytes) {
      rejected.push({
        fileName: file.name,
        reason: "fileTooLarge",
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
