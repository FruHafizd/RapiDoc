import CtaButton from "@/components/CtaButton";

const steps = [
  { title: "Pilih format", body: "Mulai dari preset umum atau atur sendiri margin, font, dan spasi." },
  { title: "Lengkapi struktur", body: "Cover, kata pengantar, daftar isi, bab, dan daftar pustaka." },
  { title: "Unduh .docx", body: "Dapatkan file Word yang rapi dan siap diisi." },
];

const faqs = [
  {
    q: "Apakah RapiDoc gratis?",
    a: "Ya. Seluruh fitur dapat dipakai tanpa biaya dan tanpa membuat akun.",
  },
  {
    q: "Apakah dokumen saya disimpan?",
    a: "Tidak. Seluruh proses berjalan di peramban Anda, tidak ada data yang dikirim ke server.",
  },
  {
    q: "Format apa yang dihasilkan?",
    a: "File Microsoft Word (.docx) yang dapat dibuka di Word dan Google Docs.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-gold">
          Template makalah otomatis
        </p>
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">
          Template makalah dibuat otomatis oleh RapiDoc.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Atur format sekali, unduh dokumen Word yang rapi dalam hitungan detik. Tidak perlu lagi
          mengulang dari awal.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <CtaButton />
          <span className="text-sm text-muted">Upload Dokumen (segera hadir)</span>
        </div>
      </section>

      <section className="border-t border-line bg-white/40">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="font-serif text-3xl font-semibold">Cara kerja</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t-2 border-gold pt-4">
                <span className="font-serif text-sm text-muted">0{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="font-serif text-3xl font-semibold">Pertanyaan umum</h2>
          <dl className="mt-8 divide-y divide-line">
            {faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10">
            <CtaButton />
          </div>
        </div>
      </section>
    </>
  );
}
