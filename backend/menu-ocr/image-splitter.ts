import sharp from 'sharp';

export async function splitMenuImage(filePath: string): Promise<string[]> {
  // TODO: implement real segmentation.
  const baseName = filePath.replace(/\.[^/.]+$/, '');
  const snippetPath = `${baseName}-snippet.png`;
  await sharp(filePath).resize(800).toFile(snippetPath);
  return [snippetPath];
}
