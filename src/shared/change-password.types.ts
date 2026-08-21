import { z } from 'zod';

/**
 * Request and response bodies for `POST /api/auth/change-password`. Kept in a
 * dedicated module so the lazy-loaded change-password page can validate
 * responses without pulling every shared schema into its chunk graph.
 */

export const ChangePasswordRequestSchema = z.object({
  newPassword: z.string().min(1),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ChangePasswordResponseSchema = z.object({ message: z.string() });
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;
