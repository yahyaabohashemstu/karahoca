export const MAX_BODY_BYTES = Number.parseInt(
  process.env.MAX_REQUEST_BODY_BYTES || '524288',
  10,
); // 512 KB

// Base64 inflates by ~33 %, so 14 MB here covers a decoded 10 MB image comfortably.
export const MAX_UPLOAD_BODY_BYTES = 14 * 1024 * 1024;

/**
 * Read and JSON-parse a request body. Enforces a byte cap (throws 413 on
 * overflow) and rejects non-JSON with a 400-style Error.
 *
 * Callers pass `MAX_UPLOAD_BODY_BYTES` for the image-upload route; everything
 * else uses the default ~512 KB.
 */
export const readRequestBody = (request, maxBytes = MAX_BODY_BYTES) =>
  new Promise((resolve, reject) => {
    let rawBody = '';
    let totalBytes = 0;
    let tooLarge = false;

    request.on('data', (chunk) => {
      if (tooLarge) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        // Drain remaining data so the socket stays alive for a response
        request.resume();
        const err = new Error('Request body too large.');
        err.statusCode = 413;
        reject(err);
        return;
      }
      rawBody += chunk;
    });

    request.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    request.on('error', (err) => {
      if (!tooLarge) reject(err);
    });
  });
