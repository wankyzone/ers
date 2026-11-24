import {
  emailSchema,
  passwordSchema,
} from "../../../packages/auth/src/validators.ts";

export function validateCustomerSignup(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  if (input.fullName.trim().length < 2 || input.fullName.trim().length > 100) {
    return "Enter a name between 2 and 100 characters.";
  }
  if (!emailSchema.safeParse(input.email.trim().toLowerCase()).success) {
    return "Enter a valid email address.";
  }
  if (!passwordSchema.safeParse(input.password).success) {
    return "Password must be at least 8 characters.";
  }
  if (input.password !== input.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

export function validateCustomerLogin(input: {
  email: string;
  password: string;
}) {
  if (!emailSchema.safeParse(input.email.trim().toLowerCase()).success) {
    return "Enter a valid email address.";
  }
  if (!passwordSchema.safeParse(input.password).success) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validatePasswordRecovery(email: string) {
  return emailSchema.safeParse(email.trim().toLowerCase()).success
    ? null
    : "Enter a valid email address.";
}

export function validatePasswordReset(input: {
  password: string;
  confirmPassword: string;
}) {
  if (!passwordSchema.safeParse(input.password).success) {
    return "Password must be at least 8 characters.";
  }
  if (input.password !== input.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}
