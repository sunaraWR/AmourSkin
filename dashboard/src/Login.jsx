import { useState, useEffect, useCallback } from "react";
import "./Login.css";
import heroImg from "./assets/hero_skincare.png";

// Use Vite env (`VITE_*`) in browser builds; fall back to localhost
const API_SERVER = import.meta?.env?.VITE_API_SERVER || "http://127.0.0.1:5000";

const LeafIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

/* ── Session & Token Management ── */
const SESSION_KEY = "sasvi_session";
const TOKEN_KEY = "sasvi_jwt_token";

/**
 * Store session with JWT token (NOT password)
 */
function setSession(user, token, remember) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    remember,
    ts: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Get current session
 */
function getSession() {
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
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Get JWT token for API calls
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Export for use in other components (consolidated at file end)
 */

/* ── Password Strength ── */
function getStrength(pw) {
  if (!pw) return { level: 0, label: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", cls: "weak" };
  if (score <= 2) return { level: 2, label: "Fair", cls: "fair" };
  if (score <= 3) return { level: 3, label: "Good", cls: "good" };
  return { level: 4, label: "Strong", cls: "strong" };
}

/* ── SVG Icons ── */
const Icons = {
  scan: (
    <svg viewBox="0 0 24 24">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
  mail: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  eyeOpen: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeClosed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
};

/* ── Floating Particles ── */
function Particles() {
  return (
    <div className="login-particles">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="login-particle" />
      ))}
    </div>
  );
}

/* ── Login Page Component ── */
export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error'|'success', text }

  const strength = tab === "signup" ? getStrength(password) : null;

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setName("");
    setShowPw(false);
    setMessage(null);
  }, []);

  function switchTab(t) {
    setTab(t);
    resetForm();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }

    if (tab === "signup" && !name.trim()) {
      setMessage({ type: "error", text: "Please enter your name." });
      return;
    }

    if (tab === "signup" && password.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }

    setLoading(true);

    try {
      const endpoint = tab === "signup" ? "/api/register" : "/api/login";
      const payload = {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      };

      if (tab === "signup") {
        payload.name = name.trim();
      }

      const response = await fetch(`${API_SERVER}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        setLoading(false);
        setMessage({
          type: "error",
          text: data.message || "Authentication failed. Please try again.",
        });
        return;
      }

      const user = {
        id: data.result.id,
        email: data.result.email,
        name: data.result.name,
      };

      setSession(user, data.result.token, remember);
      setLoading(false);
      setMessage({
        type: "success",
        text:
          tab === "signup"
            ? "Account created! Redirecting…"
            : "Welcome back! Redirecting…",
      });

      setTimeout(() => onLogin(user), 600);
    } catch (error) {
      setLoading(false);
      setMessage({
        type: "error",
        text: error.message || "Network error. Please check your connection.",
      });
    }
  }

  return (
    <div className="login-page">
      {/* ── LEFT PANEL — Editorial image ── */}
      <div className="login-left">
        <img
          src={heroImg}
          alt="Luxurious skincare"
          className="login-left-img"
        />
        <div className="login-left-overlay" />
        {/* Brand */}
        <div className="login-left-brand">
          <div className="login-left-brand-icon">
            <LeafIcon />
          </div>
          <span className="login-left-brand-name">AmourSkin</span>
        </div>
        {/* Editorial copy */}
        <div className="login-left-copy">
          <p className="login-left-quote">
            Your skin tells a story.
            <br />
            Let <span>AI reveal</span> every chapter.
          </p>
          <div className="login-left-pills">
            <span className="login-left-pill">
              <span className="login-left-pill-dot" />
              Instant AI Scan
            </span>
            <span className="login-left-pill">
              <span className="login-left-pill-dot" />
              Personalised Results
            </span>
            <span className="login-left-pill">
              <span className="login-left-pill-dot" />
              Privacy First
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ── */}
      <div className="login-right">
        <div className="login-card">
          {/* Mobile-only brand */}
          <div className="login-logo-container">
            <div className="login-logo-icon">{Icons.scan}</div>
            <div className="login-brand-name">AmourSkin AI</div>
            <div className="login-subtitle">
              Facial Scan Intelligence Platform
            </div>
          </div>

          {/* Heading */}
          <div className="login-heading">
            <div className="login-heading-title">
              {tab === "signin" ? (
                <>
                  Welcome <span>back</span>
                </>
              ) : (
                <>
                  Create your <span>account</span>
                </>
              )}
            </div>
            <div className="login-heading-sub">
              {tab === "signin"
                ? "Sign in to access your personalised skin dashboard."
                : "Join thousands discovering their perfect skincare routine."}
            </div>
          </div>

          {/* Tabs */}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${tab === "signin" ? "login-tab--active" : ""}`}
              onClick={() => switchTab("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`login-tab ${tab === "signup" ? "login-tab--active" : ""}`}
              onClick={() => switchTab("signup")}
            >
              Create Account
            </button>
          </div>

          {/* Messages */}
          {message && (
            <div className={`login-message login-message--${message.type}`}>
              {message.type === "error" ? Icons.error : Icons.check}
              {message.text}
            </div>
          )}

          {/* Form */}
          <form
            className="login-form"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            {tab === "signup" && (
              <div className="login-field">
                <label className="login-label" htmlFor="login-name">
                  Full Name
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.user}</span>
                  <input
                    id="login-name"
                    className="login-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                  <div className="login-input-focus-ring" />
                </div>
              </div>
            )}

            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Email Address
              </label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">{Icons.mail}</span>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <div className="login-input-focus-ring" />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">{Icons.lock}</span>
                <input
                  id="login-password"
                  className="login-input"
                  type={showPw ? "text" : "password"}
                  placeholder={
                    tab === "signup"
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    tab === "signup" ? "new-password" : "current-password"
                  }
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? Icons.eyeClosed : Icons.eyeOpen}
                </button>
                <div className="login-input-focus-ring" />
              </div>
              {tab === "signup" && password && (
                <>
                  <div className="login-strength">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`login-strength-bar ${i <= strength.level ? `login-strength-bar--filled login-strength--${strength.cls}` : ""}`}
                      />
                    ))}
                  </div>
                  <div
                    className={`login-strength-text login-strength-text--${strength.cls}`}
                  >
                    {strength.label}
                  </div>
                </>
              )}
            </div>

            {tab === "signin" && (
              <div className="login-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    className="login-checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="login-remember-text">Remember me</span>
                </label>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() =>
                    setMessage({
                      type: "error",
                      text: "Password reset is not available in this demo.",
                    })
                  }
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-content">
                {loading && <span className="login-spinner" />}
                {loading
                  ? tab === "signup"
                    ? "Creating Account…"
                    : "Signing In…"
                  : tab === "signup"
                    ? "Create Account"
                    : "Sign In"}
                {!loading && <span className="login-submit-arrow">→</span>}
              </span>
            </button>

            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">or continue with</span>
              <div className="login-divider-line" />
            </div>

            <div className="login-social-row">
              <button
                type="button"
                className="login-social-btn"
                onClick={() =>
                  setMessage({
                    type: "error",
                    text: "Social login is not available in this demo.",
                  })
                }
              >
                {Icons.google}
                Google
              </button>
              <button
                type="button"
                className="login-social-btn"
                onClick={() =>
                  setMessage({
                    type: "error",
                    text: "Social login is not available in this demo.",
                  })
                }
              >
                {Icons.github}
                GitHub
              </button>
            </div>
          </form>

          <div className="login-footer">
            <span className="login-footer-text">
              {tab === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
            </span>
            <button
              type="button"
              className="login-footer-link"
              onClick={() => switchTab(tab === "signin" ? "signup" : "signin")}
            >
              {tab === "signin" ? "Create one →" : "Sign in →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── User Bar (for when logged in) ── */
export function UserBar({ user, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileUser, setProfileUser] = useState(user);

  useEffect(() => {
    if (!profileOpen || !user?.email) {
      setHistory([]);
      setHistoryError("");
      return;
    }

    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const res = await fetchWithAuth(
          `${API_SERVER}/api/history/${encodeURIComponent(user.email)}`,
        );
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) {
          setHistory(Array.isArray(data.result) ? data.result : []);
        } else if (!cancelled) {
          setHistory([]);
          setHistoryError(data?.message || "Unable to load your scan history.");
        }
      } catch (error) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(
            error?.message || "Unable to load your scan history.",
          );
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [profileOpen, user?.email]);

  useEffect(() => {
    setProfileUser(user);
    setProfileName(user?.name || "");
  }, [user]);

  if (!user) return null;
  const initials = (profileUser?.name || profileUser?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleProfileSave(event) {
    event.preventDefault();
    const trimmedName = profileName.trim();
    if (!trimmedName) return;

    updateStoredProfile(user.email, trimmedName);
    const updatedUser = { ...profileUser, name: trimmedName };
    setProfileUser(updatedUser);
    setIsEditingProfile(false);
    const session = JSON.parse(localStorage.getItem("sasvi_session") || "null");
    if (session?.email) {
      session.name = trimmedName;
      localStorage.setItem("sasvi_session", JSON.stringify(session));
    }
  }

  return (
    <div className="login-user-bar">
      <span className="login-user-bar-brand">AmourSkin AI</span>
      <div className="login-user-info">
        <button
          type="button"
          className="login-profile-trigger"
          onClick={() => setProfileOpen((value) => !value)}
          aria-expanded={profileOpen}
        >
          <div className="login-user-avatar">{initials}</div>
          <span className="login-user-name">
            {profileUser?.name || profileUser?.email}
          </span>
        </button>
      </div>
      <button
        type="button"
        className="login-logout-btn"
        onClick={() => {
          clearSession();
          onLogout();
        }}
      >
        Sign Out
      </button>

      {profileOpen ? (
        <div
          className="login-profile-overlay"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="login-profile-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="login-profile-header">
              <div>
                <div className="login-profile-title">My Profile</div>
                <div className="login-profile-subtitle">
                  View your account and scan history in one place.
                </div>
              </div>
              <button
                type="button"
                className="login-profile-close"
                onClick={() => {
                  setIsEditingProfile(false);
                  setProfileOpen(false);
                }}
                aria-label="Close profile"
              >
                × Close
              </button>
            </div>

            <div className="login-profile-card">
              <div className="login-profile-avatar">{initials}</div>
              <div>
                <div className="login-profile-name">
                  {profileUser?.name || "User"}
                </div>
                <div className="login-profile-email">{profileUser?.email}</div>
              </div>
            </div>

            <div className="login-profile-actions">
              <button
                type="button"
                className="login-profile-action-btn"
                onClick={() => {
                  setProfileName(profileUser?.name || "");
                  setIsEditingProfile((value) => !value);
                }}
              >
                {isEditingProfile ? "Cancel Edit" : "Edit Profile"}
              </button>
              <button
                type="button"
                className="login-profile-action-btn login-profile-action-btn--secondary"
                onClick={() => {
                  setIsEditingProfile(false);
                  setProfileOpen(false);
                }}
              >
                Close
              </button>
            </div>

            {isEditingProfile ? (
              <form
                className="login-profile-edit-form"
                onSubmit={handleProfileSave}
              >
                <label className="login-profile-field">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Enter your name"
                  />
                </label>
                <div className="login-profile-edit-actions">
                  <button type="submit" className="login-profile-action-btn">
                    Save Profile
                  </button>
                </div>
              </form>
            ) : null}

            <div className="login-profile-history">
              <div className="login-profile-history-header">
                <h4>Scan History</h4>
                <span>
                  {history.length} {history.length === 1 ? "scan" : "scans"}
                </span>
              </div>

              {historyLoading ? (
                <div className="login-profile-empty">
                  Loading your scan history…
                </div>
              ) : historyError ? (
                <div className="login-profile-empty">{historyError}</div>
              ) : !history.length ? (
                <div className="login-profile-empty">
                  No scans yet. Upload an image and your results will appear
                  here.
                </div>
              ) : (
                <div className="login-history-list">
                  {history.map((item) => {
                    const scanResult = item.scanResult || {};
                    const summary = item.summary || {};
                    const score = (() => {
                      const directScore =
                        summary.overallScore ??
                        scanResult.overall_score ??
                        scanResult.overallScore ??
                        scanResult.score;
                      if (
                        typeof directScore === "number" &&
                        Number.isFinite(directScore)
                      ) {
                        return Math.round(directScore);
                      }
                      if (
                        typeof directScore === "string" &&
                        directScore.trim()
                      ) {
                        const parsed = Number(directScore);
                        if (Number.isFinite(parsed)) return Math.round(parsed);
                      }

                      const metrics = [
                        summary.blurScore,
                        summary.brightnessScore,
                        summary.pigmentationScore,
                        summary.wrinkleScore,
                        summary.textureScore,
                        summary.contrastScore,
                        summary.rednessScore,
                        summary.shineScore,
                        summary.underEyeShadowScore,
                        summary.poreScore,
                        summary.symmetryScore,
                        scanResult.blur_score,
                        scanResult.brightness_score,
                        scanResult.pigmentation_score,
                        scanResult.wrinkle_score,
                        scanResult.texture_score,
                        scanResult.contrast_score,
                        scanResult.redness_score,
                        scanResult.shine_score,
                        scanResult.under_eye_shadow_score,
                        scanResult.pore_score,
                        scanResult.symmetry_score,
                      ].filter(
                        (value) =>
                          typeof value === "number" && Number.isFinite(value),
                      );

                      if (metrics.length) {
                        const average =
                          metrics.reduce((sum, value) => sum + value, 0) /
                          metrics.length;
                        return Math.round(average);
                      }

                      const qualityText = String(
                        summary.imageQuality ?? scanResult.image_quality ?? "",
                      ).toLowerCase();
                      if (qualityText.includes("good")) return 82;
                      if (
                        qualityText.includes("fair") ||
                        qualityText.includes("moderate") ||
                        qualityText.includes("intermediate")
                      )
                        return 70;
                      if (qualityText.includes("poor")) return 50;
                      return 75;
                    })();
                    const skinTone =
                      summary.skinTone ??
                      scanResult.skin_tone ??
                      scanResult.skinTone ??
                      "—";
                    const undertone =
                      summary.undertone ?? scanResult.undertone ?? "—";
                    const message =
                      summary.message ??
                      scanResult.message ??
                      (scanResult.image_quality
                        ? `Image quality: ${scanResult.image_quality}`
                        : "—");
                    const quality =
                      summary.imageQuality ?? scanResult.image_quality ?? "—";
                    const blur =
                      summary.blurScore ?? scanResult.blur_score ?? "—";
                    const brightness =
                      summary.brightnessScore ??
                      scanResult.brightness_score ??
                      "—";
                    const texture =
                      summary.textureScore ?? scanResult.texture_score ?? "—";
                    const symmetry =
                      summary.symmetryScore ?? scanResult.symmetry_score ?? "—";

                    return (
                      <div
                        className="login-history-item"
                        key={item._id || item.createdAt}
                      >
                        <div className="login-history-top">
                          <div className="login-history-date">
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                          <div className="login-history-score">
                            <div className="login-history-score-value">
                              {score}/100
                            </div>
                            <div className="login-history-score-bar">
                              <span
                                style={{
                                  width: `${Math.min(100, Math.max(0, Number(score) || 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="login-history-summary">
                          <strong>Score:</strong> {score}
                        </div>
                        <div className="login-history-summary">
                          <strong>Skin tone:</strong> {skinTone}
                        </div>
                        <div className="login-history-summary">
                          <strong>Undertone:</strong> {undertone}
                        </div>
                        <div className="login-history-summary">
                          <strong>Image quality:</strong> {quality}
                        </div>
                        <div className="login-history-summary">
                          <strong>Blur:</strong> {blur} ·{" "}
                          <strong>Brightness:</strong> {brightness}
                        </div>
                        <div className="login-history-summary">
                          <strong>Texture:</strong> {texture} ·{" "}
                          <strong>Symmetry:</strong> {symmetry}
                        </div>
                        <div className="login-history-summary">
                          <strong>Message:</strong> {message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* Re-export session helpers for App.jsx */
export { getSession, clearSession, getToken };
