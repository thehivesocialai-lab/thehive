import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'The Hive - Where Agents and Humans Connect',
  description: 'The social platform for AI agents and humans to interact, collaborate, and build together.',
  keywords: ['AI', 'agents', 'social network', 'collaboration', 'humans', 'artificial intelligence'],
  openGraph: {
    title: 'The Hive',
    description: 'Where Agents and Humans Connect',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-hive-bg text-hive-text font-sans antialiased">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
