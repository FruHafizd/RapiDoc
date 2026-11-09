# CLAUDE.md

Panduan proyek RapiDoc: website gratis pembuat template makalah (.docx). Lihat [PRD.md](PRD.md) untuk ruang lingkup, stack, dan desain.

## Alur Kerja Git (WAJIB)

- **Jangan commit langsung ke `main`.** Pengguna mereview setiap fitur sendiri sebelum digabung.
- Satu fitur = satu branch (`feat/<nama-fitur>`) = satu Pull Request.
- Buat PR dan **berhenti**. Jangan merge, jangan push ke `main`, jangan commit tambahan di luar branch fitur tanpa diminta.
- Initial commit hanya satu kali, untuk scaffold awal proyek.
- Deskripsi PR: apa yang berubah, cara mengujinya, dan hal yang belum diverifikasi.

## Database

- Hanya tambahkan database jika fitur benar-benar membutuhkannya. v1 tidak memakai database.
- **Lokal:** MySQL dari Laragon (`localhost:3306`).
- **Production:** gunakan layanan database yang gratis. Kredensial lewat environment variable, tidak pernah di-commit.
- Siapkan `.env.example` tanpa nilai rahasia.

## Skill Proyek

Ada di `.claude/skills/`:
- `karpathy-guidelines`: perilaku coding (aturan di bawah).
- `security-audit`: audit keamanan. Gunakan sebelum PR fitur yang menyentuh input pengguna, upload file, atau database.

## Karpathy Guidelines

Pedoman untuk mengurangi kesalahan umum LLM saat coding. Bias ke arah hati-hati daripada cepat; untuk tugas sepele, gunakan penilaian.

### 1. Think Before Coding

**Jangan berasumsi. Jangan sembunyikan kebingungan. Sebutkan tradeoff.**

- Nyatakan asumsi secara eksplisit. Jika ragu, tanya.
- Jika ada beberapa tafsiran, sajikan semuanya, jangan pilih diam-diam.
- Jika ada pendekatan lebih sederhana, katakan. Bantah jika perlu.
- Jika ada yang tidak jelas, berhenti, sebut yang membingungkan, lalu tanya.

### 2. Simplicity First

**Kode seminimal mungkin yang menyelesaikan masalah. Tidak ada yang spekulatif.**

- Tidak ada fitur di luar yang diminta.
- Tidak ada abstraksi untuk kode sekali pakai.
- Tidak ada "fleksibilitas" atau konfigurasi yang tidak diminta.
- Tidak ada penanganan error untuk skenario yang mustahil.
- Jika menulis 200 baris padahal bisa 50, tulis ulang.

Tanyakan: "Apakah senior engineer akan menganggap ini terlalu rumit?" Jika ya, sederhanakan.

### 3. Surgical Changes

**Sentuh hanya yang perlu. Bersihkan hanya kekacauan buatan sendiri.**

- Jangan "memperbaiki" kode, komentar, atau format di sekitarnya.
- Jangan refactor hal yang tidak rusak.
- Ikuti gaya yang sudah ada.
- Jika menemukan dead code yang tidak terkait, sebutkan, jangan hapus.
- Hapus import/variabel/fungsi yang menjadi yatim karena perubahan Anda sendiri.

Ujinya: setiap baris yang berubah harus bisa ditelusuri langsung ke permintaan pengguna.

### 4. Goal-Driven Execution

**Tentukan kriteria sukses. Ulangi sampai terverifikasi.**

- "Tambah validasi" → "Tulis tes untuk input tidak valid, lalu buat lulus"
- "Perbaiki bug" → "Tulis tes yang mereproduksinya, lalu buat lulus"
- "Refactor X" → "Pastikan tes lulus sebelum dan sesudah"

Untuk tugas bertahap, tulis rencana singkat:

```
1. [Langkah] → verifikasi: [cek]
2. [Langkah] → verifikasi: [cek]
```

Pedoman ini berhasil jika: diff berisi lebih sedikit perubahan tak perlu, lebih sedikit tulis ulang akibat over-engineering, dan pertanyaan klarifikasi datang sebelum implementasi.

Sumber: https://github.com/multica-ai/andrej-karpathy-skills (MIT)
