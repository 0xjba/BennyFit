import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import './globals.css';

/**
 * One rounded geometric sans across the whole product.
 *
 * Weight and size carry the hierarchy rather than a second typeface. The rounded
 * terminals keep a subject that is mostly thresholds and deductions from reading as
 * bureaucratic.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BennyFit — benefits screening in one conversation',
  description:
    'BennyFit checks a household against federal benefit programs from a single plain-language description, and asks a follow-up question only when the answer changes the outcome.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
