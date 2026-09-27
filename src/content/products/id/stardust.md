---
name: StarDust
order: 1
status: ongoing
version: 0.3.0-alpha.1
summary: Dynamic field tanpa skema untuk PHP, tetap bisa difilter lewat index bawaan MySQL atau MariaDB tanpa search cluster terpisah.
lead: StarDust adalah library PHP yang tidak terikat framework. Setiap tenant atau pengguna bisa membuat field sendiri, dan field itu tetap bisa difilter lewat index database sungguhan, bukan dengan memindai seluruh tabel.
source: https://github.com/damarbob/StarDust
website: https://stardust.konstelasi.co.id
---

## Masalah dynamic field

Begitu pengguna boleh menambah field sendiri pada sebuah record, biasanya ada dua pilihan yang sama-sama berat. Tabel EAV membuat setiap filter berubah menjadi rangkaian self-join. Kolom JSON terlihat aman di atas kertas, tetapi pada data besar database memindai seluruh isinya karena tidak ada index yang terpakai. Keduanya mulai kewalahan ketika satu tenant punya puluhan field custom dan ingin memfilter beberapa sekaligus.

## Cara StarDust menanganinya

Payload JSON lengkap dari setiap entry selalu menjadi sumber utama. Field yang ditandai filterable juga disalin ke kolom slot bertipe yang ber-index, sehingga sebuah filter membaca index sungguhan.

```php
$page = $engine->read(new EntryQuery(
    tenantId: 1,
    modelId:  $companyModelId,
    filter:   new AndNode([
        LeafNode::local('industry',  'eq', 'software'),
        LeafNode::local('employees', 'gt', 100),
    ]),
));
```

Kalau index sebuah field belum siap, atau kapasitas slot sedang menipis, proses tulis tetap berhasil. Nilainya tersimpan aman di payload JSON, dan worker di latar belakang kemudian menyalinnya ke index.

## Yang Anda dapatkan

- Paket Composer biasa. Dependensinya saat runtime hanya interface `psr/log` dan `psr/clock`, jadi tidak ada ORM, query builder, atau framework yang ikut terpasang.
- Dua belas operator filter dengan AND, OR, dan NOT, semuanya dikompilasi menjadi SQL yang memakai index.
- Setiap query dibatasi per tenant langsung di level SQL.
- Worker latar belakang yang menyiapkan kapasitas index, mengisi field baru, mengambil kembali slot yang kosong, dan mengalirkan ekspor data. Tidak ada yang perlu menyetel skema dengan tangan.
- Pagination berbasis cursor, dirancang untuk data yang terlalu besar untuk dipaging dengan offset.
- MySQL 8.0.13 ke atas, Percona Server, dan MariaDB 10.11 ke atas. Engine mengenali database yang dipakai dan langsung menolak versi yang lebih lama saat startup.

## Apakah cocok untuk Anda?

StarDust cocok kalau Anda butuh field per tenant atau buatan pengguna yang tetap bisa difilter lewat index bawaan, sudah memakai MySQL atau MariaDB, dan tidak keberatan field yang baru dijadikan filterable baru bisa dipakai untuk query sesaat setelah dibuat, bukan seketika.

Kalau yang Anda perlukan adalah pencarian full-text, fuzzy, atau substring sejak awal, atau nomor halaman dan jumlah total pada hasil yang besar, StarDust kemungkinan bukan alat yang tepat. Pencarian full-text tetap bisa ditambahkan lewat driver custom yang meneruskan pekerjaannya ke layanan pencarian khusus.

## Mulai memakai

```bash
composer require damarbob/stardust:^0.3@alpha
```

StarDust masih berstatus alpha. Engine dan worker latar belakangnya sudah lengkap dan teruji, tetapi API publiknya masih bisa berubah sebelum rilis stabil 0.3.0. [Situs StarDust](https://stardust.konstelasi.co.id) menjelaskan cara kerjanya lewat demo interaktif, dan paketnya tersedia [di Packagist](https://packagist.org/packages/damarbob/stardust).
