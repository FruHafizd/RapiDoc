import Link from "next/link";
import Logo from "./Logo";
import CtaButton from "./CtaButton";

const nav = [
  { href: "/generator", label: "Generator" },
  { href: "/upload", label: "Upload Dokumen" },
  { href: "/tentang", label: "Tentang" },
  { href: "/kontak", label: "Kontak" },
];

export default function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" aria-label="RapiDoc, kembali ke beranda">
          <Logo />
        </Link>
        <nav aria-label="Navigasi utama" className="order-last flex w-full gap-6 text-sm sm:order-none sm:w-auto sm:flex-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <CtaButton className="!px-4 !py-2 text-sm" />
      </div>
    </header>
  );
}
