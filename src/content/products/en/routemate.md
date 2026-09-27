---
name: RouteMate
order: 4
status: pending
version: 8e77d
summary: An open-source Android app that finds the best order to visit up to twelve stops, built in Java and Kotlin.
lead: RouteMate is an open-source route optimizer for Android, written in Java and Kotlin. Put your stops on the map, choose the vehicles, and it works out the best route to start the trip with. It's meant to be easy for a first-time user and still useful to a dispatcher.
source: https://github.com/damarbob/RouteMate
---

## What it does

- Optimizes a route through as many as twelve locations on the map.
- Keeps a fleet, with the vehicles you actually use.
- Syncs your data across devices once you sign in.
- A distance matrix you can edit cell by cell, or recalculate in full, is planned.

## Building it yourself

RouteMate needs three accounts to run.

1. **Mapbox.** Sign in to your [Mapbox account](https://account.mapbox.com/) and copy the public access token from the dashboard. It starts with `pk.`.
2. **Google Maps Platform**, which is optional. In [Google Cloud](https://console.cloud.google.com/), create a project, then an API key under Google Maps Platform credentials. You can restrict it to the Distance Matrix API.
3. **Firebase.** In the [Firebase console](https://console.firebase.google.com/), create a project (it can be the same Google Cloud project) and add an Android app by following Firebase's own steps.

Then clone the repository and add your keys to `local.properties`.

```properties
mapboxAccessToken="YOUR_ACCESS_TOKEN"
googleApiKey="YOUR_API_KEY"
```

Rebuild the project and run it.

## Built with

Mapbox provides the maps and the matrix, optimization, geocoding and directions APIs. Google Maps adds its Distance Matrix API for distances. Firebase handles sign-in and the realtime database, EventBus carries events around the app, and TrueTime keeps the clock honest. All trademarks belong to their owners.
