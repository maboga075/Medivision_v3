
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/features/retinasketch/store/useStore";
import { solveAlignment } from "@/features/retinasketch/lib/geometry/align";
import { mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { detectLandmarks } from "@/features/retinasketch/lib/vision/detect";
import { computeAutoFrame } from "@/features/retinasketch/lib/geometry/autoframe";
import { detectVessels } from "@/features/retinasketch/lib/vision/vessels";
import { trimBlackBackground } from "@/features/retinasketch/lib/vision/trimBlack";
import { detectAnatomy } from "@/features/retinasketch/lib/vision/anatomy";
import { detectDiscCup } from "@/features/retinasketch/lib/ai/discCup";
import type { Laterality } from "@/features/retinasketch/lib/types";

/**
 * Bouton d'en-tête « Image de fond » : importe une rétinographie et ouvre en
 * déroulant ses réglages (colorimétrie, alignement, échelle, vaisseaux, fond
 * noir, pré-annotation IA). Rendu dans la barre du haut (`Workspace`).
 */
export default function BackgroundControls() {
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const setBackgroundImage = useStore((s) => s.setBackgroundImage);
  const updateBackground = useStore((s) => s.updateBackground);
  const toggleVisibility = useStore((s) => s.toggleBackgroundVisibility);
  const resetAdjustments = useStore((s) => s.resetBackgroundAdjustments);
  const removeBackground = useStore((s) => s.removeBackground);
  const setPointing = useStore((s) => s.setPointing);
  const setAdjustImage = useStore((s) => s.setAdjustImage);
  const setSamMode = useStore((s) => s.setSamMode);
  const setLaterality = useStore((s) => s.setLaterality);
  const setLayout = useStore((s) => s.setLayout);
  // Type du slot actif : les détections rétino (repères / vaisseaux / anatomie)
  // n'ont de sens que sur une rétinographie → masquées sur les autres coupes.
  const isRetinoSlot = useStore((s) => {
    const id = s.activeSlot[s.laterality];
    return (s.slots[s.laterality].find((sl) => sl.id === id)?.kind ?? "retino") === "retino";
  });
  const anatomy = useStore((s) => s.anatomy[s.laterality]);
  const anatomyVisible = useStore((s) => s.anatomyVisible);
  const setAnatomy = useStore((s) => s.setAnatomy);
  const clearAnatomy = useStore((s) => s.clearAnatomy);
  const setAnatomyVisible = useStore((s) => s.setAnatomyVisible);
  const setAnatomyEdit = useStore((s) => s.setAnatomyEdit);

  const [open, setOpen] = useState(false);
  const [autoFailed, setAutoFailed] = useState(false);
  const [vesselBusy, setVesselBusy] = useState(false);
  const [trimBusy, setTrimBusy] = useState(false);
  const [anatomyBusy, setAnatomyBusy] = useState(false);
  const [anatomyMsg, setAnatomyMsg] = useState("");
  // Position flottante (clic droit) : si non nul, le panneau s'ouvre au curseur
  // (position fixe) au lieu d'être ancré sous le bouton d'en-tête.
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // Clic hors panneau ET hors bouton d'en-tête → ferme (le panneau flottant
      // n'est pas dans `wrapRef`, on le teste donc séparément).
      const t = e.target as Node;
      if (
        open &&
        !(wrapRef.current && wrapRef.current.contains(t)) &&
        !(panelRef.current && panelRef.current.contains(t))
      ) {
        setOpen(false);
        setFloatPos(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Ouverture du panneau au clic droit sur le canvas (cf. `EyePane.onContextMenu`) :
  // on cible l'œil cliqué et on positionne le panneau au curseur.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; eye?: Laterality }>).detail;
      if (d?.eye) setLaterality(d.eye);
      setFloatPos(d && typeof d.x === "number" ? { x: d.x, y: d.y } : null);
      setOpen(true);
    };
    window.addEventListener("retina:open-bg-panel", onOpen);
    return () => window.removeEventListener("retina:open-bg-panel", onOpen);
  }, [setLaterality]);

  // Retire (ou rétablit) le fond noir de l'image de l'œil actif. Le détourage
  // rend transparent l'anneau noir du champ → pas d'aplat noir à l'impression.
  const toggleBlackBackground = () => {
    if (bg.blackRemoved) {
      if (bg.srcOriginal)
        updateBackground({ src: bg.srcOriginal, srcOriginal: null, blackRemoved: false });
      return;
    }
    if (!bg.src) return;
    setTrimBusy(true);
    const original = bg.src;
    const img = new Image();
    img.onload = () => {
      const out = trimBlackBackground(img);
      if (out) updateBackground({ srcOriginal: original, src: out, blackRemoved: true });
      setTrimBusy(false);
    };
    img.onerror = () => setTrimBusy(false);
    img.src = original;
  };

  // Calage automatique heuristique (opt-in) : détecte papille + fovéa puis aligne.
  const runAutoAlign = (src: string) => {
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const mirror = mirrorFor(useStore.getState().laterality);
      const marks = detectLandmarks(img);
      if (marks) {
        // Calage auto : rotation bornée (±12°) pour éviter les rotations aberrantes.
        updateBackground({
          natW,
          natH,
          ...solveAlignment(marks, natW, natH, mirror, { maxRotationDeg: 12 }),
        });
        setAutoFailed(false);
      } else {
        updateBackground({ natW, natH });
        setAutoFailed(true);
      }
    };
    img.src = src;
  };

  // Détection heuristique des vaisseaux → calque coloré superposé.
  const runDetectVessels = () => {
    if (!bg.src) return;
    setVesselBusy(true);
    const img = new Image();
    img.onload = () => {
      const src = detectVessels(img);
      updateBackground({ vesselsSrc: src, showVessels: !!src });
      setVesselBusy(false);
    };
    img.onerror = () => setVesselBusy(false);
    img.src = bg.src;
  };

  // Détection de la PAPILLE seule (indépendante de la macula).
  // 1) Heuristique instantanée (ellipse ajustée à l'intensité). 2) Segmentation IA
  // spécialisée disque + cup (W-Net ONNX) → vrai contour. Repli sur l'ellipse si le
  // modèle est absent/échoue. La macula existante est CONSERVÉE.
  const runDetectDisc = () => {
    if (!bg.src) return;
    const eye = useStore.getState().laterality;
    const src = bg.src;
    setAnatomyBusy(true);
    setAnatomyMsg("");
    const img = new Image();
    img.onload = async () => {
      const a = detectAnatomy(img, eye);
      if (!a) {
        setAnatomyBusy(false);
        setAnatomyMsg("Papille introuvable sur cette image.");
        return;
      }
      const cur = useStore.getState().anatomy[eye];
      // Pose UNIQUEMENT la papille ; conserve la macula existante (sinon aucune).
      setAnatomy(eye, {
        disc: a.disc,
        macula: cur?.macula,
        natW: a.natW,
        natH: a.natH,
        source: "heuristic",
        updatedAt: new Date().toISOString(),
      });
      setAnatomyMsg("Détection du contour de la papille (IA)…");
      try {
        const dc = await detectDiscCup(src);
        const cur2 = useStore.getState().anatomy[eye];
        if (dc && cur2) {
          setAnatomy(eye, {
            ...cur2,
            disc: {
              cx: dc.cx,
              cy: dc.cy,
              rx: dc.rx,
              ry: dc.ry,
              polygon: dc.discPolygon,
              cupPolygon: dc.cupPolygon ?? undefined,
            },
            source: "ai",
            updatedAt: new Date().toISOString(),
          });
          setAnatomyMsg(dc.cupPolygon ? "Papille + excavation détourées (IA)." : "Papille détourée (IA).");
        } else {
          setAnatomyMsg("Contour IA indisponible — ellipse conservée (ajustez).");
        }
      } catch (e) {
        console.error("[disc/cup]", e);
        setAnatomyMsg("Modèle IA absent — ellipse conservée (ajustez).");
      }
      setAnatomyBusy(false);
    };
    img.onerror = () => {
      setAnatomyBusy(false);
      setAnatomyMsg("Image illisible.");
    };
    img.src = src;
  };

  // Détection de la MACULA seule (indépendante de la papille). Heuristique
  // (position dérivée des repères + zone sombre). La papille existante est CONSERVÉE.
  const runDetectMacula = () => {
    if (!bg.src) return;
    const eye = useStore.getState().laterality;
    setAnatomyBusy(true);
    setAnatomyMsg("");
    const img = new Image();
    img.onload = () => {
      const a = detectAnatomy(img, eye);
      if (!a) {
        setAnatomyBusy(false);
        setAnatomyMsg("Macula introuvable sur cette image.");
        return;
      }
      const cur = useStore.getState().anatomy[eye];
      // Pose UNIQUEMENT la macula ; conserve la papille existante (sinon aucune).
      setAnatomy(eye, {
        disc: cur?.disc,
        macula: a.macula,
        natW: a.natW,
        natH: a.natH,
        source: cur?.source ?? "heuristic",
        updatedAt: new Date().toISOString(),
      });
      setAnatomyMsg("Macula détectée.");
      setAnatomyBusy(false);
    };
    img.onerror = () => {
      setAnatomyBusy(false);
      setAnatomyMsg("Image illisible.");
    };
    img.src = bg.src;
  };

  // À l'import : on détecte d'abord la latéralité (papille à droite de la fovéa
  // → OD, sinon OG), on range l'image dans le bon œil et on l'active. L'image est
  // posée DROITE (pas de rotation auto — c'était la source des « rotations
  // anormales »). Le calage fin reste à la main du clinicien (boutons ci-dessous).
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setOpen(true);
      const img = new Image();
      img.onload = () => {
        const marks = detectLandmarks(img);
        const eye = marks
          ? marks.discPx.x >= marks.foveaPx.x
            ? "OD"
            : "OS"
          : useStore.getState().laterality;
        setLaterality(eye);
        setBackgroundImage(url, file.name, eye);
        // Recadrage automatique : centre le disque rétinien et le fait remplir
        // le champ circulaire → supprime le liseré noir du cadre du capteur.
        const frame = computeAutoFrame(img);
        updateBackground(
          {
            natW: img.naturalWidth,
            natH: img.naturalHeight,
            ...(frame ?? {}),
          },
          eye,
        );
      };
      img.onerror = () => {
        const eye = useStore.getState().laterality;
        setBackgroundImage(url, file.name, eye);
      };
      img.src = url;
    }
    e.target.value = ""; // permet de re-sélectionner le même fichier
  };

  const hasImage = !!bg.src;

  const onButtonClick = () => {
    setFloatPos(null); // ouverture par le bouton = ancrage sous l'en-tête
    if (hasImage) setOpen((o) => !o);
    else inputRef.current?.click();
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />

      {/* Bouton d'en-tête : importe (si vide) ou ouvre les réglages (si image). */}
      <button
        onClick={onButtonClick}
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition ${
          open ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <ImageIcon />
        Image de fond
        {hasImage && (
          <span
            className={`rounded-full px-1.5 text-[10px] font-semibold ${
              bg.visible
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {bg.visible ? "ON" : "OFF"}
          </span>
        )}
      </button>

      <AnimatePresence>
        {hasImage && open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={
              floatPos
                ? {
                    position: "fixed",
                    left: Math.min(floatPos.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 296),
                    top: Math.min(floatPos.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 80),
                  }
                : undefined
            }
            className={`z-50 max-h-[80vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur ${
              floatPos ? "" : "absolute left-0 top-full mt-1.5"
            }`}
          >
            {/* En-tête : œil ciblé + nom + visibilité */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {laterality === "OD" ? "OD" : "OG"}
              </span>
              <span
                className="flex-1 truncate text-xs font-medium text-slate-500"
                title={bg.fileName ?? undefined}
              >
                {bg.fileName}
              </span>
              <button
                onClick={() => toggleVisibility()}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title={bg.visible ? "Masquer" : "Afficher"}
              >
                {bg.visible ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>

            {/* Colorimétrie */}
            <SectionLabel>Colorimétrie</SectionLabel>
            <Slider
              label="Opacité"
              value={bg.opacity}
              min={0}
              max={1}
              step={0.01}
              display={`${Math.round(bg.opacity * 100)}%`}
              onChange={(v) => updateBackground({ opacity: v })}
            />
            <Slider
              label="Luminosité"
              value={bg.brightness}
              min={0}
              max={200}
              step={1}
              display={`${bg.brightness}%`}
              onChange={(v) => updateBackground({ brightness: v })}
            />
            <Slider
              label="Contraste"
              value={bg.contrast}
              min={0}
              max={200}
              step={1}
              display={`${bg.contrast}%`}
              onChange={(v) => updateBackground({ contrast: v })}
            />
            <Slider
              label="Saturation"
              value={bg.saturation}
              min={0}
              max={200}
              step={1}
              display={`${bg.saturation}%`}
              onChange={(v) => updateBackground({ saturation: v })}
            />

            {/* Tons & netteté (retouche rapide type app Photos) */}
            <SectionLabel>Tons &amp; netteté</SectionLabel>
            <Slider
              label="Netteté"
              value={bg.sharpness}
              min={0}
              max={100}
              step={1}
              display={`${bg.sharpness}`}
              onChange={(v) => updateBackground({ sharpness: v })}
            />
            <Slider
              label="Hautes lumières"
              value={bg.highlights}
              min={-100}
              max={100}
              step={1}
              display={signed(bg.highlights)}
              onChange={(v) => updateBackground({ highlights: v })}
            />
            <Slider
              label="Ombres"
              value={bg.shadows}
              min={-100}
              max={100}
              step={1}
              display={signed(bg.shadows)}
              onChange={(v) => updateBackground({ shadows: v })}
            />
            <Slider
              label="Point blanc"
              value={bg.whites}
              min={-100}
              max={100}
              step={1}
              display={signed(bg.whites)}
              onChange={(v) => updateBackground({ whites: v })}
            />
            <Slider
              label="Point noir"
              value={bg.blacks}
              min={-100}
              max={100}
              step={1}
              display={signed(bg.blacks)}
              onChange={(v) => updateBackground({ blacks: v })}
            />

            {/* Alignement — repères fovéa/papille : rétinographie uniquement. */}
            {isRetinoSlot && (
              <>
                <SectionLabel>Alignement</SectionLabel>
                <div className="mb-1.5 flex gap-2">
                  <button
                    onClick={() => bg.src && runAutoAlign(bg.src)}
                    className="flex-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Aligner auto
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setLayout("mono"); // outils de précision = 1 œil plein cadre
                      setPointing(true);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Pointer repères
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setLayout("mono"); // outils de précision = 1 œil plein cadre
                setAdjustImage(true);
              }}
              className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <HandIcon />
              Ajuster à la souris
            </button>
            <p className="mb-1 text-[11px] leading-snug text-slate-400">
              Glisser = déplacer · molette = zoom · Maj+glisser = rotation.
            </p>
            {autoFailed && (
              <p className="mb-1 text-[11px] leading-snug text-amber-600">
                Détection auto incertaine — utilisez « Pointer repères » ou
                « Ajuster à la souris ».
              </p>
            )}
            <Slider
              label="Échelle (zoom)"
              value={bg.scale}
              min={0.2}
              max={5}
              step={0.01}
              display={`${Math.round(bg.scale * 100)}%`}
              onChange={(v) => updateBackground({ scale: v })}
            />
            <Slider
              label="Rotation (fin)"
              value={bg.rotationDeg}
              min={-180}
              max={180}
              step={1}
              display={`${Math.round(bg.rotationDeg)}°`}
              onChange={(v) => updateBackground({ rotationDeg: v })}
            />

            {/* Fond / impression */}
            <SectionLabel>Fond (impression)</SectionLabel>
            <button
              onClick={toggleBlackBackground}
              disabled={trimBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ScissorsIcon />
              {trimBusy
                ? "Détourage…"
                : bg.blackRemoved
                  ? "Rétablir le fond noir"
                  : "Retirer le fond noir"}
            </button>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Rend transparent l’anneau noir du champ → pas d’aplat noir à l’impression.
            </p>

            {/* Vaisseaux + Anatomie — rétinographie uniquement (sans objet sur
                B-scan / OCT-A / OCT antérieur / suivi / image libre). */}
            {isRetinoSlot && (
              <>
                {/* Vaisseaux */}
                <SectionLabel>Vaisseaux</SectionLabel>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runDetectVessels}
                    disabled={vesselBusy}
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {vesselBusy
                      ? "Analyse…"
                      : bg.vesselsSrc
                        ? "Re-détecter les vaisseaux"
                        : "Détecter les vaisseaux"}
                  </button>
                  {bg.vesselsSrc && (
                    <button
                      onClick={() => updateBackground({ showVessels: !bg.showVessels })}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      title={bg.showVessels ? "Masquer les vaisseaux" : "Afficher les vaisseaux"}
                    >
                      {bg.showVessels ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  )}
                </div>

                {/* Anatomie : papille et macula détectées SÉPARÉMENT */}
                <SectionLabel>Anatomie (papille / macula)</SectionLabel>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runDetectDisc}
                    disabled={anatomyBusy}
                    className="flex-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {anatomyBusy ? "Analyse…" : "Détecter la papille"}
                  </button>
                  <button
                    onClick={runDetectMacula}
                    disabled={anatomyBusy}
                    className="flex-1 rounded-lg border border-violet-300 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    {anatomyBusy ? "Analyse…" : "Détecter la macula"}
                  </button>
                  {anatomy && (
                    <button
                      onClick={() => setAnatomyVisible(!anatomyVisible)}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      title={anatomyVisible ? "Masquer l'anatomie" : "Afficher l'anatomie"}
                    >
                      {anatomyVisible ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  )}
                </div>
                {anatomy && (
                  <div className="mt-1.5 flex gap-2">
                    <button
                      onClick={() => {
                        setOpen(false);
                        setLayout("mono"); // outils de précision = 1 œil plein cadre
                        setAnatomyVisible(true);
                        setAnatomyEdit(true);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Ajuster (forme / déplacer / taille)
                    </button>
                    <button
                      onClick={() => clearAnatomy()}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
                <p className="mt-1 text-[11px] leading-snug text-slate-400">
                  {anatomyMsg ||
                    "Papille et macula se détectent séparément. « Ajuster » : glissez les points verts pour corriger la FORME du contour, P pour déplacer, M pour la macula — les corrections sont sauvegardées."}
                </p>
              </>
            )}

            {/* Pré-annotation IA */}
            <SectionLabel>Pré-annotation IA</SectionLabel>
            <button
              onClick={() => {
                setOpen(false);
                setLayout("mono"); // outils de précision = 1 œil plein cadre
                setSamMode(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-2 text-xs font-medium text-white transition hover:bg-violet-700"
            >
              <WandIcon />
              Détourer au clic (IA)
            </button>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Cliquez une lésion → l’IA propose le tracé (brouillon) à valider.
            </p>

            {/* Actions */}
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => resetAdjustments()}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Réinitialiser
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Remplacer
              </button>
              <button
                onClick={() => {
                  removeBackground();
                  setOpen(false);
                }}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                Retirer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Affichage signé d'un réglage tonal (-100..100), « 0 » restant neutre. */
function signed(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  return (
    <label className="block py-1">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-[11px] tabular-nums text-slate-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
      />
    </label>
  );
}

const HandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const ScissorsIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
  </svg>
);

const WandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2M15 10V8M9 4l1.5 1.5M21 4l-1.5 1.5M11 15l-7 7M19 8l-9 9" />
    <path d="M15 6a2 2 0 0 1 2 2" />
  </svg>
);

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0112 4c6.5 0 10 7 10 7a13.2 13.2 0 01-1.67 2.43M6.6 6.6A13.2 13.2 0 002 11s3.5 7 10 7a9.1 9.1 0 005.4-1.6" />
    <path d="M1 1l22 22" />
  </svg>
);
