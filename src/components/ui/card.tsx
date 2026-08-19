import * as React from "react"

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        ...style,
      }}
      {...props}
    />
  )
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", style, ...props }, ref) => (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", padding: "24px", gap: "6px", ...style }} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", style, ...props }, ref) => (
    <h3 ref={ref} style={{ fontSize: "20px", fontWeight: "600", color: "#111827", margin: 0, ...style }} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", style, ...props }, ref) => (
    <p ref={ref} style={{ fontSize: "14px", color: "#6b7280", margin: 0, ...style }} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", style, ...props }, ref) => (
    <div ref={ref} style={{ padding: "24px", paddingTop: 0, ...style }} {...props} />
  )
)
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", style, ...props }, ref) => (
    <div ref={ref} style={{ display: "flex", alignItems: "center", padding: "24px", paddingTop: 0, ...style }} {...props} />
  )
)
CardFooter.displayName = "CardFooter"
