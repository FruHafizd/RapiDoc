export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-serif text-xl font-semibold text-accent">
      <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
        <path
          d="M2 1h12l6 6v18H2z M14 1v6h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M6 14h10M6 19h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      RapiDoc
    </span>
  );
}
