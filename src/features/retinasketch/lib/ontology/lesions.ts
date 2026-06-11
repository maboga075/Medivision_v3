/**
 * Ontologie des lésions rétiniennes + recherche intelligente.
 * Extensible : une base internationale future viendra l'enrichir.
 */
export interface Lesion {
  id: string;
  name: string;
  color: string;
  category: string;
  /** Synonymes / termes de recherche (insensibles à la casse et aux accents). */
  terms: string[];
}

export const LESIONS: Lesion[] = [
  { id: "hem-flammeche", name: "Hémorragie en flammèche", color: "#E5484D", category: "Hémorragie", terms: ["hemorragie", "flammeche", "flame", "saignement"] },
  { id: "hem-punctiforme", name: "Hémorragie punctiforme", color: "#C2282D", category: "Hémorragie", terms: ["hemorragie", "punctiforme", "dot", "ponctuelle"] },
  { id: "hem-pre-retinienne", name: "Hémorragie pré-rétinienne", color: "#9B1C1F", category: "Hémorragie", terms: ["hemorragie", "preretinienne", "pre-retinienne", "sous-hyaloidienne"] },
  { id: "hem-sous-retinienne", name: "Hémorragie sous-rétinienne", color: "#7A1518", category: "Hémorragie", terms: ["hemorragie", "sous-retinienne", "sub-retinal"] },
  { id: "microanevrisme", name: "Microanévrisme", color: "#A11D2B", category: "Vasculaire", terms: ["microanevrisme", "microaneurysm", "ma"] },
  { id: "exsudat-dur", name: "Exsudats durs", color: "#F5A524", category: "Exsudat", terms: ["exsudat", "dur", "hard", "lipidique"] },
  { id: "nodule-cotonneux", name: "Nodule cotonneux", color: "#C9D17A", category: "Exsudat", terms: ["nodule", "cotonneux", "cotton", "soft", "mou"] },
  { id: "drusen", name: "Drusen", color: "#EAB308", category: "Dégénératif", terms: ["drusen", "dmla"] },
  { id: "oedeme-maculaire", name: "Œdème maculaire", color: "#8B5CF6", category: "Œdème", terms: ["oedeme", "œdeme", "macula", "maculaire", "ome"] },
  { id: "ischemie", name: "Ischémie", color: "#3B82F6", category: "Vasculaire", terms: ["ischemie", "ischemic", "non-perfusion", "amputation"] },
  { id: "neovaisseaux", name: "Néovaisseaux", color: "#EC4899", category: "Vasculaire", terms: ["neovaisseaux", "neovascularisation", "nvx", "nve", "nvd"] },
  { id: "anomalie-imv", name: "AMIR (anomalies microvasculaires)", color: "#06B6D4", category: "Vasculaire", terms: ["amir", "imv", "irma", "anomalie", "microvasculaire"] },
  { id: "laser-impact", name: "Impacts laser", color: "#14B8A6", category: "Traitement", terms: ["laser", "impact", "photocoagulation", "panphoto"] },
  { id: "decollement", name: "Décollement de rétine", color: "#6366F1", category: "Structurel", terms: ["decollement", "retine", "drr", "detachment"] },
  { id: "membrane-epiret", name: "Membrane épirétinienne", color: "#0EA5E9", category: "Structurel", terms: ["membrane", "epiretinienne", "mer", "pucker"] },
];

const LESION_MAP = new Map(LESIONS.map((l) => [l.id, l]));
export const getLesion = (id: string | null) =>
  id ? LESION_MAP.get(id) : undefined;

/** Normalise (minuscule, sans accents, sans tirets) pour la recherche. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-']/g, " ")
    .trim();
}

/** Vrai si tous les caractères de `q` apparaissent dans l'ordre dans `h`. */
function isSubsequence(q: string, h: string): boolean {
  let i = 0;
  for (let j = 0; j < h.length && i < q.length; j++) {
    if (h[j] === q[i]) i++;
  }
  return i === q.length;
}

/** Recherche tolérante : exact > préfixe > sous-chaîne > sous-séquence floue. */
export function searchLesions(query: string, limit = 6): Lesion[] {
  const q = norm(query).replace(/\s+/g, "");
  if (!q) return [];
  const scored = LESIONS.map((l) => {
    const haystacks = [l.name, l.category, ...l.terms].map((h) =>
      norm(h).replace(/\s+/g, ""),
    );
    let score = 0;
    for (const h of haystacks) {
      if (h === q) score = Math.max(score, 100);
      else if (h.startsWith(q)) score = Math.max(score, 70);
      else if (h.includes(q)) score = Math.max(score, 40);
      else if (isSubsequence(q, h)) score = Math.max(score, 20);
    }
    return { l, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.l.name.localeCompare(b.l.name));
  return scored.slice(0, limit).map((s) => s.l);
}
