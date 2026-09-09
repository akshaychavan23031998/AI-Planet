import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, mock } from 'node:test';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp, logger } from '../app.js';
import { openapiDocument } from './document.js';
import { schemas, canonicalSettlement } from './schemas.js';
import { paths } from './paths.js';
import {
  canonicalDocuments,
  canonicalContext,
  employees,
} from '../domain/claims/claimWorkflow.fixtures.js';
import { apiDatabase } from '../api/v1/api.fixtures.js';
import * as serializers from '../api/v1/serializers.js';
import {
  classifications,
  relationshipTypes,
} from '../modules/evidence/evidence.model.js';
import { claimStatuses, workflowActions } from '../domain/claims/types.js';

logger.level = 'silent';
const app = createApp({
  NODE_ENV: 'development',
  CLIENT_ORIGIN: 'http://localhost:5173',
});
const featurePaths = [
  ['get', '/demo/users'],
  ['get', '/travel-requests'],
  ['get', '/travel-requests/{travelRequestId}'],
  ['get', '/travel-requests/{travelRequestId}/evidence'],
  ['get', '/evidence/{evidenceId}'],
  ['get', '/travel-requests/{travelRequestId}/expenses'],
  ['get', '/claims'],
  ['get', '/claims/{claimId}'],
  ['get', '/claims/{claimId}/validation'],
  ['get', '/claims/{claimId}/readiness'],
  ['get', '/claims/{claimId}/settlement'],
  ['post', '/claims/{claimId}/expenses/{expenseId}/exclude'],
  ['post', '/claims/{claimId}/expenses/{expenseId}/restore'],
  ['post', '/claims/{claimId}/expenses/{expenseId}/resolve'],
  ['post', '/claims/{claimId}/submit'],
  ['post', '/claims/{claimId}/resubmit'],
  ['get', '/approvals'],
  ['post', '/claims/{claimId}/approve'],
  ['post', '/claims/{claimId}/return'],
  ['get', '/finance/claims'],
  ['post', '/claims/{claimId}/finance/verify'],
  ['post', '/claims/{claimId}/finance/schedule-payment'],
  ['post', '/claims/{claimId}/finance/mark-paid'],
] as const;
function schema(name: string) {
  const value = schemas[name];
  assert.ok(value, name);
  return value;
}
function expanded(
  value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.SchemaObject {
  if ('$ref' in value) return schema(value.$ref.split('/').at(-1)!);
  if (value.allOf?.length === 1) return expanded(value.allOf[0]!);
  return value;
}
function fields(name: string, value: object) {
  assert.deepEqual(
    Object.keys(schema(name).properties ?? {}).sort(),
    Object.keys(value).sort(),
    name,
  );
}

test('OpenAPI 3.0.3 document validates and all references resolve offline', async () => {
  const result = await SwaggerParser.validate(
    structuredClone(openapiDocument),
    { resolve: { external: false } },
  );
  assert.equal('openapi' in result && result.openapi, '3.0.3');
  assert.equal(result.info.title, 'AI Planet Expense Reimbursement API');
  assert.ok(openapiDocument.components?.schemas);
  assert.ok(openapiDocument.components?.securitySchemes);
});
test('all 23 real feature operations and two operational paths are documented', async () => {
  assert.equal(Object.keys(paths).length, 25);
  const router = await readFile(
    new URL('../api/v1/router.ts', import.meta.url),
    'utf8',
  );
  const actual = [...router.matchAll(/apiV1\.(get|post)\('([^']+)'/g)]
    .map((match) => `${match[1]} ${match[2]!.replace(/:(\w+)/g, '{$1}')}`)
    .sort();
  assert.deepEqual(
    actual,
    featurePaths.map(([method, path]) => `${method} ${path}`).sort(),
  );
  const operationIds = new Set<string>();
  for (const [method, path] of featurePaths) {
    const op = paths[`/api/v1${path}`]?.[method];
    assert.ok(op, path);
    assert.ok(op.operationId);
    assert.ok(!operationIds.has(op.operationId));
    operationIds.add(op.operationId);
    assert.ok(op.responses['200']);
    const names = (op.parameters ?? []).map((item) => {
      assert.ok(!('$ref' in item));
      return item.name;
    });
    for (const match of path.matchAll(/{(\w+)}/g))
      assert.ok(names.includes(match[1]!));
  }
  assert.ok(paths['/health']?.get);
  assert.ok(paths['/ready']?.get);
});
test('protected operations use only DemoEmployee and public operations opt out', () => {
  const security = openapiDocument.components?.securitySchemes?.DemoEmployee;
  assert.ok(security && !('$ref' in security));
  assert.equal(security.type, 'apiKey');
  assert.ok('name' in security);
  assert.equal(security.name, 'X-Demo-Employee-Code');
  for (const [method, path] of featurePaths)
    assert.deepEqual(
      paths[`/api/v1${path}`]?.[method]?.security,
      path === '/demo/users' ? [] : [{ DemoEmployee: [] }],
    );
  for (const path of ['/health', '/ready'])
    assert.deepEqual(paths[path]?.get?.security, []);
});
test('major response schemas match actual serializer field sets', () => {
  const data = canonicalDocuments();
  const employee = employees.find((item) =>
    item._id.equals(data.claim.employee),
  )!;
  fields('EmployeeSummary', serializers.serializeEmployee(employee));
  fields('TravelRequest', serializers.serializeTravel(data.travel, employee));
  for (const item of data.evidence)
    fields('Evidence', serializers.serializeEvidence(item));
  for (const item of data.expenses)
    fields('Expense', serializers.serializeExpense(item));
  fields('Claim', serializers.serializeClaim(data.claim, employee));
  fields(
    'Settlement',
    serializers.serializeSettlement(canonicalContext().policy),
  );
  fields('Readiness', canonicalContext().policy.readiness);
  fields('ExpenseEvaluation', canonicalContext().policy.expenseResults[0]!);
  for (const name of [
    'ApiError',
    'PolicyFinding',
    'ManualResolution',
    'ExpenseReview',
    'ExpenseReviewHistory',
    'Finance',
    'WorkflowResult',
  ])
    assert.ok(schema(name));
});
test('documented source/workflow enums match implementation constants', () => {
  assert.deepEqual(schema('EvidenceClassification').enum, [...classifications]);
  assert.deepEqual(schema('ClaimStatus').enum, [...claimStatuses]);
  assert.deepEqual(schema('WorkflowAction').enum, [...workflowActions]);
  const relation = expanded(schema('Evidence').properties!.relationships!);
  assert.equal(relation.type, 'array');
  assert.ok('items' in relation && relation.items);
  assert.deepEqual(expanded(relation.items).properties?.type, {
    type: 'string',
    enum: [...relationshipTypes],
  });
  assert.ok(!schema('ClaimStatus').enum?.includes('SUBMITTED'));
});
test('canonical settlement example matches backend evaluation without fabricated final amounts', () => {
  assert.deepEqual(
    canonicalSettlement,
    serializers.serializeSettlement(canonicalContext().policy),
  );
  assert.equal(canonicalSettlement.payableMinor, null);
  assert.equal(canonicalSettlement.recoverableMinor, null);
  assert.equal(
    expanded(schema('TravelRequest').properties!.travelRequestId!).example,
    null,
  );
  assert.equal(schema('MoneyMinor').type, 'integer');
  assert.equal(schema('MoneyMinor').maximum, Number.MAX_SAFE_INTEGER);
  assert.equal(schema('BusinessDate').format, 'date');
  assert.equal(schema('Timestamp').format, 'date-time');
  for (const name of ['payableMinor', 'recoverableMinor']) {
    const property = expanded(schema('Settlement').properties![name]!);
    assert.ok(
      property.anyOf?.some(
        (item) => !('$ref' in item) && item.nullable === true,
      ),
    );
  }
});
test('request schemas accept no server-managed fields and preserve action-specific requirements', () => {
  for (const name of [
    'ExcludeExpenseRequest',
    'ResolveExpenseRequest',
    'ApproveClaimRequest',
    'ReturnClaimRequest',
    'SchedulePaymentRequest',
    'MarkPaidRequest',
  ]) {
    assert.equal(schema(name).additionalProperties, false);
    for (const field of [
      'status',
      'role',
      'level',
      'approverId',
      'reviewCycle',
      'workflowVersion',
    ])
      assert.ok(!(field in schema(name).properties!));
  }
  assert.deepEqual(schema('ExcludeExpenseRequest').required, ['reason']);
  assert.deepEqual(schema('ResolveExpenseRequest').required, [
    'reimbursableMinor',
    'disallowedMinor',
    'reason',
  ]);
  assert.deepEqual(schema('ReturnClaimRequest').required, ['remarks']);
  for (const action of ['restore', 'submit', 'resubmit']) {
    const path =
      action === 'restore'
        ? '/api/v1/claims/{claimId}/expenses/{expenseId}/restore'
        : `/api/v1/claims/{claimId}/${action}`;
    assert.equal(paths[path]?.post?.requestBody, undefined);
  }
  assert.equal(
    expanded(schema('Claim').properties!.workflowVersion!).readOnly,
    true,
  );
});
test('only implemented evidence filters are advertised', () => {
  const params =
    paths['/api/v1/travel-requests/{travelRequestId}/evidence']?.get
      ?.parameters ?? [];
  const query = params.filter(
    (item) => !('$ref' in item) && item.in === 'query',
  );
  assert.deepEqual(
    query.map((item) => {
      assert.ok(!('$ref' in item));
      return item.name;
    }),
    ['kind', 'classification'],
  );
});
test('OpenAPI JSON is public and static with Mongo queries prohibited', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(mongoose.Query.prototype, 'exec', async () => {
    throw new Error('Documentation must not query MongoDB');
  });
  const response = await request(app)
    .get('/openapi.json')
    .expect(200)
    .expect('Content-Type', /json/);
  assert.deepEqual(response.body, openapiDocument);
  assert.ok(
    !/mongodb(?:\+srv)?:\/\/|[A-Za-z]:\\|Downloads|TRQ-2026-0000|__v/.test(
      response.text,
    ),
  );
  assert.deepEqual(openapiDocument.servers, [
    { url: '/', description: 'Same backend origin' },
  ]);
});
test('Swagger UI, initialization and assets are public and use the single JSON document', async () => {
  await request(app)
    .get('/docs')
    .redirects(1)
    .expect(200)
    .expect('Content-Type', /html/);
  const html = await request(app).get('/docs/').expect(200);
  assert.match(html.text, /AI Planet Expense Reimbursement API/);
  const js = await request(app).get('/docs/swagger-ui-init.js').expect(200);
  assert.match(js.text, /\/openapi.json/);
  assert.match(js.text, /persistAuthorization/);
  await request(app)
    .get('/docs/swagger-ui.css')
    .expect(200)
    .expect('Content-Type', /css/);
});
test('real HTTP errors and canonical settlement agree with documented envelopes/examples', async (t) => {
  t.after(() => mock.restoreAll());
  const db = apiDatabase();
  const missing = await request(app).get('/api/v1/claims').expect(401);
  const unauthorized = openapiDocument.components?.responses?.Unauthorized;
  assert.ok(unauthorized && !('$ref' in unauthorized));
  assert.deepEqual(
    missing.body,
    unauthorized.content?.['application/json']?.example,
  );
  const settlement = await request(app)
    .get(`/api/v1/claims/${db.claim._id}/settlement`)
    .set('X-Demo-Employee-Code', 'NX-4471')
    .expect(200);
  assert.deepEqual(settlement.body, { data: canonicalSettlement });
  const blocked = await request(app)
    .post(`/api/v1/claims/${db.claim._id}/submit`)
    .set('X-Demo-Employee-Code', 'NX-4471')
    .send({})
    .expect(422);
  const body = blocked.body as {
    error: { code: string; details: { findings: unknown[] } };
  };
  assert.equal(body.error.code, 'POLICY_NOT_READY');
  assert.ok(body.error.details.findings.length);
  assert.equal(db.writeCount, 0);
});
