import { useMemo, useState, useEffect, useRef } from "react";
import "./App.css";
import EnvironmentalWidget from "./EnvironmentalWidget";
import ProductRecommendations from "./ProductRecommendations";
import LoginPage, { getSession, clearSession } from "./Login";
import ScanResults from "./ScanResults";
import HomePage from "./HomePage";
import ProfilePage from "./ProfilePage";
import { saveScanHistory } from "./authService";

function App() {
  const [stage, setStage] = useState("home"); // home | login | dashboard
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
      setStage("dashboard");
    } else {
      setUser(null);
      // Stay on home until user clicks CTA
    }
  }, []);

  function handleGetStarted() {
    if (user) {
      setStage("dashboard");
    } else {
      setStage("login");
    }
  }

  function handleLogin(u) {
    setUser(u);
    setStage("dashboard");
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setStage("home");
  }

  function handleGoHome() {
    setStage("home");
  }
  function handleGoToProfile() {
    setStage("profile");
  }
  function handleGoToDashboard() {
    if (!user) {
      setStage("login");
    } else {
      setStage("dashboard");
    }
  }

  // Show nothing while checking session
  if (user === undefined) return null;

  // Landing page
  if (stage === "home")
    return (
      <HomePage
        onGetStarted={handleGetStarted}
        user={user}
        onLogout={handleLogout}
      />
    );

  // Login / register
  if (stage === "login") return <LoginPage onLogin={handleLogin} />;

  // Profile page
  if (stage === "profile")
    return (
      <ProfilePage
        user={user}
        onLogout={handleLogout}
        onGoHome={handleGoHome}
        onGoToDashboard={handleGoToDashboard}
      />
    );

  // Guard: dashboard requires authentication
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onGoHome={handleGoHome}
      onGoToProfile={handleGoToProfile}
    />
  );
}

/* ── Section Icons (inline SVGs) ── */
const SectionIcon = ({ children }) => (
  <span className="section-icon">{children}</span>
);

const Icons = {
  upload: (
    <SectionIcon>
      <svg viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </SectionIcon>
  ),
  results: (
    <SectionIcon>
      <svg viewBox="0 0 24 24">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    </SectionIcon>
  ),
  environment: (
    <SectionIcon>
      <svg viewBox="0 0 24 24">
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
      </svg>
    </SectionIcon>
  ),
  products: (
    <SectionIcon>
      <svg viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    </SectionIcon>
  ),
  layers: (
    <SectionIcon>
      <svg viewBox="0 0 24 24">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    </SectionIcon>
  ),
};

/* ── Leaf Icon for Dashboard Nav ── */
const LeafNavIcon = () => (
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

/* ── Dashboard Top Nav (mirrors hp-nav) ── */
function DashboardNav({ user, onLogout, onGoHome, onGoToProfile }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function scrollTo(id) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <nav
        className={`hp-nav hp-nav--solid${scrolled ? " hp-nav--scrolled" : ""}`}
      >
        {/* Brand — click to go home */}
        <div
          className="hp-nav-brand"
          style={{ cursor: "pointer" }}
          onClick={onGoHome}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onGoHome()}
        >
          <div className="hp-nav-brand-icon">
            <LeafNavIcon />
          </div>
          <span className="hp-nav-brand-name">AmourSkin</span>
        </div>

        {/* Section Links */}
        <ul className="hp-nav-links">
          <li>
            <button
              type="button"
              className="dash-nav-link"
              onClick={() => scrollTo("dash-upload")}
            >
              Analyse
            </button>
          </li>
          <li>
            <button
              type="button"
              className="dash-nav-link"
              onClick={() => scrollTo("dash-results")}
            >
              Results
            </button>
          </li>
          <li>
            <button
              type="button"
              className="dash-nav-link"
              onClick={() => scrollTo("dash-products")}
            >
              Products
            </button>
          </li>
          <li>
            <button
              type="button"
              className="dash-nav-link"
              onClick={() => scrollTo("dash-environment")}
            >
              Exposome
            </button>
          </li>
        </ul>

        {/* Profile + Logout */}
        <div className="dash-nav-right">
          <button
            id="dash-profile-btn"
            type="button"
            className="dash-nav-avatar"
            onClick={onGoToProfile}
            title={user?.name || user?.email}
            aria-label="Open profile"
          >
            {initials}
          </button>
          <button
            id="dash-logout-btn"
            type="button"
            className="dash-nav-logout"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}

function Dashboard({ user, onLogout, onGoHome, onGoToProfile }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [layers, setLayers] = useState([]);
  const [inputMode, setInputMode] = useState("upload");
  const [detectionSummary, setDetectionSummary] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const cameraVideoRef = useRef(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const apiUrl = useMemo(() => {
    // Can be changed later to env var or proxied
    return "http://127.0.0.1:5001/api/scan/opencv";
  }, []);

  async function runScan(nextFile) {
    setError("");
    setResult(null);
    setLayers([]);
    setDetectionSummary("");

    if (!nextFile) {
      setError("Please choose an image first.");
      return;
    }

    const form = new FormData();
    form.append("image", nextFile);

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}?layers=1`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      if (!data?.success) {
        throw new Error(data?.message || "Scan failed");
      }

      if (data?.result?.image_quality && data.result.image_quality !== "Good") {
        throw new Error(
          data.result.message ||
            `Image quality: ${data.result.image_quality}. Please retake the photo in better light.`,
        );
      }

      setResult(data.result);
      setLayers(Array.isArray(data?.result?.layers) ? data.result.layers : []);
      const age = data?.result?.age;
      const gender = data?.result?.gender;
      const skinType = data?.result?.skin_type;
      if (age !== undefined && age !== null && age !== "") {
        setDetectionSummary(
          `${gender || "unknown"} • ${age} yrs${skinType ? ` • ${skinType}` : ""}`,
        );
      } else if (gender) {
        setDetectionSummary(skinType ? `${gender} • ${skinType}` : gender);
      } else if (skinType) {
        setDetectionSummary(skinType);
      }

      try {
        await saveScanHistory(data.result, { source: "dashboard-upload" });
      } catch {
        // history save is optional; continue rendering results
      }
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onUploadAndScan(e) {
    e.preventDefault();
    await runScan(file);
  }

  function switchInputMode(mode) {
    if (mode === "upload" && cameraActive) {
      stopCamera();
    }
    setInputMode(mode);
  }

  function onPickFile(nextFile) {
    setError("");
    setResult(null);
    setDetectionSummary("");

    if (!nextFile) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setFile(nextFile);
    const url = URL.createObjectURL(nextFile);
    setPreviewUrl(url);
  }

  async function startCamera() {
    setError("");
    setCameraReady(false);
    try {
      cameraStream?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
      setCameraActive(true);
      setCameraReady(true);
    } catch {
      setCameraActive(false);
      setCameraReady(false);
      setError("Camera access was denied or unavailable.");
    }
  }

  async function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCameraActive(false);
    setCameraReady(false);
  }

  async function captureFromCamera() {
    if (!cameraVideoRef.current) {
      setError("Camera preview is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cameraVideoRef.current.videoWidth || 640;
    canvas.height = cameraVideoRef.current.videoHeight || 480;
    const context = canvas.getContext("2d");
    context.drawImage(
      cameraVideoRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Unable to capture photo from camera.");
        return;
      }
      const nextFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onPickFile(nextFile);
      runScan(nextFile);
    }, "image/jpeg");
  }

  useEffect(() => {
    if (!file) return;
    void runScan(file);
  }, [file]);

  useEffect(() => {
    async function loadCameraDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput",
        );
        setCameraDevices(videoDevices);
        if (!selectedCameraId && videoDevices[0]) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch {
        setCameraDevices([]);
      }
    }

    loadCameraDevices();
  }, [selectedCameraId]);

  useEffect(() => {
    if (!cameraVideoRef.current || !cameraStream) {
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
      return;
    }

    cameraVideoRef.current.srcObject = cameraStream;
    cameraVideoRef.current.play().catch(() => {});

    return () => {
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  // Get user initials for welcome banner
  const initials = (user.name || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstName = (user.name || "").split(" ")[0] || user.email || "User";

  return (
    <>
      <DashboardNav
        user={user}
        onLogout={onLogout}
        onGoHome={onGoHome}
        onGoToProfile={onGoToProfile}
      />
      <div className="page" style={{ paddingTop: 72 }}>
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-avatar">{initials}</div>
          <div className="welcome-text">
            <h3>Welcome back, {firstName} 👋</h3>
            <p>
              Upload a facial scan to get AI-powered skin analysis and product
              recommendations.
            </p>
          </div>
        </div>

        <header className="header" style={{ marginBottom: "32px" }}>
          <div>
            <div className="kicker">AI-Powered Analysis</div>
            <h1 className="title">Facial Scan Dashboard</h1>
            <div className="sub">
              Upload a single clear front-facing face image to receive a
              detailed skin analysis and personalized recommendations.
            </div>
          </div>
        </header>

        <section id="dash-upload" className="card card--upload">
          <h2>{Icons.upload} Upload Image</h2>
          <div
            className="mode-switch"
            role="tablist"
            aria-label="Input mode selector"
          >
            <button
              type="button"
              className={`mode-pill ${inputMode === "upload" ? "active" : ""}`}
              onClick={() => switchInputMode("upload")}
            >
              Upload Image
            </button>
            <button
              type="button"
              className={`mode-pill ${inputMode === "capture" ? "active" : ""}`}
              onClick={() => switchInputMode("capture")}
            >
              Capture Image
            </button>
          </div>

          {inputMode === "upload" ? (
            <form onSubmit={onUploadAndScan} className="form">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <button type="submit" disabled={loading || !file}>
                {loading ? "Scanning…" : "Upload & Scan"}
              </button>
            </form>
          ) : (
            <div className="capture-row">
              <div className="camera-panel">
                <div className="camera-header">
                  <strong>Live camera</strong>
                  <span>{cameraActive ? "Camera on" : "Camera off"}</span>
                </div>
                {cameraDevices.length ? (
                  <select
                    className="camera-select"
                    value={selectedCameraId}
                    onChange={(event) =>
                      setSelectedCameraId(event.target.value)
                    }
                  >
                    {cameraDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Camera ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                ) : null}
                <video
                  ref={cameraVideoRef}
                  className="camera-video"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="camera-actions">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraActive || loading}
                  >
                    {cameraActive ? "Camera Ready" : "Open Camera"}
                  </button>
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    disabled={!cameraActive || loading}
                  >
                    Capture & Scan
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    disabled={!cameraActive}
                  >
                    Stop Camera
                  </button>
                </div>
              </div>
            </div>
          )}

          {error ? <div className="alert error">{error}</div> : null}

          {detectionSummary ? (
            <div className="detection-pill">
              Auto-detected: {detectionSummary}
            </div>
          ) : null}

          <div className="preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" />
            ) : (
              <div className="previewPlaceholder">Drop or select an image</div>
            )}
          </div>
        </section>

        <section id="dash-results" className="card card--results">
          <h2>{Icons.results} Scan Analysis</h2>
          {!result ? (
            <div className="scan-empty-state">
              <div className="scan-empty-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="scan-empty-title">No scan data yet</div>
              <div className="scan-empty-sub">
                Upload and scan a facial image to see interactive analysis
                charts, radar graphs, and detailed score breakdowns.
              </div>
            </div>
          ) : (
            <ScanResults result={result} />
          )}
        </section>

        <section id="dash-environment" className="card bottom">
          <h2>{Icons.environment} Live Skin Exposome</h2>
          <EnvironmentalWidget />
        </section>

        <section id="dash-products" className="card bottom">
          <h2>{Icons.products} Suggested Products</h2>
          <div className="muted" style={{ marginBottom: 12 }}>
            Ranked using your scan results + today's humidity, temperature, and
            air quality (approx location by IP).
          </div>
          <ProductRecommendations cvScores={result} />
        </section>

        <section className="card bottom">
          <h2>{Icons.layers} Filter Layers</h2>
          {!layers?.length ? (
            <div className="muted">
              Upload an image to see filter layer samples here.
            </div>
          ) : (
            <div className="layersRow">
              {layers.map((layer) => (
                <div className="layerCard" key={layer.key || layer.label}>
                  <div className="layerLabel">{layer.label}</div>
                  {layer.image ? (
                    <img
                      className="layerImg"
                      src={layer.image}
                      alt={layer.label}
                    />
                  ) : (
                    <div className="layerMissing">No image</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="footer">
          AmourSkin AI · Prototype scoring engine · Not a medical diagnosis
        </footer>
      </div>
    </>
  );
}

/* Metric component removed — now handled by ScanResults interactive charts */

export default App;
