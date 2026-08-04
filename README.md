# simple-frontend

Frontend static sederhana untuk mencoba `api-main-service`.

Frontend ini mengikuti pola UI dari prototype chatbot, tetapi endpoint-nya diarahkan ke `api-main-service`, bukan langsung ke RAG core.

## Endpoint Yang Dipakai

Default API base URL:

```text
http://localhost:8002
```

Endpoint:

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

## Cara Jalan

Pastikan `api-main-service` sudah berjalan di port `8002`.

Jalankan frontend dari folder `simple-frontend`:

```powershell
python -m http.server 3000
```

Buka:

```text
http://localhost:3000
```

Port `3000` dipilih karena sudah ada di default `ALLOWED_ORIGINS` pada `api-main-service`.

## Login Dev

User dev dari `api-main-service/users.json`:

```text
username: mahasiswa1
password: password
```

Atau gunakan mode tamu untuk role `public`.

## Catatan

- API base URL bisa diubah dari panel kiri.
- Chat menggunakan endpoint streaming `/api/chat/stream`.
- Riwayat session hanya tampil setelah login.
- Upload gambar tidak disertakan karena kontrak awal `api-main-service` saat ini text-only.
