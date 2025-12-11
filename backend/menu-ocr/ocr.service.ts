import Tesseract from 'tesseract.js';

export async function extractTextFromImage(filePath: string): Promise<string> {
  // TODO: plug Google Vision or custom configuration.
  const result = await Tesseract.recognize(filePath, 'eng', { logger: () => undefined });
  return result?.data?.text || '';
}
