import {
  type ToneParams,
  isNeutralTone,
  toneTableValues,
  sharpenK,
  sharpenKernel,
} from "@/features/retinasketch/lib/image/filters";

/**
 * Définition SVG du filtre « tons + netteté » d'une image de rétinographie, à
 * placer DANS un `<defs>`. Combine une courbe tonale (feComponentTransfer) et une
 * accentuation (feConvolveMatrix). Rend `null` si les réglages sont neutres :
 * l'appelant ne doit alors PAS référencer le filtre (un filtre vide masquerait
 * l'image).
 */
export function ImageFilterDef({ id, tone }: { id: string; tone: ToneParams }) {
  if (isNeutralTone(tone)) return null;
  const table = toneTableValues(tone);
  const k = sharpenK(tone.sharpness);
  return (
    <filter id={id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
      {table && (
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table} />
          <feFuncG type="table" tableValues={table} />
          <feFuncB type="table" tableValues={table} />
        </feComponentTransfer>
      )}
      {k > 0 && (
        <feConvolveMatrix
          order="3"
          kernelMatrix={sharpenKernel(tone.sharpness).join(" ")}
          divisor={1}
          preserveAlpha
          edgeMode="duplicate"
        />
      )}
    </filter>
  );
}

/**
 * Enveloppe HTML : un `<svg>` invisible portant uniquement le `<defs>` du filtre,
 * pour référencer `filter: url(#id)` depuis un `<img>` (éditeur). Rend `null` si
 * neutre. `id` doit être unique dans le document.
 */
export function HiddenImageFilter({ id, tone }: { id: string; tone: ToneParams }) {
  if (isNeutralTone(tone)) return null;
  return (
    <svg
      aria-hidden
      focusable={false}
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        <ImageFilterDef id={id} tone={tone} />
      </defs>
    </svg>
  );
}
