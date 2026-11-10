import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BeanLot, Beverage } from '../types';

const BEANS_KEY = 'coquco.beans.v1';
const BEVERAGES_KEY = 'coquco.beverages.v1';

async function readAll<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

async function writeAll<T>(key: string, items: T[]) {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Bean lots ----

export async function getBeanLots(): Promise<BeanLot[]> {
  const lots = await readAll<BeanLot>(BEANS_KEY);
  return lots.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBeanLot(lot: BeanLot): Promise<void> {
  const lots = await readAll<BeanLot>(BEANS_KEY);
  lots.push(lot);
  await writeAll(BEANS_KEY, lots);
}

export async function deleteBeanLot(id: string): Promise<void> {
  const lots = (await readAll<BeanLot>(BEANS_KEY)).filter((l) => l.id !== id);
  // Also unlink any beverages that pointed at this lot
  const beverages = (await readAll<Beverage>(BEVERAGES_KEY)).map((b) =>
    b.beanLotId === id ? { ...b, beanLotId: undefined } : b
  );
  await Promise.all([
    writeAll(BEANS_KEY, lots),
    writeAll(BEVERAGES_KEY, beverages),
  ]);
}

// ---- Beverages ----

export async function getBeverages(): Promise<Beverage[]> {
  const beverages = await readAll<Beverage>(BEVERAGES_KEY);
  return beverages.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBeverage(beverage: Beverage): Promise<void> {
  const beverages = await readAll<Beverage>(BEVERAGES_KEY);
  beverages.push(beverage);
  await writeAll(BEVERAGES_KEY, beverages);
}

export async function deleteBeverage(id: string): Promise<void> {
  const beverages = (await readAll<Beverage>(BEVERAGES_KEY)).filter((b) => b.id !== id);
  await writeAll(BEVERAGES_KEY, beverages);
}
