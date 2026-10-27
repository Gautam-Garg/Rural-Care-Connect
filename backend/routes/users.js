// ==============================================================================
// HealthWatch AI: User Management Routes (Admin Only)
// DBMS Concepts: Authentication, Role-Based Access Control, Security Auditing
// ==============================================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/users
 * Admin only: List all users in system
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    let sql = 'SELECT user_id, username, role, created_at FROM Users WHERE 1=1';
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC, user_id DESC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve users.'
    });
  }
});

/**
 * POST /api/users
 * Admin only: Create a new system user
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'public' } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    if (!['admin', 'public'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "public".'
      });
    }

    // Check duplicate
    const [existing] = await db.query('SELECT user_id FROM Users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A user with this username already exists.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const [result] = await db.query(
      'INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)',
      [username.trim(), password_hash, role]
    );

    const newUserId = result.insertId;
    await logAudit(
      req.session.user.user_id,
      'INSERT',
      'Users',
      newUserId,
      `Created user account "${username.trim()}" with role "${role}"`
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user_id: newUserId
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user.'
    });
  }
});

/**
 * PUT /api/users/:id
 * Admin only: Update username, role, or reset password
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { username, password, role } = req.body;

    const [existing] = await db.query('SELECT user_id, username, role FROM Users WHERE user_id = ?', [targetUserId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    const curr = existing[0];
    const newUsername = username ? username.trim() : curr.username;
    const newRole = role || curr.role;

    if (!['admin', 'public'].includes(newRole)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "public".'
      });
    }

    // Check duplicate username if changed
    if (newUsername !== curr.username) {
      const [dup] = await db.query('SELECT user_id FROM Users WHERE username = ? AND user_id != ?', [newUsername, targetUserId]);
      if (dup.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Username already in use.'
        });
      }
    }

    if (password && password.trim().length > 0) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password.trim(), saltRounds);
      await db.query(
        'UPDATE Users SET username = ?, password_hash = ?, role = ? WHERE user_id = ?',
        [newUsername, password_hash, newRole, targetUserId]
      );
    } else {
      await db.query(
        'UPDATE Users SET username = ?, role = ? WHERE user_id = ?',
        [newUsername, newRole, targetUserId]
      );
    }

    await logAudit(
      req.session.user.user_id,
      'UPDATE',
      'Users',
      targetUserId,
      `Updated user #${targetUserId} ("${newUsername}", Role: "${newRole}"${password ? ', Password reset' : ''})`
    );

    return res.json({
      success: true,
      message: 'User updated successfully.'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user.'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Admin only: Delete user account (cannot delete oneself)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);

    if (req.session.user.user_id === targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own active admin account.'
      });
    }

    const [existing] = await db.query('SELECT username FROM Users WHERE user_id = ?', [targetUserId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    const targetUsername = existing[0].username;
    await db.query('DELETE FROM Users WHERE user_id = ?', [targetUserId]);

    await logAudit(
      req.session.user.user_id,
      'DELETE',
      'Users',
      targetUserId,
      `Deleted user account "${targetUsername}"`
    );

    return res.json({
      success: true,
      message: `User "${targetUsername}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user.'
    });
  }
});

module.exports = router;
