# OCTReport (TSX)

React/TypeScript component version of the OCT clinical report.

## Files
- `OCTReport.tsx` — data-driven component + exported `sampleReport`
- `OCTReport.css` — matching stylesheet

## Usage
```tsx
import OCTReport, { sampleReport } from "./OCTReport";

export default function Page() {
  return <OCTReport data={sampleReport} />;
}
```

## Requirements
- React 18+
- A bundler that imports `.css` (Vite, Next.js, CRA, etc.)
- Google Fonts loaded at app root:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ```

## PDF export
For server-side PDF, render the component in a route and call headless Chromium:
```js
await page.pdf({ format: "A4", printBackground: true });
```

The component fills exactly one A4 page. Data (patient, eyes, interpretation, recommendations) is fully prop-driven via the `OCTReportData` type — see `sampleReport` for shape.
