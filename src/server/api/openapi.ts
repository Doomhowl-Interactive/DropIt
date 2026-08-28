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
          downloadCount: { type: 'integer' },
          deleted: { type: 'boolean' },
        },
      },
      ApiTokenRow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
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
                  newPassword: { type: 'string' },
                },
                required: ['newPassword'],
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
          '400': { description: 'Invalid request body or invalid new password' },
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
          '206': { description: 'Partial file stream, in answer to a Range request' },
        },
      },
    },
    '/files/download/{id}': {
      get: {
        tags: ['files'],
        summary: 'Stream a file inline',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'File stream' },
          '206': { description: 'Partial file stream, in answer to a Range request' },
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
    '/files/dashboard/orphans': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Register loose files on disk that are missing from the database',
        responses: {
          '200': {
            description: 'How many loose files were registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { added: { type: 'integer' } },
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/files/dashboard/delete/{id}': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Soft-delete a file',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'The file was soft-deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string' }, deleted: { type: 'boolean' } },
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'File not found' },
        },
      },
    },
    '/files/dashboard/delete/fr/{id}': {
      post: {
        tags: ['files-dashboard'],
        summary: 'Permanently delete a file',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'The file was permanently deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string' }, deleted: { type: 'boolean' } },
                },
              },
            },
          },
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
          '206': { description: 'Partial file stream, in answer to a Range request' },
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
          '206': { description: 'Partial file stream, in answer to a Range request' },
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
          '400': { description: 'Invalid name' },
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
