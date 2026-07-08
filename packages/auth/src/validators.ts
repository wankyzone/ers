import { z } from "zod";

export const phoneSchema = z.string().min(10).max(15);

export const emailSchema = z.email();

export const passwordSchema = z.string().min(8);