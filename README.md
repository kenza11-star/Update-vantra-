# Vantra Update (Vercel)

Upload APK → isi Version → **Send**. App melihat versi baru, kirim notifikasi "Vantra update", tombol Install di About app menampilkan persen download lalu memasang otomatis.

## Deploy (sekali saja)
1. Taruh folder ini di repo GitHub (atau `vercel` CLI) → Import ke Vercel. Framework preset: **Other**.
2. **Storage → Create → Blob** → Connect ke project (otomatis menambah `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables** → `ADMIN_PASSWORD` = password pilihanmu.
4. **Redeploy**, buka alamat utama `nama-project.vercel.app`.
5. Salin alamat dari kartu "alamat server" di halaman → tempel ke `UpdateServerUrl` di app.

Kalau alamat utama minta login Vercel: **Settings → Deployment Protection → Vercel Authentication → Disabled**.

## Cara kerja upload
APK dipecah di browser dan dikirim ke `/api/chunk` (3 sekaligus). Ukuran potongan **menyesuaikan koneksi**: mulai 1 MB, naik sampai 4 MB (batas body Vercel) kalau lancar, dan otomatis diperkecil (sampai 128 KB) kalau koneksi memutus request besar, seperti pada data seluler yang buruk. Kecepatan, sisa waktu, dan keadaan koneksi tampil di kotak APK. Layar dijaga tetap menyala selama upload.
Upload mulai begitu file dipilih dan password terisi. Saat **Send**, `/api/assemble` menyambung potongan jadi satu APK, memeriksa itu file APK, menaruhnya di daftar rilis, dan menghapus potongan sementara. Potongan dari upload yang ditinggalkan dibersihkan otomatis setelah 2 jam. Tidak ada token/callback ke storage, jadi tidak tergantung alamat deployment.

## Endpoint
- `GET /api/releases` → daftar rilis (format GitHub Releases, dipakai app)
- `GET /api/config` · `POST /api/chunk` · `POST /api/assemble` · `POST /api/publish` (mode link) · `POST /api/delete`

## Penting
- APK baru harus ditandatangani key yang **sama** dan `versionCode` **lebih besar**, kalau tidak Android menolak update.
- Batas ukuran APK: ±250 MB.

## Kalau upload gagal
Sebelum upload besar, halaman menguji storage (tulis+hapus file kecil). Kalau gagal, pesan merah menjelaskan penyebabnya, mis. **store Blob bertipe Private** (harus **Public**). Kegagalan satu potongan juga ditampilkan beserta percobaan ulangnya.
