
import { useStore } from "@/features/retinasketch/store/useStore";
import type { Laterality } from "@/features/retinasketch/lib/types";
import { createViewport, fieldShape } from "@/features/retinasketch/lib/geometry/template";
import { displayFilterCss, isNeutralTone } from "@/features/retinasketch/lib/image/filters";
import { HiddenImageFilter } from "./RetinaImageFilters";

interface Props {
  width: number;
  height: number;
  /** Œil dont on affiche l'image de fond. */
  eye: Laterality;
  /** Applique le zoom/pan de l'œil (faux en vue double / impression). */
  applyView?: boolean;
}

/**
 * Rétinographie affichée sous le canvas Konva (z-0, pointer-events none) : le
 * dessin et les annotations passent toujours au-dessus, inchangés. La
 * colorimétrie est appliquée via filtres CSS (instantané, sans recache Konva).
 *
 * L'image n'est volontairement pas miroitée par la latéralité : seul le schéma
 * l'est. Le clinicien aligne la photo (échelle / position / rotation) sur les
 * repères du template, donc les annotations restent cohérentes avec ce qui est
 * affiché à l'écran.
 *
 * Tout est rendu DANS un clip circulaire (le champ rétinien à 50°) : rien ne
 * dépasse du cercle et le cadre noir éventuel de la photo est masqué proprement,
 * sans modifier le fichier original.
 */
export default function BackgroundImage({ width, height, eye, applyView = true }: Props) {
  const bg = useStore((s) => s.backgrounds[eye]);
  const storeView = useStore((s) => s.views[eye]);
  // Géométrie du slot actif (cercle/carré/rectangle) → forme du clip de l'image.
  const geometry = useStore((s) => {
    const id = s.activeSlot[eye];
    return s.slots[eye].find((sl) => sl.id === id)?.geometry ?? "circle";
  });
  const view = applyView ? storeView : { scale: 1, x: 0, y: 0 };
  if (!bg.src || !bg.visible) return null;

  // Échelle px/mm (mirror non appliqué à l'image) + forme du champ.
  const vp = createViewport(width, height, 1);
  const { pxPerMm } = vp;
  const f = fieldShape(geometry, vp);
  const isCircle = f.kind === "circle";
  // Boîte du champ (px) : diamètre pour le cercle, largeur/hauteur pour le rect.
  const fieldW = f.kind === "circle" ? 2 * f.r : 2 * f.halfW;
  const fieldH = f.kind === "circle" ? 2 * f.r : 2 * f.halfH;
  const cx = f.cx;
  const cy = f.cy;
  const boxW = fieldW;
  const boxH = fieldH;
  const tx = bg.offsetXMm * pxPerMm;
  const ty = bg.offsetYMm * pxPerMm;

  // Tons & netteté (filtre SVG) : id unique par œil ; null si réglages neutres.
  const tone = {
    sharpness: bg.sharpness,
    highlights: bg.highlights,
    shadows: bg.shadows,
    whites: bg.whites,
    blacks: bg.blacks,
  };
  const filterId = `rsk-ed-adj-${eye}`;
  const svgFilterId = isNeutralTone(tone) ? null : filterId;
  const imgFilter = displayFilterCss(bg.brightness, bg.contrast, bg.saturation, svgFilterId);

  // Transform de l'image, identique pour la photo et le calque vaisseaux.
  const imgTransform = `translate(${tx}px, ${ty}px) scale(${bg.scale}) rotate(${bg.rotationDeg}deg)`;
  // L'image remplit la boîte du cercle en « cover » (recadrée, sans vide) ; le
  // clip circulaire masque ensuite tout débord → aucun bord noir visible.
  const imgBox = {
    width: boxW,
    height: boxH,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "cover",
    objectPosition: "center",
  } as const;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Définition du filtre SVG « tons + netteté » (référencé ci-dessous). */}
      <HiddenImageFilter id={filterId} tone={tone} />
      {/* Transform de vue globale (zoom/pan), identique au Stage Konva. */}
      <div
        className="absolute inset-0"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {/* Clip du champ (centré sur le schéma). En cercle (rétino/OCT-A), un
            masque radial estompe l'anneau extérieur : le liseré noir des
            rétinographies (cadre du capteur) se fond dans le fond du schéma.
            En carré/rectangle (en-face/B-scan), clip rectangulaire net. */}
        <div
          className={`absolute overflow-hidden ${isCircle ? "rounded-full" : "rounded-sm"}`}
          style={{
            left: cx - fieldW / 2,
            top: cy - fieldH / 2,
            width: fieldW,
            height: fieldH,
            ...(isCircle
              ? {
                  WebkitMaskImage:
                    "radial-gradient(circle at center, #000 0%, #000 97%, transparent 100%)",
                  maskImage:
                    "radial-gradient(circle at center, #000 0%, #000 97%, transparent 100%)",
                }
              : {}),
          }}
        >
          {/* Photo (centrée sur le centre du cercle) */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bg.src}
              alt="Rétinographie en arrière-plan"
              draggable={false}
              style={{
                ...imgBox,
                transformOrigin: "center",
                transform: imgTransform,
                opacity: bg.opacity,
                filter: imgFilter,
              }}
            />
          </div>

          {/* Calque vaisseaux détectés (même transform → aligné sur la photo) */}
          {bg.showVessels && bg.vesselsSrc && (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bg.vesselsSrc}
                alt="Vaisseaux détectés"
                draggable={false}
                style={{ ...imgBox, transformOrigin: "center", transform: imgTransform }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
