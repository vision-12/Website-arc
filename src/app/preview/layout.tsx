import '@/features/templates/shared/base.css';
import '@/features/templates/institutional-classic/tokens.css';
import type { Metadata } from 'next';

// Preview and demo pages are never indexed (robots.txt also disallows /preview).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
