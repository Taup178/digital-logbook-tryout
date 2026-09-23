# Running the application

The application has six processes: frontend, API gateway, auth, dashboard,
project, and profile services. All modes use an existing Supabase project for
PostgreSQL, authentication, and storage. Compose does not provision Supabase.
Apply the repository's Supabase migrations before using a new database.

## Docker Compose

Requirements: Docker Engine/Desktop with Compose v2 or newer.

1. Copy `.env.example` to `.env` at the repository root. Fill in the public
   Supabase URL and anon key used by the frontend. Never put a service-role key
   in a `VITE_` setting: these values are bundled into browser JavaScript.
2. Copy each `services/*/.env.example` to `.env` in the same directory and fill
   in your existing database and service credentials. Existing `.env` files work.
   Use a reachable Supabase PostgreSQL connection string, not `localhost`.
   Project-service requires DATABASE_URL at startup because `npm start` runs
   its idempotent template migration. Optional AI/email keys enable those features.
3. Run from the repository root:

   ```sh
   docker compose build
   docker compose up -d --wait --wait-timeout 180
   docker compose ps
   ```

Open http://localhost:8080. Alternatively, build and start with
`docker compose up -d --build --wait --wait-timeout 180`.
Set `WEB_PORT` in root `.env` to change the published port. For a VM, set
`CORS_ORIGINS=http://YOUR_VM_IP:8080` (comma-separated for multiple origins),
and allow the selected port in the VM firewall/network rules if public access
is desired. Only nginx is published; backend container names resolve internally.
HTTPS is needed for browser features such as microphone recording on remote hosts.

Use `docker compose logs --tail=100 SERVICE` to diagnose a failing container,
and `docker compose down` to stop the stack. Health checks verify HTTP startup;
they do not prove authentication or database operations work. Frontend public
settings are build-time values: rebuild the frontend after changing them.
Backend secrets are runtime env files and are excluded from image contexts.

## Local Node development

Use Node.js 24. In the frontend, gateway and each backend directory, run `npm ci`.
Copy the corresponding `.env.example` files to `.env` and configure Supabase.
In `frontend/.env`, leave `VITE_API_GATEWAY_URL=` empty to use Vite's `/api`
proxy. In `api-gateway/.env`, use the localhost backend URLs from its example.
Start `npm start` in each of the four backend directories and the gateway,
then `npm run dev` in `frontend`. Open http://localhost:3000.
The project service's `npm start` applies its template migration before serving.

## Render

`render.yaml` retains native Node web services and the static frontend/docs sites,
and includes the API gateway. Use Node 24, `npm ci --omit=dev`, and `npm start`
for backend services. Configure each required DATABASE_URL and Supabase setting
in Render's environment settings. On the gateway, set the four `*_SERVICE_URL`
values to the backend services' public HTTPS URLs and set `CORS_ORIGINS` to the
frontend's exact HTTPS origin. Set the frontend's `VITE_API_GATEWAY_URL` to the
gateway's public HTTPS URL and supply its public Supabase values, then rebuild.
Add the frontend URL to Supabase Auth's allowed redirect URLs for each environment.

For a Render Docker web service instead, use the corresponding service directory
as its Docker build context and that directory's Dockerfile. These images honor
Render's PORT. The frontend Docker image additionally needs public VITE build
arguments and API_GATEWAY_UPSTREAM set to the public HTTPS gateway URL at runtime.
Compose service DNS names apply only inside Compose, not on Render.

Reference: [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/)
and [Render Docker configuration](https://render.com/docs/docker).
