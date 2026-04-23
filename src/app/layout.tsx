import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });
const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Cadu Cakes | Sistema Financeiro",
  description: "Preview financeiro em Next.js com animacoes e graficos",
  metadataBase: new URL(appBaseUrl),
  icons: {
    icon: "/logo-perfil-1024.png",
    apple: "/logo-perfil-1024.png",
    shortcut: "/logo-perfil-1024.png",
  },
  openGraph: {
    title: "Cadu Cakes | Sistema Financeiro",
    description: "Preview financeiro em Next.js com animacoes e graficos",
    images: [
      {
        url: "/logo-perfil-1024.png",
        width: 1024,
        height: 1024,
        alt: "Logo Cadu Cakes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadu Cakes | Sistema Financeiro",
    description: "Preview financeiro em Next.js com animacoes e graficos",
    images: ["/logo-perfil-1024.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={manrope.className}>{children}</body>
    </html>
  );
}
