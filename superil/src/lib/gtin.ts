/** Validates a GTIN-8/12/13/14 check digit. Used to decide whether an ItemCode is a real barcode. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Canonical form used to match the same barcode across retailers: GTIN-8/12/13/14 are left-padded to 13
 * digits after removing redundant leading zeros (so UPC-A "012345678905" and EAN "0012345678905" match),
 * GTIN-14 with a packaging indicator keeps all 14 digits. Returns undefined for anything that is not a valid GTIN.
 */
export function canonicalGtin(code: string): string | undefined {
  const digits = code.trim();
  if (!/^\d{8,14}$/.test(digits)) return undefined;
  const padded = digits.padStart(14, "0");
  if (!isValidGtin(padded)) return undefined;
  return padded.startsWith("0") ? padded.slice(1) : padded;
}
