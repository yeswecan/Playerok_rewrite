import React from "react";

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, disabled, id, ...props }, ref) => {
  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className={className || "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox }; 