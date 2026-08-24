/**
 * Authentication Utilities
 * Handles password hashing, JWT token generation, and user database operations
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

function parseJsonValue(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function serializeJsonValue(value) {
    const seen = new WeakSet();
    const replacer = (key, currentValue) => {
        if (typeof currentValue === 'object' && currentValue !== null) {
            if (seen.has(currentValue)) {
                return '[Circular]';
            }
            seen.add(currentValue);
        }
        return currentValue;
    };

    try {
        return JSON.stringify(value, replacer);
    } catch {
        return JSON.stringify(value ? String(value) : null);
    }
}

// MySQL Connection Pool
let pool = null;

async function initializePool() {
    if (pool) return pool;

    pool = await mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DB || 'amourskin',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelayMs: 0,
    });

    return pool;
}

/**
 * Initialize database with required tables
 */
async function initializeDatabase() {
    const connection = await (await initializePool()).getConnection();
    try {
        // Create users table if not exists
        await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

        // Create scan_history table if not exists
        await connection.query(`
      CREATE TABLE IF NOT EXISTS scan_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scan_result JSON NOT NULL,
        summary JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id),
        INDEX idx_user_email (user_email)
      )
    `);

        // Create products table if not exists
        await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        type VARCHAR(50),
        brand VARCHAR(255),
        price DECIMAL(10, 2),
        texture VARCHAR(50),
        attributes JSON,
        environmental_targets JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_type (type)
      )
    `);

        console.log('Database tables initialized successfully');
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
        throw err;
    } finally {
        connection.release();
    }
}

/**
 * Hash a password
 */
async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(userId, email) {
    return jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Register new user
 */
async function registerUser(email, password, name) {
    const conn = await (await initializePool()).getConnection();
    try {
        // Check if user already exists
        const [existing] = await conn.query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existing.length > 0) {
            throw new Error('User already exists with this email');
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Insert user
        const [result] = await conn.query(
            'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
            [email.toLowerCase(), name, passwordHash]
        );

        return {
            id: result.insertId,
            email: email.toLowerCase(),
            name,
            token: generateToken(result.insertId, email.toLowerCase()),
        };
    } finally {
        conn.release();
    }
}

/**
 * Authenticate user (login)
 */
async function authenticateUser(email, password) {
    const conn = await (await initializePool()).getConnection();
    try {
        const [users] = await conn.query(
            'SELECT id, email, name, password_hash FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            throw new Error('Invalid email or password');
        }

        const user = users[0];
        const passwordMatch = await verifyPassword(password, user.password_hash);

        if (!passwordMatch) {
            throw new Error('Invalid email or password');
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            token: generateToken(user.id, user.email),
        };
    } finally {
        conn.release();
    }
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
    const conn = await (await initializePool()).getConnection();
    try {
        const [users] = await conn.query(
            'SELECT id, email, name, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return null;
        }

        return users[0];
    } finally {
        conn.release();
    }
}

/**
 * Update user profile
 */
async function updateUserProfile(userId, name) {
    const conn = await (await initializePool()).getConnection();
    try {
        await conn.query(
            'UPDATE users SET name = ? WHERE id = ?',
            [name, userId]
        );

        return getUserById(userId);
    } finally {
        conn.release();
    }
}

/**
 * Save scan to history
 */
async function saveScanHistory(userId, userEmail, scanResult, metadata = {}) {
    const conn = await (await initializePool()).getConnection();
    try {
        const [result] = await conn.query(
            'INSERT INTO scan_history (user_id, user_email, scan_result, summary) VALUES (?, ?, ?, ?)',
            [userId, userEmail, serializeJsonValue(scanResult), serializeJsonValue(metadata)]
        );

        return {
            id: result.insertId,
            userId,
            userEmail,
            scanDate: new Date(),
            scanResult,
            summary: metadata,
        };
    } finally {
        conn.release();
    }
}

/**
 * Get user scan history
 */
async function getUserScanHistory(userId) {
    const conn = await (await initializePool()).getConnection();
    try {
        // Note: ORDER BY on large JSON columns can trigger ER_OUT_OF_SORTMEMORY.
        // Fetch without ORDER BY and sort in JS to avoid MySQL sort buffer issues.
        const [scans] = await conn.query(
            'SELECT id, user_id, user_email, scan_date, scan_result, summary FROM scan_history WHERE user_id = ? LIMIT 50',
            [userId]
        );

        return scans
            .map(scan => ({
                id: scan.id,
                userId: scan.user_id,
                userEmail: scan.user_email,
                scanDate: scan.scan_date,
                createdAt: scan.scan_date,   // frontend expects createdAt
                scanResult: parseJsonValue(scan.scan_result) ?? {},
                summary: parseJsonValue(scan.summary) ?? {},
            }))
            .sort((a, b) => new Date(b.scanDate) - new Date(a.scanDate));
    } finally {
        conn.release();
    }
}

module.exports = {
    initializePool,
    initializeDatabase,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    registerUser,
    authenticateUser,
    getUserById,
    updateUserProfile,
    saveScanHistory,
    getUserScanHistory,
    parseJsonValue,
    serializeJsonValue,
    JWT_SECRET,
};
