// routes/bookings.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { body, validationResult } = require('express-validator');
const { sendBookingConfirmation, sendCancellationEmail, sendAdminNotification } = require('../mailer');

// ── Validation rules ──────────────────────────────────────────────────────────
const bookingRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('meeting_date').isDate().withMessage('Valid date required'),
  body('meeting_time').notEmpty().withMessage('Meeting time required'),
];

// ── GET /api/bookings — list all (admin) ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, date, search } = req.query;
    let sql = `
      SELECT b.*, c.name as client_name, c.email as client_email,
             c.phone, c.company
      FROM bookings b
      JOIN clients c ON b.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') { sql += ' AND b.status = ?'; params.push(status); }
    if (date)   { sql += ' AND b.meeting_date = ?'; params.push(date); }
    if (search) { sql += ' AND (c.name LIKE ? OR c.email LIKE ? OR b.service LIKE ?)'; const s=`%${search}%`; params.push(s,s,s); }
    sql += ' ORDER BY b.meeting_date ASC, b.meeting_time ASC';
    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/bookings/calendar?month=YYYY-MM — calendar view ─────────────────
router.get('/calendar', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [rows] = await db.execute(`
      SELECT b.id, b.meeting_date, b.meeting_time, b.status, b.service,
             c.name as client_name
      FROM bookings b
      JOIN clients c ON b.client_id = c.id
      WHERE DATE_FORMAT(b.meeting_date,'%Y-%m') = ?
      ORDER BY b.meeting_date, b.meeting_time
    `, [month]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/bookings/stats — dashboard stats ────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[totals]] = await db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(status='pending')   as pending,
        SUM(status='confirmed') as confirmed,
        SUM(status='completed') as completed,
        SUM(status='cancelled') as cancelled,
        SUM(meeting_date = CURDATE()) as today
      FROM bookings
    `);
    const [monthly] = await db.execute(`
      SELECT DATE_FORMAT(meeting_date,'%b') as month,
             COUNT(*) as count
      FROM bookings
      WHERE meeting_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(meeting_date,'%Y-%m')
      ORDER BY meeting_date ASC
    `);
    const [recentClients] = await db.execute(`
      SELECT c.name, c.email, c.company, b.service, b.status, b.meeting_date
      FROM bookings b JOIN clients c ON b.client_id=c.id
      ORDER BY b.created_at DESC LIMIT 5
    `);
    res.json({ success:true, data:{ totals, monthly, recentClients } });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// ── GET /api/bookings/available-slots?date=YYYY-MM-DD ────────────────────────
router.get('/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success:false, error:'Date required' });
    const allSlots = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];
    const [booked] = await db.execute(
      `SELECT TIME_FORMAT(meeting_time,'%H:%i') as t FROM bookings WHERE meeting_date=? AND status!='cancelled'`,
      [date]
    );
    const [blocked] = await db.execute(
      `SELECT TIME_FORMAT(block_time,'%H:%i') as t FROM blocked_slots WHERE block_date=? AND (all_day=TRUE OR block_time IS NOT NULL)`,
      [date]
    );
    const taken = new Set([...booked.map(r=>r.t), ...blocked.map(r=>r.t)]);
    const available = allSlots.filter(s => !taken.has(s));
    res.json({ success:true, data: available });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// ── POST /api/bookings — create new booking ───────────────────────────────────
router.post('/', bookingRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, phone, company, service, meeting_date, meeting_time, message, source } = req.body;

    // Upsert client
    let clientId;
    const [existing] = await conn.execute('SELECT id FROM clients WHERE email=?', [email]);
    if (existing.length) {
      clientId = existing[0].id;
      await conn.execute('UPDATE clients SET name=?,phone=?,company=? WHERE id=?', [name, phone||null, company||null, clientId]);
    } else {
      const [ins] = await conn.execute(
        'INSERT INTO clients(name,email,phone,company,source) VALUES(?,?,?,?,?)',
        [name, email, phone||null, company||null, source||'website_form']
      );
      clientId = ins.insertId;
    }

    // Check slot not already taken
    const [clash] = await conn.execute(
      `SELECT id FROM bookings WHERE meeting_date=? AND meeting_time=? AND status!='cancelled'`,
      [meeting_date, meeting_time]
    );
    if (clash.length) {
      await conn.rollback();
      return res.status(409).json({ success:false, error:'That time slot is already booked. Please choose another.' });
    }

    // Create booking
    const [bk] = await conn.execute(
      `INSERT INTO bookings(client_id,service,meeting_date,meeting_time,message,status) VALUES(?,?,?,?,?,'pending')`,
      [clientId, service||null, meeting_date, meeting_time, message||null]
    );
    await conn.commit();

    // Send emails (non-blocking)
    const bookingData = { client_name:name, client_email:email, service, meeting_date, meeting_time, duration_min:30, status:'pending', message, source };
    sendBookingConfirmation(bookingData).catch(e=>console.error('Email error:',e));
    sendAdminNotification(bookingData).catch(e=>console.error('Admin email error:',e));

    // Log email
    await db.execute(
      `INSERT INTO email_logs(booking_id,recipient,subject,type,status) VALUES(?,?,?,?,?)`,
      [bk.insertId, email, 'Booking confirmation', 'confirmation', 'sent']
    );

    res.status(201).json({ success:true, message:'Booking created! Check your email for confirmation.', bookingId: bk.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success:false, error:'Server error. Please try again.' });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/bookings/:id — update status / details ────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, meet_link, admin_notes } = req.body;
    const fields=[]; const vals=[];
    if (status)       { fields.push('status=?');       vals.push(status); }
    if (assigned_to)  { fields.push('assigned_to=?');  vals.push(assigned_to); }
    if (meet_link)    { fields.push('meet_link=?');     vals.push(meet_link); }
    if (admin_notes)  { fields.push('admin_notes=?');   vals.push(admin_notes); }
    if (!fields.length) return res.status(400).json({ success:false, error:'Nothing to update' });
    vals.push(id);
    await db.execute(`UPDATE bookings SET ${fields.join(',')} WHERE id=?`, vals);

    // If confirmed, resend confirmation email with meet link
    if (status === 'confirmed' || status === 'cancelled') {
      const [[bk]] = await db.execute(
        `SELECT b.*,c.name as client_name,c.email as client_email FROM bookings b JOIN clients c ON b.client_id=c.id WHERE b.id=?`,
        [id]
      );
      if (bk) {
        if (status === 'confirmed') sendBookingConfirmation({...bk, meet_link}).catch(console.error);
        if (status === 'cancelled') sendCancellationEmail(bk).catch(console.error);
      }
    }
    res.json({ success:true, message:'Booking updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// ── DELETE /api/bookings/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM bookings WHERE id=?', [req.params.id]);
    res.json({ success:true, message:'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
