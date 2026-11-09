import GeneratorForm from "@/components/GeneratorForm";

export const metadata = { title: "Generator Template - RapiDoc" };

export default function GeneratorPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Generator Template</h1>
      <p className="mt-3 mb-10 max-w-2xl text-muted">
        Atur format, lihat struktur dokumen, lalu unduh file Word. Semua diproses di peramban Anda.
      </p>
      <GeneratorForm />
    </section>
  );
}
