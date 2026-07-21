import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <input
        ref={ref}
        style={{
          width: "100%",
          height: "42px",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #d1d5db",
          fontSize: "14px",
          color: "#111827",
          backgroundColor: "#ffffff",
          outline: "none",
          transition: "all 0.15s ease",
          boxSizing: "border-box",
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#e21b22";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(226, 27, 34, 0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#d1d5db";
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
