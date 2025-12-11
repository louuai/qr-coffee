import { CategoryBlock } from './types';

export function detectCategoriesFromText(text: string): CategoryBlock[] {
  // TODO: smarter NLP; for now stub single block.
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return [
    {
      title: 'Autodetected',
      items: lines.map((rawText) => ({ rawText })),
    },
  ];
}
