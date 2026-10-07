// Decimal bytes stay within a vendor's advertised 3.5 MB limit even if its
// implementation does not use MiB. The browser, upload API and scanner agree.
export const MAX_EVIDENCE_BYTES = 3_500_000;
// Multipart boundaries and the small service/issuer/date fields need room too.
export const MAX_EVIDENCE_REQUEST_BYTES = MAX_EVIDENCE_BYTES + 64 * 1024;
export const EVIDENCE_REQUEST_SIZE_ERROR = "This upload is too large. Choose one document up to 3.5 MB and try again.";
export const EVIDENCE_REQUEST_FORMAT_ERROR = "We couldn't read this upload. Choose your document again and try once more.";
export const MAX_SOURCE_PHOTO_BYTES = 20_000_000;

export const EVIDENCE_UPLOAD_HELP = "PDF, JPG, PNG, or WebP; up to 3.5 MB per document. Larger photos are resized on your device before upload.";
export const EVIDENCE_SIZE_ERROR = "The document must be 3.5 MB or smaller.";
export const EVIDENCE_PDF_SIZE_ERROR = "This PDF is over 3.5 MB. Choose a smaller PDF from the issuer, keeping every page. If you need help, contact hello@tuveloz.com.";
