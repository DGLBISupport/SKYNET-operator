import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email, currentPassword, newPassword } = await request.json();

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email, current password/PIN, and new password/PIN are required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
        { success: false, error: `Database check failed: ${errText}` },
        { status: 500 }
      );
    }

    const users = await res.json();
    const user = users && users[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // 2. Verify current password hash
    const currentHashed = crypto
      .createHash("sha256")
      .update(currentPassword)
      .digest("hex");

    if (user.hashed_password !== currentHashed) {
      return NextResponse.json(
        { success: false, error: "Incorrect current password/PIN." },
        { status: 401 }
      );
    }

    // 3. Hash new password
    const newHashed = crypto
      .createHash("sha256")
      .update(newPassword)
      .digest("hex");

    // 4. Update password in database
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        hashed_password: newHashed,
        has_password_changed: true,
        is_first_login: false,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return NextResponse.json(
        { success: false, error: `Failed to update password: ${errText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Password/PIN updated successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
