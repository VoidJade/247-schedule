# 24/7 Schedule — Password Edition

A shared 24-hour x 7-day schedule with password login.

## Render environment variables
Set these under the service's Environment settings:

- `USER_PASSWORD` — password everyone uses
- `MANAGER_PASSWORD` — separate password only you use; this enables remove controls
- `SESSION_SECRET` — a long random secret
- `NODE_ENV` — `production`

The app uses SQLite (`schedule.db`) for the shared schedule. On hosts with ephemeral storage, database contents may reset when the service is redeployed or restarted. For persistent production data, attach a persistent disk or move the database to hosted storage.
