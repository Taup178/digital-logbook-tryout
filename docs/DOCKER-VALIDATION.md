# Deployment validation — 2026-09-23

Source: `https://github.com/Taup178/digital-logbook-tryout.git`, branch `main`.
Changes were made on the Windows workspace, pushed to GitHub, and pulled on
the supplied Ubuntu VM before building.

## Passed

- Windows frontend TypeScript/Vite production build.
- Local Node startup of all four services and the gateway, with Vite serving
  the frontend and forwarding `/api` requests to each service.
- VM `docker compose config --quiet` validation.
- VM `docker compose build`: all six images built successfully from their lockfiles.
- VM `docker compose up -d --wait --wait-timeout 180`: all six containers healthy.
- Frontend HTML, JavaScript asset, and SPA deep-link responses through nginx.
- All four service health routes through nginx and the API gateway.
- Protected project API rejects an unauthenticated JSON POST with HTTP 401.
- Gateway regression test on Windows and inside its Linux image: JSON bodies,
  multipart uploads, paths, query strings, authorization forwarding, allowed
  CORS origins, and rejected CORS origins.
- Read-only PostgreSQL connection and existence of users, projects, and template tables.

## Limits and other test results

The full test suites are not green: auth passed 14/14, dashboard passed 46/46,
profile passed 21/22, project passed 543/569, and frontend passed 814/857.
Failures include profile username expectations, project entry/access mocks,
archive rollback mocks, frontend field normalization, and UI assertions. These
application test failures are outside the container configuration changes.

No interactive login, authenticated CRUD, OAuth callbacks, AI requests, emails,
or storage uploads were performed against the live Supabase project. The gateway
upload test uses an isolated mock upstream. Render configuration was updated,
but no live Render deployment was performed.

The VM serves the application on port 8080 internally. Its Azure NSG currently
permits only SSH, so direct public HTTP access times out. Use the SSH tunnel in
[Running the application](RUNNING.md) to view it from your PC. No Azure resources
or firewall rules were created for this test.

Environment files were transferred separately over SSH with mode 0600; they are
ignored by Git and excluded from Docker build contexts. Backend credentials are
runtime settings. The frontend bundle contains only its configured public values.
