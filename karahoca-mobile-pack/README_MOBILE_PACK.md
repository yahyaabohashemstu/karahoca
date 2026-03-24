# KARAHOCA — Dedicated Mobile Design (Drop‑in Pack)

This pack adds a **clean, top‑tier mobile experience** while preserving the desktop UI and brand identity.

## Files included

- `src/hooks/useIsMobile.ts` — Hook to detect the viewport.
- `src/styles/mobile.css` — Dedicated mobile stylesheet (<=768px) using KARAHOCA colors & glass-morphism.
- `src/mobile/MobileLayout.tsx` — Sticky header + off‑canvas nav + footer.
- `src/mobile/MobileHeader.tsx` — Compact header with language placeholder.
- `src/mobile/MobileNavSheet.tsx` — Smooth sliding sheet menu.
- `src/mobile/MobileFooter.tsx` — Simplified, accessible footer.
- `src/mobile/MobileHome.tsx` — Example of a mobile‑optimized landing composition (Hero, Brands, Numbers, About).

## How to integrate (5 minutes)

1) **Copy** the `src/` folders from this pack into your project:
```
/src/hooks/useIsMobile.ts
/src/styles/mobile.css
/src/mobile/*
```

2) **Import the stylesheet** once (e.g. in `src/main.tsx` or `src/index.css`):
```ts
import "./styles/mobile.css";
```

3) **Decide where to render mobile vs desktop.**  
In `App.tsx` (or page components), use the hook:
```tsx
import { useIsMobile } from "./hooks/useIsMobile";
import MobileLayout from "./mobile/MobileLayout";
import MobileHome from "./mobile/MobileHome";

export default function App() {
  const isMobile = useIsMobile(768);

  if (isMobile) {
    return (
      <MobileLayout>
        <MobileHome />
      </MobileLayout>
    );
  }

  // Existing desktop app (unchanged)
  return <DesktopApp />;
}
```

If you already use routes, switch per route similarly (mobile pages live under `src/mobile`).

4) **Bind translations**  
Mobile components call keys like `nav.brands`, `numbers.title`, `hero.title`, `about.title`, etc.  
They map to your existing i18n resources. Adjust key names if yours differ.

5) **Brand assets**  
Replace example image paths (`/brands/diox.png`, `/brands/aylox.png`, `/logo.png`) with real assets under `public/`.

## UX decisions (why this works on phones)

- **One-column flow** with short, high-contrast sections.
- **Sticky, translucent header** with clear Burger → **Sheet navigation** (Fitts’ Law optimized tap targets).
- **CTA row** uses 2 buttons side-by-side for key actions; secondary is ghost.
- **Cardized content** with consistent 12–16px paddings and 12–20px radii for a premium glass look.
- **Typography scale**: 24/18/14 for title/section/paragraph for crisp legibility at 360–430 px widths.
- **Hit area > 44px** for all actionable elements; no overflow scrolling sideways.
- **Reduced motion**; only the sheet animates to communicate state change.

## Notes

- The pack **does not alter** desktop code. It’s a separate mobile layer.
- If you prefer Tailwind, the CSS tokens here map 1:1 to your design system; you can port them to Tailwind variables.
- All elements are accessible (labels, roles, aria attributes) and keyboard-friendly.
