import { z } from 'zod';

/**
 * Every request and response body crossing the `/api/*` boundary, as a Zod
 * schema. The server validates incoming bodies against these and shapes
 * outgoing JSON through them (which also guarantees fields like a file's
 * on-disk `path` never leak); the Angular app imports the same schemas to
 * validate what it gets back and to type what it sends. One definition, both
 * sides agree.
 */

export const ErrorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({ token: z.string() });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MeResponseSchema = z.object({
  user_id: z.string(),
  role: z.string(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const AdminCheckResponseSchema = z.object({ message: z.string() });
export type AdminCheckResponse = z.infer<typeof AdminCheckResponseSchema>;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const UploadResponseSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  view_key: z.string(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** A file record as it's allowed to leave the server — no on-disk `path`. */
export const FileExportRecordSchema = z.object({
  id: z.string(),
  viewId: z.string(),
  filename: z.string(),
  size: z.number(),
  downloadCount: z.number(),
  deleted: z.boolean(),
  createdAt: z.string(),
});
export type FileExportRecord = z.infer<typeof FileExportRecordSchema>;

export const FileExportResponseSchema = z.array(FileExportRecordSchema);
export type FileExportResponse = z.infer<typeof FileExportResponseSchema>;

/** The legacy, snake_cased shape `/dashboard/import` accepts. */
export const ImportFileRecordSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  download_count: z.number(),
  deleted: z.boolean(),
  created_at: z.string(),
});
export type ImportFileRecord = z.infer<typeof ImportFileRecordSchema>;

export const ImportRequestSchema = z.array(ImportFileRecordSchema);
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

export const ImportResponseSchema = z.object({ imported: z.number() });
export type ImportResponse = z.infer<typeof ImportResponseSchema>;

/** A row as rendered on the SSR dashboard page — display-formatted, not raw. */
export const DashboardFileRowSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.string(),
  createdAt: z.string(),
  downloadCount: z.number(),
  deleted: z.boolean(),
});
export type DashboardFileRow = z.infer<typeof DashboardFileRowSchema>;

// ---------------------------------------------------------------------------
// API tokens
// ---------------------------------------------------------------------------

export const MAX_TOKEN_NAME_LENGTH = 60;

/**
 * A token as the server is willing to describe it. Shared by the SSR page
 * data and the JSON API — note the absence of `tokenHash`.
 */
export const ApiTokenRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  revoked: z.boolean(),
});
export type ApiTokenRow = z.infer<typeof ApiTokenRowSchema>;

export const ApiTokensListResponseSchema = z.array(ApiTokenRowSchema);
export type ApiTokensListResponse = z.infer<typeof ApiTokensListResponseSchema>;

export const CreateApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TOKEN_NAME_LENGTH),
});
export type CreateApiTokenRequest = z.infer<typeof CreateApiTokenRequestSchema>;

/** Response to a token creation — the one and only sighting of `secret`. */
export const CreatedApiTokenSchema = z.object({
  token: ApiTokenRowSchema,
  secret: z.string(),
});
export type CreatedApiToken = z.infer<typeof CreatedApiTokenSchema>;
