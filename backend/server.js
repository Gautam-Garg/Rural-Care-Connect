// ==============================================================================
// Rural Care Connect: Express Backend Server
// Tagline: "Healthcare access for every village."
// Problem Statement: Rural Healthcare Access (SDG 3, SDG 9, SDG 10)
// Tech Stack: Node.js + Express + mysql2 + bcryptjs + express-session
// Safety: Connects only to 'healthwatch', no destructive operations.
// ==============================================================================

const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const db = require('./db');
const authRoutes = require('./routes/auth');
const phcRoutes = require('./routes/phcs');
const hospitalRoutes = require('./routes/hospitals'); // backward-compatibility alias
const diseaseRoutes = require('./routes/diseases');
const caseRoutes = require('./routes/cases');
const alertRoutes = require('./routes/alerts');
const medicineRoutes = require('./routes/medicines');
const vaccinationRoutes = require('./routes/vaccination');
const vaccinationDriveRoutes = require('./routes/vaccination_drives');
const geographyRoutes = require('./routes/geography');
const serviceRoutes = require('./routes/services');
const ashaRoutes = require('./routes/asha');
const complaintRoutes = require('./routes/complaints');
const auditRoutes = require('./routes/audit');
const statsRoutes = require('./routes/stats');
const weatherRoutes = require('./routes/weather');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Middleware: Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Session Management
app.use(session({
  name: 'ruralcare_sid',
  secret: process.env.SESSION_SECRET || 'ruralcare_connect_session_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set to true if running with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Favicon route (ensures /favicon.ico returns 200 with image/x-icon)
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(frontendPath, 'favicon.ico'));
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.testConnection();
  return res.json({
    project: 'Rural Care Connect',
    tagline: 'Healthcare access for every village.',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/phcs', phcRoutes);
app.use('/api/hospitals', hospitalRoutes); // backward-compatible alias
app.use('/api/geography', geographyRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/vaccination-drives', vaccinationDriveRoutes);
app.use('/api/asha', ashaRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/vaccination', vaccinationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cost', require('./routes/cost'));
app.use('/api/medicine-fallback', require('./routes/medicine_fallback'));
app.use('/api/feedback', require('./routes/feedback'));

// Fallback for root route: redirect based on session role
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard.html');
    }
    if (req.session.user.role === 'asha') {
      return res.redirect('/asha/dashboard.html');
    }
    return res.redirect('/public/dashboard.html');
  }
  return res.redirect('/login.html');
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` Rural Care Connect Server running on port ${PORT}`);
    console.log(` Tagline: "Healthcare access for every village."`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
