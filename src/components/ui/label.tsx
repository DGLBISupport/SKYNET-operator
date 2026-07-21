import React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <label
        ref={ref}
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "#374151",
          display: "block",
          marginBottom: "6px",
          userSelect: "none",
          ...style,
        }}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";
