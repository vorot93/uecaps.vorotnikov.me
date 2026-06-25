import { base32Encode, base32Decode } from './base32';
import { deflate, inflate } from './deflate';
import { InvalidPayloadError } from './errors';

export const PAYLOAD_VERSION = '1';

export async function encodeState(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const compressed = await deflate(bytes);
  return PAYLOAD_VERSION + base32Encode(compressed);
}

export async function decodeState(payload: string): Promise<string> {
  if (!payload) {
    throw new InvalidPayloadError('Empty payload');
  }
  if (payload[0] !== PAYLOAD_VERSION) {
    throw new InvalidPayloadError(`Unsupported payload version: ${payload[0]}`);
  }
  try {
    const compressed = base32Decode(payload.slice(1));
    const bytes = await inflate(compressed);
    return new TextDecoder().decode(bytes);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new InvalidPayloadError(
      `Could not decode payload: ${detail || 'data is not valid compressed content'}`,
    );
  }
}
