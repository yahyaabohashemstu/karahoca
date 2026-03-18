import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function MobileRouteEffects() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const targetId = location.hash.replace("#", "");

    const scrollToHashTarget = () => {
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }

      return false;
    };

    if (scrollToHashTarget()) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      scrollToHashTarget();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [location.pathname, location.hash]);

  return null;
}
