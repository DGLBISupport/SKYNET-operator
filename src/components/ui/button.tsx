import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  width?: string | number;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, style, width, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          height: "44px",
          padding: "0 24px",
          backgroundColor: "#e21b22", // Skynet red
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
          width: width || "100%",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
          ...style,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.filter = "brightness(0.9)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.filter = "none";
        }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
