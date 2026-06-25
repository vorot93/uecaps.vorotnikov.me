import { deflateSync, inflateSync } from 'fflate';

// Detect raw-DEFLATE CompressionStream support once, at module load.
const HAS_DEFLATE_RAW: boolean = (() => {
  try {
    new CompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
})();

async function pump(data: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (HAS_DEFLATE_RAW) return pump(data, new CompressionStream('deflate-raw'));
  return deflateSync(data);
}

export async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (HAS_DEFLATE_RAW) return pump(data, new DecompressionStream('deflate-raw'));
  return inflateSync(data);
}
