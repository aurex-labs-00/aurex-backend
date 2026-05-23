// server.js — Aurex Labs Backend
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const bookings   = require('./routes/bookings');
const clients    = require('./routes/clients');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000','http://127.0.0.1:5500','http://127.0.0.1:3000', process.env.FRONTEND_URL].filter(Boolean),
  methods: ['GET','POST','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended:true }));

// Serve frontend HTML files statically from parent folder
app.use(express.static('../'));

// Rate limiting on booking creation
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success:false, error:'Too many requests, please try again later.' },
});
app.use('/api/bookings', bookingLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/bookings', bookings);
app.use('/api/clients',  clients);

// Simple admin auth check (no JWT needed for single-user dashboard)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success:true, token: Buffer.from(`${username}:${Date.now()}`).toString('base64') });
  } else {
    res.status(401).json({ success:false, error:'Invalid credentials' });
  }
});

// Health check
app.get('/api/health', (req,res) => res.json({ status:'ok', time: new Date().toISOString() }));

// 404
app.use((req,res) => res.status(404).json({ success:false, error:'Route not found' }));

// Error handler
app.use((err,req,res,next) => {
  console.error(err.stack);
  res.status(500).json({ success:false, error:'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀  Aurex Labs Backend running on http://localhost:${PORT}`);
  console.log(`📊  Dashboard  → open dashboard.html in your browser`);
  console.log(`📅  Booking    → open booking.html in your browser\n`);
});
