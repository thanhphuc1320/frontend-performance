export interface Customer {
  id: string;
  storeId: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function validateCustomerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Customer name is required';
  if (trimmed.length > 200) return 'Customer name must be less than 200 characters';
  return null;
}

export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (trimmed.length === 0) return 'Phone number is required';
  if (trimmed.length > 20) return 'Phone number must be less than 20 characters';
  return null;
}
