import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm
          placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-danger focus:ring-danger' : ''}
          ${className}
        `}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
