import Link from "next/link";
import Logo from "./Logo";
import CtaButton from "./CtaButton";

export default function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="RapiDoc, kembali ke beranda">
          <Logo />
        </Link>
        <CtaButton className="!px-4 !py-2 text-sm" />
      </div>
    </header>
  );
}
