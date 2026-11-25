import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사이언스 랩 (Science Lab) | 초등 과학 스마트 실험실",
  description:
    "초등 3~6학년 과학 탐구 수업을 위한 플러그인 확장형 실험 기록 및 실시간 전자칠판 공유 웹 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
