const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const db = new Database('schedule.db');
const PORT = process.env.PORT || 3000;
const USER_PASSWORD = process.env.USER_PASSWORD;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if (!USER_PASSWORD || !MANAGER_PASSWORD) {
  console.warn('USER_PASSWORD and MANAGER_PASSWORD should be set in the hosting environment.');
}

db.exec(`CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person TEXT NOT NULL,
  day INTEGER NOT NULL,
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS people (
  name TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function requireLogin(req,res,next){
  if (!req.session.user) return res.status(401).json({error:'Login required'});
  next();
}
function requireManager(req,res,next){
  if (!req.session.manager) return res.status(403).json({error:'Manager access required'});
  next();
}

app.post('/api/login', (req,res)=>{
  const {password, managerPassword} = req.body || {};
  if (!password) return res.status(400).json({error:'Enter a password.'});
  let role = 'user';
  if (MANAGER_PASSWORD && password === MANAGER_PASSWORD) role = 'manager';
  else if (USER_PASSWORD && password === USER_PASSWORD) role = 'user';
  else if (!USER_PASSWORD && !MANAGER_PASSWORD && password === 'change-me') role='manager';
  else return res.status(401).json({error:'Incorrect password.'});
  req.session.user = 'member';
  req.session.manager = role === 'manager';
  res.json({ok:true, role});
});

app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({loggedIn:!!req.session.user, manager:!!req.session.manager}));

app.get('/api/shifts', requireLogin, (req,res)=>res.json(db.prepare('SELECT * FROM shifts ORDER BY day,start,id').all()));
app.post('/api/shifts', requireLogin, (req,res)=>{
  const {person,day,start,end}=req.body||{};
  if (!String(person||'').trim() || !Number.isInteger(day)||!Number.isInteger(start)||!Number.isInteger(end) || day<0||day>6||start<0||start>23||end<0||end>23)
    return res.status(400).json({error:'Invalid shift.'});
  const name=String(person).trim().slice(0,40);
  db.prepare('INSERT OR IGNORE INTO people(name,added_by) VALUES(?,?)').run(name, req.session.manager?'manager':'member');
  const info=db.prepare('INSERT INTO shifts(person,day,start,end,created_by) VALUES(?,?,?,?,?)').run(name,day,start,end,req.session.manager?'manager':'member');
  res.json({id:info.lastInsertRowid});
});
app.put('/api/shifts/:id', requireLogin, (req,res)=>{
  const {person,day,start,end}=req.body||{};
  if (!String(person||'').trim() || !Number.isInteger(day)||!Number.isInteger(start)||!Number.isInteger(end)) return res.status(400).json({error:'Invalid shift.'});
  const name=String(person).trim().slice(0,40);
  db.prepare('INSERT OR IGNORE INTO people(name,added_by) VALUES(?,?)').run(name, req.session.manager?'manager':'member');
  db.prepare('UPDATE shifts SET person=?,day=?,start=?,end=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,day,start,end,req.params.id);
  res.json({ok:true});
});
app.delete('/api/shifts/:id', requireLogin, requireManager, (req,res)=>{db.prepare('DELETE FROM shifts WHERE id=?').run(req.params.id);res.json({ok:true});});

app.get('/api/people', requireLogin, (req,res)=>res.json(db.prepare('SELECT name FROM people ORDER BY name').all()));
app.delete('/api/people/:name', requireLogin, requireManager, (req,res)=>{
  const name=decodeURIComponent(req.params.name);
  db.prepare('DELETE FROM shifts WHERE person=?').run(name);
  db.prepare('DELETE FROM people WHERE name=?').run(name);
  res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Schedule app listening on ${PORT}`));
