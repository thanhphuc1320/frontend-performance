'use client';

import React, { useState, useCallback } from 'react';
import { useCreateCustomer, useUpdateCustomer } from '../queries';
import { useCapabilities } from '../../stores/queries';
import type { Customer, CreateCustomerInput } from '../types';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { FormError } from '../../../components/ui/form-error';

interface CustomerFormProps {
  storeId: string;
  customer?: Customer | null;
  onSuccess?: () => void;
}

export function CustomerForm({ storeId, customer, onSuccess }: CustomerFormProps) {
  const isEdit = !!customer;
  const [form, setForm] = useState<CreateCustomerInput>({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? null,
    address: customer?.address ?? null,
    city: customer?.city ?? null,
    district: customer?.district ?? null,
    ward: customer?.ward ?? null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const { data: capabilities } = useCapabilities();
  const canManage = capabilities?.permissions.includes('orders.manage') ?? false;

  const handleChange = useCallback((field: keyof CreateCustomerInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
    // Clear error when user types
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    if (form.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        newErrors.email = 'Invalid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!canManage) {
        setSubmitError('You do not have permission to manage customers');
        return;
      }

      if (!validate()) return;

      try {
        if (isEdit && customer) {
          await updateMutation.mutateAsync({
            storeId,
            customerId: customer.id,
            data: {
              name: form.name,
              phone: form.phone,
              email: form.email,
              address: form.address,
              city: form.city,
              district: form.district,
              ward: form.ward,
            },
          });
        } else {
          await createMutation.mutateAsync({
            storeId,
            data: form,
          });
        }
        onSuccess?.();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to save customer');
      }
    },
    [canManage, validate, isEdit, customer, storeId, form, updateMutation, createMutation, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="rounded-lg border border-danger bg-danger-light p-4 text-sm text-danger">
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Customer' : 'New Customer'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label required>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
              />
              {errors.name && <FormError>{errors.name}</FormError>}
            </div>
            <div>
              <Label required>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                error={!!errors.phone}
              />
              {errors.phone && <FormError>{errors.phone}</FormError>}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                error={!!errors.email}
              />
              {errors.email && <FormError>{errors.email}</FormError>}
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address ?? ''}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={form.city ?? ''}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div>
              <Label>District</Label>
              <Input
                value={form.district ?? ''}
                onChange={(e) => handleChange('district', e.target.value)}
              />
            </div>
            <div>
              <Label>Ward</Label>
              <Input
                value={form.ward ?? ''}
                onChange={(e) => handleChange('ward', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={createMutation.isPending || updateMutation.isPending}
          disabled={!canManage}
        >
          {isEdit ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
