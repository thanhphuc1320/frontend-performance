import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  children: React.ReactNode;
}

export function FormError({ children }: FormErrorProps) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-danger mt-1" role="alert">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
