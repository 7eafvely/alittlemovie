import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alittlemovie Studio',
  description: '个人创作者的剧本到短剧工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <a className="global-generate-link" href="/generate">▶ 生成视频</a>
      </body>
    </html>
  );
}
