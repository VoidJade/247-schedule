const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('schedule.db');
const PORT = process.env.PORT || 3000;
const MANAGER_ID = '1058895628836556920';

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  console.warn('Discord credentials are not configured. Add them as environment variables.');
}

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not configured. Set it in production.');
}

db.exec(`
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person TEXT NOT NULL,
  day INTEGER NOT NULL CHECK(day >= 0 AND day <= 6),
  start INTEGER NOT NULL CHECK(start >= 0 AND start <= 23),
  end INTEGER NOT NULL CHECK(end >= 0 AND end <= 23),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-in-render',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

function loggedIn(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Discord login required.' });
  next();
}

function validShift({ person, day, start, end }) {
  return typeof person === 'string' && person.trim() &&
    Number.isInteger(day) && day >= 0 && day <= 6 &&
    Number.isInteger(start) && start >= 0 && start <= 23 &&
    Number.isInteger(end) && end >= 0 && end <= 23;
}

app.get('/auth/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return res.status(500).send('Discord Client ID is not configured.');
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/discord/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/discord/callback`;
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code || '',
        redirect_uri: redirectUri
      })
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('Discord token exchange failed.');

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const me = await meRes.json();
    if (!me.id) throw new Error('Discord user lookup failed.');

    req.session.user = {
      id: me.id,
      username: me.global_name || me.username,
      avatar: me.avatar || null
    };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Discord login failed. Check your OAuth settings and environment variables.');
  }
});

app.post('/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', (req, res) => {
  const user = req.session.user || null;
  res.json({ user, manager: !!user && user.id === MANAGER_ID });
});

app.get('/api/shifts', loggedIn, (req, res) => {
  res.json(db.prepare('SELECT id, person, day, start, end, created_by FROM shifts ORDER BY day, start, id').all());
});

app.post('/api/shifts', loggedIn, (req, res) => {
  const payload = req.body || {};
  if (!validShift(payload)) return res.status(400).json({ error: 'Invalid shift.' });
  const result = db.prepare('INSERT INTO shifts (person, day, start, end, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(payload.person.trim().slice(0, 40), payload.day, payload.start, payload.end, req.session.user.id);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/shifts/:id', loggedIn, (req, res) => {
  const payload = req.body || {};
  if (!validShift(payload)) return res.status(400).json({ error: 'Invalid shift.' });
  const result = db.prepare('UPDATE shifts SET person=?, day=?, start=?, end=? WHERE id=?')
    .run(payload.person.trim().slice(0, 40), payload.day, payload.start, payload.end, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Shift not found.' });
  res.json({ ok: true });
});

app.delete('/api/shifts/:id', loggedIn, (req, res) => {
  if (req.session.user.id !== MANAGER_ID) return res.status(403).json({ error: 'Only the manager can remove shifts.' });
  const result = db.prepare('DELETE FROM shifts WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Shift not found.' });
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`24/7 Schedule listening on ${PORT}`));
