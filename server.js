const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DB_FOLDER = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_FOLDER, 'database.json');

if (!fs.existsSync(DB_FOLDER)) fs.mkdirSync(DB_FOLDER, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sites: [], messages: [] }, null, 2));
}

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return { users: [], sites: [], messages: [] }; }
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function makeSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 25);
  return base + '-' + Math.random().toString(36).substring(2, 7);
}

// OPTIONAL AUTH - allows guest + logged in users
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], SECRET);
      req.userId = decoded.id;
      req.userRole = decoded.role || 'user';
    } catch (e) {}
  }
  if (!req.userId) {
    req.userId = 'guest-' + Math.random().toString(36).substring(2, 10);
    req.userRole = 'guest';
  }
  next();
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Login required' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role || 'user';
    next();
  } catch (e) { res.status(401).json({ error: 'Session expired' }); }
}

function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ============ AI FEATURES INJECTION ============
function injectAIFeatures(html) {
  const ai = `
    <button onclick="aiVoiceSearch()" title="Voice Search" style="position:fixed;bottom:24px;left:24px;width:56px;height:56px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(99,102,241,.5);z-index:998;color:#fff;">
      <svg width="26" height="26" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
    </button>
    <button onclick="aiChatToggle()" title="AI Assistant" style="position:fixed;bottom:24px;left:96px;width:56px;height:56px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(16,185,129,.5);z-index:998;color:#fff;">
      <svg width="26" height="26" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
    <div id="aiChatPanel" style="display:none;position:fixed;bottom:96px;left:24px;width:340px;max-width:calc(100vw - 48px);height:440px;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);z-index:999;flex-direction:column;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-weight:700;font-size:14px;">🤖 AI Assistant</div>
        <button onclick="aiChatToggle()" style="background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;">×</button>
      </div>
      <div id="aiChatMessages" style="flex:1;padding:14px;overflow-y:auto;font-size:13px;color:#334155;line-height:1.5;">
        <div style="background:#f1f5f9;padding:10px 14px;border-radius:10px;margin-bottom:10px;">Assalam-o-Alaikum! Kaise madad kar sakta hoon?</div>
      </div>
      <div style="padding:10px;border-top:1px solid #e2e8f0;display:flex;gap:6px;">
        <input id="aiChatInput" type="text" placeholder="Type question..." style="flex:1;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onkeypress="if(event.key==='Enter')aiChatSend()">
        <button onclick="aiChatSend()" style="background:#6366f1;color:#fff;border:none;padding:0 14px;border-radius:8px;cursor:pointer;font-weight:600;">Send</button>
      </div>
    </div>
    <button onclick="document.getElementById('easypaisaModal').style.display='flex'" title="Pay Now" style="position:fixed;bottom:96px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(245,158,11,.5);z-index:998;color:#fff;font-size:24px;">💳</button>
    <div id="easypaisaModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:400px;color:#0f172a;">
        <h3 style="font-size:20px;font-weight:800;margin-bottom:16px;">Complete Payment</h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button onclick="processPayment('easypaisa')" style="background:#ecfdf5;border:2px solid #10b981;padding:14px;border-radius:10px;cursor:pointer;text-align:left;font-family:inherit;font-weight:700;">💚 Easypaisa</button>
          <button onclick="processPayment('jazzcash')" style="background:#fff7ed;border:2px solid #f59e0b;padding:14px;border-radius:10px;cursor:pointer;text-align:left;font-family:inherit;font-weight:700;">❤️ JazzCash</button>
          <button onclick="processPayment('bank')" style="background:#eff6ff;border:2px solid #3b82f6;padding:14px;border-radius:10px;cursor:pointer;text-align:left;font-family:inherit;font-weight:700;">🏦 Bank Transfer</button>
        </div>
        <button onclick="document.getElementById('easypaisaModal').style.display='none'" style="width:100%;padding:10px;background:#f1f5f9;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:12px;font-family:inherit;">Cancel</button>
      </div>
    </div>
    <script>
      function aiVoiceSearch(){
        if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){alert('Try Chrome');return;}
        var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
        var r=new SR();r.lang='en-US';
        r.onresult=function(e){var t=e.results[0][0].transcript;var c=document.querySelectorAll('[data-product]');var f=0;c.forEach(function(x){if(x.getAttribute('data-product').toLowerCase().includes(t.toLowerCase())){x.style.boxShadow='0 0 0 3px #10b981';f++;setTimeout(function(){x.style.boxShadow='';},3000);}});alert(f+' items found for: '+t);};
        r.start();
      }
      function aiChatToggle(){var p=document.getElementById('aiChatPanel');p.style.display=p.style.display==='none'?'flex':'none';}
      function aiChatSend(){var i=document.getElementById('aiChatInput');var m=i.value.trim();if(!m)return;var ms=document.getElementById('aiChatMessages');ms.innerHTML+='<div style="background:#6366f1;color:#fff;padding:10px 14px;border-radius:10px;margin-bottom:10px;text-align:right;">'+m+'</div>';setTimeout(function(){var r=gen(m);ms.innerHTML+='<div style="background:#f1f5f9;padding:10px 14px;border-radius:10px;margin-bottom:10px;">'+r+'</div>';ms.scrollTop=ms.scrollHeight;},600);i.value='';ms.scrollTop=ms.scrollHeight;}
      function gen(m){var l=m.toLowerCase();if(l.includes('price')||l.includes('rate'))return 'Prices are listed on each item. Contact on WhatsApp for bulk orders!';if(l.includes('order')||l.includes('buy'))return 'Click any item and contact us on WhatsApp!';if(l.includes('delivery'))return 'Free delivery on orders above Rs. 2000.';if(l.includes('hello')||l.includes('hi')||l.includes('salam'))return 'Walaikum Assalam! How can I help?';return 'Thank you! Contact us on WhatsApp for quick response.';}
      function processPayment(m){var ms={easypaisa:{name:'Easypaisa',num:'0345-1234567'},jazzcash:{name:'JazzCash',num:'0301-1234567'},bank:{name:'Bank',num:'HBL: 1234-5678-9012-3456'}};var x=ms[m];alert('Pay to '+x.name+':\\n'+x.num);window.open('https://wa.me/923001234567?text=I want to pay via '+x.name,'_blank');document.getElementById('easypaisaModal').style.display='none';}
    <\/script>
  `;
  return html.replace('</body>', ai + '</body>');
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ============ SIGNUP ============
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password 6+ chars' });

    const emailLower = email.toLowerCase().trim();
    const db = readDB();
    if (db.users.find(u => u.email === emailLower)) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = { id: Date.now().toString(), name: name.trim(), email: emailLower, password: hashed, role: 'user', status: 'active', createdAt: new Date().toISOString() };
    db.users.push(user);
    writeDB(db);

    const token = jwt.sign({ id: user.id, role: 'user' }, SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: 'user' } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ============ LOGIN ============
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const emailLower = email.toLowerCase().trim();
    const db = readDB();

    if (emailLower === (process.env.ADMIN_EMAIL || '').toLowerCase() && password === process.env.ADMIN_PASSWORD) {
      let admin = db.users.find(u => u.email === emailLower);
      if (!admin) {
        const hashed = await bcrypt.hash(password, 10);
        admin = { id: 'admin-' + Date.now(), name: 'Administrator', email: emailLower, password: hashed, role: 'admin', status: 'active', createdAt: new Date().toISOString() };
        db.users.push(admin);
        writeDB(db);
      }
      const token = jwt.sign({ id: admin.id, role: 'admin' }, SECRET, { expiresIn: '30d' });
      return res.json({ success: true, token, user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' } });
    }

    const user = db.users.find(u => u.email === emailLower);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account blocked' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role || 'user' }, SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user' } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ============ SAVE SITE (OPTIONAL AUTH) ============
app.post('/api/sites', optionalAuth, (req, res) => {
  try {
    const { name, html, category, style } = req.body;
    if (!name || !html) return res.status(400).json({ error: 'Name and HTML required' });

    const db = readDB();
    const slug = makeSlug(name);
    const enhancedHtml = injectAIFeatures(html);

    const site = {
      id: Date.now().toString(),
      userId: req.userId,
      name: name.trim(),
      slug: slug,
      html: enhancedHtml,
      category: category || 'other',
      style: style || 'modern',
      views: 0,
      published: true,
      isGuest: req.userRole === 'guest',
      createdAt: new Date().toISOString()
    };

    db.sites.push(site);
    writeDB(db);
    res.json({ success: true, slug: site.slug, url: '/site/' + site.slug, id: site.id });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/sites', auth, (req, res) => {
  const db = readDB();
  res.json({ sites: db.sites.filter(s => s.userId === req.userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.delete('/api/sites/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.sites.findIndex(s => s.id === req.params.id && s.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.sites.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

// ============ PUBLIC VIEW ============
app.get('/site/:slug', (req, res) => {
  const db = readDB();
  const site = db.sites.find(s => s.slug === req.params.slug);
  if (!site) return res.status(404).send('<!DOCTYPE html><html><head><title>404</title></head><body style="font-family:Arial;text-align:center;padding:80px;background:#0f172a;color:#fff;"><h1 style="font-size:80px;color:#6366f1;margin:0;">404</h1><p>Website not found</p><a href="/" style="color:#6366f1;">← Home</a></body></html>');
  site.views = (site.views || 0) + 1;
  writeDB(db);
  res.send(site.html);
});

// ============ ADMIN ============
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const db = readDB();
  res.json({ users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role || 'user', status: u.status || 'active', createdAt: u.createdAt })) });
});

app.get('/api/admin/sites', auth, adminOnly, (req, res) => {
  const db = readDB();
  res.json({ sites: db.sites.map(s => {
    const o = db.users.find(u => u.id === s.userId);
    return { id: s.id, name: s.name, slug: s.slug, category: s.category, style: s.style, views: s.views, isGuest: s.isGuest || false, createdAt: s.createdAt, ownerName: o ? o.name : (s.isGuest ? 'Guest' : 'Unknown'), ownerEmail: o ? o.email : (s.isGuest ? 'anonymous' : 'Unknown') };
  }) });
});

app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  const db = readDB();
  res.json({
    totalUsers: db.users.filter(u => u.role !== 'admin').length,
    totalSites: db.sites.length,
    totalViews: db.sites.reduce((sum, s) => sum + (s.views || 0), 0),
    activeToday: db.users.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length,
    guestSites: db.sites.filter(s => s.isGuest).length
  });
});

app.put('/api/admin/users/:id/status', auth, adminOnly, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot modify admin' });
  user.status = req.body.status === 'blocked' ? 'blocked' : 'active';
  writeDB(db);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (db.users[idx].role === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
  db.sites = db.sites.filter(s => s.userId !== db.users[idx].id);
  db.users.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

app.delete('/api/admin/sites/:id', auth, adminOnly, (req, res) => {
  const db = readDB();
  const idx = db.sites.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.sites.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

// 404
app.use((req, res) => {
  res.status(404).send('<!DOCTYPE html><html><body style="font-family:Arial;background:#0f172a;color:#fff;text-align:center;padding:80px;"><h1 style="font-size:80px;color:#6366f1;">404</h1><p>Page not found</p><a href="/" style="color:#6366f1;">← Home</a></body></html>');
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║                                      ║');
  console.log('  ║   ✅  SmartBuild Server Running      ║');
  console.log('  ║                                      ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log('  🌐  http://localhost:' + PORT);
  console.log('  📁  Database: data/database.json');
  console.log('');
  console.log('  👤  Admin: ' + (process.env.ADMIN_EMAIL || 'admin@smartbuild.com'));
  console.log('  🔑  Pass:  ' + (process.env.ADMIN_PASSWORD || 'admin123456'));
  console.log('');
});