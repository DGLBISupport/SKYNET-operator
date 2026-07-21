"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    pin: "",
  });

  const [formError, setFormError] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    pin: "",
  });

  const validateFormData = () => {
    const newErrors = {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      pin: "",
    };

    if (!formData.firstName && !formData.lastName && !formData.email && !formData.password && !formData.confirmPassword) {
      toast.error("All fields are required");
      setFormError(newErrors);
      return false;
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
      setFormError(newErrors);
      toast.error("First name is required");
      return false;
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
      setFormError(newErrors);
      toast.error("Last name is required");
      return false;
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
      setFormError(newErrors);
      toast.error("Email is required");
      return false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
      setFormError(newErrors);
      toast.error("Password is required");
      return false;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
      setFormError(newErrors);
      toast.error("Confirm password is required");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.password = "Passwords do not match";
      setFormError(newErrors);
      toast.error("Passwords do not match");
      return false;
    }

    if (!formData.pin) {
      newErrors.pin = "4-digit quick-switch PIN is required";
      setFormError(newErrors);
      toast.error("PIN is required");
      return false;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      newErrors.pin = "PIN must be exactly 4 digits";
      setFormError(newErrors);
      toast.error("PIN must be exactly 4 digits (numeric only)");
      return false;
    }

    setFormError(newErrors);
    return true;
  };

  const handleSignupClick = async () => {
    if (!validateFormData()) {
      return;
    }

    setIsSigningUp(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          pin: formData.pin,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Account created successfully!");
        localStorage.setItem("skynet_user", JSON.stringify(data.user));
        // Redirect to homepage
        router.push("/");
      } else {
        toast.error(data.error || "Failed to create account.");
      }
    } catch (error) {
      console.error(error);
      toast.error("API connection failure. Failed to create account.");
    } finally {
      setIsSigningUp(false);
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
      <Card style={{ width: "100%", maxWidth: "440px" }}>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <img src="/logo.png" alt="Skynet" style={{ height: "45px", objectFit: "contain" }} />
          </div>
          <CardTitle style={{ textAlign: "center" }}>Create an account</CardTitle>
          <CardDescription style={{ textAlign: "center" }}>
            Enter your information to get started with SKYNET
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  placeholder="John"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
                {formError.firstName && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  placeholder="Doe"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
                {formError.lastName && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.lastName}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {formError.email && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.email}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {formError.password && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.password}</p>}
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              {formError.confirmPassword && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.confirmPassword}</p>}
            </div>
            <div>
              <Label htmlFor="pin">4-Digit Quick-Switch PIN (numeric only)</Label>
              <Input
                id="pin"
                type="text"
                maxLength={4}
                placeholder="1234"
                required
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
              />
              {formError.pin && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0 0" }}>{formError.pin}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSignupClick} disabled={isSigningUp}>
            {isSigningUp ? "Creating Account..." : "Create Account"}
          </Button>
          <div style={{ fontSize: "14px", textAlign: "center", color: "#6b7280", marginTop: "12px" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#e21b22", textDecoration: "none", fontWeight: "600" }}>
              Log In
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
