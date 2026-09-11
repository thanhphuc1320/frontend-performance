import React from 'react';

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentArea({ children, className = '' }: ContentAreaProps) {
  return (
    <div className={`mx-auto max-w-7xl ${className}`}>
      {children}
    </div>
  );
}
