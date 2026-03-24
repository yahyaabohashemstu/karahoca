import React, { useState } from "react";
import MobileHeader from "./MobileHeader";
import MobileNavSheet from "./MobileNavSheet";
import MobileFooter from "./MobileFooter";

type Props = { children: React.ReactNode };

export default function MobileLayout({ children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <MobileHeader onMenu={() => setOpen(true)} />
      <MobileNavSheet open={open} onClose={() => setOpen(false)} />
      {children}
      <MobileFooter />
    </div>
  );
}
