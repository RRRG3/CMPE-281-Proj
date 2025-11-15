import { verifyAccessToken } from '../auth/utils.js';

/**
 * Middleware to authenticate requests using JWT
 * Extracts Bearer token from Authorization header and verifies it
 * Attaches decoded user info to req.user
 */
export function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No authorization header provided'
      });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Invalid authorization format. Use: Bearer <token>'
      });
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify the token
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        message: 'Your session has expired. Please login again.'
      });
    } else if (error.message === 'Invalid token') {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        message: 'Invalid authentication token'
      });
    }

    return res.status(401).json({ 
      error: 'Invalid or expired token',
      message: 'Authentication failed'
    });
  }
}

/**
 * Middleware factory to require specific roles
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} - Express middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  
  next();
}
