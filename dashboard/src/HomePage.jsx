import { useState, useEffect, useRef } from "react";
import "./HomePage.css";
import heroImg from "./assets/hero_skincare.png";
import processImg from "./assets/process_mockup.png";

/* ── Global Reveal Hook ── */
function useGlobalReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("hp-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    // Find all unobserved reveal elements
    const elements = document.querySelectorAll(".hp-reveal:not(.hp-visible)");
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ── Animated Counter ── */
function Counter({ end, suffix = "", duration = 1800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

/* ── SVG Icons ── */
const HPIcons = {
  leaf: (
    <svg viewBox="0 0 24 24">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24">
      <path d="M12 3c-1 3-3 5-6 6 3 1 5 3 6 6 1-3 3-5 6-6-3-1-5-3-6-6Z" />
      <path d="M5 3v4" />
      <path d="M3 5h4" />
      <path d="M19 17v4" />
      <path d="M17 19h4" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-3 3" />
    </svg>
  ),
  drop: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

/* ── Star Rating ── */
function Stars() {
  return (
    <div className="hp-testimonial-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="hp-star" viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

/* ── Testimonial Card ── */
const testimonials = [
  {
    text: "AmourSkin AI completely transformed my skincare routine. The analysis was spot-on and the product recommendations actually worked for my oily skin.",
    name: "Priya Sharma",
    title: "Skincare Enthusiast",
    initials: "PS",
    color: "linear-gradient(135deg, #c8847a, #a8645a)",
  },
  {
    text: "I was skeptical at first, but the AI detected my combination skin type accurately and suggested products I never would have found on my own.",
    name: "Amara Osei",
    title: "Beauty Blogger",
    initials: "AO",
    color: "linear-gradient(135deg, #8aab8e, #6a8b6e)",
  },
  {
    text: "The environmental factor analysis is genius. It showed me how humidity was affecting my skin and guided me to the right moisturizer.",
    name: "Sarah Chen",
    title: "Dermatology Student",
    initials: "SC",
    color: "linear-gradient(135deg, #c9a96e, #a88950)",
  },
  {
    text: "Finally, a tool that understands the nuances of mature skin. The suggested anti-aging serums have given my face a radiant, youthful glow in just weeks.",
    name: "Elena Rostova",
    title: "Wellness Coach",
    initials: "ER",
    color: "linear-gradient(135deg, #d4a5a5, #b87a7a)",
  },
  {
    text: "As a guy who knew nothing about skincare, this app was a lifesaver. It kept things simple, direct, and the recommended cleanser cleared my breakouts.",
    name: "Marcus Thorne",
    title: "Fitness Instructor",
    initials: "MT",
    color: "linear-gradient(135deg, #7a9eb8, #5a7d99)",
  },
  {
    text: "I love tracking my 'Overall Score' over time. Seeing the data prove that my new routine is actually working makes me feel so much more confident!",
    name: "Chloe Dupont",
    title: "Fashion Designer",
    initials: "CD",
    color: "linear-gradient(135deg, #b8a5d4, #8b7aa6)",
  },
];

/* ══════════════════════════════════════
   HOME PAGE COMPONENT
══════════════════════════════════════ */
export default function HomePage({ onGetStarted, user, onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const userInitials = user
    ? (user.name || user.email || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  /* Navbar scroll effect */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  /* Global scroll reveal effect */
  useGlobalReveal();

  function scrollDown() {
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  }

  return (
    <div className="home-page">
      {/* ── NAVBAR ── */}
      <nav className={`hp-nav ${scrolled ? "hp-nav--scrolled" : ""}`}>
        {/* Brand */}
        <div className="hp-nav-brand">
          <div className="hp-nav-brand-icon">{HPIcons.leaf}</div>
          <span className="hp-nav-brand-name">AmourSkin</span>
        </div>

        {/* Links */}
        <ul className="hp-nav-links">
          <li>
            <a href="#how-it-works">How It Works</a>
          </li>
          <li>
            <a href="#results">Results</a>
          </li>
          <li>
            <a href="#testimonials">Stories</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
        </ul>

        {/* CTA / User controls */}
        {user ? (
          <div className="hp-nav-user">
            <span className="hp-nav-user-name">
              {(user.name || user.email || "").split(" ")[0]}
            </span>
            <button
              id="hp-nav-dashboard-btn"
              className="hp-nav-cta"
              onClick={onGetStarted}
              style={{ padding: "9px 18px", fontSize: "13px" }}
            >
              Dashboard
            </button>
            <button
              id="hp-nav-logout-btn"
              className="hp-nav-logout"
              onClick={onLogout}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            id="hp-nav-cta-btn"
            className="hp-nav-cta"
            onClick={onGetStarted}
          >
            <span>Scan My Skin</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="hp-hero">
        <img
          src={heroImg}
          alt="Luxurious skincare spa setting with botanical elements and serums"
          className="hp-hero-img"
        />
        <div className="hp-hero-overlay" />

        <div className="hp-hero-content">
          {/* Badge */}
          <div className="hp-hero-badge">
            <div className="hp-hero-badge-dot" />
            AI-Powered Skin Intelligence
          </div>

          {/* Title */}
          <h1 className="hp-hero-title">
            Discover Your <span>True Skin</span> Story
          </h1>

          {/* Subtitle */}
          <p className="hp-hero-sub">
            A 30-second AI facial scan that reveals your skin type, analyses
            environmental impacts, and curates a personalised skincare routine
            just for you.
          </p>

          {/* Actions */}
          <div className="hp-hero-actions">
            <button
              id="hp-hero-primary-btn"
              className="hp-btn-primary"
              onClick={onGetStarted}
            >
              Scan My Skin Now
            </button>
            <button
              id="hp-hero-secondary-btn"
              className="hp-btn-secondary"
              onClick={() =>
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              See How It Works
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="hp-hero-scroll"
          onClick={scrollDown}
          aria-label="Scroll down"
        >
          <div className="hp-hero-scroll-line" />
          <span className="hp-hero-scroll-text">Scroll</span>
        </div>
      </section>

      {/* ── FEATURES STRIP ── */}
      <section className="hp-features-strip">
        <div className="hp-feature-pill hp-reveal hp-reveal-delay-1">
          <div className="hp-feature-pill-icon">{HPIcons.camera}</div>
          <span className="hp-feature-pill-label">Instant Face Scan</span>
        </div>
        <div className="hp-feature-pill hp-reveal hp-reveal-delay-2">
          <div className="hp-feature-pill-icon">{HPIcons.sparkle}</div>
          <span className="hp-feature-pill-label">AI Skin Analysis</span>
        </div>
        <div className="hp-feature-pill hp-reveal hp-reveal-delay-3">
          <div className="hp-feature-pill-icon">{HPIcons.drop}</div>
          <span className="hp-feature-pill-label">Product Matching</span>
        </div>
        <div className="hp-feature-pill hp-reveal hp-reveal-delay-4">
          <div className="hp-feature-pill-icon">{HPIcons.shield}</div>
          <span className="hp-feature-pill-label">Privacy First</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="hp-section" id="how-it-works">
        <div
          className="hp-section-inner"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "center",
          }}
        >
          <div className="hp-process-content">
            <div className="hp-reveal">
              <div className="hp-section-label">
                <div className="hp-section-label-line" />
                <span className="hp-section-label-text">The Process</span>
              </div>
              <h2 className="hp-section-title">
                Your skin, decoded in seconds
              </h2>
              <p className="hp-section-subtitle">
                Three simple steps powered by deep learning and dermatological
                science to give you precision skincare insights.
              </p>
            </div>

            <div
              className="hp-steps"
              style={{
                gridTemplateColumns: "1fr",
                gap: "32px",
                marginTop: "48px",
              }}
            >
              {[
                {
                  num: "01",
                  icon: HPIcons.camera,
                  title: "Upload or Capture",
                  desc: "Take a selfie or upload a clear photo of your face. Our AI works with any device camera.",
                  delay: "hp-reveal-delay-1",
                },
                {
                  num: "02",
                  icon: HPIcons.scan,
                  title: "AI Analyses Your Skin",
                  desc: "Our deep learning model detects oily, dry, combination, or sensitive skin type with clinical-grade accuracy.",
                  delay: "hp-reveal-delay-2",
                },
                {
                  num: "03",
                  icon: HPIcons.sparkle,
                  title: "Get Personalised Picks",
                  desc: "Receive curated product recommendations tailored to your skin type, local climate, and lifestyle.",
                  delay: "hp-reveal-delay-3",
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className={`hp-step hp-reveal ${step.delay}`}
                  style={{
                    padding: "24px",
                    background: "white",
                    borderRadius: "16px",
                    border: "1px solid var(--hp-border)",
                    boxShadow: "var(--hp-shadow-sm)",
                  }}
                >
                  <div className="hp-step-top">
                    <div className="hp-step-icon">{step.icon}</div>
                    <div className="hp-step-num">{step.num}</div>
                  </div>
                  <h3 className="hp-step-title">{step.title}</h3>
                  <p className="hp-step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hp-process-image hp-reveal hp-reveal-delay-2">
            <img
              src={processImg}
              alt="AI Facial Analysis Process"
              style={{
                width: "100%",
                borderRadius: "24px",
                boxShadow: "var(--hp-shadow-lg)",
                border: "1px solid var(--hp-border)",
              }}
            />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="hp-stats" id="results">
        <div className="hp-stats-inner hp-reveal">
          {[
            { end: 98, suffix: "%", label: "Analysis\nAccuracy" },
            { end: 50000, suffix: "+", label: "Skin Scans\nCompleted" },
            { end: 120, suffix: "+", label: "Curated\nProducts" },
            { end: 4.9, suffix: "★", label: "User\nRating" },
          ].map((s, i) => (
            <div key={i} className="hp-stat">
              <div className="hp-stat-value">
                <Counter end={s.end} suffix={s.suffix} />
              </div>
              <div className="hp-stat-label" style={{ whiteSpace: "pre-line" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="hp-testimonials" id="testimonials">
        <div className="hp-testimonials-inner">
          <div className="hp-reveal">
            <div className="hp-section-label">
              <div className="hp-section-label-line" />
              <span className="hp-section-label-text">Success Stories</span>
            </div>
            <h2 className="hp-section-title">Loved by skin enthusiasts</h2>
          </div>

          <div className="hp-testimonials-grid">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`hp-testimonial hp-reveal hp-reveal-delay-${i + 1}`}
              >
                <Stars />
                <p className="hp-testimonial-text">"{t.text}"</p>
                <div className="hp-testimonial-author">
                  <div
                    className="hp-testimonial-avatar"
                    style={{ background: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="hp-testimonial-name">{t.name}</div>
                    <div className="hp-testimonial-title">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="hp-cta-banner">
        <div className="hp-cta-banner-inner hp-reveal">
          <div
            className="hp-section-label"
            style={{ justifyContent: "center" }}
          >
            <div className="hp-section-label-line" />
            <span className="hp-section-label-text">Start Today</span>
            <div className="hp-section-label-line" />
          </div>
          <h2 className="hp-cta-title">Your skin deserves personalised care</h2>
          <p className="hp-cta-sub">
            Join thousands of people who've discovered their perfect routine.
            Free, instant, and powered by AI.
          </p>
          <button
            id="hp-cta-bottom-btn"
            className="hp-btn-primary"
            onClick={onGetStarted}
          >
            Begin Your Skin Journey →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <span className="hp-footer-brand">AmourSkin AI</span>
        <span className="hp-footer-copy">
          © {new Date().getFullYear()} AmourSkin. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
