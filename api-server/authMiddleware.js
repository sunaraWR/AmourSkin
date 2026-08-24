/**
 * Authentication Middleware
 * Protects routes that require user authentication
 */

const { verifyToken } = require('./authUtils');

/**
 * Middleware to verify JWT token in Authorization header
 */
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Missing authorization header',
            });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authorization header format (expected: Bearer <token>)',
            });
        }

        const token = parts[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token',
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Authentication error',
        });
    }
}

module.exports = {
    authMiddleware,
};
