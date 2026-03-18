import { useState } from "react";
import type { ReactNode } from "react";
import MobileHeader from "./MobileHeader";
import MobileNavSheet from "./MobileNavSheet";
import MobileFooter from "./MobileFooter";
import MobileRouteEffects from "./MobileRouteEffects";

type Props = { children: ReactNode };

export default function MobileLayout({ children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <MobileRouteEffects />
      <MobileHeader onMenu={() => setOpen(true)} />
      <MobileNavSheet open={open} onClose={() => setOpen(false)} />
      {children}
      <MobileFooter />
    </div>
  );
}
