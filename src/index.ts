/**
 * WASM-based LZMA2/XZ compression using liblzma compiled via Emscripten.
 * The WASM module is lazy-loaded on first use.
 */

import type { LzmaWasmModule } from './lzma.js'

export type { LzmaWasmModule }

let modulePromise: Promise<LzmaWasmModule> | null = null

/**
 * Returns the (lazily instantiated) raw Emscripten module, for advanced use.
 */
export function getLzmaModule(): Promise<LzmaWasmModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Dynamic import of the Emscripten glue code
      const factory: () => Promise<LzmaWasmModule> = (await import('./lzma.js')).default
      return factory()
    })()
  }
  return modulePromise
}

function run(mod: LzmaWasmModule, input: Uint8Array, op: 'compress' | 'decompress', call: (ptr: number, len: number) => number): ArrayBuffer {
  const inputPtr = mod._malloc(input.length)
  if (!inputPtr) throw new Error('WASM malloc failed for input')

  try {
    mod.HEAPU8.set(input, inputPtr)
    const ret = call(inputPtr, input.length)
    if (ret !== 0) {
      mod._free_result()
      throw new Error(`LZMA WASM ${op} failed with code ${ret}`)
    }

    const resultPtr = mod._get_result_ptr()
    const resultLen = mod._get_result_len()
    const output = new Uint8Array(resultLen)
    output.set(mod.HEAPU8.subarray(resultPtr, resultPtr + resultLen))
    mod._free_result()
    return output.buffer
  } finally {
    mod._free(inputPtr)
  }
}

/**
 * Compresses data into the .xz container format (LZMA2 filter, CRC64 check).
 * @param data the data to compress
 * @param preset the xz preset level (0-9), defaults to 6
 */
export async function lzmaWasmCompress(data: ArrayBuffer | Uint8Array, preset: number = 6): Promise<ArrayBuffer> {
  const mod = await getLzmaModule()
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data
  return run(mod, input, 'compress', (ptr, len) => mod._lzma_wasm_compress(ptr, len, preset))
}

/**
 * Decompresses data in the .xz container format.
 * @param data the compressed data
 */
export async function lzmaWasmDecompress(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const mod = await getLzmaModule()
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data
  return run(mod, input, 'decompress', (ptr, len) => mod._lzma_wasm_decompress(ptr, len))
}
