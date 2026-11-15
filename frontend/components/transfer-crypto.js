// Chunked, password-based encryption for portable transfer backups.
// SQX1 = magic, 16-byte PBKDF2 salt, 4-byte iteration count, then
// repeated [4-byte encrypted-frame length][12-byte GCM nonce][ciphertext].
(() => {
  const MAGIC = new Uint8Array([0x53, 0x51, 0x58, 0x31]);
  const ITERATIONS = 310000, FRAME = 64 * 1024;
  const put32 = (view, at, value) => view.setUint32(at, value, false);
  const read32 = (bytes, at = 0) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, false);
  async function keyFor(password, salt, iterations) {
    if (!password || password.length < 8) throw new Error("Use a transfer password with at least 8 characters.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptStream(source, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await keyFor(password, salt, ITERATIONS), reader = source.getReader();
    let headerSent = false;
    const output = new ReadableStream({
      async pull(controller) {
        try {
          if (!headerSent) {
            const header = new Uint8Array(24); header.set(MAGIC); header.set(salt, 4); put32(new DataView(header.buffer), 20, ITERATIONS);
            controller.enqueue(header); headerSent = true; return;
          }
          const { done, value } = await reader.read();
          if (done) { controller.enqueue(new Uint8Array(4)); controller.close(); return; }
          for (let offset = 0; offset < value.length; offset += FRAME) {
            const nonce = crypto.getRandomValues(new Uint8Array(12));
            const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, value.subarray(offset, offset + FRAME)));
            const frame = new Uint8Array(4 + nonce.length + cipher.length); put32(new DataView(frame.buffer), 0, 12 + cipher.length); frame.set(nonce, 4); frame.set(cipher, 16); controller.enqueue(frame);
          }
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); }
    });
    reader.closed.catch(() => {});
    return output;
  }
  function decryptStream(source, password) {
    const reader = source.getReader(); let pending = new Uint8Array(0), keyPromise = null, finished = false;
    const append = bytes => { const joined = new Uint8Array(pending.length + bytes.length); joined.set(pending); joined.set(bytes, pending.length); pending = joined; };
    async function need(size) { while (pending.length < size) { const { done, value } = await reader.read(); if (done) return false; append(value); } return true; }
    async function take(size) { const out = pending.slice(0, size); pending = pending.slice(size); return out; }
    const output = new ReadableStream({
      async pull(controller) {
        try {
          if (finished) return;
          if (!keyPromise) {
            if (!await need(24)) throw new Error("Encrypted transfer file is incomplete.");
            const header = await take(24);
            if (!MAGIC.every((byte, index) => header[index] === byte)) throw new Error("This is not a supported encrypted transfer file.");
            const iterations = read32(header, 20);
            if (iterations < 100000 || iterations > 1000000) throw new Error("Transfer file has an invalid encryption header.");
            keyPromise = keyFor(password, header.slice(4, 20), iterations);
          }
          if (!await need(4)) throw new Error("Encrypted transfer file is incomplete.");
          const size = read32(await take(4));
          if (!size) { finished = true; controller.close(); return; }
          if (size < 28 || size > 2 * 1024 * 1024) throw new Error("Encrypted transfer file contains an invalid data frame.");
          if (!await need(size)) throw new Error("Encrypted transfer file is incomplete.");
          const frame = await take(size), key = await keyPromise;
          try { controller.enqueue(new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: frame.slice(0, 12) }, key, frame.slice(12)))); }
          catch (_) { throw new Error("Wrong password or damaged encrypted transfer file."); }
        } catch (error) { finished = true; controller.error(error); }
      },
      cancel(reason) { finished = true; return reader.cancel(reason); }
    });
    reader.closed.catch(() => {});
    return output;
  }
  window.SplitAppTransferCrypto = Object.freeze({ isEncryptedHeader: bytes => bytes?.length >= 4 && MAGIC.every((byte, index) => bytes[index] === byte), encryptStream, decryptStream });
})();
