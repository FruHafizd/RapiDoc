# PRD RapiDoc v1

## 1. Ringkasan
RapiDoc adalah website gratis untuk membuat template makalah (.docx) otomatis, sesuai format kampus atau perusahaan. Pengguna mengisi form, melihat pratinjau, lalu mengunduh file Word yang sudah rapi.

**Headline:** Template makalah dibuat otomatis oleh RapiDoc.
**Subheadline:** Atur format sekali, unduh dokumen Word yang rapi dalam hitungan detik. Gratis.

## 2. Target & Masalah
- Pengguna: mahasiswa, pegawai, admin (17–30 tahun), desktop dan mobile.
- Masalah: mengulang format makalah yang sama terus-menerus (margin, font, cover, daftar isi, penomoran halaman).

## 3. Tujuan & Ukuran Keberhasilan
- Pengguna dapat mengunduh .docx dalam kurang dari 2 menit.
- 50 pengunjung per bulan (diukur dengan Vercel Analytics).
- Selesai dalam 1 minggu, biaya Rp0.

## 4. Ruang Lingkup

### Wajib di v1 (1 minggu)
1. **Beranda** dengan CTA utama.
2. **Generator template** berupa form bertahap:
   - Format halaman: ukuran kertas (A4/Letter), margin, spasi baris.
   - Font: jenis dan ukuran (default Times New Roman 12).
   - Cover: judul, nama, NIM/NIP, institusi, tahun (bisa dinonaktifkan).
   - Struktur: kata pengantar, daftar isi otomatis, BAB I–III atau kustom, daftar pustaka.
   - Penomoran halaman: romawi untuk awal, angka untuk isi.
3. **Preset format** (Umum Indonesia, APA, dll.) untuk mengisi form otomatis.
4. **Ekspor .docx**, dengan opsi "template kosong" (tanpa isi) atau "dengan contoh isi".
5. **Pratinjau** ringkas struktur dokumen sebelum unduh.
6. Halaman **Tentang Kami**, **FAQ**, dan **Kontak** (muhammadhafizd055@gmail.com, IG @fruha82).
7. SEO dasar, responsif, bahasa Indonesia formal.

### Nanti (v2+)
- Upload dokumen, lalu sistem mendeteksi format (margin, font, gaya heading) dan menyimpannya sebagai preset.
- Editor dokumen di browser untuk memperbaiki hasil deteksi.
- Menulis makalah langsung di website (editor mirip Word).
- Simpan preset ke akun (butuh login dan database).

### Di luar ruang lingkup
Login, pembayaran, dashboard admin, blog.

## 5. Alur Pengguna
Beranda → klik **Buat Template Sekarang** → pilih preset → sesuaikan form → pratinjau → **Unduh .docx**.

## 6. CTA
- **Utama:** "Buat Template Sekarang" (Beranda, header, dan akhir setiap halaman).
- **Sekunder:** "Upload Dokumen" ditampilkan dengan label "Segera hadir", supaya fitur v2 terlihat tanpa menambah kompleksitas.
- Pendukung: link Instagram di footer.

## 7. Halaman
| Halaman | Isi | Tujuan |
|---|---|---|
| Beranda | Hero, 3 langkah cara kerja, fitur, FAQ singkat | Memperkenalkan dan mengarahkan ke generator |
| Generator (Produk/Layanan) | Form, preset, pratinjau, unduh | Inti produk |
| Tentang Kami | Cerita dan alasan RapiDoc dibuat | Membangun kepercayaan |
| Kontak | Email dan Instagram | Saran dan laporan masalah |

## 8. Stack yang Direkomendasikan
| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Bawaan Vercel, SEO bagus, satu codebase |
| Styling | **Tailwind CSS + shadcn/ui** | Cepat, komponen rapi, mudah dikustom |
| Form | **react-hook-form + zod** | Validasi form bertahap yang ringan |
| Pembuat .docx | **`docx` (npm)** | Membuat Word asli: margin, font, TOC, penomoran halaman. Berjalan di browser |
| Hosting | **Vercel (gratis)** | Sesuai brief |
| Analitik | **Vercel Analytics** | Gratis, tanpa cookie banner |
| Backend/DB | **Tidak ada di v1** | Semua diproses di browser, tidak ada data pengguna disimpan, tidak perlu kebijakan privasi |

Untuk v2: `mammoth.js` atau parsing XML `.docx` untuk deteksi format, dan **TipTap** untuk editor.

## 9. Desain

**Kesan:** seperti kertas berkualitas, tenang, rapi.

| Peran | Warna | Alasan |
|---|---|---|
| Latar | Ivory `#F7F4EE` | Terasa seperti kertas, lebih hangat dan mewah daripada putih murni |
| Teks | Ink `#16181D` | Kontras tinggi, terbaca nyaman |
| Aksen utama | Hijau tua `#1E4D45` | Tenang dan formal, jarang dipakai produk AI generik (ungu/biru gradien) |
| Aksen kecil | Emas redup `#B08D57` | Hanya untuk garis dan detail kecil agar kesan mewah tanpa ramai |
| Garis/kartu | `#E4DED2` | Pemisah halus tanpa bayangan berat |

**Font:** judul dengan serif (Fraunces atau Source Serif 4) agar terasa seperti dokumen, UI dengan Inter atau Geist.

**Logo:** wordmark "RapiDoc" dengan ikon halaman berujung terlipat, satu warna hijau tua. Mudah dibuat di Figma dan SVG.

**Hindari ("AI slop"):** gradien ungu, glassmorphism, emoji sebagai ikon, kartu bayangan tebal, animasi berlebihan, teks generik.

## 10. SEO
Kata kunci: template makalah, format makalah, contoh format makalah word, template makalah otomatis, generator makalah, format makalah APA.

## 11. Jadwal (1 minggu)
| Hari | Pekerjaan |
|---|---|
| 1 | Setup project, desain token, layout, Beranda |
| 2–3 | Form generator dan preset |
| 4 | Ekspor .docx (cover, TOC, penomoran halaman) |
| 5 | Pratinjau, halaman Tentang dan Kontak, FAQ |
| 6 | SEO, responsif, uji hasil .docx di Word dan Google Docs |
| 7 | Deploy ke Vercel dan perbaikan akhir |

## 12. Risiko
- Daftar isi otomatis di .docx harus diperbarui pengguna di Word (F9) saat dibuka pertama. Beri petunjuknya di halaman unduh.
- Format tiap kampus berbeda. Preset v1 terbatas, jadi form harus cukup fleksibel.
