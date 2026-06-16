import { describe, it, expect } from 'vitest';
import { buildClinicalSummary } from '../clinicalSummary';
import type { DonneesCliniquesNormalisees, EyeDataNormalisee } from '../../types/clinical';

function makeNormalized(od: Partial<EyeDataNormalisee>): DonneesCliniquesNormalisees {
  return {
    patient: { nom: 'TEST', age: 60 },
    contexte: { motifs: [], antecedents: [], hypotheses_diagnostiques: [] },
    donnees_cliniques: {
      oeil_droit: { observations: {}, ...od },
      oeil_gauche: null,
    },
  };
}

describe('buildClinicalSummary — interprétation du suivi', () => {
  it('remonte une aggravation quand le RNFL diminue au suivi', () => {
    const summary = buildClinicalSummary(
      makeNormalized({ hasFollowUp: true, rnflEvolution: 'Diminution (amincissement)' }),
    );
    const od = summary!.analyse_clinique.oeil_droit;
    expect(od.anomalies).toContain('Diminution du RNFL au suivi (aggravation)');
    expect(od.patterns).toContain('aggravation_suivi');
  });

  it("n'ajoute pas d'aggravation quand l'évolution est stable", () => {
    const summary = buildClinicalSummary(
      makeNormalized({ hasFollowUp: true, rnflEvolution: 'Stable', gclEvolution: 'Stable' }),
    );
    expect(summary!.analyse_clinique.oeil_droit.patterns).not.toContain('aggravation_suivi');
  });
});

describe('buildClinicalSummary — lésions RetinaSketch', () => {
  it('remonte les lésions dessinées comme anomalies', () => {
    const summary = buildClinicalSummary(
      makeNormalized({ observations: { retina: ['Présence de microanévrismes en région maculaire.'] } }),
    );
    const anomalies = summary!.analyse_clinique.oeil_droit.anomalies;
    expect(anomalies.some((a) => a.toLowerCase().includes('microanévrisme'))).toBe(true);
  });
});
