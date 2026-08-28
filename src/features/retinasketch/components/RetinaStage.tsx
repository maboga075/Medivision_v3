
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Stage, Layer, Group, Circle, Ellipse, Line, Arrow, Text, Rect } from "react-konva";
import type Konva from "konva";
import { useStore, IMG_MIN_SCALE, IMG_MAX_SCALE } from "@/features/retinasketch/store/useStore";
import type { Annotation } from "@/features/retinasketch/lib/types";
import { TEMPLATE, createViewport, toScreen, mirrorFor, isInsideRetina, fieldShape, fieldHalfExtentsMm } from "@/features/retinasketch/lib/geometry/template";
import { imagePxToHomeMm, imagePxLenToMm } from "@/features/retinasketch/lib/geometry/project";
import { arcadePolylines } from "@/features/retinasketch/lib/geometry/engine";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";

const C = {
  contour: "#0f172a",
  subtle: "#cbd5e1",
  disc: "#e2e8f0",
  discStroke: "#94a3b8",
  vessel: "#9aa4b2",
  vesselHi: "#b91c1c",
  overlay: "#94a3b8",
  overlayText: "#64748b",
  draft: "#94a3b8",
  draftFill: "rgba(148,163,184,0.28)",
  preview: "#2563eb",
  select: "#0ea5e9", // halo de la lésion sélectionnée
  discDetected: "#16a34a", // papille détectée (vert)
  cupDetected: "#f59e0b", // excavation (cup) détectée (ambre)
  maculaDetected: "#a855f7", // macula détectée (violet)
};

const DRAG_THRESHOLD_MM = 0.8; // au-delà → surface libre, sinon → spot

/** Taille de la tête de flèche (mm, espace rétinien). */
const ARROW_HEAD_MM = 0.7;

/** Sensibilité du zoom à la molette (plus petit = plus doux). */
const ZOOM_SENSITIVITY = 0.0012;

/**
 * Normalise l'amplitude d'un événement molette selon son `deltaMode`
 * (pixel / ligne / page) puis la borne, afin d'obtenir un zoom proportionnel et
 * doux, cohérent entre souris et trackpad (qui émet beaucoup de petits events).
 */
function normalizeWheel(e: WheelEvent): number {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  return Math.max(-60, Math.min(60, e.deltaY * unit));
}

interface Props {
  width: number;
  height: number;
  /** Force l'œil affiché (vue double) ; sinon latéralité globale du store. */
  eye?: "OD" | "OS";
  /** Rendu statique (vue double / impression) : pas d'interaction ni de zoom. */
  readOnly?: boolean;
  /** Récupère l'instance Stage Konva (capture pour export PDF). */
  stageRef?: React.Ref<Konva.Stage>;
}

export default function RetinaStage({ width, height, eye, readOnly, stageRef }: Props) {
  const storeLaterality = useStore((s) => s.laterality);
  const layers = useStore((s) => s.layers);
  const allAnnotations = useStore((s) => s.annotations);
  const hiddenLesionIds = useStore((s) => s.hiddenLesionIds);
  const spotRadiusMm = useStore((s) => s.spotRadiusMm);
  const drawTool = useStore((s) => s.drawTool);
  const annotationOpacity = useStore((s) => s.annotationOpacity);
  const addSpot = useStore((s) => s.addSpot);
  const addFreeform = useStore((s) => s.addFreeform);
  const addArrow = useStore((s) => s.addArrow);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const adjustSpotRadius = useStore((s) => s.adjustSpotRadius);
  const updateBackground = useStore((s) => s.updateBackground);
  const selectMode = useStore((s) => s.selectMode);
  const selectedAnnotationId = useStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  const setOverlapPick = useStore((s) => s.setOverlapPick);

  const laterality = eye ?? storeLaterality;
  // Type/géométrie du slot actif de cet œil (Lot B) : détermine la forme du
  // champ (cercle/carré/rectangle) et si les repères rétiniens s'appliquent.
  const activeMeta = useStore((s) => {
    const id = s.activeSlot[laterality];
    return s.slots[laterality].find((sl) => sl.id === id) ?? null;
  });
  const geometry = activeMeta?.geometry ?? "circle";
  const isRetino = (activeMeta?.kind ?? "retino") === "retino";
  // Cadre custom (template libre à rognage dynamique) : demi-dimensions du slot.
  const frameW = activeMeta?.frameHalfWMm;
  const frameH = activeMeta?.frameHalfHMm;
  const frameOverride = useMemo(
    () => (geometry === "free" && frameW != null && frameH != null ? { halfW: frameW, halfH: frameH } : null),
    [geometry, frameW, frameH],
  );
  // Image de fond de cet œil : son transform (zoom/pan/rotation) est appliqué
  // AUSSI aux annotations → les lésions suivent l'image quand on la manipule.
  const bg = useStore((s) => s.backgrounds[laterality]);
  // Anatomie spécifique détectée (papille + macula) — suit l'image comme les lésions.
  const anatomy = useStore((s) => s.anatomy[laterality]);
  const anatomyVisible = useStore((s) => s.anatomyVisible);
  // Présence d'une image de fond manipulable (molette = zoom, Shift+glisser = déplacer).
  const hasBg = !readOnly && !!bg.src && bg.visible;
  // On n'affiche que les annotations de l'œil de ce panneau.
  const annotations = allAnnotations.filter((a) => a.laterality === laterality);

  const vp = useMemo(
    () => createViewport(width, height, mirrorFor(laterality)),
    [width, height, laterality],
  );

  // Transform commun image + annotations (autour du centre du cercle), en px écran.
  const imageFrame = {
    x: vp.cx + bg.offsetXMm * vp.pxPerMm,
    y: vp.cy + bg.offsetYMm * vp.pxPerMm,
    offsetX: vp.cx,
    offsetY: vp.cy,
    scaleX: bg.scale,
    scaleY: bg.scale,
    rotation: bg.rotationDeg,
  };

  // Anatomie détectée → mm « domicile » (rendue sous `imageFrame` → suit l'image).
  // Réservée aux slots rétino (papille/macula n'ont pas de sens sur B-scan/en-face).
  const anatomyShapes =
    isRetino && anatomyVisible && anatomy && bg.src
      ? {
          // Papille (indépendante) : présente uniquement si détectée.
          disc: anatomy.disc
            ? {
                ...imagePxToHomeMm(anatomy.disc.cx, anatomy.disc.cy, anatomy.natW, anatomy.natH, vp),
                rx: imagePxLenToMm(anatomy.disc.rx, anatomy.natW, anatomy.natH),
                ry: imagePxLenToMm(anatomy.disc.ry, anatomy.natW, anatomy.natH),
              }
            : null,
          // Contours réels (IA) si présents → affichés à la place de l'ellipse.
          discPolygon: anatomy.disc ? discPolygonToHomeMm(anatomy.disc.polygon, anatomy.natW, anatomy.natH, vp) : null,
          cupPolygon: anatomy.disc ? discPolygonToHomeMm(anatomy.disc.cupPolygon, anatomy.natW, anatomy.natH, vp) : null,
          // Macula (indépendante) : présente uniquement si détectée.
          macula: anatomy.macula
            ? {
                ...imagePxToHomeMm(anatomy.macula.cx, anatomy.macula.cy, anatomy.natW, anatomy.natH, vp),
                r: imagePxLenToMm(anatomy.macula.r, anatomy.natW, anatomy.natH),
              }
            : null,
        }
      : null;

  const groupRef = useRef<Konva.Group>(null);
  const active = useRef(false);
  const moved = useRef(false);
  const buffer = useRef<number[]>([]);
  const lastY = useRef(0);
  // Déplacement de l'IMAGE de fond (Shift+glisser ou bouton du milieu) — pas les annotations.
  const panImg = useRef<{ sx: number; sy: number; ox: number; oy: number; sc: number } | null>(null);

  const [draftLine, setDraftLine] = useState<number[]>([]);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  // Touche Espace = mode ajustement du diamètre du spot (interactif seulement).
  // Ignorée quand on saisit du texte (palette d'identification, champ de nom…),
  // sinon l'espace ne s'insère jamais dans les inputs.
  useEffect(() => {
    if (readOnly) return;
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [readOnly]);

  const modelPos = useCallback(() => {
    return groupRef.current?.getRelativePointerPosition() ?? null;
  }, []);

  const onDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const evt = e.evt as MouseEvent;
      // Clic droit = menu contextuel (ouverture du panneau Image de fond) → ne
      // jamais dessiner ni sélectionner.
      if ("button" in evt && evt.button === 2) return;
      const shift = "shiftKey" in evt && evt.shiftKey;
      const middle = "button" in evt && evt.button === 1;
      // Shift+glisser (ou bouton du milieu) = déplacer l'IMAGE de fond dans le
      // cercle, sans toucher aux annotations déjà posées.
      if ((shift || middle) && hasBg) {
        evt.preventDefault?.();
        const p = e.target.getStage()?.getPointerPosition();
        const bg = useStore.getState().backgrounds[laterality];
        if (p)
          panImg.current = {
            sx: p.x,
            sy: p.y,
            ox: bg.offsetXMm,
            oy: bg.offsetYMm,
            sc: bg.scale || 1,
          };
        return;
      }
      if (spaceHeld) return; // en mode diamètre, pas de dessin
      // Mode sélection : le clic CHOISIT une lésion (sans en créer). Si plusieurs
      // lésions sont superposées sous le clic, on propose la liste à choisir.
      if (selectMode) {
        const p = modelPos();
        if (!p) return;
        const hits = useStore
          .getState()
          .annotations.filter(
            (a) => a.laterality === laterality && annHit(a, p.x, p.y),
          );
        if (hits.length <= 1) {
          selectAnnotation(hits[0]?.id ?? null);
        } else {
          const sp = e.target.getStage()?.getPointerPosition();
          if (sp)
            setOverlapPick({
              eye: laterality,
              x: sp.x,
              y: sp.y,
              ids: hits.map((h) => h.id).reverse(), // dernière dessinée (au-dessus) en premier
            });
        }
        return;
      }
      const p = modelPos();
      if (!p) return;
      active.current = true;
      moved.current = false;
      buffer.current = [p.x, p.y];
      setDraftLine([p.x, p.y]);
    },
    [spaceHeld, modelPos, laterality, hasBg, selectMode, selectAnnotation, setOverlapPick],
  );

  const onMove = useCallback(() => {
    // Déplacement de l'image de fond : delta écran → décalage (mm). Bornage « cover » :
    // l'image ne peut jamais découvrir le cercle (au zoom 1, déplacement nul).
    if (panImg.current) {
      const sp = groupRef.current?.getStage()?.getPointerPosition();
      if (!sp) return;
      const { sx, sy, ox, oy, sc } = panImg.current;
      // Cercle (rétino) : bornage « cover » (l'image ne découvre jamais le champ).
      // Autres templates (B-scan, OCT antérieur, suivi, libre…) : pan LIBRE pour
      // ajuster la zone de travail, même au zoom 1 (Maj + glisser).
      const lim =
        geometry === "circle"
          ? TEMPLATE.retina.halfWidthMm * Math.max(0, sc - 1)
          : TEMPLATE.retina.halfWidthMm * (sc + 1);
      const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
      updateBackground(
        {
          offsetXMm: clamp(ox + (sp.x - sx) / vp.pxPerMm),
          offsetYMm: clamp(oy + (sp.y - sy) / vp.pxPerMm),
        },
        laterality,
      );
      return;
    }
    const p = modelPos();
    if (!p) return;
    if (spaceHeld) {
      // mouvement vertical → ajuste le diamètre
      const dy = p.y - lastY.current;
      adjustSpotRadius(-dy * 0.6);
      lastY.current = p.y;
      setPreview({ x: p.x, y: p.y });
      return;
    }
    lastY.current = p.y;
    if (!active.current) return;
    const last = buffer.current;
    const dx = p.x - last[last.length - 2];
    const dyy = p.y - last[last.length - 1];
    if (Math.hypot(dx, dyy) > 0.05) {
      buffer.current = [...last, p.x, p.y];
      setDraftLine(buffer.current);
    }
    const start = buffer.current;
    if (Math.hypot(p.x - start[0], p.y - start[1]) > DRAG_THRESHOLD_MM)
      moved.current = true;
  }, [spaceHeld, modelPos, adjustSpotRadius, updateBackground, laterality, vp, geometry]);

  const onUp = useCallback(() => {
    if (panImg.current) {
      panImg.current = null;
      return;
    }
    if (!active.current) return;
    // Le dessin est rattaché à l'œil de CE panneau (pas seulement à l'œil actif).
    // On rejette toute lésion dont le centre est hors du contour rétinien.
    const buf = buffer.current;
    // Limite de dessin adaptée à la forme du slot (cercle/carré/rectangle).
    const insideField = (mx: number, my: number, tol = 0.2) => {
      if (geometry === "circle") return isInsideRetina(mx, my, tol);
      const { halfW, halfH } = fieldHalfExtentsMm(geometry, frameOverride);
      return Math.abs(mx) <= halfW + tol && Math.abs(my) <= halfH + tol;
    };
    // Annotation du dessus (de cet œil) sous le clic vérifiant `pred`.
    const findHit = (pred: (a: Annotation) => boolean): Annotation | undefined => {
      const all = useStore.getState().annotations;
      for (let i = all.length - 1; i >= 0; i--) {
        const a = all[i];
        if (a.laterality === laterality && pred(a) && annHit(a, buf[0], buf[1])) return a;
      }
      return undefined;
    };

    if (drawTool === "arrow") {
      if (moved.current && buf.length >= 4) {
        // Glissé = queue → pointe. La POINTE (ce que la flèche désigne) doit être
        // dans le champ ; un clic sans glissé ne crée pas de flèche.
        const x1 = buf[buf.length - 2];
        const y1 = buf[buf.length - 1];
        if (insideField(x1, y1)) addArrow([buf[0], buf[1], x1, y1], laterality);
      } else if (!moved.current) {
        // Clic simple en mode flèche : efface la flèche sous le clic (brouillon OU validée).
        const h = findHit((a) => a.kind === "arrow");
        if (h) deleteAnnotation(h.id);
      }
    } else if (moved.current) {
      // Glissé → surface libre (un glissé ne sert jamais à effacer).
      const c = polygonCentroid(buf);
      if (insideField(c.x, c.y)) addFreeform(buf, laterality);
    } else {
      // Clic simple : une FLÈCHE sous le clic est toujours effaçable (pure
      // désignation) ; sinon un brouillon (spot/surface) sous le clic est effacé ;
      // sinon on crée un spot. Les lésions validées non-flèche restent verrouillées.
      const arrowHit = findHit((a) => a.kind === "arrow");
      if (arrowHit) {
        deleteAnnotation(arrowHit.id);
      } else {
        const draftHit = findHit((a) => a.status === "draft");
        if (draftHit) deleteAnnotation(draftHit.id);
        else if (insideField(buf[0], buf[1])) addSpot(buf[0], buf[1], laterality);
      }
    }
    active.current = false;
    moved.current = false;
    buffer.current = [];
    setDraftLine([]);
  }, [addFreeform, addSpot, addArrow, drawTool, deleteAnnotation, laterality, geometry, frameOverride]);

  // Molette = zoom de l'IMAGE de fond À L'INTÉRIEUR du cercle, centré sur le
  // curseur. Borné à [IMG_MIN_SCALE, IMG_MAX_SCALE] : on ne dézoome jamais
  // au-delà de la vue de départ (rétinographie à 50° remplissant le cercle).
  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      if (!hasBg) return;
      const pointer = groupRef.current?.getStage()?.getPointerPosition();
      if (!pointer) return;
      const bg = useStore.getState().backgrounds[laterality];
      const { pxPerMm, cx, cy } = vp;
      const sOld = bg.scale || 1;
      const sNew = Math.max(
        IMG_MIN_SCALE,
        Math.min(IMG_MAX_SCALE, sOld * Math.exp(-normalizeWheel(e.evt) * ZOOM_SENSITIVITY)),
      );
      const tx = bg.offsetXMm * pxPerMm;
      const ty = bg.offsetYMm * pxPerMm;
      const ratio = sNew / sOld;
      const txNew = pointer.x - cx - ratio * (pointer.x - cx - tx);
      const tyNew = pointer.y - cy - ratio * (pointer.y - cy - ty);
      // Bornage « cover » : recadrer le décalage pour ne jamais découvrir le cercle.
      const lim = TEMPLATE.retina.halfWidthMm * Math.max(0, sNew - 1);
      const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
      updateBackground(
        { scale: sNew, offsetXMm: clamp(txNew / pxPerMm), offsetYMm: clamp(tyNew / pxPerMm) },
        laterality,
      );
    },
    [hasBg, updateBackground, laterality, vp],
  );

  useEffect(() => {
    if (!spaceHeld) setPreview(null);
  }, [spaceHeld]);

  const arcades = useMemo(() => arcadePolylines(), []);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      listening={!readOnly}
      onMouseDown={readOnly ? undefined : onDown}
      onMouseMove={readOnly ? undefined : onMove}
      onMouseUp={readOnly ? undefined : onUp}
      onTouchStart={readOnly ? undefined : onDown}
      onTouchMove={readOnly ? undefined : onMove}
      onTouchEnd={readOnly ? undefined : onUp}
      onWheel={readOnly ? undefined : onWheel}
      style={
        readOnly
          ? undefined
          : { cursor: spaceHeld ? "ns-resize" : selectMode ? "pointer" : "crosshair" }
      }
    >
      <Layer>
        {/* Schéma + couches : FIXES (ne suivent pas l'image), non-interactifs */}
        <Group
          x={vp.cx}
          y={vp.cy}
          scaleX={vp.pxPerMm * vp.mirror}
          scaleY={vp.pxPerMm}
          listening={false}
        >
          {/* Template + couches : non-interactifs, on dessine au travers */}
          <Group listening={false}>
            {/* Contour du champ : cercle (rétino/OCT-A), carré (en-face) ou
                rectangle (B-scan) selon la géométrie du slot actif. */}
            {geometry === "circle" ? (
              <Circle
                x={0}
                y={0}
                radius={TEMPLATE.retina.halfWidthMm}
                stroke={C.contour}
                strokeWidth={1.6}
                strokeScaleEnabled={false}
              />
            ) : (
              (() => {
                const { halfW, halfH } = fieldHalfExtentsMm(geometry, frameOverride);
                return (
                  <Rect
                    x={-halfW}
                    y={-halfH}
                    width={2 * halfW}
                    height={2 * halfH}
                    stroke={C.contour}
                    strokeWidth={1.6}
                    strokeScaleEnabled={false}
                  />
                );
              })()
            )}

            {/* Repères rétiniens (périphérie/fovéa/quadrants/ETDRS/anatomie) :
                réservés aux slots rétino. */}
            {isRetino && layers.periphery && (
              <Circle
                x={0}
                y={0}
                radius={TEMPLATE.posteriorPoleRadiusMm}
                stroke={C.overlay}
                strokeWidth={1}
                dash={[3, 3]}
                strokeScaleEnabled={false}
              />
            )}

            {/* Distance à la fovéa */}
            {isRetino && layers.fovea &&
              [1, 3, 6, 12].map((r) => (
                <Circle
                  key={r}
                  x={0}
                  y={0}
                  radius={r}
                  stroke={C.overlay}
                  strokeWidth={1}
                  dash={[2, 4]}
                  strokeScaleEnabled={false}
                />
              ))}

            {/* Quadrants : croix centrée papille */}
            {isRetino && layers.quadrants && (
              <>
                <Line
                  points={[
                    -TEMPLATE.retina.halfWidthMm,
                    TEMPLATE.disc.y,
                    TEMPLATE.retina.halfWidthMm,
                    TEMPLATE.disc.y,
                  ]}
                  stroke={C.overlay}
                  strokeWidth={1}
                  dash={[5, 4]}
                  strokeScaleEnabled={false}
                />
                <Line
                  points={[
                    TEMPLATE.disc.x,
                    -TEMPLATE.retina.halfHeightMm,
                    TEMPLATE.disc.x,
                    TEMPLATE.retina.halfHeightMm,
                  ]}
                  stroke={C.overlay}
                  strokeWidth={1}
                  dash={[5, 4]}
                  strokeScaleEnabled={false}
                />
              </>
            )}

            {/* Grille ETDRS */}
            {isRetino && layers.etdrs && (
              <>
                {[
                  TEMPLATE.etdrs.inner,
                  TEMPLATE.etdrs.middle,
                  TEMPLATE.etdrs.outer,
                ].map((r) => (
                  <Circle
                    key={r}
                    x={0}
                    y={0}
                    radius={r}
                    stroke={C.overlayText}
                    strokeWidth={1.1}
                    strokeScaleEnabled={false}
                  />
                ))}
                {[45, 135, 225, 315].map((deg) => {
                  const a = (deg * Math.PI) / 180;
                  const r0 = TEMPLATE.etdrs.inner;
                  const r1 = TEMPLATE.etdrs.outer;
                  return (
                    <Line
                      key={deg}
                      points={[
                        Math.cos(a) * r0,
                        Math.sin(a) * r0,
                        Math.cos(a) * r1,
                        Math.sin(a) * r1,
                      ]}
                      stroke={C.overlayText}
                      strokeWidth={1.1}
                      strokeScaleEnabled={false}
                    />
                  );
                })}
              </>
            )}

            {/* Modèle anatomique générique (papille + macula + fovéa) : affiché
                UNIQUEMENT via la couche « Zones anatomiques » (mode démonstration,
                désactivé par défaut). On abandonne progressivement ce repère fixe ;
                la structuration reste calculée sur les constantes du TEMPLATE. */}
            {isRetino && layers.anatomy && (
              <>
                {/* Papille + zone péripapillaire */}
                <Circle
                  x={TEMPLATE.disc.x}
                  y={TEMPLATE.disc.y}
                  radius={TEMPLATE.peripapillaryRadiusMm}
                  stroke={C.subtle}
                  strokeWidth={1}
                  dash={[3, 3]}
                  strokeScaleEnabled={false}
                />
                <Circle
                  x={TEMPLATE.disc.x}
                  y={TEMPLATE.disc.y}
                  radius={TEMPLATE.discRadiusMm}
                  fill={C.disc}
                  stroke={C.discStroke}
                  strokeWidth={1.2}
                  strokeScaleEnabled={false}
                />

                {/* Macula + fovéa */}
                <Circle
                  x={0}
                  y={0}
                  radius={TEMPLATE.maculaRadiusMm}
                  stroke={C.subtle}
                  strokeWidth={1}
                  dash={[3, 3]}
                  strokeScaleEnabled={false}
                />
                <Circle x={0} y={0} radius={0.18} fill={C.contour} />
              </>
            )}

            {/* Nouvelle nomenclature (8 zones) — axes fovéal + papillaire, ligne
                fovéa–papille et cercle maculaire (repères de la nomenclature). */}
            {isRetino && layers.nomenclature && (
              <>
                {/* Axe fovéal (vertical, x=0) */}
                <Line
                  points={[0, -TEMPLATE.retina.halfHeightMm, 0, TEMPLATE.retina.halfHeightMm]}
                  stroke={C.overlayText}
                  strokeWidth={1.1}
                  dash={[5, 4]}
                  strokeScaleEnabled={false}
                />
                {/* Axe papillaire (vertical, x=disc.x) */}
                <Line
                  points={[
                    TEMPLATE.disc.x, -TEMPLATE.retina.halfHeightMm,
                    TEMPLATE.disc.x, TEMPLATE.retina.halfHeightMm,
                  ]}
                  stroke={C.overlayText}
                  strokeWidth={1.1}
                  dash={[5, 4]}
                  strokeScaleEnabled={false}
                />
                {/* Ligne fovéa–papille (séparation supérieur / inférieur) */}
                {(() => {
                  const slope = TEMPLATE.disc.y / TEMPLATE.disc.x;
                  const hw = TEMPLATE.retina.halfWidthMm;
                  return (
                    <Line
                      points={[-hw, slope * -hw, hw, slope * hw]}
                      stroke={C.overlayText}
                      strokeWidth={1.1}
                      dash={[5, 4]}
                      strokeScaleEnabled={false}
                    />
                  );
                })()}
                {/* Cercle maculaire (priorité MS/MI) */}
                <Circle
                  x={0}
                  y={0}
                  radius={TEMPLATE.maculaRadiusMm}
                  stroke={C.overlayText}
                  strokeWidth={1.3}
                  dash={[4, 3]}
                  strokeScaleEnabled={false}
                />
              </>
            )}

            {/* Arcades vasculaires — masquées par défaut, visibles via la couche « Vaisseaux ». */}
            {isRetino && layers.vessels &&
              arcades.map((line, i) => (
                <Line
                  key={i}
                  points={line.flatMap((p) => [p.x, p.y])}
                  stroke={C.vesselHi}
                  strokeWidth={2.2}
                  opacity={0.85}
                  tension={0.5}
                  lineCap="round"
                  strokeScaleEnabled={false}
                />
              ))}
          </Group>
        </Group>

        {/* ——— Annotations : suivent l'image de fond (zoom/pan/rotation) ———
            Non-interactives (listening=false) → elles n'interceptent jamais le
            clic de création ; la sélection se fait par hit-test (mode Sélection). */}
        <Group
          listening={false}
          // Clip circulaire au champ rétinien FIXE (coords écran) : appliqué HORS
          // du transform image (zoom/pan) → aucune lésion ne déborde du cercle, y
          // compris quand on zoome l'image (fix bug « lésion hors zone au zoom »).
          clipFunc={(ctx) => {
            ctx.beginPath();
            const f = fieldShape(geometry, vp, frameOverride);
            if (f.kind === "circle") {
              ctx.arc(f.cx, f.cy, f.r, 0, Math.PI * 2, false);
            } else {
              ctx.rect(f.cx - f.halfW, f.cy - f.halfH, 2 * f.halfW, 2 * f.halfH);
            }
            ctx.closePath();
          }}
        >
        <Group {...imageFrame} listening={false}>
          <Group
            ref={groupRef}
            x={vp.cx}
            y={vp.cy}
            scaleX={vp.pxPerMm * vp.mirror}
            scaleY={vp.pxPerMm}
          >
          {/* Anatomie détectée (proposition) : papille et macula INDÉPENDANTES */}
          {anatomyShapes && (
            <>
              {anatomyShapes.macula && (
                <>
                  <Circle
                    x={anatomyShapes.macula.x}
                    y={anatomyShapes.macula.y}
                    radius={anatomyShapes.macula.r}
                    stroke={C.maculaDetected}
                    strokeWidth={1.4}
                    dash={[4, 3]}
                    strokeScaleEnabled={false}
                  />
                  <Circle
                    x={anatomyShapes.macula.x}
                    y={anatomyShapes.macula.y}
                    radius={0.18}
                    fill={C.maculaDetected}
                  />
                </>
              )}
              {anatomyShapes.discPolygon ? (
                <Line
                  points={anatomyShapes.discPolygon}
                  closed
                  fill={hexToRgba(C.discDetected, 0.12)}
                  stroke={C.discDetected}
                  strokeWidth={1.8}
                  strokeScaleEnabled={false}
                />
              ) : anatomyShapes.disc ? (
                <Ellipse
                  x={anatomyShapes.disc.x}
                  y={anatomyShapes.disc.y}
                  radiusX={anatomyShapes.disc.rx}
                  radiusY={anatomyShapes.disc.ry}
                  fill={hexToRgba(C.discDetected, 0.12)}
                  stroke={C.discDetected}
                  strokeWidth={1.8}
                  strokeScaleEnabled={false}
                />
              ) : null}
              {/* Excavation (cup) détourée par l'IA */}
              {anatomyShapes.cupPolygon && (
                <Line
                  points={anatomyShapes.cupPolygon}
                  closed
                  fill={hexToRgba(C.cupDetected, 0.14)}
                  stroke={C.cupDetected}
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                />
              )}
            </>
          )}
          {annotations.map((a) => {
            const lesion = getLesion(a.lesionId);
            if (lesion && hiddenLesionIds.includes(lesion.id)) return null;
            // Remplissage transparent (la rétinographie reste visible), contour
            // plus visible que le remplissage.
            const stroke = lesion ? lesion.color : C.draft;
            const fill = lesion ? hexToRgba(lesion.color, 0.22) : C.draftFill;
            const selected = a.id === selectedAnnotationId;
            const sw = selected ? 2.6 : 1.6;

            if (a.kind === "point") {
              const r = a.radiusMm ?? 0.5;
              return (
                <Group key={a.id}>
                  {selected && (
                    <Circle
                      x={a.points[0]}
                      y={a.points[1]}
                      radius={r}
                      stroke={C.select}
                      strokeWidth={5}
                      opacity={0.5}
                      strokeScaleEnabled={false}
                    />
                  )}
                  <Circle
                    x={a.points[0]}
                    y={a.points[1]}
                    radius={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                    opacity={annotationOpacity}
                    strokeScaleEnabled={false}
                  />
                </Group>
              );
            }

            if (a.kind === "arrow") {
              // Flèche pleine (pas de remplissage de surface) : la tête et le trait
              // portent la couleur de la lésion. Contour non mis à l'échelle → trait
              // d'épaisseur constante quel que soit le zoom de l'image.
              return (
                <Group key={a.id}>
                  {selected && (
                    <Line
                      points={a.points}
                      stroke={C.select}
                      strokeWidth={6}
                      opacity={0.5}
                      lineCap="round"
                      strokeScaleEnabled={false}
                    />
                  )}
                  <Arrow
                    points={a.points}
                    stroke={stroke}
                    fill={stroke}
                    strokeWidth={selected ? 3 : 2.2}
                    pointerLength={ARROW_HEAD_MM}
                    pointerWidth={ARROW_HEAD_MM}
                    lineCap="round"
                    lineJoin="round"
                    opacity={annotationOpacity}
                    strokeScaleEnabled={false}
                  />
                </Group>
              );
            }

            return (
              <Group key={a.id}>
                {selected && (
                  <Line
                    points={a.points}
                    closed
                    stroke={C.select}
                    strokeWidth={5}
                    opacity={0.5}
                    tension={0.4}
                    strokeScaleEnabled={false}
                  />
                )}
                <Line
                  points={a.points}
                  closed
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  tension={0.4}
                  opacity={annotationOpacity}
                  strokeScaleEnabled={false}
                />
              </Group>
            );
          })}

          {/* Tracé en cours : flèche droite (queue → curseur) en mode flèche,
              sinon aperçu main levée de la surface. */}
          {moved.current && draftLine.length >= 4 && (
            drawTool === "arrow" ? (
              <Arrow
                points={[
                  draftLine[0],
                  draftLine[1],
                  draftLine[draftLine.length - 2],
                  draftLine[draftLine.length - 1],
                ]}
                stroke={C.preview}
                fill={C.preview}
                strokeWidth={2.2}
                pointerLength={ARROW_HEAD_MM}
                pointerWidth={ARROW_HEAD_MM}
                dash={[4, 3]}
                lineCap="round"
                strokeScaleEnabled={false}
              />
            ) : (
              <Line
                points={draftLine}
                stroke={C.draft}
                strokeWidth={1.6}
                tension={0.4}
                dash={[4, 3]}
                strokeScaleEnabled={false}
              />
            )
          )}

          {/* Aperçu du diamètre du spot (touche Espace) */}
          {spaceHeld && preview && (
            <Circle
              x={preview.x}
              y={preview.y}
              radius={spotRadiusMm}
              fill={hexToRgba(C.preview, 0.18)}
              stroke={C.preview}
              strokeWidth={1.4}
              dash={[3, 2]}
              strokeScaleEnabled={false}
            />
          )}
          </Group>
        </Group>
        </Group>
      </Layer>

      {/* ——— Étiquettes (espace écran) ——— */}
      <Layer listening={false}>
        {layers.quadrants &&
          quadrantLabels(vp).map((l) => (
            <Text
              key={l.text}
              x={l.x - 10}
              y={l.y - 7}
              text={l.text}
              fontSize={13}
              fontStyle="600"
              fill={C.overlayText}
            />
          ))}
        {layers.etdrs &&
          etdrsLabels(vp).map((l) => (
            <Text
              key={l.text}
              x={l.x - 7}
              y={l.y - 6}
              text={l.text}
              fontSize={10}
              fontStyle="600"
              fill={C.overlayText}
            />
          ))}
        {isRetino && layers.nomenclature &&
          nomenclatureLabels(vp).map((l) => (
            <Text
              key={l.text}
              x={l.x - 12}
              y={l.y - 7}
              text={l.text}
              fontSize={13}
              fontStyle="700"
              fill={C.overlayText}
            />
          ))}
        {/* La couche « zones anatomiques » n'affiche plus les libellés Papille,
            Macula, Rétine temporale/nasale (demande praticien) : seuls les repères
            graphiques (papille + macula) restent visibles. */}
      </Layer>
    </Stage>
  );
}

/* ——— Étiquettes calculées en coordonnées écran ——— */
type Vp = ReturnType<typeof createViewport>;

/** Contour papille (px image) → points mm « domicile » pour Konva, ou null. */
function discPolygonToHomeMm(
  poly: number[] | undefined,
  natW: number,
  natH: number,
  vp: Vp,
): number[] | null {
  if (!poly || poly.length < 6) return null;
  const out: number[] = [];
  for (let i = 0; i < poly.length; i += 2) {
    const p = imagePxToHomeMm(poly[i], poly[i + 1], natW, natH, vp);
    out.push(p.x, p.y);
  }
  return out;
}

function quadrantLabels(vp: Vp) {
  const d = TEMPLATE.disc;
  return [
    { text: "TS", ...toScreen(d.x + 5, d.y - 6, vp) },
    { text: "TI", ...toScreen(d.x + 5, d.y + 6, vp) },
    { text: "NS", ...toScreen(d.x - 3, d.y - 6, vp) },
    { text: "NI", ...toScreen(d.x - 3, d.y + 6, vp) },
  ];
}

/** Libellés des 8 zones topographiques (mm modèle → écran, mirror géré par `vp`). */
function nomenclatureLabels(vp: Vp) {
  return [
    { text: "MS", ...toScreen(0, -1.3, vp) },
    { text: "MI", ...toScreen(0, 1.3, vp) },
    { text: "TS-M", ...toScreen(4.3, -4, vp) },
    { text: "TI-M", ...toScreen(4.3, 4, vp) },
    { text: "NS-M", ...toScreen(-2.4, -4, vp) },
    { text: "NI-M", ...toScreen(-2.4, 4, vp) },
    { text: "NS-P", ...toScreen(-6.3, -4, vp) },
    { text: "NI-P", ...toScreen(-6.3, 4, vp) },
  ];
}

function etdrsLabels(vp: Vp) {
  const ri = (TEMPLATE.etdrs.inner + TEMPLATE.etdrs.middle) / 2;
  const ro = (TEMPLATE.etdrs.middle + TEMPLATE.etdrs.outer) / 2;
  const diag = Math.SQRT1_2;
  return [
    { text: "C", ...toScreen(0, 0, vp) },
    { text: "TI", ...toScreen(ri, 0, vp) },
    { text: "NI", ...toScreen(-ri, 0, vp) },
    { text: "SI", ...toScreen(0, -ri, vp) },
    { text: "II", ...toScreen(0, ri, vp) },
    { text: "TE", ...toScreen(ro * diag, -ro * diag, vp) },
    { text: "NE", ...toScreen(-ro * diag, -ro * diag, vp) },
    { text: "IE", ...toScreen(ro * diag, ro * diag, vp) },
    { text: "SE", ...toScreen(0, -ro, vp) },
  ];
}

/** Hit-test générique d'une annotation (mm), selon son type. */
function annHit(
  a: { kind: string; points: number[]; radiusMm: number | null },
  mx: number,
  my: number,
) {
  if (a.kind === "point") return spotHit(a, mx, my);
  if (a.kind === "arrow") return arrowHit(a.points, mx, my);
  return polyHit(a.points, mx, my);
}

/** Hit-test d'une flèche (mm) : distance point↔segment sous une tolérance de visée. */
function arrowHit(pts: number[], mx: number, my: number) {
  if (pts.length < 4) return false;
  const [x0, y0, x1, y1] = pts;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((mx - x0) * dx + (my - y0) * dy) / len2)) : 0;
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  const TOL = 0.35; // mm
  return (mx - px) ** 2 + (my - py) ** 2 <= TOL * TOL;
}

/** Hit-test d'un spot (mm) : le point est-il dans le disque de la lésion ? */
function spotHit(a: { points: number[]; radiusMm: number | null }, mx: number, my: number) {
  const r = (a.radiusMm ?? 0.5) + 0.15; // légère tolérance de visée
  const dx = mx - a.points[0];
  const dy = my - a.points[1];
  return dx * dx + dy * dy <= r * r;
}

/** Hit-test d'un polygone (mm) : point-dans-polygone (lancer de rayon). */
function polyHit(pts: number[], mx: number, my: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    const intersect =
      yi > my !== yj > my && mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Centroïde approché (moyenne des sommets) d'un polygone [x,y,...]. */
function polygonCentroid(pts: number[]) {
  let sx = 0;
  let sy = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) {
    sx += pts[i];
    sy += pts[i + 1];
  }
  return { x: sx / n, y: sy / n };
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
