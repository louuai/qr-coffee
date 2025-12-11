export function detectPriceFromText(rawText: string): number | null {
  const match = rawText.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}
