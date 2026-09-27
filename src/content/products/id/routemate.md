---
name: RouteMate
order: 4
status: pending
version: 8e77d
summary: Aplikasi Android open source yang mencari urutan kunjungan terbaik untuk hingga dua belas titik, dibangun dengan Java dan Kotlin.
lead: RouteMate adalah aplikasi optimasi rute open source untuk Android, ditulis dengan Java dan Kotlin. Letakkan titik tujuan di peta, pilih kendaraannya, dan RouteMate menghitung rute terbaik untuk memulai perjalanan. Mudah untuk pengguna baru, tetap berguna untuk yang sudah terbiasa mengatur armada.
source: https://github.com/damarbob/RouteMate
---

## Yang bisa dilakukan

- Mengoptimalkan rute melewati hingga dua belas lokasi di peta.
- Menyimpan armada berisi kendaraan yang benar-benar Anda pakai.
- Menyinkronkan data antarperangkat setelah Anda masuk ke akun.
- Distance matrix yang bisa diubah per sel atau dihitung ulang seluruhnya sedang direncanakan.

## Membangunnya sendiri

RouteMate membutuhkan tiga akun agar bisa berjalan.

1. **Mapbox.** Masuk ke [akun Mapbox](https://account.mapbox.com/) dan salin public access token dari dashboard. Token ini diawali `pk.`.
2. **Google Maps Platform**, opsional. Di [Google Cloud](https://console.cloud.google.com/), buat project, lalu buat API key di bagian credentials Google Maps Platform. Anda bisa membatasinya hanya untuk Distance Matrix API.
3. **Firebase.** Di [Firebase console](https://console.firebase.google.com/), buat project (boleh memakai project Google Cloud yang sama) dan tambahkan aplikasi Android dengan mengikuti langkah dari Firebase.

Setelah itu clone repository-nya dan tambahkan key Anda ke `local.properties`.

```properties
mapboxAccessToken="YOUR_ACCESS_TOKEN"
googleApiKey="YOUR_API_KEY"
```

Build ulang project-nya, lalu jalankan.

## Dibangun dengan

Mapbox menyediakan peta beserta API matrix, optimization, geocoding, dan directions. Google Maps menambahkan Distance Matrix API untuk menghitung jarak. Firebase menangani login dan realtime database, EventBus mengalirkan event di dalam aplikasi, dan TrueTime menjaga waktu tetap akurat. Semua merek dagang adalah milik pemiliknya masing-masing.
