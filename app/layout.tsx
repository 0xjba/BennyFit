import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Benefits screener',
  description:
    'Describe a household once in plain language and see every eligibility criterion for three federal programs evaluated in one pass, with the one question that would settle what is missing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
