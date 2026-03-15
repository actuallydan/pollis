# Next

## Easiest / lowest risk
- remove useViewCounter.ts and anywhere it's used, not interested
- change github action desktop flow to not create new releases of app and not push to R2 if any of the apps fail to build (release job already depends on all 3 builds — may already work as intended, just verify and add R2 guard when that step exists)
- figure out how to have multiple dev clients for testing work locally (no code changes needed — separate SQLite profiles + separate Clerk test accounts)
- Create wiki .md files in repo for onboarding developers (how to add a new api endpoint in the server, how to add a protobuf...thing between server and wails app)
- Make the website much faster, caching, edge, pre-render the root view whatever it takes (site is already minimal on Vercel — main win is static export and reducing the DotMatrix animation cost)

## Small effort, low risk
- optimize docker image file size and perf for server (already multi-stage alpine with stripped binary — marginal gains from distroless or trimming apk packages)
- solution for logging from prod server so we don't need to SSH in (look at cheapest, production ready solutions, ideally free or self-hosted, that create the least amount of code changes to the server) (swap stdlib log for slog/zap + forward to Grafana Loki or similar — additive changes only)

## Medium effort
- Analyze repos and see how we can simplify/improve/speed up the deployment workflow (parallelize desktop platform builds, consolidate caching)
- research how to safely run migrations and if the target db doesn't have the same schema, how we manage that (currently auto-runs on startup with no rollback — need pre-flight checks, dry-run mode, Turso PITR as safety net)
- research and document plan to implement local E2E testing of app and server
- decide how to manage downloads since we don't want users downloading broken builds, but we don't necessarily want them to always have to download the latest if there are issues they identify before I do.
- Add executables to cdn.pollis.com R2 bucket and add download links to /website, these files should be overwritten on push, if they want older builds, they can get them from github (new website page + R2 upload CI step — coordinates with OTA plan below)

## Large effort / highest risk
- create a plan for the application to fetch and run the built frontend from R2, so the app can implement OTA updates. This will require a change to the wails app to run the frontend as a fully detached view, keep some record of the latest frontend version somewhere, and then fetch it if the user's local version is older than the current version (also need to provide a way to tell the user the application is updating) (blocked by R2 downloads item above — high risk of breaking app if update is incomplete or version mismatches)

# Not doing yet
- manage secrets better between dev and prod/
- test that adding images to groups works and persists
