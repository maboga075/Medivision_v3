import * as React from "react";

/**
 * Mise en forme des textes cliniques (analyse clinique, conclusion).
 *
 * Deux règles, conformes aux consignes médicales :
 *  – **gras** : réservé aux noms de MALADIES / SYMPTÔMES. Le modèle IA entoure
 *    ces termes de `**…**` (markdown). Les sigles techniques (RNFL, GCL, OCT,
 *    C/D, PIO…) et structures anatomiques ne sont volontairement PAS mis en
 *    valeur.
 *  – soulignement : « œil droit » / « œil gauche » sont soulignés à chaque
 *    occurrence pour repérer la latéralité d'un coup d'œil.
 */

// « œil droit / gauche », avec ou sans article « à l' », graphie œ ou oe.
const SIDE_RE = /(?:à\s+l['’]\s*)?(?:œil|oeil)\s+(?:droit|gauche)/gi;

/** Souligne les mentions « œil droit / gauche » dans un fragment de texte simple. */
function renderSides(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = new RegExp(SIDE_RE.source, "gi");
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <u key={`${keyBase}-s${i++}`} className="side">
        {m[0]}
      </u>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Convertit le texte en nœuds React : `**maladie**` → <strong class="dx">,
 * « œil droit/gauche » → <u class="side">. Le reste est laissé tel quel.
 */
export function highlightText(text: string): React.ReactNode {
  if (!text) return text;
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...renderSides(text.slice(last, m.index), `p${i}`));
    out.push(
      <strong key={`d${i}`} className="dx">
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(...renderSides(text.slice(last), `p${i}`));
  return <>{out}</>;
}
