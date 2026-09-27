---
title: StarCore akhirnya stabil di v0.2.0
description: StarCore, kernel HMVC dan hook kami untuk CodeIgniter 4, keluar dari alpha dengan rangkaian test yang lebih lengkap, migration yang lebih aman, dan pemuatan modul tanpa konfigurasi.
published: 2025-12-24
author: Damar Maulana
---

Setelah masa panjang refactoring, pengujian, dan penyempurnaan, StarCore mencapai tonggak stabil pertamanya, **v0.2.0**.

Kalau Anda membangun aplikasi yang kompleks dengan **CodeIgniter 4**, StarCore mengisi celah yang tidak ditangani framework-nya. StarCore adalah kernel yang menambahkan struktur HMVC (Hierarchical Model-View-Controller) yang sesungguhnya dan sistem hook ala WordPress. Dengan rilis ini, StarCore naik dari alpha eksperimental menjadi library yang kami rekomendasikan untuk proyek modular Anda berikutnya.

## Jalan menuju stabil

Kernel yang berjalan di atas framework harus tidak mengganggu, tetapi tetap bekerja sungguhan. Selama sebulan terakhir kami membongkar StarCore dan menyusunnya kembali menjadi lebih kuat.

### Diuji dengan serius

Menyebut sesuatu stabil berarti berjanji, jadi kami ingin ada bukti di baliknya. Rangkaian test bertambah banyak, mulai dari perilaku inti hook sampai kasus-kasus keamanan di pinggiran. Cakupan test untuk layanan inti tinggi, sehingga event terpicu tepat waktu dan modul selalu termuat.

Fungsi helper juga kami perkuat dari serangan directory traversal, sehingga penemuan modul secara otomatis tidak bisa dipakai untuk menyerang server Anda.

### Fondasi data yang lebih kokoh

Migration kini idempotent. Maju maupun mundur sama-sama bisa diprediksi, dan deployment tidak lagi terhenti karena error "table already exists" yang sudah akrab itu.

Di bagian dalam, akses data kini memakai pola builder yang lebih fleksibel, sehingga data modul Anda bisa diakses dengan lebih rapi.

### Lebih sedikit yang perlu diatur

Fitur yang kuat seharusnya tidak dibayar dengan kerumitan. v0.2.0 menyempurnakan pemuatan modul tanpa konfigurasi. Taruh kode Anda di `modules/`, lalu StarCore mendaftarkan namespace dan menjalankan inisialisasinya untuk Anda.

## Kenapa StarCore

Kalau Anda menyukai CodeIgniter 4 tetapi merindukan modularitas framework lain, atau sistem event plug-in milik CMS seperti WordPress, StarCore dibuat untuk Anda.

- Susun fitur sebagai modul yang berdiri sendiri, masing-masing dengan route, controller, view, dan model.
- Sisipkan logika di mana saja lewat hook. Pakai action untuk efek samping, misalnya mengirim email saat ada yang mendaftar, dan filter untuk mengubah data yang lewat, misalnya mengurai shortcode di dalam konten.
- Pakai sebagai library Composer atau sebagai kernel lokal. Keduanya sama-sama didukung.

## Mulai memakai

Pasang StarCore dengan Composer.

```bash
composer require damarbob/starcore
```

[README](https://github.com/damarbob/starcore) menjelaskan cara membuat modul pertama dan mendaftarkan hook.

## Berikutnya

Dengan fondasi yang sudah stabil, pembaruan berikutnya akan memperbanyak modul standar dan menyempurnakan alat bantu untuk developer.

Terima kasih kepada semua yang sudah mencoba versi alpha dan beta. Masukan Anda adalah gravitasi yang menyatukan proyek ini.

Selamat ngoding!
