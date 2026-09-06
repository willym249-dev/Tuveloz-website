import {
  EVIDENCE_PDF_SIZE_ERROR,
  MAX_EVIDENCE_BYTES,
  MAX_SOURCE_PHOTO_BYTES,
} from "./provider-evidence-limits.ts";

export type PreparedProviderEvidence = { file: File; resized: boolean };

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_ERROR = "We couldn't prepare this photo. Choose a JPG, PNG, or WebP photo, or a PDF under 3.5 MB.";
const READABILITY_ERROR = "We couldn't make this photo small enough while keeping enough detail. Try a closer photo of the whole document, or a PDF under 3.5 MB.";
const IMAGE_TIMEOUT_MS = 20_000;

function loadPhoto(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const photo = new Image();
    const finish = () => {
      clearTimeout(timer);
      photo.onload = null;
      photo.onerror = null;
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      finish();
      photo.src = "";
      reject(new Error(PHOTO_ERROR));
    }, IMAGE_TIMEOUT_MS);
    photo.onload = () => { finish(); resolve(photo); };
    photo.onerror = () => { finish(); reject(new Error(PHOTO_ERROR)); };
    // Browser image rendering honors the photo's EXIF orientation. Re-encoding
    // the rendered pixels keeps that orientation without copying GPS metadata.
    photo.src = url;
  });
}

function jpegCopy(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(PHOTO_ERROR)), IMAGE_TIMEOUT_MS);
    canvas.toBlob((blob) => {
      clearTimeout(timer);
      if (!blob || blob.type !== "image/jpeg" || blob.size === 0) {
        reject(new Error(PHOTO_ERROR));
      } else {
        resolve(blob);
      }
    }, "image/jpeg", quality);
  });
}

export async function prepareProviderEvidence(file: File): Promise<PreparedProviderEvidence> {
  if (file.size === 0 || (file.type !== "application/pdf" && !PHOTO_TYPES.has(file.type))) {
    throw new Error("Choose a PDF, JPG, PNG, or WebP document.");
  }
  // Keep PDFs (including signatures and every page) and already-small photos
  // byte-for-byte intact. Never rasterize, crop, or silently discard PDF pages.
  if (file.size <= MAX_EVIDENCE_BYTES) return { file, resized: false };
  if (file.type === "application/pdf") throw new Error(EVIDENCE_PDF_SIZE_ERROR);
  if (file.size > MAX_SOURCE_PHOTO_BYTES) {
    throw new Error("This photo is over 20 MB. Choose a smaller photo or a PDF under 3.5 MB.");
  }

  const photo = await loadPhoto(file);
  const canvas = document.createElement("canvas");
  try {
    const width = photo.naturalWidth;
    const height = photo.naturalHeight;
    if (!width || !height || width * height > 50_000_000) throw new Error(PHOTO_ERROR);
    const context = canvas.getContext("2d");
    if (!context) throw new Error(PHOTO_ERROR);

    // Try a detailed copy first. Stop at a conservative resolution/quality
    // floor rather than shrinking indefinitely to force any file to fit.
    const sizes = [...new Set([3200, 2800, 2400].map(size => Math.min(size, Math.max(width, height))))];
    for (const longestSide of sizes) {
      const scale = longestSide / Math.max(width, height);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.94, 0.90, 0.86]) {
        const blob = await jpegCopy(canvas, quality);
        if (blob.size > MAX_EVIDENCE_BYTES) continue;
        const name = `${file.name.replace(/\.[^.]*$/, "").slice(0, 120) || "document"}-resized.jpg`;
        return { file: new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified }), resized: true };
      }
    }
    throw new Error(READABILITY_ERROR);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    photo.src = "";
  }
}
