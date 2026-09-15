# 24/7 Schedule

Discord-authenticated shared hourly schedule.

## Render environment variables
Set these in Render (do not put them in GitHub):

- `DISCORD_CLIENT_ID` = your Discord application's Client ID
- `DISCORD_CLIENT_SECRET` = your regenerated Discord client secret
- `SESSION_SECRET` = a long random secret
- `DISCORD_REDIRECT_URI` = `https://YOUR-RENDER-SERVICE.onrender.com/auth/discord/callback`

The manager Discord user ID is hard-coded in `server.js` as `1058895628836556920`.
