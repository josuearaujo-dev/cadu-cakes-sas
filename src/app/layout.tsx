import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

const manrope = Manrope({ subsets: ["latin"] });

const defaultTitle = "Cadu Cakes | Sistema Financeiro";
const defaultDescription =
  "Gestão financeira da Cadu Cakes: lançamentos, cheques, folha e painel operacional.";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: defaultTitle,
    template: "%s | Cadu Cakes",
  },
  description: defaultDescription,
  icons: {
    icon: [{ url: "/cadu-cakes-logo.svg", type: "image/svg+xml" }],
    shortcut: "/cadu-cakes-logo.svg",
    apple: "/cadu-cakes-logo.svg",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Cadu Cakes",
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
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
