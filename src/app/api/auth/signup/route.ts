import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
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
      Prefer: "return=representation",
    };

    // 1. Check if user already exists
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      { headers }
    );
    if (!checkRes.ok) {
      const errText = await checkRes.text();
      return NextResponse.json(
        { success: false, error: `Database check failed: ${errText}` },
        { status: 500 }
      );
    }

    const existingUsers = await checkRes.json();
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // 2. Hash password using SHA-256
    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    // 3. Insert user into users table
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        username: email,
        hashed_password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        status: "ACTIVE",
        role: "operator",
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return NextResponse.json(
        { success: false, error: `Failed to create user record: ${errText}` },
        { status: 500 }
      );
    }

    const createdUsers = await insertRes.json();
    const safeUser = {
      id: createdUsers[0].id,
      email: createdUsers[0].email,
      firstName: createdUsers[0].first_name,
      lastName: createdUsers[0].last_name,
      role: createdUsers[0].role,
    };

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
