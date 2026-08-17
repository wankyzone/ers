import supabase from '../supabase.js';

const PROFILE_SELECT = `
  id,
  email,
  role,
  date_of_birth,
  address,
  account_number,
  account_name,
  emergency_contact,
  verified,
  created_at
`;

const ALLOWED_PROFILE_FIELDS = [
  'date_of_birth',
  'address',
  'account_number',
  'account_name',
  'emergency_contact',
];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}
function normalizeProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id ?? null,
    email: profile.email ?? null,
    role: profile.role ?? null,
    date_of_birth: profile.date_of_birth ?? null,
    address: profile.address ?? null,
    account_number: profile.account_number ?? null,
    account_name: profile.account_name ?? null,
    emergency_contact: profile.emergency_contact ?? null,
    verified: Boolean(profile.verified),
    created_at: profile.created_at ?? null,
  };
}

export async function getAdminProfileForUser(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'Unable to load admin profile.');
  }

  return normalizeProfile(data);
}

export async function updateAdminProfileForUser(userId, payload = {}) {
  const updates = {};

  // validation rules
  const MAX_LENGTHS = {
    address: 200,
    account_number: 34,
    account_name: 100,
    emergency_contact: 100,
  };

  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (!(field in payload)) {
      continue;
    }

    const raw = payload[field];

    // allow explicit null or empty string to clear fields
    if (raw === null || raw === '') {
      updates[field] = null;
      continue;
    }

    // date_of_birth: validate YYYY-MM-DD
    if (field === 'date_of_birth') {
      if (typeof raw !== 'string') {
        throw new ValidationError('date_of_birth must be a string in YYYY-MM-DD format.');
      }

      const dob = raw.trim();
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dob)) {
        throw new ValidationError('date_of_birth must be in YYYY-MM-DD format.');
      }

      // verify it's a real date
      const parts = dob.split('-').map((p) => parseInt(p, 10));
      const [y, m, d] = parts;
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (
        dt.getUTCFullYear() !== y ||
        dt.getUTCMonth() + 1 !== m ||
        dt.getUTCDate() !== d
      ) {
        throw new ValidationError('date_of_birth is not a valid date.');
      }

      updates[field] = dob;
      continue;
    }

    // other fields must be strings
    if (typeof raw !== 'string') {
      throw new ValidationError(`${field} must be a string.`);
    }

    const value = raw.trim();

    if (value.length === 0) {
      updates[field] = null;
      continue;
    }

    const max = MAX_LENGTHS[field] || 255;
    if (value.length > max) {
      throw new ValidationError(`${field} is too long (max ${max} characters).`);
    }

    if (field === 'account_number') {
      // normalize: allow digits, spaces and dashes but require digits length between 6 and 34
      const digits = value.replace(/[^0-9]/g, '');
      if (digits.length < 6 || digits.length > MAX_LENGTHS.account_number) {
        throw new ValidationError('account_number must contain between 6 and 34 digits.');
      }
      updates[field] = value;
      continue;
    }

    updates[field] = value;
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No profile fields were provided for update.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update admin profile.');
  }

  return normalizeProfile(data);
}
