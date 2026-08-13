/**
 * Static OpenAPI 3.0 document for everything under `/api`. Served as JSON at
 * `/api/openapi.json` and rendered by Swagger UI at `/api`.
 *
 * Keep this in sync whenever a route under `src/server/api` changes — see
 * AGENTS.md.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Drop.it API',
    version: '1.0.0',
    description: 'File upload/download/admin API for Drop.it.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Either the session JWT from POST /auth/login, or a long-lived API token from POST /tokens.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth_token',
        description: 'Cookie set by POST /auth/login.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      FileRecord: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          filename: { type: 'string' },
          size: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          downloadCount: { type: 'integer' },
          deleteAfterDownload: { type: 'boolean' },
          deleted: { type: 'boolean' },
        },
      },
      ApiTokenRow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          revokedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Authenticate and set the auth cookie',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' } },
                },
              },
            },
          },
          '400': { description: 'Invalid request body' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: "Return the authenticated user's ID and role",
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user_id: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/auth/admin-check': {
      get: {
        tags: ['auth'],
        summary: 'Check that the authenticated user is an admin',
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['auth'],
        summary: "Change the authenticated user's password",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  oldPassword: { type: 'string' },
                  newPassword: { type: 'string' },
                },
                required: ['oldPassword', 'newPassword'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Password changed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
          '400': { description: 'Invalid request body, invalid new password, or wrong old password' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/files/upload': {
      post: {
        tags: ['files'],
        summary: 'Multipart upload (admin)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  duration: {
                    type: 'integer',
                    description: 'Seconds until expiry; omit or <=0 for no expiry.',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Uploaded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deletion_id: { type: 'string' },
                    filename: { type: 'string' },
                    size: { type: 'integer' },
                    view_key: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing file' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/view/{id}': {
      get: {
        tags: ['files'],
        summary: 'Stream a file inline',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'File stream, or the rendered "file not found" page' },
        },
      },
    },
    '/files/download/{id}': {
      get: {
        tags: ['files'],
        summary: 'Stream a file inline',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'File stream' } },
      },
    },
    '/files/delete/{del_id}': {
      get: {
        tags: ['files'],
        summary: 'Soft-delete and show a confirmation page (admin)',
        parameters: [{ name: 'del_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Rendered confirmation or "file not found" page' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/files/dashboard': {
      get: {
        tags: ['files-dashboard'],
        summary: 'List all file records (admin)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/FileRecord' } },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/dashboard/export': {
      get: {
        tags: ['files-dashboard'],
        summary: 'Export all file records (admin)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/FileRecord' } },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/dashboard/import': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Import file records (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/FileRecord' } },
            },
          },
        },
        responses: {
          '200': {
            description: 'Imported',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { imported: { type: 'integer' } },
                },
              },
            },
          },
          '400': { description: 'Invalid JSON' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/dashboard/delete/{id}': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Soft-delete a file and redirect to /dashboard',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '303': { description: 'Redirect to /dashboard' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'File not found' },
        },
      },
    },
    '/files/dashboard/delete/fr/{id}': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Permanently delete a file and redirect to /dashboard',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '303': { description: 'Redirect to /dashboard' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'File not found' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/dashboard/download/{id}': {
      get: {
        tags: ['files-dashboard'],
        summary: 'Stream an admin file by database ID (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'File stream' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'File not found' },
        },
      },
    },
    '/files/dashboard/{id}': {
      get: {
        tags: ['files-dashboard'],
        summary: 'Stream an admin file by database ID (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'File stream' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'File not found' },
        },
      },
    },
    '/tokens': {
      get: {
        tags: ['tokens'],
        summary: 'List API tokens (admin)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ApiTokenRow' } },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
      post: {
        tags: ['tokens'],
        summary: 'Issue an API token, returning the plaintext secret once (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  expiresInDays: { type: 'integer', nullable: true },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { $ref: '#/components/schemas/ApiTokenRow' },
                    secret: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid name or expiresInDays' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/tokens/{id}/revoke': {
      post: {
        tags: ['tokens'],
        summary: 'Revoke an API token (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Revoked',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiTokenRow' },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Token not found' },
          '500': { description: 'Server error' },
        },
      },
    },
  },
} as const;
