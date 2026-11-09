export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <p>RapiDoc. Gratis untuk semua.</p>
        <p>
          <a className="underline" href="mailto:muhammadhafizd055@gmail.com">
            muhammadhafizd055@gmail.com
          </a>
          {" · "}
          <a className="underline" href="https://instagram.com/fruha82" rel="noopener noreferrer">
            @fruha82
          </a>
        </p>
      </div>
    </footer>
  );
}
