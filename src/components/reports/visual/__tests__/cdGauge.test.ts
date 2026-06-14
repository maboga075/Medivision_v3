import { describe, it, expect } from 'vitest';
import { parseNum, normalCDLimit, gaugeGradient } from '../CDGauge';

describe('parseNum', () => {
  it('extrait un décimal avec virgule et symbole parasite', () => {
    expect(parseNum('0,70 ⚠')).toBeCloseTo(0.7);
  });
  it('extrait la surface en mm²', () => {
    expect(parseNum('2.0 mm²')).toBe(2);
  });
  it('renvoie NaN pour vide ou non numérique', () => {
    expect(Number.isNaN(parseNum(undefined))).toBe(true);
    expect(Number.isNaN(parseNum('—'))).toBe(true);
  });
});

describe('normalCDLimit (limite haute de normalité C/D selon surface discale)', () => {
  it('petit disque ≤ 1,5 mm² → 0,5', () => {
    expect(normalCDLimit(1.0)).toBe(0.5);
    expect(normalCDLimit(1.5)).toBe(0.5);
  });
  it('taille courante ~2,0 mm² → ~0,6', () => {
    expect(normalCDLimit(2.0)).toBeCloseTo(0.6, 5);
  });
  it('grand disque ≥ 2,8 mm² → 0,7', () => {
    expect(normalCDLimit(2.8)).toBeCloseTo(0.7, 5);
    expect(normalCDLimit(3.5)).toBe(0.7);
  });
  it('croît de façon monotone avec la surface', () => {
    expect(normalCDLimit(1.5)).toBeLessThan(normalCDLimit(2.0));
    expect(normalCDLimit(2.0)).toBeLessThan(normalCDLimit(2.8));
  });
  it('valeur invalide → défaut taille moyenne 0,6', () => {
    expect(normalCDLimit(NaN)).toBe(0.6);
    expect(normalCDLimit(0)).toBe(0.6);
  });
});

describe('gaugeGradient', () => {
  it('produit un dégradé CSS avec les seuils dépendant de la limite', () => {
    const g = gaugeGradient(0.6);
    expect(g).toContain('linear-gradient(to top');
    // ambre placé à hauteur = limite * 100
    expect(g).toContain('60%');
  });
});
