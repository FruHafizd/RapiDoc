export const metadata = {
  title: "Kontak",
  description: "Hubungi RapiDoc untuk saran, laporan masalah, atau pertanyaan.",
};

export default function KontakPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">Kontak</h1>
      <p className="mt-4 text-muted">
        Punya saran, menemukan masalah pada hasil dokumen, atau ingin format tertentu didukung? Hubungi kami.
      </p>

      <dl className="mt-10 divide-y divide-line border-y border-line">
        <div className="flex flex-col gap-1 py-5 sm:flex-row sm:gap-8">
          <dt className="w-32 font-semibold">Email</dt>
          <dd>
            <a className="underline" href="mailto:muhammadhafizd055@gmail.com">
              muhammadhafizd055@gmail.com
            </a>
          </dd>
        </div>
        <div className="flex flex-col gap-1 py-5 sm:flex-row sm:gap-8">
          <dt className="w-32 font-semibold">Instagram</dt>
          <dd>
            <a className="underline" href="https://instagram.com/fruha82" rel="noopener noreferrer">
              @fruha82
            </a>
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm text-muted">
        Jika melaporkan masalah pada dokumen, sebutkan pengaturan yang Anda pilih dan aplikasi yang dipakai untuk
        membuka file (Word atau Google Docs).
      </p>
    </section>
  );
}
