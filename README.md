# Vantra Update (Vercel)

Upload APK → isi Version → **Send**. App otomatis melihat versi baru, kirim notifikasi "Vantra update", dan tombol Install di About app menampilkan persen download lalu memasang otomatis.

## Deploy (sekali saja, ±5 menit)
1. Taruh folder ini di repo GitHub baru (atau `vercel` CLI dari folder ini) → **Import ke Vercel**. Framework preset: **Other**.
2. Di project Vercel: **Storage → Create → Blob** → Connect ke project ini (otomatis menambah `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables** → tambah `ADMIN_PASSWORD` = password pilihanmu (Production + Preview).
4. **Redeploy**. Buka `https://NAMA-PROJECT.vercel.app`.
5. Di app: edit `UpdateServerUrl` di `GithubUpdates.kt` ke URL itu (lihat patch app).

## Kenapa Send cepat
APK **mulai terunggah di latar begitu dipilih** (setelah password terisi). Saat kamu mengetik versi & catatan, upload sudah jalan; tekan **Send** dan yang tersisa hanya mengirim versi (≈1 detik). Kalau upload belum selesai, Send menunggu dan persennya tampil di tombol.

## Endpoint
- `GET /api/releases` → daftar rilis (format sama seperti GitHub Releases, dipakai app)
- `POST /api/upload` · `POST /api/publish` · `POST /api/delete` (butuh password)

## Penting
- APK baru **harus ditandatangani dengan key yang sama** dan `versionCode` **lebih besar**, kalau tidak Android menolak update.
- Batas file Blob: tiap APK upload langsung dari browser, aman untuk ratusan MB.
