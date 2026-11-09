import CtaButton from "@/components/CtaButton";

export const metadata = {
  title: "Tentang RapiDoc",
  description: "RapiDoc dibuat agar tidak perlu lagi menyusun format makalah dari awal.",
};

export default function TentangPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">Tentang RapiDoc</h1>

      <h2 className="mt-10 font-serif text-2xl font-semibold">Masalah yang kami lihat</h2>
      <p className="mt-3 text-muted">
        Mahasiswa, pegawai, dan staf administrasi sering menyusun dokumen dengan format yang sama berulang kali:
        margin, font, cover, daftar isi, dan penomoran halaman. Setiap kampus atau perusahaan punya aturannya sendiri,
        dan menyiapkannya dari awal memakan waktu.
      </p>

      <h2 className="mt-10 font-serif text-2xl font-semibold">Apa yang RapiDoc lakukan</h2>
      <p className="mt-3 text-muted">
        RapiDoc membuat template makalah Word (.docx) secara otomatis. Anda mengatur format sekali, melihat
        pratinjaunya, lalu mengunduh dokumen yang rapi dan siap diisi, termasuk untuk makalah kelompok.
      </p>

      <h2 className="mt-10 font-serif text-2xl font-semibold">Prinsip kami</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>Gratis dan tanpa akun.</li>
        <li>Seluruh proses berjalan di peramban Anda. Dokumen dan logo tidak diunggah ke server.</li>
        <li>Fokus pada format yang benar, bukan fitur yang berlebihan.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl font-semibold">Rencana berikutnya</h2>
      <p className="mt-3 text-muted">
        Segera hadir: unggah dokumen Anda sendiri agar RapiDoc mendeteksi formatnya, lalu menyimpannya sebagai template.
      </p>

      <div className="mt-12">
        <CtaButton />
      </div>
    </section>
  );
}
