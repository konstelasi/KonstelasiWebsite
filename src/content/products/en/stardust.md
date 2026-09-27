---
name: StarDust
order: 1
status: ongoing
version: 0.3.0-alpha.1
summary: Schemaless dynamic fields for PHP, filterable through the native indexes of MySQL or MariaDB, with no separate search cluster.
lead: StarDust is a framework-neutral PHP library that lets every tenant or user define their own fields, and still filter them through real database indexes instead of a table scan.
source: https://github.com/damarbob/StarDust
website: https://stardust.konstelasi.co.id
---

## The problem with dynamic fields

Letting users add their own fields to a record usually ends in one of two trade-offs. An EAV table turns every filter into a chain of self-joins. A JSON column filters fine on paper, but at scale it scans instead of using an index. Neither holds up once a tenant has a few dozen custom fields and wants to filter on several of them at once.

## How StarDust handles it

The complete JSON payload of every entry is always the system of record. Fields marked filterable are also mirrored into typed, indexed slot columns behind the scenes, so a filter reads a real index.

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

If a field's index isn't ready yet, or slot capacity runs low for a moment, the write still succeeds. The value is safe in the JSON payload, and a background worker backfills it into an index later.

## What you get

- A plain Composer package. The only runtime dependencies are the `psr/log` and `psr/clock` interfaces, so no ORM, query builder or framework comes with it.
- Twelve filter operators with full AND, OR and NOT, compiled to indexed SQL.
- Tenant scoping on every query, at the SQL level.
- Background workers that provision index capacity, backfill new fields, reclaim freed slots and stream exports, so nobody hand-tunes the schema.
- Cursor pagination, built for datasets too large to page through with offsets.
- MySQL 8.0.13 or later, Percona Server, and MariaDB 10.11 or later. The engine detects which one it's talking to and rejects older versions at startup.

## Is it a fit?

StarDust suits you if you need per-tenant or user-defined fields that stay filterable through native indexes, you already run MySQL or MariaDB, and you can accept that a newly filterable field becomes queryable shortly after it's created rather than instantly.

It's probably not the right tool if you need full-text, fuzzy or substring search out of the box, or page numbers and a total count on large result sets. Full-text search can still be added through a custom driver that hands the work to a dedicated search service.

## Getting started

```bash
composer require damarbob/stardust:^0.3@alpha
```

StarDust is in alpha. The engine and its background workers are complete and covered by tests, but the public API may still change before the stable 0.3.0 release. The [StarDust website](https://stardust.konstelasi.co.id) walks through the engine with live demos, and the package itself is [on Packagist](https://packagist.org/packages/damarbob/stardust).
