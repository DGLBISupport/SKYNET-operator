import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        style={{
          display: "flex",
          height: "40px",
          width: "100%",
          borderRadius: "6px",
          border: "1px solid #d1d5db",
          backgroundColor: "#f9fafb",
          padding: "8px 12px",
          fontSize: "14px",
          outline: "none",
          boxSizing: "border-box",
          ...style,
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
