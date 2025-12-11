import { CategoryBlock, ParsedProduct } from './types';
import { detectPriceFromText } from './price-detector';

export function parseMenuBlocksToProducts(blocks: CategoryBlock[]): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  for (const block of blocks) {
    for (const item of block.items) {
      const price = detectPriceFromText(item.rawText);
      const name = item.rawText.replace(/([0-9]+(?:[.,][0-9]+)?)/g, '').trim();
      products.push({
        category: block.title,
        name: name || 'Produit',
        price,
        image: item.imagePath,
      });
    }
  }
  return products;
}
