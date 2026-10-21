import { describe, expect, test } from "bun:test"
import { base64Decode, base64Encode, checksum, sampledChecksum } from "./encode.js"

describe("frontend encoding", () => {
  test("uses unpadded URL-safe UTF-8 base64", () => {
    expect(base64Encode("hello")).toBe("aGVsbG8")
    expect(base64Encode("✓ à la mode")).toBe("4pyTIMOgIGxhIG1vZGU")
    expect(base64Decode("4pyTIMOgIGxhIG1vZGU")).toBe("✓ à la mode")
    expect(base64Decode("dXNlcjpwYXNz")).toBe("user:pass")
  })

  test("rejects invalid base64", () => {
    expect(() => base64Decode("%%%")).toThrow()
  })

  test("keeps stable FNV checksums", () => {
    expect(checksum("")).toBeUndefined()
    expect(checksum("hello")).toBe("m3bicr")
    expect(checksum("✓ à la mode")).toBe("jmczk0")
  })

  test("samples large values without changing the size boundary", () => {
    const value = "abcdef".repeat(100)
    expect(sampledChecksum(value, value.length)).toBe(checksum(value))
    expect(sampledChecksum(value, value.length - 1)).toBe("600:1isj1k5:1isj1k5:1isj1k5:1isj1k5:1isj1k5")
  })
  for (const fromEnd of [1, 2048, 2049]) {
    test(`captures the final checksum sample when a same-size value changes ${fromEnd} characters from EOF`, () => {
      const before = "a".repeat(600_000)
      const index = before.length - fromEnd
      const after = `${before.slice(0, index)}b${before.slice(index + 1)}`
      expect(sampledChecksum(after)).not.toBe(sampledChecksum(before))
    })
  }

  test("captures the final checksum sample from the actual last window", () => {
    const value = "abcdefghijk".repeat(60_000)
    expect(sampledChecksum(value)?.split(":").at(-1)).toBe(checksum(value.slice(-4096)))
  })

})
