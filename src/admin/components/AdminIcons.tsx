import React from 'react';

// Navigation icons as inline SVG. The sidebar used emoji, which depend on
// the OS font: on Windows 10 the Funnel's 🪜 (Unicode 13) rendered as an
// empty box, and Blog had no icon at all.

type IconName =
  | 'dashboard' | 'analytics' | 'funnel' | 'cohorts' | 'abtest'
  | 'products' | 'categories' | 'news' | 'blog'
  | 'campaigns' | 'newsletter'
  | 'ai' | 'insights' | 'chats' | 'audit' | 'logout';

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  analytics: <path d="M3 3v18h18M7 15l4-5 3 3 5-7" />,
  funnel: <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />,
  cohorts: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
    </>
  ),
  abtest: <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9.5V3M7.5 15h9" />,
  products: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  categories: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12z" />,
  news: (
    <>
      <path d="M4 5h13v14.5a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 19.5V5z" />
      <path d="M17 9h3v10.5a1.5 1.5 0 0 1-3 0M7.5 9h6M7.5 12.5h6M7.5 16h4" />
    </>
  ),
  blog: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  campaigns: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  newsletter: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4L12 3z" />
      <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </>
  ),
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  chats: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />,
  audit: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  logout: <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h10" />,
};

export const AdminIcon: React.FC<{ name: IconName; size?: number }> = ({ name, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name]}
  </svg>
);

export type { IconName };
