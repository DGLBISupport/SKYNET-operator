import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: "pointer",
          border: variant === "outline" ? "1px solid #d1d5db" : "none",
          backgroundColor: variant === "default" ? "#e21b22" : variant === "outline" ? "#ffffff" : variant === "secondary" ? "#f3f4f6" : "#e21b22",
          color: variant === "outline" ? "#374151" : variant === "secondary" ? "#1f2937" : "#ffffff",
          padding: size === "sm" ? "6px 12px" : size === "lg" ? "12px 24px" : "8px 16px",
          transition: "all 0.2s",
          ...style,
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
