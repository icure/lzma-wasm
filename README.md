# @icure/lzma-wasm

LZMA2 / XZ compression and decompression for browsers, web workers and Node.js, using
[liblzma](https://tukaani.org/xz/) (XZ Utils 5.6.4) compiled to WebAssembly with Emscripten.

Output is a standard `.xz` stream (LZMA2 filter, CRC64 check) that interoperates with the `xz` CLI.

## Install

```bash
npm install @icure/lzma-wasm
```

## Usage

```ts
import { lzmaWasmCompress, lzmaWasmDecompress } from '@icure/lzma-wasm'

const compressed: ArrayBuffer = await lzmaWasmCompress(new TextEncoder().encode('hello'), 6) // preset 0-9, default 6
const decompressed: ArrayBuffer = await lzmaWasmDecompress(compressed)
```

Both functions accept an `ArrayBuffer` or a `Uint8Array` and never modify their input.
The WASM module is loaded lazily on first call. `getLzmaModule()` gives access to the raw Emscripten module.

### Bundlers

`dist/lzma.js` locates `lzma.wasm` next to itself. When bundling for the browser, make sure
`lzma.wasm` is emitted as an asset alongside the bundled glue code (e.g. webpack `asset/resource`,
or copy it to your public directory).

## Rebuilding the WASM module

The prebuilt `src/lzma.js` and `src/lzma.wasm` are committed. To rebuild them you need
[Emscripten](https://emscripten.org/) (`emcc`) on your `PATH`:

```bash
npm run build:wasm   # downloads xz 5.6.4 into src/build, compiles src/lzma_wasm.c + liblzma
npm test
```

## License

MIT for the code in this repository. liblzma is 0BSD (see `LICENSE.liblzma`).
