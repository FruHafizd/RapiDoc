import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

const description =
  "Buat template makalah Word (.docx) sesuai format kampus atau perusahaan secara otomatis dan gratis. Atur margin, font, cover, daftar isi, dan penomoran halaman.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "RapiDoc - Template Makalah Otomatis", template: "%s - RapiDoc" },
  description,
  keywords: [
    "template makalah",
    "format makalah",
    "format makalah word",
    "template makalah otomatis",
    "generator makalah",
    "cover makalah kelompok",
    "format makalah APA",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "id_ID",
    title: "RapiDoc - Template Makalah Otomatis",
    description,
  },
  twitter: { card: "summary", title: "RapiDoc - Template Makalah Otomatis", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
