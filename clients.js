// routes/clients.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT c.*, COUNT(b.id) as total_bookings,
               MAX(b.meeting_date) as last_booking
               FROM clients c LEFT JOIN bookings b ON c.id=b.client_id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)'; const s=`%${search}%`; params.push(s,s,s); }
    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
    const [rows] = await db.execute(sql, params);
    res.json({ success:true, data:rows });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const [[client]] = await db.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
    if (!client) return res.status(404).json({ success:false, error:'Client not found' });
    const [bookings] = await db.execute(
      'SELECT * FROM bookings WHERE client_id=? ORDER BY meeting_date DESC', [req.params.id]
    );
    res.json({ success:true, data:{ ...client, bookings } });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM clients WHERE id=?', [req.params.id]);
    res.json({ success:true, message:'Client deleted' });
  } catch (err) {
    res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
