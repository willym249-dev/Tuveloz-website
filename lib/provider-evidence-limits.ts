// Decimal bytes stay within a vendor's advertised 3.5 MB limit even if its
// implementation does not use MiB. The browser, upload API and scanner agree.
export const MAX_EVIDENCE_BYTES = 3_500_000;
export const MAX_SOURCE_PHOTO_BYTES = 20_000_000;

export const EVIDENCE_UPLOAD_HELP = "PDF, JPG, PNG, or WebP; up to 3.5 MB per document. Larger photos are resized on your device before upload.";
export const EVIDENCE_SIZE_ERROR = "The document must be 3.5 MB or smaller.";
export const EVIDENCE_PDF_SIZE_ERROR = "This PDF is over 3.5 MB. Choose a smaller PDF from the issuer, keeping every page. If you need help, contact hello@tuveloz.com.";
