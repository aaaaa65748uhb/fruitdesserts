import { gunzipSync, unzipSync } from "fflate";

/**
 * Turns an uploaded official price file into text entries.
 * Supports plain XML, gzip (.gz), ZIP archives (including .gz files inside a ZIP) and the text encodings
 * seen in published files: UTF-8 (with/without BOM), UTF-16 LE/BE (BOM) and windows-1255 / ISO-8859-8
 * (declared in the XML prolog).
 */

export interface DecodedEntry {
  /** Name of the file inside the upload (archive path for ZIP entries). */
  name: string;
  text: string;
  encoding: string;
  container: "plain" | "gzip" | "zip" | "zip+gzip";
}

export interface DecodeResult {
  entries: DecodedEntry[];
  errors: string[];
}

export const MAX_DECOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;

const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06);

export function detectEncoding(bytes: Uint8Array): { encoding: string; offset: number } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", offset: 3 };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", offset: 2 };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", offset: 2 };
  // UTF-16 without BOM: "<\0?\0" or "\0<\0?"
  if (bytes[0] === 0x3c && bytes[1] === 0x00) return { encoding: "utf-16le", offset: 0 };
  if (bytes[0] === 0x00 && bytes[1] === 0x3c) return { encoding: "utf-16be", offset: 0 };
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const declared = head.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (declared && /1255|8859-8|hebrew/.test(declared)) return { encoding: "windows-1255", offset: 0 };
  return { encoding: "utf-8", offset: 0 };
}

export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  const { encoding, offset } = detectEncoding(bytes);
  let text = new TextDecoder(encoding, { fatal: false }).decode(bytes.subarray(offset));
  // A prolog that declares an encoding we already applied would confuse nothing in our parser, but strip a stray BOM.
  text = text.replace(/^﻿/, "");
  return { text, encoding };
}

function gunzipChecked(bytes: Uint8Array): Uint8Array<ArrayBufferLike> {
  const out = gunzipSync(bytes);
  if (out.length > MAX_DECOMPRESSED_BYTES) throw new Error("Decompressed file is too large");
  return out;
}

export function decodeUpload(fileName: string, bytes: Uint8Array): DecodeResult {
  const errors: string[] = [];
  const entries: DecodedEntry[] = [];
  try {
    if (isZip(bytes)) {
      let total = 0;
      const files = unzipSync(bytes, {
        filter: (f) => {
          total += f.originalSize;
          return !f.name.endsWith("/") && total <= MAX_DECOMPRESSED_BYTES;
        },
      });
      const names = Object.keys(files);
      if (!names.length) errors.push(`${fileName}: the ZIP archive contains no files`);
      if (names.length > MAX_ZIP_ENTRIES) throw new Error(`ZIP archive has too many entries (${names.length})`);
      for (const name of names) {
        const base = name.split("/").pop() ?? name;
        if (base.startsWith(".") || name.startsWith("__MACOSX")) continue;
        try {
          let data: Uint8Array<ArrayBufferLike> = files[name];
          let container: DecodedEntry["container"] = "zip";
          if (isGzip(data)) {
            data = gunzipChecked(data);
            container = "zip+gzip";
          }
          if (!looksLikeXml(data)) {
            errors.push(`${name}: not an XML file – skipped (only the official XML formats are supported)`);
            continue;
          }
          const { text, encoding } = decodeText(data);
          entries.push({ name: base.replace(/\.gz$/i, ""), text, encoding, container });
        } catch (e) {
          errors.push(`${name}: ${e instanceof Error ? e.message : "could not be read"}`);
        }
      }
    } else if (isGzip(bytes)) {
      const data = gunzipChecked(bytes);
      if (!looksLikeXml(data)) errors.push(`${fileName}: decompressed content is not XML`);
      else {
        const { text, encoding } = decodeText(data);
        entries.push({ name: fileName.replace(/\.gz$/i, ""), text, encoding, container: "gzip" });
      }
    } else if (looksLikeXml(bytes)) {
      const { text, encoding } = decodeText(bytes);
      entries.push({ name: fileName, text, encoding, container: "plain" });
    } else {
      errors.push(`${fileName}: unsupported file – expected XML, .gz or .zip`);
    }
  } catch (e) {
    errors.push(`${fileName}: ${e instanceof Error ? e.message : "could not be decompressed"}`);
  }
  return { entries, errors };
}

function looksLikeXml(bytes: Uint8Array): boolean {
  const { encoding, offset } = detectEncoding(bytes);
  const head = new TextDecoder(encoding).decode(bytes.subarray(offset, offset + 400)).trimStart();
  return head.startsWith("<");
}
