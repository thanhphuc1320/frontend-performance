import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Alert({ children, variant = 'default', className = '', ...props }: AlertProps) {
  const variants = {
    default: 'bg-gray-50 text-text-primary border-gray-200',
    success: 'bg-success-light text-emerald-800 border-emerald-200',
    warning: 'bg-warning-light text-amber-800 border-amber-200',
    danger: 'bg-danger-light text-red-800 border-red-200',
    info: 'bg-info-light text-blue-800 border-blue-200',
  };

  const icons = {
    default: Info,
    success: CheckCircle2,
    warning: AlertCircle,
    danger: XCircle,
    info: Info,
  };

  const Icon = icons[variant];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${variants[variant]} ${className}`} {...props}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">{children}</div>
    </div>
  );
}
