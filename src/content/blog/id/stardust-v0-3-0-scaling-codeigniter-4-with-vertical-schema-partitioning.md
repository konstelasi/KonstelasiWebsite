---
title: Membawa StarDust v0.3.0 ke skala besar dengan vertical schema partitioning
description: Alasan StarDust meninggalkan virtual column, dan cara vertical schema partitioning menjaga dynamic field tetap ber-index tanpa pemakaian memori yang tak terbatas.
published: 2026-04-07
author: Damar Maulana
---

> Tulisan ini kami buat pada April 2026, ketika v0.3.0 masih dirancang. StarDust 0.3.0-alpha.1 sudah dirilis sebagai library PHP yang tidak terikat framework, bukan paket CodeIgniter 4, dan beberapa detail di bawah berubah di sepanjang jalan. [Halaman StarDust](/id/software/stardust/) menjelaskan kondisinya saat ini.

Membangun model data dinamis di database relasional biasanya memaksa pilihan yang sulit. Anda menerima beban performa dari tabel EAV (Entity-Attribute-Value), atau menerima kenyataan bahwa penyimpanan JSON mentah sulit di-index.

Di PT Konstelasi Teknologi Internasional, kami membangun StarDust untuk menyelesaikan masalah itu di **CodeIgniter 4**. Dengan virtual column dan index B-tree milik MySQL, StarDust v0.2.x memberi data dinamis keluwesan ala NoSQL dengan kecepatan query SQL bawaan.

Namun, seiring data kami membesar, kami menemukan batas skalabilitas yang nyata pada desain virtual column. Tulisan ini mengumumkan rencana **StarDust v0.3.0**, perombakan besar yang memindahkan engine intinya ke **vertical schema partitioning**. Berikut alasan perubahannya, gambaran [blueprint arsitektur yang baru](https://github.com/Konstelasi-Teknologi-Internasional/StarDust-Developer-Project-Guide), dan dampaknya bagi aplikasi Anda.

Blueprint ini adalah dokumen hidup. Desain, strategi, dan rencana migrasinya bisa berubah kapan saja selama kami terus menguji performa sistem dan menemukan jawaban yang lebih baik sepanjang siklus v0.3.0. Bagi kami, performa dan stabilitas lebih penting daripada berpegang pada draf pertama.

## Kenapa kami meninggalkan virtual column

Arsitektur v0.2.x bergantung pada indexer saat runtime yang membuat virtual column, misalnya `v_price_num` dan `v_sku_str`, sebagai cerminan field JSON Anda. Cara ini cepat untuk data berukuran sedang, tetapi pada skala besar ada kelemahan serius, yaitu **premature materialisation**.

Saat query menyentuh data yang sangat besar, menarik payload JSON yang berat langsung ke memori bisa menyebabkan **crash karena kehabisan memori**. Mengandalkan virtual column saja untuk index dinamis juga cepat menabrak batas lebar tabel, dan pembaruan sinkron bisa membuat hardware terkunci.

Agar tetap stabil di ukuran seperti itu, kami butuh desain yang membatasi pemakaian sumber daya dengan ketat, dan memisahkan secara fisik payload JSON yang berat dari index pencarian yang kecil dan cepat.

## Vertical schema partitioning

Di v0.3.0, MySQL kami perlakukan murni sebagai penyimpanan transaksional berkapasitas tinggi, bukan mesin pencari untuk segala hal. Inti desainnya adalah strategi **extension table satu banding satu**. Alih-alih tabel lebar dengan puluhan virtual column, data dibagi secara vertikal.

- `entry_data` adalah tabel payload inti. Isinya primary key, ID tenant, timestamp sistem, dan payload JSON lengkap yang tidak di-index.
- `entry_slots_page_X` adalah extension table yang terhubung satu banding satu. Isinya kolom bertipe ketat (`i_str_01`, `i_num_01`, dan seterusnya) yang hanya dipakai untuk index dan pencarian cepat.

### Query yang dibatasi

Query lintas halaman dan filter yang rumit tidak lagi dijalankan sebagai satu `INNER JOIN` tanpa batas. Setiap pembacaan memakai dua query.

1. Probe berhalaman menjalankan filter memakai covering index dan hanya mengambil ID, sehingga pemakaian memori tetap kecil.
2. Fetch terbatas lalu memuat payload lengkap untuk ID tersebut dalam batch yang aman dan terkendali.

## Yang juga dibawa v0.3.0

Ini lebih dari sekadar perubahan skema. Cara StarDust menerima dan mengeluarkan data ditulis ulang.

### Dua daemon latar belakang

Untuk mengelola extension table tanpa menghambat proses tulis, v0.3.0 menambahkan dua daemon PHP yang berjalan terpisah.

**Watcher** adalah singleton yang memantau pemakaian slot di seluruh extension table. Saat kapasitas kosong turun di bawah 20%, Watcher menyiapkan tabel baru dengan DDL yang hanya menyentuh tabel kosong, sehingga tidak terjadi perebutan lock.

**Reconciler** adalah daemon mandiri yang menguras `stardust_sync_queue`. Jika kapasitas slot sampai 100%, StarDust tetap berjalan dengan mulus. Payload JSON tetap disimpan dan pembaruan index dimasukkan ke antrean, lalu Reconciler mengisi index untuk entry tersebut begitu ada kapasitas baru. Tidak ada data tulis yang hilang.

### API yang tegas dan bisa diprediksi

Database tidak lagi menurun diam-diam. Kalau ada yang mencoba memfilter atau mengurutkan berdasarkan field yang tidak ditandai `is_filterable = true`, StarDust langsung menolak permintaan itu dengan `400 Bad Request`. Pagination berbasis cursor, sehingga aplikasi terlindung dari lonjakan pemakaian memori.

### Ekspor asinkron

Karena endpoint sinkron dibatasi ketat oleh pagination cursor, v0.3.0 menambahkan endpoint khusus `/api/exports`. Pengguna bisa meminta ekspor data yang sangat besar, yang diproses di latar belakang lalu tersedia sebagai file CSV atau JSON untuk diunduh. Laporan yang berat pun tidak membebani database yang sedang berjalan.

### Pencarian yang bisa diganti

Driver bawaannya adalah MySQL native driver buatan kami, dan arsitekturnya mengikuti adapter pattern. Kalau Anda butuh pencarian full-text, Anda bisa memasang driver untuk Meilisearch atau OpenSearch di lapisan aplikasi.

## Migrasi dan kompatibilitas

v0.3.0 membawa skema database yang sangat berbeda dan API yang lebih ketat, jadi ini adalah **breaking change**.

Sampai API v0.3.0 final, kami sangat menyarankan Anda tetap di jalur `^0.2.0-alpha.x` pada `composer.json`. Jalur migrasi akan tersedia bersama rilisnya, dan perbaikan penting untuk 0.2.x tetap dilanjutkan di branch `support/v0.2`.

## Penutup

Kami percaya alat open source layak dirancang dengan kecermatan arsitektur yang sama seperti software komersial. Dengan vertical schema partitioning, StarDust v0.3.0 ingin memberi developer engine data dinamis yang aman sampai jutaan record.

Untuk gambaran teknis lengkapnya, baca [panduan proyek developer dan blueprint arsitektur StarDust](https://github.com/Konstelasi-Teknologi-Internasional/StarDust-Developer-Project-Guide), dan ikuti [GitHub kami](https://github.com/damarbob) untuk tag pre-release dan skrip migrasi.
