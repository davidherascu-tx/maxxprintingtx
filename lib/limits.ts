// Upload size limits, shared by the studio (browser) and the API routes (server).
// Kept well under the Cloudflare Workers request and memory limits (the Worker holds a file in memory
// a couple of times while storing it).

export const MAX_UPLOAD_MB = 20;
/** One uploaded image. */
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1000 * 1000;
/** One saved design: every preview and print file together. The studio lowers the print DPI to fit. */
export const MAX_DESIGN_BYTES = 20 * 1000 * 1000;
/** A whole request body: a file or a design, plus form overhead. */
export const MAX_REQUEST_BYTES = 22 * 1000 * 1000;
