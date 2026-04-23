# Handoff — Compte rendu OCT (Clinique Medivision)

## Overview
Single-page A4 clinical report (print-ready) for an ophthalmology clinic, summarising a bilateral OCT / retinography exam. The document is meant to be generated per patient, printed on A4, and signed by the practitioner.

## About the Design Files
The file in this bundle (`CR_OCT_Medivision_v2.html`) is a **design reference created in HTML** — a high-fidelity mock showing the intended look, typography, spacing and layout. It is **not production code to ship as-is**.

The task is to **recreate this design in the target codebase's existing environment** (React + CSS, PDF generator like `pdfme` / `react-pdf` / WeasyPrint, or a backend template engine — whichever fits the stack). If no environment exists yet, choose the stack best suited to medical PDF generation (typically: React → HTML → headless Chromium print-to-PDF, or a server-side template + WeasyPrint).

## Fidelity
**High-fidelity.** All colors, typography, spacing, pill styles, SVG iconography and the A4 print rules are final. Recreate pixel-accurately.

---

## Page Setup

- **Format**: A4 portrait, 210 mm × 297 mm
- **Page padding**: `14mm 13mm 12mm 13mm`
- **Background**: `#FFFFFF` (paper) — preview background `#EDEEF0`
- **Print rule**: `@page { size: A4; margin: 0; }` — box-shadow removed in print
- **Color accuracy in print**: `-webkit-print-color-adjust: exact; print-color-adjust: exact;`
- **Watermark**: single decorative eye SVG in `::before`, top-right, `210×210px`, starting `8mm/8mm` from edge, low opacity (~0.14–0.18 strokes). See `.page::before` in source.

The page uses a vertical flex layout; the signature block sticks to the bottom via `margin-top: auto`.

---

## Design Tokens

```css
/* Neutrals */
--ink:          #0B1B2B;  /* primary text */
--ink-soft:     #1E2F3F;  /* secondary text */
--mute:         #6B7B8A;  /* tertiary / labels */
--line:         #E2E8EC;  /* dividers */
--line-strong:  #C9D3DA;  /* stronger dividers */
--bg:           #FAFBFC;
--paper:        #FFFFFF;

/* Brand */
--teal:         #0A6E6B;  /* signature teal */
--teal-deep:    #064645;  /* deep teal, titles */
--teal-wash:    #E8F2F1;  /* card tint */
--gold:         #B8893A;  /* editorial accent */

/* Semantic */
--amber:        #C86A1C;  /* alert / pathology flag */
--crimson:      #B4322A;  /* critical */
--sage:         #5C8A6E;  /* normal / reassuring */

/* Eye differentiation */
--od-tint:      #F4F8FB;  /* right eye column wash (cool) */
--od-bar:       #2C6A9E;  /* right eye accent */
--og-tint:      #F9F7F2;  /* left eye column wash (warm) */
--og-bar:       #A67938;  /* left eye accent */
```

### Typography
Fonts loaded from Google Fonts:
- **Fraunces** 300 / 400 / 500 / 600 / 700 (serif display, italic variant used)
- **Inter Tight** 400 / 500 / 600 / 700 (primary sans — body, pills, section titles)
- **JetBrains Mono** 400 / 500 / 600 (monospace — codes, values, kickers)

Feature settings on body: `font-feature-settings: 'ss01', 'cv11', 'tnum';`

---

## Structural Zones (top to bottom)

### 1. Masthead (header)
- Top row: kicker `Compte rendu · N° 2026-0422-01` (JetBrains Mono, 9px, 0.2em tracking, teal, uppercase), right-aligned, margin-bottom 8px.
- Main row: 2-column grid (`auto 1fr`), items vertically centered.
  - **Left**: brand block
    - Logo mark: 46×46 rounded square (`border-radius: 12px`), teal gradient (`linear-gradient(155deg, #0A6E6B → #064645)`), subtle box-shadow + inset highlight, gold dot `10×10` bottom-right with 1.5px paper border.
    - SVG inside logo: stylised eye (cornea path + iris circle + highlight), `30×30`, stroke `#F6F1E4`.
    - Wordmark: Fraunces 500 22px `-0.022em`, "Clinique" in regular + "Medivision" italic in teal.
    - Tagline: Inter 8.5px 0.22em uppercase mute, format `Ophtalmologie · Imagerie rétinienne · Libreville` with gold `·` separators.
  - **Right**: doc-title block, right-aligned
    - Main: Fraunces italic 500 22px → "OCT maculaire & Rétinographie"
    - Sub: Inter 8.5px 0.22em uppercase mute → "Examen du 22 avril 2026 — Segment postérieur bilatéral"
- Wordmark and `.main` share size (22px) and line-height (1.1) so baselines align; tagline and sub likewise (8.5px uppercase).
- Border-bottom: `1.5px solid var(--ink)`.

### 2. Patient meta strip
4-column grid (`1.8fr 1fr 1.4fr 1.1fr`), vertical dividers `1px var(--line)` between cells.
Each cell: label (JetBrains Mono 7px 0.18em uppercase mute) + value (Inter 12px 600 ink).
Data: Patient · Prescripteur · Motif · Antécédents.

### 3. Clinical grid — OD / OG (bilateral)
2-column grid, `1px var(--line)` border, radius 6px.
Each eye column has:
- **Eye header**: paper background, left accent bar 4px (OD: blue-ish, OG: warm brown), padding `9px 12px 9px 0`.
  - Code pill: JetBrains Mono 13px 700 0.08em uppercase, white on `--od-bar` or `--og-bar`, `padding: 4px 9px`, `border-radius: 4px`.
  - Eye pictogram: 22×22 SVG (almond-shape cornea + filled iris + small white highlight), color = eye accent.
  - Name: Fraunces 600 14px ink.
  - Latin: italic 10.5px mute.
- **Sections** (`Analyse morphologique`, `Paramètres biométriques`):
  - Section title: JetBrains Mono **9px** 600 0.2em uppercase `var(--teal-deep)`, preceded by a 3×3 teal dot.
  - Params: 2-column rows (key | value), 3px vertical padding, `1px rgba(201,211,218,.45)` divider.
  - Key: Inter 10px 500, with optional "hint" (Inter 8.5px 400 mute).
  - Value: JetBrains Mono 10.5px 600.

#### Status pills
Variants on `.pill` — bordered, dot-prefix with halo:
- `.normal`  → sage background `rgba(92,138,110,.14)`, text `#2F5A40`, border `rgba(92,138,110,.35)`, weight 600.
- `.alert`   → amber `rgba(200,106,28,.16)` / `#8F4A13` / `.40` border, weight 700.
- `.critical`→ crimson `rgba(180,50,42,.14)` / `#8A241E` / `.40` border, weight 700.

### 4. Interpretation block (`Analyse clinique`)
- Card: gradient `linear-gradient(180deg,#FCFCFB,#F7F7F4)`, teal 3px left border, radius `0 5px 5px 0`, padding `11px 14px 12px`.
- Title: Inter 12px 700 0.18em uppercase `var(--teal-deep)`, preceded by an 18×1.5 teal rule inline.
- Body: Inter 10.5px, line-height 1.55, justified, hyphens: auto, `.key` = 600 ink.

### 5. Conclusion block
- **Transparent** background. Border `1px var(--line-strong)`, 3px left border `var(--teal)`, radius 5px, padding `13px 16px 14px`.
- Two-column grid (auto 1fr), 14px gap, centered.
- Badge column: label "Conclusion" (Inter 13px 700 0.18em uppercase teal-deep); `·Synthèse` kicker (JetBrains Mono 8px 0.2em gold). Right border `1px var(--line-strong)`, padding-right 14px.
- Text: **Inter Tight** 11px 400, line-height 1.55, ink.
  - `strong` (if used): teal-deep 700 with gold highlight underline — currently NO strong in the headline sentence.
  - `em` (reset to upright): block display, margin-top 4px, ink-soft.

### 6. Recommendations (2 cards)
2-column grid, 10px gap.
- Base card: `.rec-card` — paper bg, `1px var(--line)` border, radius 5px, padding `10px 12px 11px`.
- Follow-up card: `.rec-card.follow` → teal-wash bg, teal border.
- Head: flex row, teal 1.5px divider.
  - Title: Inter 11px 700 0.16em uppercase teal-deep, preceded by a 14×1.5 teal rule.
  - Icon: 18×18 teal-deep, `opacity: .75`.
    - **Hygiene card**: heart icon, `fill="currentColor"`, single path `M12 21s-7.7-4.7-9.6-10.2A5.6 5.6 0 0 1 12 6.2a5.6 5.6 0 0 1 9.6 4.6C19.7 16.3 12 21 12 21Z`.
    - **Follow-up card**: clock icon (circle r=9 + polyline 12,7→12,12→15,14), stroke-width 1.6.
- List: `.rec-list li` — bulletless, 14px left indent, 5×1.5px teal dash marker via `::before`. Inter 9.5px, line-height 1.5, ink-soft. `strong` = 600 ink.

### 7. Signature footer
- Flex bottom bar, `1px var(--line)` top border, padding-top 12px.
- **Left**:
  - City line: Fraunces italic 10px ink-soft ("Fait à Libreville, le 22 avril 2026").
  - Contact block: Inter 8.5px mute — `CLINIQUE MEDIVISION · Libreville, Gabon` / `yoanmboussou@gmail.com · +241 76 51 50 12`.
- **Right** (text-align right):
  - Doctor name: Fraunces 500 16px **teal** (both "Dr." italic and surname share the teal color now).
  - Specialty: JetBrains Mono 7.5px 0.18em uppercase mute — "Médecin · Imagerie rétinienne".
  - Signature line: 140×26px box with 1px ink bottom border, margin-left auto. **No placeholder handwriting** (practitioner signs on print).

---

## Content (current example)
- Patient: MBOUSSOU · 67 ans · M
- Prescripteur: Dr. Milebou
- Motif: Excavation papillaire bilatérale
- OD: Papille — Excavation ↑ (alert), C/D 0.70; other params normal.
- OG: all normal; C/D 0.60.
- Conclusion: "Excavation papillaire asymétrique cliniquement suspecte mais isolée, sans traduction structurelle objective sur le RNFL ou le GCL. L'ensemble évoque prioritairement une excavation physiologique à surveiller ; un glaucome à angle ouvert pré-périmétrique ne peut toutefois être formellement écarté."

All content should come from props/data in the target implementation — nothing is hard-coded conceptually.

---

## Data Model (suggested)

```ts
type Report = {
  reportNumber: string;          // "2026-0422-01"
  examDate: string;              // ISO
  examType: string;              // "OCT maculaire & Rétinographie"
  examDescription: string;       // "Segment postérieur bilatéral"
  patient:     { name: string; age: number; sex: 'M'|'F' };
  prescriber:  string;
  indication:  string;
  history:     string;
  eyes: { od: EyeData; og: EyeData };
  interpretation: string;        // HTML allowed for <span class="key">
  conclusion:     { lead: string; caveat: string };
  recommendations: {
    hygiene:   string[];
    followUp:  string[];
  };
  practitioner: {
    name: string;
    title: string;              // "Dr."
    specialty: string;
    city: string;
    clinic: { name: string; address: string; email: string; phone: string };
  };
};

type EyeData = {
  morphology: { label: string; hint?: string; pill: PillVariant; text: string }[];
  biometrics: { label: string; hint?: string; value: string; flag?: 'alert'|'critical' }[];
};

type PillVariant = 'normal' | 'alert' | 'critical';
```

---

## Print Requirements
- Must fit on a single A4 page (current padding + margins tuned for this).
- Must print cleanly in **black & white** — all status pills have text contrast without relying on color; the conclusion is transparent so it prints as a simple outlined block; borders + left accent rules remain visible.
- Force color-adjust: exact on `html, body, *, *::before, *::after`.

## Accessibility
- All decorative SVGs marked `aria-hidden="true"`.
- Semantic markup used (`<header>`, `<section>`, `<footer>`).
- Color is paired with text in every status pill (never color alone).

## Files Included
- `CR_OCT_Medivision_v2.html` — the full single-file HTML prototype (CSS inline in `<style>`, SVGs inline).

## Implementation Notes
- Prefer React components mapped 1:1 to the zones above: `<Masthead>`, `<PatientMeta>`, `<EyeColumn>`, `<Interpretation>`, `<Conclusion>`, `<RecommendationCard>`, `<SignatureBlock>`.
- Keep the CSS custom properties as a single `:root` token layer — do not duplicate hex values in components.
- For PDF export: the simplest reliable path is Puppeteer `page.pdf({ format: 'A4', printBackground: true })` against a route rendering the same HTML/CSS.
- Google Fonts must be self-hosted or pre-loaded on the render service to guarantee print consistency.
