export const MAX_BODY_BYTES = Number.parseInt(
  process.env.MAX_REQUEST_BODY_BYTES || '524288',
  10,
); // 512 KB

// Base64 inflates by ~33 %, so 14 MB here covers a decoded 10 MB image comfortably.
export const MAX_UPLOAD_BODY_BYTES = 14 * 1024 * 1024;

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Read and JSON-parse a request body. Enforces a byte cap (throws 413 on
 * overflow) and rejects non-JSON with a 400.
 *
 * Callers pass `MAX_UPLOAD_BODY_BYTES` for the image-upload route; everything
 * else uses the default ~512 KB.
 */
export const readRequestBody = (request, maxBytes = MAX_BODY_BYTES) =>
  new Promise((resolve, reject) => {
    // Raw Buffers, decoded once at the end: appending each chunk to a string
    // decoded it on its own, so an Arabic/Turkish/Russian character whose
    // bytes straddled a TCP chunk boundary became two U+FFFD characters —
    // silently corrupting long non-Latin texts (articles, campaign bodies).
    const chunks = [];
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
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (tooLarge) return;
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (!rawBody) {
        resolve({});
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        // Previously a plain Error → reported as a 500 "server error".
        reject(badRequest('Invalid JSON payload.'));
        return;
      }
      // `null`, `42`, `"x"` are valid JSON but every handler destructures the
      // body, which threw a TypeError (→ 500) on them.
      if (parsed === null || typeof parsed !== 'object') {
        reject(badRequest('Invalid JSON payload.'));
        return;
      }
      resolve(parsed);
    });

    request.on('error', (err) => {
      if (!tooLarge) reject(err);
    });
  });
