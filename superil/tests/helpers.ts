import { readFileSync } from "fs";
import path from "path";

export const FIX = path.join(__dirname, "fixtures/official");
export const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIX, name)));
export const fixtureText = (name: string) => readFileSync(path.join(FIX, name), "utf8");

/** Minimal windows-1255 encoder for ASCII + Hebrew letters (used to build legacy-encoded test files). */
export function encodeWindows1255(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c >= 0x05d0 && c <= 0x05ea) out.push(0xe0 + (c - 0x05d0));
    else throw new Error(`unsupported char ${ch}`);
  }
  return new Uint8Array(out);
}

export function encodeUtf16le(text: string, bom = true): Uint8Array {
  const buf = Buffer.from(text, "utf16le");
  return new Uint8Array(bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), buf]) : buf);
}
