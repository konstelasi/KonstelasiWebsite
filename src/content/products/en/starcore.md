---
name: StarCore
order: 2
status: stable
version: 0.2.0
summary: A small kernel that brings HMVC modules and hook orchestration to CodeIgniter 4.
lead: StarCore is a lightweight library that gives CodeIgniter 4 applications a Hierarchical Model-View-Controller (HMVC) structure and a hook system, so an application can grow as a set of independent, event-driven modules.
source: https://github.com/damarbob/StarCore
---

## What it adds

- Each feature lives in its own module folder under `modules/`, with its own routes, controllers, models and views.
- Hooks come in three kinds, each with a priority. Actions run side effects, filters change a value on its way through, and triggers fire events.
- StarCore finds every module in `modules/` and registers its namespace, so there's no `composer dump-autoload` after adding a class.
- It works without configuration, and everything can still be configured.

## Installation

```bash
composer require damarbob/starcore
```

Choose which modules are active in `app/Config/Star.php`, or in `.env`.

```ini
Star.activeModules = 'Blog,Auth,Shop'
```

Development modules live in `modules/.star-dev/` and are meant for tools such as a debug toolbar. They're never meant for production, and safe mode turns them off together with every other module.

## Hooks in practice

Register a hook from a module's `init.php`, which StarCore runs when it loads the module.

```php
use StarCore\Service\HyperHooks;

// An action, for a side effect.
HyperHooks::getInstance()->register('user.login', function ($user) {
    log_message('info', 'User logged in: ' . $user->id);
});

// A filter, which changes the value passed through it.
HyperHooks::getInstance()->register('content.render', function ($content) {
    return strtoupper($content);
});
```

Then fire them wherever the event happens.

```php
$hooks = service('hooks');
$hooks->action('user.login', [$currentUser]);
$content = $hooks->filter('content.render', 'hello world'); // "HELLO WORLD"
```

## A module's shape

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

A module can also be a Composer package. StarCore gives the Composer version priority over a local module of the same name.

StarCore is released under the MIT License. The [README on GitHub](https://github.com/damarbob/StarCore) covers configuration, hook placeholders and safe mode in full.
