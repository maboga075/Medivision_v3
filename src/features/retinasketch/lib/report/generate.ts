import type {
  Annotation,
  Laterality,
  RetinoAttributes,
  BscanAttributes,
  CorneaAttributes,
  OctaAttributes,
  TopoZone,
} from "../types";
import { TOPO_ZONE_LABEL } from "../types";
import { getLesion } from "../ontology/lesions";

/** Génère un compte rendu clinique à partir des annotations validées. */

function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function plural(n: number, sing: string, plur: string) {
  return n > 1 ? plur : sing;
}

const STOPWORDS = new Set(["en", "de", "du", "des", "à", "au", "aux", "d'"]);

/**
 * Pluralise un nom de lésion : pluralise le nom et ses adjectifs accolés,
 * mais s'arrête à une préposition (locution invariable).
 *   « Œdème maculaire » → « œdèmes maculaires »
 *   « Hémorragie en flammèche » → « hémorragies en flammèche »
 */
function pluralizeLesion(name: string): string {
  const words = name.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (STOPWORDS.has(words[i].toLowerCase())) break;
    if (!/[sxz]$/i.test(words[i])) words[i] += "s";
  }
  return words.join(" ");
}

/** Fragment « présence d'une/de N <lésion> » commun à tous les contextes. */
function presenceCount(lesionName: string, n: number): string {
  const count =
    n > 1
      ? `${n} ${pluralizeLesion(lesionName).toLowerCase()}`
      : `${lesionName.toLowerCase()}`;
  const presence = plural(n, "présence d'une", "présence de");
  return `${presence} ${count}`;
}

/** Met en forme la phrase finale : espace unique, majuscule initiale, point final. */
function finalize(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + ".";
}

/** Localisation en toutes lettres à partir d'une zone topographique (8 zones). */
function topoLocation(zone: TopoZone): string {
  return `en secteur ${zone} (${TOPO_ZONE_LABEL[zone]})`;
}

/** Phrase pour une rétinographie (nomenclature topographique 8 zones). */
function sentenceRetino(lesionName: string, items: Annotation[]): string {
  const attrs = items
    .map((a) => a.attrs)
    .filter((x): x is RetinoAttributes => x.context === "retino");
  const n = attrs.length;
  const zone = mostFrequent(attrs.map((a) => a.topoZone)) as TopoZone;
  return finalize(`${presenceCount(lesionName, n)} ${topoLocation(zone)}`);
}

/** Couche dominante d'un lot d'attributs de coupe (ou null si non renseignée). */
function dominantLayer(layers: (string | null)[]): string | null {
  const present = layers.filter((l): l is string => !!l);
  return present.length ? mostFrequent(present) : null;
}

/** Phrase pour une coupe B-scan (support + couche + région transverse). */
function sentenceBscan(lesionName: string, items: Annotation[]): string {
  const attrs = items
    .map((a) => a.attrs)
    .filter((x): x is BscanAttributes => x.context === "bscan");
  const n = attrs.length;
  const zone = mostFrequent(attrs.map((a) => a.transverseZone));
  const layer = dominantLayer(attrs.map((a) => a.layer));
  const layerPart = layer ? `, couche ${layer}` : "";
  return finalize(`${presenceCount(lesionName, n)} sur le B-scan${layerPart}, en région ${zone}`);
}

/** Phrase pour une coupe de cornée / angle (couche cornéenne + région). */
function sentenceCornea(lesionName: string, items: Annotation[]): string {
  const attrs = items
    .map((a) => a.attrs)
    .filter((x): x is CorneaAttributes => x.context === "cornea");
  const n = attrs.length;
  const zone = mostFrequent(attrs.map((a) => a.transverseZone));
  const layer = dominantLayer(attrs.map((a) => a.layer));
  const layerPart = layer ? `, couche ${layer}` : "";
  return finalize(`${presenceCount(lesionName, n)} sur la coupe de cornée${layerPart}, en région ${zone}`);
}

/** Phrase pour une coupe OCT-A / en-face (nomenclature topographique 8 zones). */
function sentenceOcta(lesionName: string, items: Annotation[]): string {
  const attrs = items
    .map((a) => a.attrs)
    .filter((x): x is OctaAttributes => x.context === "octa");
  const n = attrs.length;
  const zone = mostFrequent(attrs.map((a) => a.topoZone)) as TopoZone;
  return finalize(`${presenceCount(lesionName, n)} en OCT-angiographie, ${topoLocation(zone)}`);
}

/** Dispatch de la phrase selon le contexte d'attribution du groupe. */
function sentenceForGroup(lesionName: string, items: Annotation[]): string {
  switch (items[0].attrs.context) {
    case "retino": return sentenceRetino(lesionName, items);
    case "bscan": return sentenceBscan(lesionName, items);
    case "cornea": return sentenceCornea(lesionName, items);
    case "octa": return sentenceOcta(lesionName, items);
  }
}

export function generateReport(
  annotations: Annotation[],
  laterality: Laterality,
): string {
  // Les flèches sont de pures désignations visuelles : exclues du décompte des
  // lésions (elles ne doivent pas gonfler « présence de N … »).
  const validated = annotations.filter(
    (a) =>
      a.status === "validated" &&
      a.laterality === laterality &&
      a.lesionId &&
      a.kind !== "arrow",
  );
  const eye = laterality === "OD" ? "Œil droit (OD)" : "Œil gauche (OG)";
  if (validated.length === 0) {
    return `${eye}\nExamen du fond d'œil sans particularité annotée.`;
  }

  // Regroupement par contexte de coupe puis par lésion : une même lésion sur un
  // B-scan et sur la rétinographie donne deux phrases distinctes et adaptées.
  const byGroup = new Map<string, Annotation[]>();
  for (const a of validated) {
    const key = `${a.attrs.context}::${a.lesionId}`;
    const arr = byGroup.get(key) ?? [];
    arr.push(a);
    byGroup.set(key, arr);
  }

  const lines: string[] = [eye];
  for (const items of byGroup.values()) {
    const lesion = getLesion(items[0].lesionId);
    if (!lesion) continue;
    lines.push("• " + sentenceForGroup(lesion.name, items));
  }
  return lines.join("\n");
}
