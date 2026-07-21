"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Clear existing session on login page load
  useEffect(() => {
    localStorage.removeItem("skynet_user");
  }, []);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const validateFormData = () => {
    const newErrors = {
      email: "",
      password: "",
    };

    if (!formData.email && !formData.password) {
      toast.error("Please fill in all fields.");
      return false;
    }

    if (!formData.email) {
      newErrors.email = "Email is required.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);

    return Object.values(newErrors).every((error) => error === "");
  };

  const handleLoginClick = async () => {
    if (!validateFormData()) {
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Logged in successfully!");
        localStorage.setItem("skynet_user", JSON.stringify(data.user));
        // Redirect to homepage
        router.push("/");
      } else {
        toast.error(data.error || "Authentication failed.");
      }
    } catch (error) {
      console.error("Error login: ", error);
      toast.error("Failed to connect to authentication server.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "20px",
      backgroundColor: "#f9fafb",
      boxSizing: "border-box"
    }}>
      <Card style={{ width: "100%", maxWidth: "420px" }}>
        <CardHeader>
          {/* Logo header */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <img src="/logo.png" alt="Skynet" style={{ height: "45px", objectFit: "contain" }} />
          </div>
          <CardTitle style={{ textAlign: "center" }}>Welcome back</CardTitle>
          <CardDescription style={{ textAlign: "center" }}>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={formData.email}
                required
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleLoginClick(); }}
              />
              {errors.email && <p style={{ color: "#dc2626", fontSize: "12px", margin: "4px 0 0 0" }}>{errors.email}</p>}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <Label htmlFor="password" style={{ margin: 0 }}>Password</Label>
                <Link href="#" onClick={(e) => { e.preventDefault(); toast.info("Please contact system administrator to reset password."); }} style={{ fontSize: "12px", color: "#e21b22", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                required
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleLoginClick(); }}
              />
              {errors.password && <p style={{ color: "#dc2626", fontSize: "12px", margin: "4px 0 0 0" }}>{errors.password}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLoginClick} disabled={isLoggingIn}>
            {isLoggingIn ? "Signing In..." : "Sign In"}
          </Button>
          <div style={{ fontSize: "14px", textAlign: "center", color: "#6b7280", marginTop: "12px" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: "#e21b22", textDecoration: "none", fontWeight: "600" }}>
              Sign Up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
