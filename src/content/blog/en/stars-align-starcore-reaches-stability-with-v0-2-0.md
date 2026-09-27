---
title: The stars align as StarCore reaches v0.2.0
description: StarCore, our HMVC and hook kernel for CodeIgniter 4, leaves alpha with a larger test suite, safer migrations and zero-configuration module loading.
published: 2025-12-24
author: Damar Maulana
---

After a long stretch of refactoring, testing and refining, StarCore has reached its first stable milestone, **v0.2.0**.

If you build complex applications with **CodeIgniter 4**, StarCore fills a gap the framework leaves open. It's a kernel that adds a real HMVC (Hierarchical Model-View-Controller) structure and a hook system in the style of WordPress. With this release it moves from an experimental alpha to a library we're comfortable recommending for your next modular project.

## The road to stable

A kernel that sits on top of a framework has to stay out of the way and still do real work. Over the past month we took StarCore apart and put it back together, stronger than before.

### Tested properly

Calling something stable is a promise, so we wanted proof behind it. The test suite grew a lot, from the core hook behaviour to security edge cases. Coverage of the core services is high, so events fire when they should and modules load every time.

We also hardened the helper functions against directory traversal, so discovering modules automatically can't be turned against your server.

### A firmer base for data

Migrations are now idempotent. Rolling forward or back is predictable, and a deployment no longer stops on the familiar "table already exists" error.

Internally, data access moved to a more flexible builder pattern, which gives you cleaner access to your module's data.

### Less to configure

Power shouldn't cost you complexity. v0.2.0 improves zero-configuration module loading. Drop your code into `modules/`, and StarCore registers the namespace and runs the initialisation for you.

## Why StarCore

If you like CodeIgniter 4 but miss the modularity of other frameworks, or the plug-in event system of a CMS like WordPress, StarCore was built for you.

- Organise features as independent modules, each with its own routes, controllers, views and models.
- Put logic anywhere with hooks. Use actions for side effects, such as sending an email when someone registers, and filters to change data on the way through, such as parsing shortcodes in content.
- Use it as a Composer library or as a local kernel. It fits either workflow.

## Getting started

Install StarCore with Composer.

```bash
composer require damarbob/starcore
```

The [README](https://github.com/damarbob/starcore) shows how to create your first module and register hooks.

## What's next

With the base stable, the next updates will grow the set of standard modules and improve the developer tooling.

Thank you to everyone who tried the alphas and betas. Your feedback was the gravity that pulled this project together.

Happy coding!
