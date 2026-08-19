import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface PermissionDefinition {
  id: string;
  name: string;
  category: "Scans" | "Tracking & Reports" | "Administration";
  description: string;
}

interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: string[]; // List of permission IDs
}

const ALL_PERMISSIONS: PermissionDefinition[] = [
  { id: "first_scan", name: "First Scan (Box Unsealing)", category: "Scans", description: "Perform box unsealing and 1st scan parcel verification" },
  { id: "second_scan", name: "Second Scan & LMD Bagging", category: "Scans", description: "Perform 2nd scan parcel allocation and outbound bagging" },
  { id: "dispatch_verify", name: "Dispatch Verification", category: "Scans", description: "Verify dispatch bins and outbound partner allocations" },
  { id: "damaged_barcode", name: "Damaged Barcode Lookup", category: "Scans", description: "Search damaged labels and reprint parcel tags" },
  { id: "manifest_tracking", name: "Manifest & Bag Tracking", category: "Tracking & Reports", description: "View MAWB manifest details and bag tracking status" },
  { id: "reports", name: "Reports & Analytics", category: "Tracking & Reports", description: "Access scan statistics, throughput, and audit reports" },
  { id: "config_settings", name: "Workstation Configuration", category: "Administration", description: "Configure local scanner settings and printing options" },
  { id: "admin_panel", name: "Admin Panel Access", category: "Administration", description: "Access admin settings and user account management" },
  { id: "roles_permissions", name: "Roles & Permissions Management", category: "Administration", description: "Define custom user roles and grant permission sets" },
  { id: "export_untracked_parcels", name: "Export Untracked Parcels (Excel)", category: "Administration", description: "Super Admin export of unknown/untracked parcel reference numbers to Excel" }
];

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Full operational and administrative access across all system features.",
    isSystem: true,
    permissions: ALL_PERMISSIONS.map(p => p.id)
  },
  {
    id: "admin",
    name: "System Admin",
    description: "Full access to scans, tracking, reports, and user configuration.",
    isSystem: true,
    permissions: [
      "first_scan",
      "second_scan",
      "dispatch_verify",
      "damaged_barcode",
      "manifest_tracking",
      "reports",
      "config_settings",
      "admin_panel"
    ]
  },
  {
    id: "supervisor",
    name: "Station Supervisor",
    description: "Access to operational scans, bag tracking, and daily reports.",
    isSystem: true,
    permissions: [
      "first_scan",
      "second_scan",
      "dispatch_verify",
      "damaged_barcode",
      "manifest_tracking",
      "reports"
    ]
  },
  {
    id: "operator",
    name: "Workstation Operator",
    description: "Standard operator access for parcel unsealing, scanning, and allocation.",
    isSystem: true,
    permissions: [
      "first_scan",
      "second_scan",
      "dispatch_verify",
      "damaged_barcode"
    ]
  }
];

const getRolesFilePath = () => {
  const dataDir = path.join(process.cwd(), "src", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "roles_config.json");
};

const loadRoles = (): RoleDefinition[] => {
  try {
    const filePath = getRolesFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data.roles) && data.roles.length > 0) {
        return data.roles;
      }
    }
  } catch (e) {
    console.warn("Failed to read roles file:", e);
  }
  return DEFAULT_ROLES;
};

const saveRoles = (roles: RoleDefinition[]) => {
  try {
    const filePath = getRolesFilePath();
    fs.writeFileSync(filePath, JSON.stringify({ roles }, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to write roles file:", e);
  }
};

export async function GET() {
  try {
    const roles = loadRoles();
    return NextResponse.json({
      success: true,
      roles,
      allPermissions: ALL_PERMISSIONS
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !role.name) {
      return NextResponse.json(
        { success: false, error: "Role name is required." },
        { status: 400 }
      );
    }

    const roles = loadRoles();
    const roleId = role.id || role.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    
    const existingIndex = roles.findIndex(r => r.id === roleId);
    const newRole: RoleDefinition = {
      id: roleId,
      name: role.name,
      description: role.description || "",
      isSystem: role.isSystem || false,
      permissions: Array.isArray(role.permissions) ? role.permissions : []
    };

    if (existingIndex >= 0) {
      roles[existingIndex] = newRole;
    } else {
      roles.push(newRole);
    }

    saveRoles(roles);
    return NextResponse.json({ success: true, roles });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, roleId } = await request.json();
    if (!userId || !roleId) {
      return NextResponse.json(
        { success: false, error: "User ID and Role ID are required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      };

      const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role: roleId })
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return NextResponse.json({ success: false, error: `Failed to update user role: ${errText}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `Role updated to ${roleId}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}
