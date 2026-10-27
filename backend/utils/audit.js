// ==============================================================================
// HealthWatch AI: Audit Logging Utility
// Captures user actions for compliance, security, and DBMS viva demonstrations.
// ==============================================================================

const db = require('../db');

/**
 * Inserts an entry into the Audit_Log table.
 * @param {number|null} userId - ID of the user performing the action
 * @param {string} action - Action verb (e.g., 'INSERT', 'UPDATE', 'DELETE', 'ADMIT', 'CLOSE', 'RESOLVE')
 * @param {string} tableName - Target entity or table name
 * @param {number} recordId - Primary key of the affected record
 * @param {string|null} details - Contextual details describing the operation
 */
async function logAudit(userId, action, tableName, recordId, details = null) {
  try {
    await db.query(
      `INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, action, tableName, recordId, details]
    );
  } catch (err) {
    console.error('Audit log insertion error:', err.message);
  }
}

module.exports = { logAudit };
