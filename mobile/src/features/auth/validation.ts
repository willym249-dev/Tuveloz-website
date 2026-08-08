import { z } from 'zod';

/**
 * Validation for the auth forms.
 *
 * Client-side validation exists to give fast, specific feedback — it is not a
 * security control. Firebase enforces its own rules on the server, and the
 * password floor here is deliberately at least as strict as Firebase's.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Passwords cannot be longer than 128 characters.');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your name.')
  .max(80, 'That name is too long.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({ email: emailSchema });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Flattens a failed parse into `{ field: firstMessage }`, which is the shape
 * the form components render. Only the first error per field is kept — showing
 * someone three problems with one input at once is noise.
 */
export function fieldErrors<T>(error: z.ZodError<T>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in result)) {
      result[field] = issue.message;
    }
  }

  return result;
}
