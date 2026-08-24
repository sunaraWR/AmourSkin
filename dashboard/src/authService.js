/**
 * Authentication Service
 * Centralized auth utilities for the dashboard
 */

// Use Vite env (`VITE_*`) in browser builds; fall back to localhost
const API_SERVER = import.meta?.env?.VITE_API_SERVER || "http://127.0.0.1:5000";
const TOKEN_KEY = "sasvi_jwt_token";
const SESSION_KEY = "sasvi_session";

/**
 * Get stored JWT token
 */
export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Get current user session
 */
export function getSession() {
    try {
        const data = JSON.parse(localStorage.getItem(SESSION_KEY));
        const token = localStorage.getItem(TOKEN_KEY);
        if (data && data.email && token) {
            return { ...data, token };
        }
    } catch {
        /* ignore */
    }
    return null;
}

/**
 * Clear session and token
 */
export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * Make authenticated API call with JWT token
 */
export async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // If 401 Unauthorized, clear session (token expired or invalid)
    if (response.status === 401) {
        clearSession();
        window.location.href = "/"; // Redirect to home/login
        return null;
    }

    return response;
}

/**
 * Update user profile
 */
export async function updateUserProfile(name) {
    const response = await fetchWithAuth(`${API_SERVER}/api/profile`, {
        method: "PUT",
        body: JSON.stringify({ name }),
    });

    if (!response) return null;

    const data = await response.json();
    if (data.success) {
        // Update session with new name
        const session = getSession();
        if (session) {
            const updated = { ...session, name };
            localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        }
        return data.result;
    }

    throw new Error(data.message || "Failed to update profile");
}

/**
 * Get user profile
 */
export async function getUserProfile() {
    const response = await fetchWithAuth(`${API_SERVER}/api/profile`);

    if (!response) return null;

    const data = await response.json();
    if (data.success) {
        return data.result;
    }

    throw new Error(data.message || "Failed to fetch profile");
}

/**
 * Save scan to history
 */
export async function saveScanHistory(scanResult, metadata = {}) {
    const response = await fetchWithAuth(`${API_SERVER}/api/history`, {
        method: "POST",
        body: JSON.stringify({ scanResult, metadata }),
    });

    if (!response) return null;

    const data = await response.json();
    if (data.success) {
        return data.result;
    }

    throw new Error(data.message || "Failed to save scan history");
}

/**
 * Get user scan history
 */
export async function getScanHistory() {
    const session = getSession();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const response = await fetchWithAuth(`${API_SERVER}/api/history/${encodeURIComponent(session.email)}`);

    if (!response) return null;

    const data = await response.json();
    if (data.success) {
        return data.result || [];
    }

    throw new Error(data.message || "Failed to fetch scan history");
}

export default {
    getToken,
    getSession,
    clearSession,
    fetchWithAuth,
    updateUserProfile,
    getUserProfile,
    saveScanHistory,
    getScanHistory,
};
