---
name: StarCore
order: 2
status: stable
version: 0.2.0
summary: Kernel ringan yang menghadirkan modul HMVC dan orkestrasi hook ke CodeIgniter 4.
lead: StarCore adalah library ringan yang memberi aplikasi CodeIgniter 4 struktur Hierarchical Model-View-Controller (HMVC) dan sistem hook. Dengan begitu, aplikasi bisa tumbuh sebagai kumpulan modul yang berdiri sendiri dan saling terhubung lewat event.
source: https://github.com/damarbob/StarCore
---

## Yang ditambahkan

- Setiap fitur punya folder modul sendiri di `modules/`, lengkap dengan route, controller, model, dan view masing-masing.
- Hook tersedia dalam tiga jenis, masing-masing dengan prioritas. Action menjalankan efek samping, filter mengubah nilai yang lewat, dan trigger memicu event.
- StarCore menemukan setiap modul di `modules/` dan mendaftarkan namespace-nya, jadi tidak perlu menjalankan `composer dump-autoload` setiap kali menambah class.
- Bisa langsung dipakai tanpa konfigurasi, tetapi semuanya tetap bisa diatur.

## Instalasi

```bash
composer require damarbob/starcore
```

Pilih modul yang aktif di `app/Config/Star.php` atau lewat `.env`.

```ini
Star.activeModules = 'Blog,Auth,Shop'
```

Modul pengembangan disimpan di `modules/.star-dev/` dan ditujukan untuk alat bantu seperti debug toolbar. Modul ini tidak untuk production, dan safe mode mematikannya bersama semua modul lain.

## Contoh pemakaian hook

Daftarkan hook dari `init.php` milik modul. StarCore menjalankan file ini ketika memuat modulnya.

```php
use StarCore\Service\HyperHooks;

// Action, untuk efek samping.
HyperHooks::getInstance()->register('user.login', function ($user) {
    log_message('info', 'User logged in: ' . $user->id);
});

// Filter, untuk mengubah nilai yang dilewatkan.
HyperHooks::getInstance()->register('content.render', function ($content) {
    return strtoupper($content);
});
```

Lalu panggil di tempat event itu terjadi.

```php
$hooks = service('hooks');
$hooks->action('user.login', [$currentUser]);
$content = $hooks->filter('content.render', 'hello world'); // "HELLO WORLD"
```

## Struktur sebuah modul

```text
modules/
  Blog/
    Config/Routes.php
    Controllers/
    Models/
    Views/
    Hooks/
    init.php
```

Modul juga bisa berupa paket Composer. Jika ada modul lokal dengan nama yang sama, StarCore mendahulukan versi Composer.

StarCore dirilis dengan lisensi MIT. [README di GitHub](https://github.com/damarbob/StarCore) membahas konfigurasi, placeholder pada hook, dan safe mode secara lengkap.
