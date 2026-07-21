import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email, firstName, pin } = await request.json();

    if (!email || !firstName || !pin) {
      return NextResponse.json(
        { success: false, error: "First name and 4-digit PIN are required." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Supabase environment variables not configured." },
        { status: 500 }
      );
    }

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    // 1. Fetch user by email
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      { headers }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, error: `Authentication failed: ${errText}` },
        { status: 500 }
      );
    }

    const users = await res.json();
    const user = users && users[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Operator session not found." },
        { status: 404 }
      );
    }

    if (user.status === "INACTIVE") {
      return NextResponse.json(
        { success: false, error: "Account is inactive. Contact Admin." },
        { status: 403 }
      );
    }

    // 2. Verify first name (case-insensitive)
    if (user.first_name.trim().toLowerCase() !== firstName.trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "First name does not match the selected operator." },
        { status: 401 }
      );
    }

    // 3. Verify PIN (hash stored in phone_number)
    const pinHashed = crypto
      .createHash("sha256")
      .update(pin)
      .digest("hex");

    if (user.phone_number !== pinHashed) {
      return NextResponse.json(
        { success: false, error: "Incorrect 4-digit PIN." },
        { status: 401 }
      );
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role || "operator",
    };

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
