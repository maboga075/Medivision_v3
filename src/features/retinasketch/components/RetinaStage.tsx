
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Stage, Layer, Group, Circle, Ellipse, Line, Text } from "react-konva";
import type Konva from "konva";
import { useStore } from "../store/useStore";
import { TEMPLATE, createViewport, toScreen } from "../lib/geometry/template";
import { arcadePolylines } from "../lib/geometry/engine";
import { getLesion } from "../lib/ontology/lesions";

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
};

const DRAG_THRESHOLD_MM = 0.8; // au-delà → surface libre, sinon → spot

interface Props {
  width: number;
  height: number;
}

export default function RetinaStage({ width, height }: Props) {
  const laterality = useStore((s) => s.laterality);
  const layers = useStore((s) => s.layers);
  const annotations = useStore((s) => s.annotations);
  const hiddenLesionIds = useStore((s) => s.hiddenLesionIds);
  const spotRadiusMm = useStore((s) => s.spotRadiusMm);
  const addSpot = useStore((s) => s.addSpot);
  const addFreeform = useStore((s) => s.addFreeform);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const adjustSpotRadius = useStore((s) => s.adjustSpotRadius);

  const vp = useMemo(
    () => createViewport(width, height, laterality === "OD" ? 1 : -1),
    [width, height, laterality],
  );

  const groupRef = useRef<Konva.Group>(null);
  const active = useRef(false);
  const moved = useRef(false);
  const buffer = useRef<number[]>([]);
  const lastY = useRef(0);

  const [draftLine, setDraftLine] = useState<number[]>([]);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  // Touche Espace = mode ajustement du diamètre du spot.
  // Ne pas intercepter si l'utilisateur tape dans un champ texte (création de lésion, etc.)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const typing =
          e.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
        if (typing) return;
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
  }, []);

  const modelPos = useCallback(() => {
    return groupRef.current?.getRelativePointerPosition() ?? null;
  }, []);

  const onDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (spaceHeld) return; // en mode diamètre, pas de dessin
      if (e.target !== e.target.getStage()) return; // un objet gère le clic
      const p = modelPos();
      if (!p) return;
      // Bloquer les clics hors de l'ellipse rétinienne
      const rx = TEMPLATE.retina.halfWidthMm;
      const ry = TEMPLATE.retina.halfHeightMm;
      if ((p.x * p.x) / (rx * rx) + (p.y * p.y) / (ry * ry) > 1) return;
      active.current = true;
      moved.current = false;
      buffer.current = [p.x, p.y];
      setDraftLine([p.x, p.y]);
    },
    [spaceHeld, modelPos],
  );

  const onMove = useCallback(() => {
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
  }, [spaceHeld, modelPos, adjustSpotRadius]);

  const onUp = useCallback(() => {
    if (!active.current) return;
    if (moved.current) addFreeform(buffer.current);
    else addSpot(buffer.current[0], buffer.current[1]);
    active.current = false;
    moved.current = false;
    buffer.current = [];
    setDraftLine([]);
  }, [addFreeform, addSpot]);

  useEffect(() => {
    if (!spaceHeld) setPreview(null);
  }, [spaceHeld]);

  const arcades = useMemo(() => arcadePolylines(), []);

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      style={{ cursor: spaceHeld ? "ns-resize" : "crosshair" }}
    >
      <Layer>
        <Group
          ref={groupRef}
          x={vp.cx}
          y={vp.cy}
          scaleX={vp.pxPerMm * vp.mirror}
          scaleY={vp.pxPerMm}
        >
          {/* Template + couches : non-interactifs, on dessine au travers */}
          <Group listening={false}>
            {/* Contour rétinien (toujours visible) */}
            <Ellipse
              x={0}
              y={0}
              radiusX={TEMPLATE.retina.halfWidthMm}
              radiusY={TEMPLATE.retina.halfHeightMm}
              stroke={C.contour}
              strokeWidth={1.6}
              strokeScaleEnabled={false}
            />

            {/* Périphérie */}
            {layers.periphery && (
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
            {layers.fovea &&
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
            {layers.quadrants && (
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
            {layers.etdrs && (
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

            {/* Papille + zone péripapillaire (base) */}
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

            {/* Macula + fovéa (base) */}
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

            {/* Arcades vasculaires */}
            {arcades.map((line, i) => (
              <Line
                key={i}
                points={line.flatMap((p) => [p.x, p.y])}
                stroke={layers.vessels ? C.vesselHi : C.vessel}
                strokeWidth={layers.vessels ? 2.2 : 1.4}
                opacity={layers.vessels ? 0.85 : 0.6}
                tension={0.5}
                lineCap="round"
                strokeScaleEnabled={false}
              />
            ))}
          </Group>

          {/* ——— Annotations ——— */}
          {annotations.map((a) => {
            const lesion = getLesion(a.lesionId);
            if (lesion && hiddenLesionIds.includes(lesion.id)) return null;
            const locked = a.status === "validated";
            const stroke = lesion ? lesion.color : C.draft;
            const onClick = (
              e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
            ) => {
              e.cancelBubble = true;
              if (!locked) deleteAnnotation(a.id); // re-clic = effacer (brouillon)
            };

            if (a.kind === "point") {
              return (
                <Circle
                  key={a.id}
                  x={a.points[0]}
                  y={a.points[1]}
                  radius={a.radiusMm ?? 0.5}
                  fill={lesion ? lesion.color : C.draftFill}
                  stroke={stroke}
                  strokeWidth={1.4}
                  strokeScaleEnabled={false}
                  onClick={onClick}
                  onTap={onClick}
                />
              );
            }
            return (
              <Line
                key={a.id}
                points={a.points}
                closed
                fill={lesion ? hexToRgba(lesion.color, 0.25) : C.draftFill}
                stroke={stroke}
                strokeWidth={1.6}
                tension={0.4}
                strokeScaleEnabled={false}
                onClick={onClick}
                onTap={onClick}
              />
            );
          })}

          {/* Tracé main levée en cours */}
          {moved.current && draftLine.length >= 4 && (
            <Line
              points={draftLine}
              stroke={C.draft}
              strokeWidth={1.6}
              tension={0.4}
              dash={[4, 3]}
              strokeScaleEnabled={false}
            />
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
        {layers.anatomy &&
          anatomyLabels(vp).map((l) => (
            <Text
              key={l.text}
              x={l.x}
              y={l.y}
              text={l.text}
              fontSize={11}
              fill={C.overlayText}
            />
          ))}
      </Layer>
    </Stage>
  );
}

/* ——— Étiquettes calculées en coordonnées écran ——— */
type Vp = ReturnType<typeof createViewport>;

function quadrantLabels(vp: Vp) {
  const d = TEMPLATE.disc;
  return [
    { text: "TS", ...toScreen(d.x + 5, d.y - 6, vp) },
    { text: "TI", ...toScreen(d.x + 5, d.y + 6, vp) },
    { text: "NS", ...toScreen(d.x - 3, d.y - 6, vp) },
    { text: "NI", ...toScreen(d.x - 3, d.y + 6, vp) },
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

function anatomyLabels(vp: Vp) {
  const d = TEMPLATE.disc;
  return [
    { text: "Papille", ...toScreen(d.x - 1.2, d.y + 2.2, vp) },
    { text: "Macula", ...toScreen(0.6, TEMPLATE.maculaRadiusMm + 0.4, vp) },
    { text: "Rétine temporale", ...toScreen(9, 0, vp) },
    { text: "Rétine nasale", ...toScreen(-13.5, 0, vp) },
  ];
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
