import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alittlemovie Studio',
  description: '剧本到短剧的创作工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
