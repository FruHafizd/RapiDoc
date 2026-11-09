import Link from "next/link";

export default function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/generator"
      className={`inline-block rounded-md bg-accent px-6 py-3 font-medium text-accent-ink transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      Buat Template Sekarang
    </Link>
  );
}
