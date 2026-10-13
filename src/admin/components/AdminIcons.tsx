import React from 'react';
import { DIRECTIONAL_ICONS, ICON_PATHS, type IconName } from './iconPaths';

export type { IconName };

// The admin's one icon set: inline SVG, 24×24 grid, 1.8 stroke, round caps
// and joins, drawn in currentColor. It replaced emoji, which depend on the
// OS font (on Windows 10 🪜 was an empty box and flags showed as "SA",
// "GB"…) and came in a dozen unrelated styles.
//
// Directional icons (back/forward, chevrons) mirror in right-to-left so
// they keep pointing the way the reader moves.
//
// Usage guide and the emoji → icon map: src/admin/ui/README.md.

const SIZES = { xs: 14, sm: 16, md: 18, lg: 20, xl: 24 } as const;

export interface AdminIconProps {
  name: IconName;
  /** Pixels, or xs 14 · sm 16 · md 18 (default) · lg 20 · xl 24. */
  size?: number | keyof typeof SIZES;
  className?: string;
  /** Read out instead of hidden — only for an icon that stands alone with meaning. */
  label?: string;
}

export const AdminIcon: React.FC<AdminIconProps> = ({ name, size = 'md', className, label }) => {
  const px = typeof size === 'number' ? size : SIZES[size];
  const classes = ['adm-icon', DIRECTIONAL_ICONS.has(name) ? 'adm-icon-dir' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
};
