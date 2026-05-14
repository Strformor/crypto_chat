import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '₿ Crypto Market Assistant',
  description: 'Live crypto chatbot powered by Claude AI and tradingeconomics.com',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0d1117] text-[#e6edf3] antialiased">{children}</body>
    </html>
  );
}
