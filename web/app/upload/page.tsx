import UploadEditor from "@/components/UploadEditor";

export const metadata = {
  title: "Upload Dokumen",
  description: "Unggah makalah .docx Anda: isinya langsung tampil, bisa diedit, lalu diunduh kembali dengan formatnya.",
};

export default function UploadPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Upload Dokumen</h1>
      <p className="mt-4 max-w-3xl text-muted">
        Unggah makalah .docx Anda. Seluruh isinya langsung tampil di halaman, lengkap dengan format yang terdeteksi
        (kertas, margin, font, spasi). Perbaiki bila ada yang keliru, lalu unduh kembali sebagai .docx.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Semua diproses di peramban Anda. Dokumen tidak diunggah ke server.
      </p>
      <div className="mt-8">
        <UploadEditor />
      </div>
    </section>
  );
}
