import { Router } from 'express';
import { z } from 'zod';
import { classifications } from '../../modules/evidence/evidence.model.js';
import { demoIdentity, requestActor } from './identity.middleware.js';
import { ApiError } from './errorMapping.js';
import { WorkflowError } from '../../domain/claims/errors.js';
import * as queries from './query.service.js';
import * as serializers from './serializers.js';
import {
  parse,
  routeId,
  emptyBody,
  emptyQuery,
  remarksBody,
  excludeBody,
  resolutionBody,
  scheduleBody,
  paidBody,
} from './validation.js';
import { reviewClaimExpense } from '../../domain/claims/expenseReview.service.js';
import {
  submitClaim,
  resubmitClaim,
  approveClaim,
  returnClaim,
  verifyClaimByFinance,
  schedulePayment,
  markClaimPaid,
} from '../../domain/claims/claimWorkflow.service.js';
import type { Actor } from '../../domain/claims/types.js';

const list = <T>(data: T[]) => ({ data, meta: { count: data.length } });
const evidenceFilters = z.strictObject({
  kind: z.enum(['EMAIL', 'IMAGE']).optional(),
  classification: z.enum(classifications).optional(),
});
async function submit(claimId: string, actor: Actor, resubmit: boolean) {
  try {
    return await (resubmit ? resubmitClaim : submitClaim)(claimId, actor);
  } catch (error) {
    if (error instanceof WorkflowError && error.code === 'POLICY_NOT_READY') {
      const policy = await queries.getClaimEvaluation(claimId, actor);
      throw new ApiError('POLICY_NOT_READY', 'Claim is not ready to submit.', {
        findings: policy.findings,
      });
    }
    throw error;
  }
}
export const apiV1 = Router();
apiV1.get('/demo/users', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list((await queries.listDemoUsers()).map(serializers.serializeEmployee)),
  );
});
apiV1.use(demoIdentity);
apiV1.use((req, _res, next) => {
  if (!['GET', 'HEAD'].includes(req.method))
    parse(emptyQuery, req.query, 'INVALID_REQUEST');
  next();
});
apiV1.get('/travel-requests', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (await queries.listVisibleTravels(requestActor(req))).map((item) =>
        serializers.serializeTravel(item.travel, item.employee),
      ),
    ),
  );
});
apiV1.get('/travel-requests/:travelRequestId', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  const item = await queries.getVisibleTravel(
    routeId(req, 'travelRequestId'),
    requestActor(req),
  );
  res.json({ data: serializers.serializeTravel(item.travel, item.employee) });
});
apiV1.get('/travel-requests/:travelRequestId/evidence', async (req, res) => {
  const filters = parse(evidenceFilters, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (
        await queries.listEvidence(
          routeId(req, 'travelRequestId'),
          requestActor(req),
          {
            ...(filters.kind ? { kind: filters.kind } : {}),
            ...(filters.classification
              ? { classification: filters.classification }
              : {}),
          },
        )
      ).map(serializers.serializeEvidence),
    ),
  );
});
apiV1.get('/evidence/:evidenceId', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json({
    data: serializers.serializeEvidence(
      await queries.getEvidence(routeId(req, 'evidenceId'), requestActor(req)),
    ),
  });
});
apiV1.get('/travel-requests/:travelRequestId/expenses', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (
        await queries.listExpenses(
          routeId(req, 'travelRequestId'),
          requestActor(req),
        )
      ).map(serializers.serializeExpense),
    ),
  );
});
apiV1.get('/claims', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (await queries.listVisibleClaims(requestActor(req))).map((item) =>
        serializers.serializeClaim(item.claim, item.employee),
      ),
    ),
  );
});
apiV1.get('/claims/:claimId', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  const data = await queries.getVisibleClaim(
    routeId(req, 'claimId'),
    requestActor(req),
  );
  res.json({ data: serializers.serializeClaim(data.claim, data.employee) });
});
apiV1.get('/claims/:claimId/validation', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  const policy = await queries.getClaimEvaluation(
    routeId(req, 'claimId'),
    requestActor(req),
  );
  res.json({
    data: {
      findings: policy.findings,
      expenseResults: policy.expenseResults,
      requiredClaimApprovalLevels: policy.requiredClaimApprovalLevels,
      claimedValueMinor: policy.claimedValueMinor,
      claimApprovalBasisIsProvisional: policy.claimApprovalBasisIsProvisional,
    },
  });
});
apiV1.get('/claims/:claimId/readiness', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json({
    data: (
      await queries.getClaimEvaluation(
        routeId(req, 'claimId'),
        requestActor(req),
      )
    ).readiness,
  });
});
apiV1.get('/claims/:claimId/settlement', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json({
    data: serializers.serializeSettlement(
      await queries.getClaimEvaluation(
        routeId(req, 'claimId'),
        requestActor(req),
      ),
    ),
  });
});
apiV1.post('/claims/:claimId/expenses/:expenseId/exclude', async (req, res) => {
  const body = parse(excludeBody, req.body);
  const data = await reviewClaimExpense(
    routeId(req, 'claimId'),
    routeId(req, 'expenseId'),
    requestActor(req),
    { action: 'EXCLUDED', reason: body.reason },
  );
  res.json({ data: serializers.serializeClaim(data.claim, data.employee) });
});
apiV1.post('/claims/:claimId/expenses/:expenseId/restore', async (req, res) => {
  parse(emptyBody, req.body);
  const data = await reviewClaimExpense(
    routeId(req, 'claimId'),
    routeId(req, 'expenseId'),
    requestActor(req),
    { action: 'RESTORED' },
  );
  res.json({ data: serializers.serializeClaim(data.claim, data.employee) });
});
apiV1.post('/claims/:claimId/expenses/:expenseId/resolve', async (req, res) => {
  const body = parse(resolutionBody, req.body, 'INVALID_MANUAL_RESOLUTION');
  const data = await reviewClaimExpense(
    routeId(req, 'claimId'),
    routeId(req, 'expenseId'),
    requestActor(req),
    { action: 'RESOLVED', ...body },
  );
  res.json({ data: serializers.serializeClaim(data.claim, data.employee) });
});
apiV1.post('/claims/:claimId/submit', async (req, res) => {
  parse(emptyBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await submit(routeId(req, 'claimId'), requestActor(req), false),
    ),
  });
});
apiV1.post('/claims/:claimId/resubmit', async (req, res) => {
  parse(emptyBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await submit(routeId(req, 'claimId'), requestActor(req), true),
    ),
  });
});
apiV1.get('/approvals', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (await queries.listVisibleClaims(requestActor(req), 'approvals')).map(
        (item) => serializers.serializeClaim(item.claim, item.employee),
      ),
    ),
  );
});
apiV1.post('/claims/:claimId/approve', async (req, res) => {
  const body = parse(remarksBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await approveClaim(
        routeId(req, 'claimId'),
        requestActor(req),
        body.remarks,
      ),
    ),
  });
});
apiV1.post('/claims/:claimId/return', async (req, res) => {
  const body = parse(remarksBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await returnClaim(
        routeId(req, 'claimId'),
        requestActor(req),
        body.remarks ?? '',
      ),
    ),
  });
});
apiV1.get('/finance/claims', async (req, res) => {
  parse(emptyQuery, req.query, 'INVALID_REQUEST');
  res.json(
    list(
      (await queries.listVisibleClaims(requestActor(req), 'finance')).map(
        (item) => serializers.serializeClaim(item.claim, item.employee),
      ),
    ),
  );
});
apiV1.post('/claims/:claimId/finance/verify', async (req, res) => {
  const body = parse(remarksBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await verifyClaimByFinance(
        routeId(req, 'claimId'),
        requestActor(req),
        body.remarks,
      ),
    ),
  });
});
apiV1.post('/claims/:claimId/finance/schedule-payment', async (req, res) => {
  const body = parse(scheduleBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await schedulePayment(
        routeId(req, 'claimId'),
        requestActor(req),
        body.scheduledFor,
      ),
    ),
  });
});
apiV1.post('/claims/:claimId/finance/mark-paid', async (req, res) => {
  const body = parse(paidBody, req.body);
  res.json({
    data: serializers.serializeWorkflow(
      await markClaimPaid(
        routeId(req, 'claimId'),
        requestActor(req),
        body.paymentReference ?? '',
      ),
    ),
  });
});
apiV1.use(() => {
  throw new ApiError('NOT_FOUND', 'API route was not found.');
});
