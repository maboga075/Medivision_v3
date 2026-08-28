import { describe, it, expect } from 'vitest';
import { normalizeClinicalData } from '../clinicalPayload';
import { createEyeState } from '../clinicalData';
import type { RawConsultationData } from '../../types/clinical';
import type { Annotation } from '../../features/retinasketch/lib/types';

// Annotation validée de l'œil gauche, taguée 'OS' par l'éditeur RetinaSketch.
const ogAnnotation: Annotation = {
  id: 'a1',
  kind: 'point',
  points: [0, 0],
  radiusMm: 0.5,
  centroidMm: { x: 0, y: 0 },
  areaMm2: null,
  laterality: 'OS',
  lesionId: 'microanevrisme',
  status: 'validated',
  attrs: {
    context: 'retino',
    topoZone: 'MI',
    anatomicalZone: 'Macula',
    quadrant: 'TI',
    foveaBand: '1-3mm',
    distanceToFoveaMm: 2,
    etdrsSector: 'TI',
    distanceToDiscMm: 5,
    vascularRelation: { nearVessel: false, distanceToVesselMm: null },
  },
  author: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function makeRaw(): RawConsultationData {
  return {
    patient: { nom: 'TEST', age: 60, date_naissance: null },
    contexte: { prescripteur: '', motifs: [], antecedents: [], hypotheses_diagnostiques: [], hypothese_libre: '' },
    oeil_droit: createEyeState(),
    oeil_gauche: { ...createEyeState(), retinaAnnotations: [ogAnnotation] },
  };
}

// Annotation validée sur une coupe B-scan (couche OPL), œil gauche.
const bscanAnnotation: Annotation = {
  id: 'b1',
  kind: 'point',
  points: [0, 0],
  radiusMm: 0.5,
  centroidMm: { x: 0, y: 0 },
  areaMm2: null,
  laterality: 'OS',
  lesionId: 'oedeme-maculaire',
  status: 'validated',
  attrs: { context: 'bscan', transverseZone: 'centrale', layer: 'OPL' },
  author: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('normalizeClinicalData — symptômes RetinaSketch transmis à l\'IA', () => {
  it('convertit les annotations OG (taguées OS) en observations.retina (régression latéralité)', () => {
    const norm = normalizeClinicalData(makeRaw());
    const og = norm?.donnees_cliniques.oeil_gauche;
    expect(og?.observations.retina).toBeDefined();
    expect((og?.observations.retina ?? []).length).toBeGreaterThan(0);
  });

  it('convertit les annotations d\'un slot B-scan en observations.bscan', () => {
    const raw = makeRaw();
    raw.oeil_gauche = {
      ...createEyeState(),
      retinaSlots: [
        {
          id: 's1',
          kind: 'bscan',
          geometry: 'rect',
          label: 'B-scan 1',
          background: null,
          annotations: [bscanAnnotation],
          printSelected: true,
        },
      ],
    };
    const og = normalizeClinicalData(raw)?.donnees_cliniques.oeil_gauche;
    expect(og?.observations.bscan).toBeDefined();
    expect((og?.observations.bscan ?? []).some((l) => l.includes('B-scan'))).toBe(true);
    // La lésion de coupe ne doit pas polluer la clé rétino.
    expect(og?.observations.retina).toBeUndefined();
  });
});
