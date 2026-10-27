import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { lzmaWasmCompress, lzmaWasmDecompress } from '../dist'

const REF_SIZE = 32 * 1024

function generateReferenceData(): Uint8Array {
  const words = ['patient', 'contact', 'healthcare', 'delegation', 'encrypted', 'document', 'service', 'invoice']
  const lines: string[] = []
  let len = 0
  let i = 0
  while (len < REF_SIZE) {
    const line = `${i}: ${words[i % words.length]} id=${Math.random().toString(36).slice(2)} value=${Math.random()}\n`
    lines.push(line)
    len += line.length
    i++
  }
  return new TextEncoder().encode(lines.join('').slice(0, REF_SIZE))
}

function hasXzCli(): boolean {
  try {
    execFileSync('xz', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function withTmpFile<T>(data: Buffer, f: (file: string) => T): T {
  const tmp = path.join(os.tmpdir(), `lzma-wasm-test-${process.pid}-${Math.random().toString(36).slice(2)}.bin`)
  fs.writeFileSync(tmp, data)
  try {
    return f(tmp)
  } finally {
    fs.unlinkSync(tmp)
  }
}

describe('lzma-wasm', () => {
  it('round-trips data', async () => {
    const data = generateReferenceData()
    const compressed = await lzmaWasmCompress(data)
    assert.ok(compressed.byteLength < data.length)
    assert.deepEqual(new Uint8Array(await lzmaWasmDecompress(compressed)), data)
  })

  it('round-trips empty input', async () => {
    const compressed = await lzmaWasmCompress(new Uint8Array(0))
    assert.equal((await lzmaWasmDecompress(compressed)).byteLength, 0)
  })

  it('accepts every preset level', async () => {
    const data = generateReferenceData()
    for (let preset = 0; preset <= 9; preset++) {
      assert.deepEqual(new Uint8Array(await lzmaWasmDecompress(await lzmaWasmCompress(data, preset))), data)
    }
  })

  it('does not modify ArrayBuffer inputs', async () => {
    const input = generateReferenceData().buffer.slice(0) as ArrayBuffer
    const snapshot = new Uint8Array(input.slice(0))
    const compressed = await lzmaWasmCompress(input)
    assert.deepEqual(new Uint8Array(input), snapshot)
    const compressedSnapshot = new Uint8Array(compressed.slice(0))
    await lzmaWasmDecompress(compressed)
    assert.deepEqual(new Uint8Array(compressed), compressedSnapshot)
  })

  it('rejects invalid input on decompression', async () => {
    await assert.rejects(lzmaWasmDecompress(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /decompress failed/)
  })

  describe('xz CLI interop', () => {
    it('produces output that xz can decompress', async (t) => {
      if (!hasXzCli()) return t.skip('xz not installed')
      const data = generateReferenceData()
      const compressed = Buffer.from(await lzmaWasmCompress(data))
      const decompressed = withTmpFile(compressed, (f) => execFileSync('xz', ['--decompress', '--stdout', f]))
      assert.ok(decompressed.equals(Buffer.from(data)))
    })

    it('decompresses output from xz', async (t) => {
      if (!hasXzCli()) return t.skip('xz not installed')
      const data = generateReferenceData()
      const compressed = withTmpFile(Buffer.from(data), (f) => execFileSync('xz', ['--compress', '-6', '--stdout', f]))
      assert.deepEqual(new Uint8Array(await lzmaWasmDecompress(compressed)), data)
    })
  })
})
