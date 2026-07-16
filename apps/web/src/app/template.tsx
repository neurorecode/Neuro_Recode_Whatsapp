'use client';

/**
 * Next.js re-mounts template.tsx on every navigation (unlike layout.tsx, which
 * persists). Wrapping each page in `.page-transition` replays the roll-down
 * animation defined in globals.css every time the route changes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition h-full">{children}</div>;
}
