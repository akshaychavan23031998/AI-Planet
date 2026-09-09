import type { OpenAPIV3 } from 'openapi-types';
import { schemas } from './schemas.js';
import { paths, responses } from './paths.js';

export const openapiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'AI Planet Expense Reimbursement API',
    version: '1.0.0',
    description:
      'Employee travel expense settlement with policy-aware review, business approvals and Finance actions. Demo identity is not real authentication. Money is integer INR paise; business dates are date-only and timestamps are ISO 8601. Source expenses are not automatically reimbursable. Obtain Mongo IDs from list responses. Requests reject unsupported query/body fields; no client-supplied roles or workflow transitions are accepted.',
  },
  servers: [{ url: '/', description: 'Same backend origin' }],
  tags: [
    'Operations',
    'Demo',
    'Travel Requests',
    'Evidence',
    'Expenses',
    'Claims',
    'Approvals',
    'Finance',
  ].map((name) => ({ name })),
  paths,
  components: {
    schemas,
    responses,
    securitySchemes: {
      DemoEmployee: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Demo-Employee-Code',
        description:
          'Demo identity only. The backend resolves Employee, role, reporting hierarchy and authorization from MongoDB. It is not real authentication. Enter an employee code, for example NX-4471 (Chaitanya Reddy) or NX-2210 (Suresh Iyer). Values are trimmed and must match ^NX-\\d{4}$. Missing/blank or unknown identity returns 401; malformed format returns 400. Do not enter a role or Bearer prefix.',
      },
    },
  },
};
