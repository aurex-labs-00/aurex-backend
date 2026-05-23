-- ═══════════════════════════════════════════════════════════════
--  Aurex Labs — MySQL Database Schema
--  Run this file once to set up your database
--  Command: mysql -u root -p < database.sql
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS aurex_labs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aurex_labs;

-- ── Clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL,
  email       VARCHAR(180)  NOT NULL UNIQUE,
  phone       VARCHAR(30),
  company     VARCHAR(120),
  source      ENUM('website_form','booking_page','manual') DEFAULT 'website_form',
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Bookings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  service       VARCHAR(120),
  meeting_date  DATE NOT NULL,
  meeting_time  TIME NOT NULL,
  duration_min  INT DEFAULT 30,
  status        ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  assigned_to   VARCHAR(80),
  message       TEXT,
  meet_link     VARCHAR(300),
  admin_notes   TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ── Email Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT,
  recipient   VARCHAR(180) NOT NULL,
  subject     VARCHAR(255),
  type        ENUM('confirmation','reminder','cancellation','custom') DEFAULT 'confirmation',
  status      ENUM('sent','failed') DEFAULT 'sent',
  sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

-- ── Blocked Time Slots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_slots (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  block_date  DATE NOT NULL,
  block_time  TIME,
  reason      VARCHAR(200),
  all_day     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes for performance ──────────────────────────────────
CREATE INDEX idx_bookings_date    ON bookings(meeting_date);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_bookings_client  ON bookings(client_id);
CREATE INDEX idx_clients_email    ON clients(email);

-- ── Sample seed data ─────────────────────────────────────────
INSERT INTO clients (name, email, phone, company, source) VALUES
  ('Ahmed Raza',    'ahmed@example.com',  '+92-300-1234567', 'TechCorp PK',    'website_form'),
  ('Sara Khan',     'sara@example.com',   '+92-321-9876543', 'DigitalEdge',    'booking_page'),
  ('Usman Malik',   'usman@example.com',  '+92-333-5551234', 'StartupHub',     'manual');

INSERT INTO bookings (client_id, service, meeting_date, meeting_time, status, assigned_to, message) VALUES
  (1, 'Web Development',    CURDATE(),              '10:00:00', 'confirmed', 'Salahuddin', 'Need a full e-commerce site'),
  (2, 'Custom AI Agents',   DATE_ADD(CURDATE(),INTERVAL 1 DAY), '14:00:00', 'pending',   'Ashar',       'Automate customer support'),
  (3, 'Graphic Design & Branding', DATE_ADD(CURDATE(),INTERVAL 2 DAY), '11:00:00', 'pending', 'Abubakar', 'Full rebrand needed');
