import type { Annotation, Laterality } from "../types";
import { getLesion } from "../ontology/lesions";

/** Génère un compte rendu clinique à partir des annotations validées. */

const ZONE_PHRASE: Record<string, string> = {
  Papille: "au niveau de la papille",
  "Zone péripapillaire": "en région péripapillaire",
  Macula: "maculaire(s)",
  Fovéa: "fovéolaire(s)",
  "Rétine temporale": "en rétine temporale",
  "Rétine nasale": "en rétine nasale",
  Périphérie: "en périphérie",
};

const QUADRANT_LABEL: Record<string, string> = {
  TS: "temporal supérieur",
  TI: "temporal inférieur",
  NS: "nasal supérieur",
  NI: "nasal inférieur",
};

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

function sentenceForGroup(lesionName: string, items: Annotation[]): string {
  const n = items.length;
  const zone = mostFrequent(items.map((a) => a.attrs.anatomicalZone));
  const quadrant = mostFrequent(items.map((a) => a.attrs.quadrant));
  const etdrs = items
    .map((a) => a.attrs.etdrsSector)
    .filter((x): x is NonNullable<typeof x> => !!x);

  const count =
    n > 1
      ? `${n} ${pluralizeLesion(lesionName).toLowerCase()}`
      : `${lesionName.toLowerCase()}`;
  const presence = plural(n, "présence d'une", "présence de");

  let loc = ZONE_PHRASE[zone] ?? "";
  if (zone === "Macula" || zone === "Fovéa") {
    loc = zone === "Fovéa" ? "à proximité fovéolaire" : "en région maculaire";
  } else {
    loc = `${ZONE_PHRASE[zone] ?? ""}, quadrant ${QUADRANT_LABEL[quadrant]}`;
  }

  let s = `${presence} ${count} ${loc}`.replace(/\s+/g, " ").trim();
  if (etdrs.length) {
    s += ` (secteur${etdrs.length > 1 ? "s" : ""} ETDRS ${[...new Set(etdrs)].join(", ")})`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function generateReport(
  annotations: Annotation[],
  laterality: Laterality,
): string {
  const validated = annotations.filter(
    (a) => a.status === "validated" && a.laterality === laterality && a.lesionId,
  );
  const eye = laterality === "OD" ? "Œil droit (OD)" : "Œil gauche (OG)";
  if (validated.length === 0) {
    return `${eye}\nExamen du fond d'œil sans particularité annotée.`;
  }

  const byLesion = new Map<string, Annotation[]>();
  for (const a of validated) {
    const arr = byLesion.get(a.lesionId!) ?? [];
    arr.push(a);
    byLesion.set(a.lesionId!, arr);
  }

  const lines: string[] = [eye];
  for (const [lesionId, items] of byLesion) {
    const lesion = getLesion(lesionId);
    if (!lesion) continue;
    lines.push("• " + sentenceForGroup(lesion.name, items));
  }
  return lines.join("\n");
}
