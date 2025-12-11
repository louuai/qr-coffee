export interface CategoryBlock {
  title: string;
  items: Array<{ rawText: string; imagePath?: string }>;
}

export interface ParsedProduct {
  category: string;
  name: string;
  price: number | null;
  image?: string;
}

export interface OCRDebugPayload {
  rawText: string;
  categories: CategoryBlock[];
  products: ParsedProduct[];
}
