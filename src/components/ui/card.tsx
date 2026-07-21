import React from "react";

export const Card = ({ children, style, ...props }: any) => (
  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
      overflow: "hidden",
      width: "100%",
      boxSizing: "border-box",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, style, ...props }: any) => (
  <div
    style={{
      padding: "24px 24px 16px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      boxSizing: "border-box",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ children, style, ...props }: any) => (
  <h3
    style={{
      fontSize: "22px",
      fontWeight: "700",
      color: "#111827",
      margin: 0,
      padding: 0,
      fontFamily: "inherit",
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({ children, style, ...props }: any) => (
  <p
    style={{
      fontSize: "14px",
      color: "#6b7280",
      margin: 0,
      padding: 0,
      lineHeight: "1.4",
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent = ({ children, style, ...props }: any) => (
  <div
    style={{
      padding: "0 24px 24px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      boxSizing: "border-box",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter = ({ children, style, ...props }: any) => (
  <div
    style={{
      padding: "0 24px 24px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      boxSizing: "border-box",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
