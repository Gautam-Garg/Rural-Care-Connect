// ==============================================================================
// HealthWatch AI: Authentication Routes
// Routes: POST /api/login, POST /api/logout, GET /api/me
// Security: Parameterized SQL queries, bcrypt password hashing, session state
// ==============================================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

/**
 * POST /api/login
 * Body: { username, password }
 * Response: { success: true, role, user: { user_id, username, role } }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    // Parameterized query: prevent SQL injection
    const [rows] = await db.query(
      'SELECT user_id, username, password_hash, role FROM Users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
      });
    }

    const user = rows[0];

    // Verify password against stored bcrypt hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
      });
    }

    // Store identity in session
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    let redirectUrl = '/public/dashboard.html';
    if (user.role === 'admin') redirectUrl = '/admin/dashboard.html';
    else if (user.role === 'asha') redirectUrl = '/asha/dashboard.html';

    return res.json({
      success: true,
      message: 'Login successful',
      role: user.role,
      redirectUrl,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login.'
    });
  }
});

/**
 * POST /api/logout
 * Destroys session
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Failed to terminate session.'
        });
      }
      res.clearCookie('connect.sid');
      return res.json({
        success: true,
        message: 'Logged out successfully.'
      });
    });
  } else {
    return res.json({
      success: true,
      message: 'No active session.'
    });
  }
});

/**
 * GET /api/me
 * Returns current authenticated user and role
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      success: true,
      authenticated: true,
      role: req.session.user.role,
      user: req.session.user
    });
  }
  return res.status(401).json({
    success: false,
    authenticated: false,
    error: 'Not authenticated.'
  });
});

module.exports = router;
