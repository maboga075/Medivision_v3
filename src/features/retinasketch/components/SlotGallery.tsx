/**
 * SlotGallery — bande de miniatures des images d'un œil (galerie multi-images).
 *
 * Affiche les slots de l'œil (rétino, OCT-A, en-face, B-scan), met en évidence
 * le slot actif, permet d'en sélectionner un (clic), d'en supprimer un (×), et
 * d'en ajouter via un bouton « + » ouvrant un menu des 4 types d'image.
 *
 * La forme du slot (cercle/carré/rectangle) est rappelée par une pastille, et la
 * miniature reprend l'image de fond du slot (active = champs de travail,
 * inactifs = stash).
 */

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/features/retinasketch/store/useStore";
import type { ImageKind, ImageGeometry, Laterality } from "@/features/retinasketch/lib/types";
import { LABEL_FOR_KIND } from "@/features/retinasketch/lib/types";

const ADD_KINDS: ImageKind[] = ["retino", "octa", "enface", "bscan"];

/** Pastille de forme (cercle / carré / rectangle) rappelant la géométrie du slot. */
function ShapeGlyph({ geometry, className }: { geometry: ImageGeometry; className?: string }) {
  const base = `border-2 ${className ?? ""}`;
  if (geometry === "circle") return <span className={`${base} rounded-full w-3 h-3`} />;
  if (geometry === "square") return <span className={`${base} rounded-[2px] w-3 h-3`} />;
  return <span className={`${base} rounded-[2px] w-3.5 h-2.5`} />; // rect
}

export default function SlotGallery({ eye }: { eye: Laterality }) {
  const slots = useStore((s) => s.slots[eye]);
  const activeId = useStore((s) => s.activeSlot[eye]);
  const activeBg = useStore((s) => s.backgrounds[eye]);
  const stash = useStore((s) => s.slotStash);
  const addSlot = useStore((s) => s.addSlot);
  const selectSlot = useStore((s) => s.selectSlot);
  const removeSlot = useStore((s) => s.removeSlot);
  const setLaterality = useStore((s) => s.setLaterality);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  /** Source d'image d'un slot : champs de travail si actif, sinon stash. */
  const srcFor = (id: string): string | null =>
    id === activeId ? activeBg.src : stash[id]?.background.src ?? null;

  const onAdd = (kind: ImageKind) => {
    setLaterality(eye);
    addSlot(kind, eye);
    setMenuOpen(false);
  };

  return (
    // `relative z-30` : la bande (et son menu) passe DEVANT la zone de dessin.
    // Les miniatures scrollent dans un conteneur interne ; le bouton « + » reste
    // HORS de ce scroll pour que son menu ne soit pas rogné par l'overflow.
    <div className="relative z-30 flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 min-w-0">
      {slots.map((slot) => {
        const isActive = slot.id === activeId;
        const src = srcFor(slot.id);
        return (
          <div key={slot.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setLaterality(eye);
                selectSlot(slot.id, eye);
              }}
              title={slot.label}
              className={`group flex w-16 flex-col items-center gap-1 rounded-lg border-2 p-1 transition ${
                isActive ? "border-blue-500 bg-white shadow-sm" : "border-transparent hover:border-slate-300 bg-white/60"
              }`}
            >
              <div className="relative h-12 w-full overflow-hidden rounded bg-slate-200">
                {src ? (
                  <img src={src} alt={slot.label} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center">
                    <ShapeGlyph geometry={slot.geometry} className="border-slate-400" />
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5">
                  <ShapeGlyph geometry={slot.geometry} className="border-white/90 bg-black/30" />
                </span>
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold text-slate-600">
                {slot.label}
              </span>
            </button>

            {/* Supprimer — masqué s'il ne reste qu'un slot */}
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlot(slot.id, eye)}
                aria-label={`Supprimer ${slot.label}`}
                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-slate-500 text-white shadow hover:bg-red-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}
      </div>

      {/* Ajout d'une image → menu des 4 types (hors zone scrollable) */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          title="Ajouter une image"
          className="grid h-12 w-12 place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-blue-400 hover:text-blue-500"
        >
          <Plus className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {ADD_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onAdd(kind)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {LABEL_FOR_KIND[kind]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
