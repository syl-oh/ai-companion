import crypto from "crypto";

const ENCRYPTION_KEY = process.env.APPDIRECT_ENCRYPTION_KEY;
const algorithm = "aes-256-gcm";
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, nonce);

  let encryptedData = cipher.update(text, "utf-8", "hex");
  encryptedData += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Prepend nonce and tag to the encrypted data
  return nonce.toString("hex") + tag.toString("hex") + encryptedData;
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const nonce = Buffer.from(text.slice(0, 2 * NONCE_LENGTH), "hex");
  const tag = Buffer.from(
    text.slice(2 * NONCE_LENGTH, 2 * NONCE_LENGTH + 2 * TAG_LENGTH),
    "hex"
  );
  const encryptedText = text.slice(2 * NONCE_LENGTH + 2 * TAG_LENGTH);

  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, nonce);
  decipher.setAuthTag(tag);

  let decryptedData = decipher.update(encryptedText, "hex", "utf-8");
  decryptedData += decipher.final("utf8");

  return decryptedData;
}
