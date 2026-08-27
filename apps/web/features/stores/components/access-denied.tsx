'use client';

import React from 'react';

interface AccessDeniedProps {
  detail?: string;
}

export function AccessDenied({ detail }: AccessDeniedProps) {
  return (
    <div role="alert">
      <h2>Access denied</h2>
      {detail && <p>{detail}</p>}
    </div>
  );
}
