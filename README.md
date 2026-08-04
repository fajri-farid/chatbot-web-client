# chatbot-web-client

Antarmuka web sederhana untuk pengujian dan demo chatbot berbasis RAG. Terhubung ke `api-main-service` untuk autentikasi, manajemen sesi percakapan, dan streaming chat real-time.

---

## Daftar Isi

1. [Tentang](#tentang)
2. [Endpoint yang Digunakan](#endpoint-yang-digunakan)
3. [Cara Menjalankan](#cara-menjalankan)
4. [Akun Dev](#akun-dev)
5. [Fitur](#fitur)
6. [Catatan](#catatan)

---

## Tentang

Frontend ini dibangun menggunakan HTML, CSS, dan JavaScript murni (tanpa framework), sehingga bisa langsung dibuka di browser tanpa proses build apapun.

Semua request diarahkan ke `api-main-service` — bukan langsung ke RAG Core. Tujuannya adalah menjadi klien referensi untuk menguji seluruh alur yang sudah diimplementasikan di backend.

Arsitektur:

```text
chatbot-web-client
  -> api-main-service (auth, session, history)
       -> rag-core-system (RAG pipeline, LLM, Qdrant)
```

---

## Endpoint yang Digunakan

Default API base URL (bisa diubah dari panel kiri di antarmuka):

```text
http://localhost:8002
```

Daftar endpoint yang diakses:

```text
GET  /api/health
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/chat/stream
GET  /api/sessions
GET  /api/sessions/{session_id}
DELETE /api/sessions/{session_id}
```

---

## Cara Menjalankan

### Prasyarat

Pastikan `api-main-service` sudah berjalan di port `8002`. Ikuti instruksi setup di repo `api-main-service`.

### Jalankan Frontend

Dari folder `chatbot-web-client`:

```powershell
python -m http.server 3000
```

Buka di browser:

```text
http://localhost:3000
```

Port `3000` dipilih karena sudah terdaftar di `ALLOWED_ORIGINS` default pada `api-main-service`.

> Alternatif: bisa juga menggunakan extension **Live Server** di VS Code — klik kanan `index.html` → *Open with Live Server*.

---

## Akun Dev

User bawaan dari `api-main-service/users.json`:

| Username | Password | Role |
|---|---|---|
| `mahasiswa1` | `password` | mahasiswa |
| `admin1` | `password` | admin |

Atau gunakan mode **Tamu** (tanpa login) untuk role `public`.

---

## Fitur

- **Login / Logout** dengan JWT — token disimpan di `localStorage`.
- **Mode Tamu** — langsung chat tanpa login dengan role `public`.
- **Streaming SSE** — jawaban RAG ditampilkan token demi token secara real-time.
- **Manajemen Sesi** — daftar riwayat percakapan di panel kiri, bisa dibuka ulang atau dihapus.
- **Sesi Baru** — mulai percakapan baru tanpa kehilangan riwayat lama.
- **Upload Gambar** — lampirkan hingga 2 gambar (JPEG/PNG/WebP) per pesan menggunakan tombol 📎. Thumbnail ditampilkan di area preview sebelum kirim, dan di bubble chat setelah terkirim.

  > **Catatan**: Fitur gambar aktif hanya jika `rag-core-system` dikonfigurasi dengan `LLM_SUPPORTS_VISION=true`.

- **Debug Bar** — informasi mode jawaban (rag, chitchat, cache_hit, dll.), waktu proses, intent, dan skor relevansi di bawah setiap jawaban bot.
- **Sumber Dokumen** — daftar chunk dokumen yang digunakan RAG untuk menjawab dapat dilihat via collapse/expand.
- **Ganti API URL** — URL `api-main-service` bisa diubah langsung dari panel kiri tanpa reload halaman.

---

## Catatan

- Chat menggunakan endpoint streaming `/api/chat/stream` (bukan `/api/chat`).
- Riwayat sesi hanya tampil setelah login — mode tamu tidak menyimpan riwayat.
- Jika server RAG Core tidak tersambung, `api-main-service` akan mengembalikan error `502` dan pesan error ditampilkan di bubble chat.
- Gambar hanya dikonversi ke base64 di sisi browser — tidak ada server upload terpisah yang dibutuhkan.
