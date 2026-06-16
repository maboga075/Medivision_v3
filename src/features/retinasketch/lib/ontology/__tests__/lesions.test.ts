import { describe, it, expect } from 'vitest';
import { searchLesions } from '../lesions';

describe('searchLesions', () => {
  it('renvoie [] pour une requête vide', () => {
    expect(searchLesions('')).toEqual([]);
  });

  it('trouve par synonyme insensible aux accents', () => {
    const r = searchLesions('hemorragie');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.id && l.name && l.color)).toBe(true);
  });

  it('trouve une lésion par son terme exact', () => {
    expect(searchLesions('microanevrisme').some((l) => l.id === 'microanevrisme')).toBe(true);
  });

  it('classe une correspondance exacte de nom en tête', () => {
    expect(searchLesions('drusen')[0].id).toBe('drusen');
  });

  it('respecte la limite de résultats', () => {
    expect(searchLesions('e', 3).length).toBeLessThanOrEqual(3);
  });
});
