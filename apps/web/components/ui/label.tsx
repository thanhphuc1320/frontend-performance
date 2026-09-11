import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = '', ...props }: LabelProps) {
  return (
    <label className={`text-sm font-medium text-text-secondary ${className}`} {...props}>
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  );
}
