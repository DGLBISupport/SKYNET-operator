"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  // Sign Up Form State
  const [signUpData, setSignUpData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    pin: "",
  });

  // Clear session on login page load
  useEffect(() => {
    localStorage.removeItem("skynet_user");
  }, []);

  const handleSignInSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!signInData.email || !signInData.password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signInData.email.trim(),
          password: signInData.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Logged in successfully!");
        localStorage.setItem("skynet_user", JSON.stringify(data.user));
        router.push("/");
      } else {
        toast.error(data.error || "Authentication failed.");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to connect to authentication server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { firstName, lastName, email, password, confirmPassword, pin } = signUpData;

    if (!firstName || !lastName || !email || !password || !confirmPassword || !pin) {
      toast.error("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 numeric digits.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          pin,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Account created successfully!");
        localStorage.setItem("skynet_user", JSON.stringify(data.user));
        router.push("/");
      } else {
        toast.error(data.error || "Failed to create account.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Failed to connect to authentication server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Color theme variables based on dark/light mode
  const bg = isDarkMode ? "#0d0d0f" : "#f9fafb";
  const textColor = isDarkMode ? "#ffffff" : "#111827";
  const subTextColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const headerBorder = isDarkMode ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e5e7eb";
  const modalBg = isDarkMode ? "#18181b" : "#ffffff";
  const modalBorder = isDarkMode ? "1px solid #27272a" : "1px solid #e5e7eb";
  const inputBg = isDarkMode ? "#09090b" : "#ffffff";
  const inputBorder = isDarkMode ? "1px solid #27272a" : "1px solid #d1d5db";
  const inputColor = isDarkMode ? "#ffffff" : "#111827";

  return (
    <div style={{
      backgroundColor: bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: textColor,
      transition: "background-color 0.2s ease, color 0.2s ease",
      boxSizing: "border-box"
    }}>
      {/* ── TOP NAVIGATION HEADER ── */}
      <header style={{
        height: "64px",
        padding: "0 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: headerBorder,
        boxSizing: "border-box"
      }}>
        {/* Brand Logos */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img src="/logo.png" alt="SKYNET logo" style={{ height: "26px", width: "auto" }} />
          <img src="/skynet_logi_logo.png" alt="LOGICENTRIX logo" style={{ height: "25px", width: "auto" }} />
        </div>

        {/* Dark / Light Mode Toggle Icon */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            background: "none",
            border: "none",
            color: subTextColor,
            cursor: "pointer",
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease"
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = textColor; }}
          onMouseOut={(e) => { e.currentTarget.style.color = subTextColor; }}
        >
          {isDarkMode ? (
            /* Sun Icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            /* Moon Icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      {/* ── CENTER HERO CONTENT ── */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        textAlign: "center",
        boxSizing: "border-box"
      }}>
        <h1 style={{
          fontSize: "44px",
          fontWeight: "800",
          color: textColor,
          letterSpacing: "-0.5px",
          margin: 0,
          lineHeight: "1.2"
        }}>
          Welcome to <span style={{ color: "#e21b22", fontWeight: "800" }}>SKYNET</span>
        </h1>

        <p style={{
          fontSize: "17px",
          fontWeight: "400",
          color: subTextColor,
          marginTop: "12px",
          marginBottom: "0",
          letterSpacing: "0.2px"
        }}>
          Intelligent Parcel Allocation System
        </p>

        {/* Action Buttons */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "28px"
        }}>
          {/* Sign In Button */}
          <button
            onClick={() => {
              setShowSignInModal(true);
              setShowSignUpModal(false);
            }}
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "9px 22px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)",
              transition: "transform 0.15s ease, backgroundColor 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#ef4444";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#dc2626";
              e.currentTarget.style.transform = "none";
            }}
          >
            Sign In
          </button>

          {/* Create Account Button */}
          <button
            onClick={() => {
              setShowSignUpModal(true);
              setShowSignInModal(false);
            }}
            style={{
              backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
              color: isDarkMode ? "#ffffff" : "#111827",
              border: isDarkMode ? "1px solid #374151" : "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "9px 22px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "transform 0.15s ease, backgroundColor 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#374151" : "#f3f4f6";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#1f2937" : "#ffffff";
              e.currentTarget.style.transform = "none";
            }}
          >
            Create Account
          </button>
        </div>
      </main>

      {/* ── SIGN IN MODAL ── */}
      {showSignInModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: modalBg,
            border: modalBorder,
            borderRadius: "14px",
            width: "100%",
            maxWidth: "400px",
            padding: "28px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            boxSizing: "border-box",
            position: "relative"
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowSignInModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: subTextColor,
                fontSize: "18px",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <img src="/logo.png" alt="SKYNET logo" style={{ height: "30px", width: "auto" }} />
                <img src="/skynet_logi_logo.png" alt="LOGICENTRIX logo" style={{ height: "28px", width: "auto" }} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: textColor }}>
                Sign In to SKYNET
              </h2>
              <p style={{ fontSize: "13px", color: subTextColor, margin: 0 }}>
                Enter your operator credentials to access workstation
              </p>
            </div>

            <form onSubmit={handleSignInSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: subTextColor, marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="operator@skynet.lk"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: inputBg,
                    border: inputBorder,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "14px",
                    color: inputColor,
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: subTextColor, marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signInData.password}
                  onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: inputBg,
                    border: inputBorder,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "14px",
                    color: inputColor,
                    outline: "none"
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginTop: "8px",
                  transition: "backgroundColor 0.15s ease"
                }}
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: subTextColor }}>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setShowSignInModal(false);
                  setShowSignUpModal(true);
                }}
                style={{ background: "none", border: "none", color: "#e21b22", fontWeight: "700", cursor: "pointer", padding: 0 }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ACCOUNT MODAL ── */}
      {showSignUpModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: modalBg,
            border: modalBorder,
            borderRadius: "14px",
            width: "100%",
            maxWidth: "440px",
            padding: "28px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            boxSizing: "border-box",
            position: "relative"
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowSignUpModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: subTextColor,
                fontSize: "18px",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <img src="/logo.png" alt="SKYNET logo" style={{ height: "30px", width: "auto" }} />
                <img src="/skynet_logi_logo.png" alt="LOGICENTRIX logo" style={{ height: "28px", width: "auto" }} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: textColor }}>
                Create your Account
              </h2>
              <p style={{ fontSize: "13px", color: subTextColor, margin: 0 }}>
                Enter your details to register as a workstation operator
              </p>
            </div>

            <form onSubmit={handleSignUpSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    value={signUpData.firstName}
                    onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    value={signUpData.lastName}
                    onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="operator@skynet.lk"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: subTextColor, marginBottom: "4px" }}>4-Digit Quick PIN (Numeric)</label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="1234"
                  value={signUpData.pin}
                  onChange={(e) => setSignUpData({ ...signUpData, pin: e.target.value.replace(/\D/g, "") })}
                  style={{ width: "100%", boxSizing: "border-box", backgroundColor: inputBg, border: inputBorder, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: inputColor, outline: "none" }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginTop: "6px",
                  transition: "backgroundColor 0.15s ease"
                }}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "14px", fontSize: "13px", color: subTextColor }}>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setShowSignUpModal(false);
                  setShowSignInModal(true);
                }}
                style={{ background: "none", border: "none", color: "#e21b22", fontWeight: "700", cursor: "pointer", padding: 0 }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
