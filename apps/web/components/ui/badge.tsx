import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'default';
}

export function Badge({ children, variant = 'default', size = 'default', className = '', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary-light text-primary-dark',
    secondary: 'bg-gray-100 text-text-secondary',
    success: 'bg-success-light text-emerald-700',
    warning: 'bg-warning-light text-amber-700',
    danger: 'bg-danger-light text-red-700',
    info: 'bg-info-light text-blue-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2.5 py-0.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
}
