import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateAge } from '../age';

describe('calculateAge', () => {
  afterEach(() => vi.useRealTimers());

  const freeze = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it('âge exact le jour de l’anniversaire', () => {
    freeze('2026-06-15T10:00:00Z');
    expect(calculateAge('2000-06-15')).toBe(26);
  });

  it('anniversaire pas encore passé → une année de moins', () => {
    freeze('2026-06-14T10:00:00Z');
    expect(calculateAge('2000-06-15')).toBe(25);
  });

  it('anniversaire déjà passé cette année', () => {
    freeze('2026-06-16T10:00:00Z');
    expect(calculateAge('2000-06-15')).toBe(26);
  });

  it('patient né en 1950 (cas long)', () => {
    freeze('2026-09-01T10:00:00Z');
    expect(calculateAge('1950-01-01')).toBe(76);
  });

  it('date vide ou invalide → 0', () => {
    expect(calculateAge('')).toBe(0);
    expect(calculateAge('pas-une-date')).toBe(0);
  });
});
