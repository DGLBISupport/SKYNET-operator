import * as React from "react"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", style, ...props }, ref) => (
    <label
      ref={ref}
      style={{
        fontSize: "14px",
        fontWeight: "500",
        color: "#374151",
        display: "block",
        marginBottom: "4px",
        ...style,
      }}
      {...props}
    />
  )
)
Label.displayName = "Label"
