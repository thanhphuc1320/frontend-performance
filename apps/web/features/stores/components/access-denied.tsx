import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface AccessDeniedProps {
  detail?: string;
  onBack?: () => void;
}

export function AccessDenied({ detail = 'You do not have access to this resource.', onBack }: AccessDeniedProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <ShieldAlert className="h-16 w-16 text-danger mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Access Denied</h2>
        <p className="text-text-secondary mb-6">{detail}</p>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Go back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
