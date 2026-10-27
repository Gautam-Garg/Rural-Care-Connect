// ==============================================================================
// Rural Care Connect: Authentication & RBAC Middleware
// Role-Based Access Control (RBAC): Enforced on the backend on every route.
// Supported roles: 'admin', 'public', 'asha'
// ==============================================================================

/**
 * Ensures the client has an active authenticated session.
 */
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in.'
  });
}

/**
 * Ensures the logged-in user has the 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin role required for this action.'
    });
  }

  next();
}

/**
 * Ensures the logged-in user has the 'asha' role.
 */
function requireAsha(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  if (req.session.user.role !== 'asha') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: ASHA worker role required for this action.'
    });
  }

  next();
}

/**
 * Allows either Admin or ASHA worker
 */
function requireAdminOrAsha(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  if (req.session.user.role !== 'admin' && req.session.user.role !== 'asha') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Administrative or ASHA role required for this action.'
    });
  }

  next();
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireAsha,
  requireAdminOrAsha
};
