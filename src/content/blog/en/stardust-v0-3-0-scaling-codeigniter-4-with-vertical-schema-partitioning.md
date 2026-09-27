---
title: Scaling StarDust v0.3.0 with vertical schema partitioning
description: Why StarDust is moving away from virtual columns, and how vertical schema partitioning keeps dynamic fields indexed without unbounded memory use.
published: 2026-04-07
author: Damar Maulana
---

> We wrote this post in April 2026, while v0.3.0 was still being designed. StarDust 0.3.0-alpha.1 has since shipped as a framework-neutral PHP library rather than a CodeIgniter 4 package, and some details below changed on the way. The [StarDust page](/software/stardust/) describes it as it is today.

Building dynamic data models in a relational database usually forces a painful choice. Either you accept the performance cost of EAV (Entity-Attribute-Value) tables, or you live with how poorly raw JSON storage indexes.

At PT Konstelasi Teknologi Internasional we built StarDust to solve exactly that for **CodeIgniter 4**. Using MySQL virtual columns and B-tree indexes, StarDust v0.2.x gave dynamic data the flexibility of NoSQL with the query speed of native SQL.

As our datasets grew, though, we found real scalability limits in the virtual column design. This post announces the plan for **StarDust v0.3.0**, a major rework that moves the core engine to **vertical schema partitioning**. Here's why we're making the change, what the [new architectural blueprint](https://github.com/Konstelasi-Teknologi-Internasional/StarDust-Developer-Project-Guide) looks like, and what it means for your applications.

The blueprint is a living document. Its designs, strategies and migration plans may change at any time as we benchmark the system and find better answers during the v0.3.0 cycle. We put performance and stability ahead of sticking to a first draft.

## Why we're leaving virtual columns

The v0.2.x architecture relies on a runtime indexer that generates virtual columns, such as `v_price_num` and `v_sku_str`, mirroring your JSON fields. That's fast on moderate datasets, but at scale it has a serious weakness, **premature materialisation**.

When a query touches a very large dataset, pulling heavy JSON payloads straight into memory can cause **out-of-memory crashes**. Relying only on virtual columns for dynamic indexing also hits a ceiling on table width, and synchronous updates can lock the hardware up.

To stay stable at that size we needed a design that strictly bounds resource use and physically separates the heavy JSON payloads from the small, fast search indexes.

## Vertical schema partitioning

In v0.3.0 we treat MySQL strictly as a high-throughput transactional store, not as a search engine for everything. The core of the design is a **one-to-one extension table** strategy. Instead of wide tables with dozens of virtual columns, the data is split vertically.

- `entry_data` is the core payload table. It holds the primary keys, tenant IDs, system timestamps and the complete, unindexed JSON payload.
- `entry_slots_page_X` are extension tables linked one to one. They hold strictly typed columns (`i_str_01`, `i_num_01` and so on) used only for fast indexing and lookups.

### Bounded queries

Queries across pages and complex filters will no longer run as a single, unbounded `INNER JOIN`. Every read uses two queries instead.

1. A paginated probe runs the filter against covering indexes and fetches only the IDs, which keeps memory use tiny.
2. A bounded fetch then loads the full payloads for those IDs in a safe, controlled batch.

## What else v0.3.0 brings

This is more than a schema change. It rewrites how StarDust takes data in and gets it back out.

### Two background daemons

To manage the extension tables without blocking writes, v0.3.0 adds two isolated PHP daemons.

The **Watcher** is a singleton that monitors slot use across the extension tables. When free capacity drops below 20%, it provisions new tables with DDL that only ever touches empty tables, which avoids lock contention.

The **Reconciler** is an independent daemon that drains `stardust_sync_queue`. If slot capacity ever reaches 100%, StarDust degrades gracefully. It saves the JSON payload and queues the index update, and the Reconciler backfills those entries once new capacity exists. No write is dropped.

### A strict, predictable API

Silent degradation in the database ends here. If a caller tries to filter or sort on a field that isn't explicitly flagged `is_filterable = true`, StarDust rejects the request with `400 Bad Request`. Pagination is cursor-based, which protects the application from runaway memory use.

### Asynchronous exports

Because synchronous endpoints are strictly bounded by cursor pagination, v0.3.0 adds a dedicated `/api/exports` endpoint. Users can request very large exports, which run in the background and arrive as a downloadable CSV or JSON file, so heavy reporting never weighs on the live database.

### Pluggable search

The default driver is our own MySQL native driver, and the architecture follows the adapter pattern. If you need full-text search, you can plug in a driver for Meilisearch or OpenSearch at the application layer.

## Migration and compatibility

v0.3.0 brings a very different database schema and a stricter API, so it's a **breaking change**.

Until the v0.3.0 API is final, we strongly recommend staying on the `^0.2.0-alpha.x` line in your `composer.json`. A migration path will come with the release, and critical fixes for 0.2.x will continue on the `support/v0.2` branch.

## Wrapping up

We believe open-source tools deserve the same architectural care as commercial software. With vertical schema partitioning, StarDust v0.3.0 aims to give developers a dynamic data engine that scales to millions of records safely.

For the full technical picture, read the [StarDust developer project guide and architectural blueprint](https://github.com/Konstelasi-Teknologi-Internasional/StarDust-Developer-Project-Guide), and follow [our GitHub](https://github.com/damarbob) for pre-release tags and migration scripts.
