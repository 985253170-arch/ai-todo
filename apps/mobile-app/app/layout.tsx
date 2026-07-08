import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "清行",
  description: "慢一点，也在向前走",
};

export const viewport: Viewport = {
  themeColor: "#0F3155",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-warm-bg font-sans text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
