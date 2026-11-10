// Core data models for CoQuCo (Coffee Quality Control)

export type BeanType = 'green' | 'roasted';

export interface BeanAnalysis {
  /** 0..100 overall bean quality score (color consistency, uniformity, type match) */
  score: number;
  /** Mean luminance 0..1 of the bean area */
  meanLuminance: number;
  /** 0..1 — 1 means perfectly even color across beans */
  uniformity: number;
  /** 0..1 — how strongly pixels match the expected green/roasted profile */
  typeMatch: number;
  /** Roast level label, only meaningful for roasted beans */
  roastLevel?: RoastLevel;
  /** 0..1 — 0 = light roast, 1 = very dark */
  roastIntensity?: number;
}

export type RoastLevel =
  | 'Cinnamon'
  | 'Light'
  | 'Medium'
  | 'Medium-Dark'
  | 'Dark'
  | 'Very Dark';

export interface BeanLot {
  id: string;
  createdAt: number;
  name: string;
  imageUri: string;
  beanType: BeanType;
  analysis: BeanAnalysis;
  origin?: string;
  notes?: string;
}

export type BeverageType = 'espresso' | 'filter' | 'milk' | 'other';

export interface BeverageScores {
  aroma: number; // 0..10
  acidity: number; // 0..10
  body: number; // 0..10
  sweetness: number; // 0..10
  balance: number; // 0..10
}

export interface Beverage {
  id: string;
  createdAt: number;
  name: string;
  imageUri: string;
  beverageType: BeverageType;
  scores: BeverageScores;
  /** Links this cup to a bean lot, if any */
  beanLotId?: string;
  notes?: string;
}

export function beverageTotal(b: Beverage): number {
  const s = b.scores;
  return Math.round(((s.aroma + s.acidity + s.body + s.sweetness + s.balance) / 5) * 10) / 10;
}
