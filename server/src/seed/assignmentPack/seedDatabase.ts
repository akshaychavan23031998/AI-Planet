import { Types } from 'mongoose';
import pino from 'pino';
import { connectToDatabase, disconnectFromDatabase } from '../../database.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Claim } from '../../modules/claims/claim.model.js';
import { importAssignmentPack } from './importAssignmentPack.js';
import {
  CLAIM_KEY,
  SOURCE_DATASET,
  TRAVEL_KEY,
  canonicalRelationships,
} from './canonicalData.js';
import { verifySeed } from './verifySeed.js';

const logger = pino();

function seedIds(
  keys: string[],
  existing: { key: string; _id: Types.ObjectId; sourceDataset: string }[],
) {
  const ids = new Map(keys.map((key) => [key, new Types.ObjectId()]));
  for (const item of existing) {
    if (item.sourceDataset !== SOURCE_DATASET)
      throw new Error('Seed identity collides with a non-seed record');
    ids.set(item.key, item._id);
  }
  return ids;
}
function reference(
  ids: Map<string, Types.ObjectId>,
  key: string,
): Types.ObjectId {
  const id = ids.get(key);
  if (!id) throw new Error('Missing canonical relationship target');
  return id;
}
// Full documents are validated before writes; bulk updates preserve creation dates and IDs.
function operation(
  document: { toObject(): Record<string, unknown> },
  identity: 'seedKey' | 'employeeCode',
) {
  const { _id, ...fields } = document.toObject();
  return {
    updateOne: {
      filter: { [identity]: fields[identity], sourceDataset: SOURCE_DATASET },
      update: { $set: fields, $setOnInsert: { _id } },
      upsert: true,
    },
  };
}

async function main() {
  let stage = 'source validation';
  try {
    const data = await importAssignmentPack(process.env.ASSIGNMENT_PACK_PATH);
    logger.info('Canonical source inventory, hashes, CSV and MIME validated');
    stage = 'database connection';
    await connectToDatabase();
    stage = 'identity resolution';
    const [oldEmployees, oldTravels, oldEvidence, oldExpenses, oldClaims] =
      await Promise.all([
        Employee.find({
          employeeCode: {
            $in: data.employees.map((item) => item.employeeCode),
          },
        }).lean(),
        TravelRequest.find({ seedKey: TRAVEL_KEY }).lean(),
        Evidence.find({
          seedKey: { $in: data.evidence.map((item) => item.seedKey) },
        }).lean(),
        Expense.find({
          seedKey: { $in: data.expenses.map((item) => item.seedKey) },
        }).lean(),
        Claim.find({ seedKey: CLAIM_KEY }).lean(),
      ]);
    const employeeIds = seedIds(
      data.employees.map((item) => item.employeeCode),
      oldEmployees.map((item) => ({
        key: item.employeeCode,
        _id: item._id,
        sourceDataset: item.sourceDataset,
      })),
    );
    const travelIds = seedIds(
      [TRAVEL_KEY],
      oldTravels.map((item) => ({
        key: item.seedKey,
        _id: item._id,
        sourceDataset: item.sourceDataset,
      })),
    );
    const evidenceIds = seedIds(
      data.evidence.map((item) => item.seedKey),
      oldEvidence.map((item) => ({
        key: item.seedKey,
        _id: item._id,
        sourceDataset: item.sourceDataset,
      })),
    );
    const expenseIds = seedIds(
      data.expenses.map((item) => item.seedKey),
      oldExpenses.map((item) => ({
        key: item.seedKey,
        _id: item._id,
        sourceDataset: item.sourceDataset,
      })),
    );
    const claimIds = seedIds(
      [CLAIM_KEY],
      oldClaims.map((item) => ({
        key: item.seedKey,
        _id: item._id,
        sourceDataset: item.sourceDataset,
      })),
    );
    const travelId = reference(travelIds, TRAVEL_KEY);
    const claimantId = reference(employeeIds, 'NX-4471');
    const employees = data.employees.map(
      ({ reportingManagerCode, ...facts }) =>
        new Employee({
          ...facts,
          _id: reference(employeeIds, facts.employeeCode),
          sourceDataset: SOURCE_DATASET,
          reportingManager: reportingManagerCode
            ? reference(employeeIds, reportingManagerCode)
            : null,
        }),
    );
    const travel = new TravelRequest({
      _id: travelId,
      seedKey: TRAVEL_KEY,
      sourceDataset: SOURCE_DATASET,
      travelRequestId: null,
      employee: claimantId,
      origin: 'Pune',
      destination: 'Bengaluru',
      startDate: '2026-06-16',
      endDate: '2026-06-20',
      purpose:
        'Customer meeting / Vertex account review and site/plant visit planned for 18 Jun',
      travelType: 'DOMESTIC',
      costCentre: 'CE110',
      currency: 'INR',
      estimatedSpendMinor: 4800000,
      advanceRequestedMinor: 2000000,
      advanceDisbursedMinor: 2000000,
      advanceReference: 'ADV/2026/0619',
      advanceDisbursedDate: '2026-06-10',
      advanceNotifiedAt: new Date('2026-06-10T15:02:11+05:30'),
      advanceEvidence: [reference(evidenceIds, 'evidence-email-03')],
      plannedLodgingNights: 4,
      evidencedLodgingNights: 3,
      preTravelApprovals: [
        {
          approver: reference(employeeIds, 'NX-2210'),
          role: 'REPORTING_MANAGER',
          decision: 'APPROVED',
          approvedAt: new Date('2026-06-08T18:40:55+05:30'),
          evidence: reference(evidenceIds, 'evidence-email-02'),
        },
      ],
      sourceNotes: [
        'Actual Travel Request ID not supplied; seedKey is internal only.',
        'Only Reporting Manager pre-travel approval is evidenced; no HOD approval supplied.',
        'Estimated employee/company-borne breakdown absent; advance cap compliance undetermined.',
        'Four nights planned, three evidenced; no fourth lodging night supplied.',
        'Settlement submission date unknown. No completed plant visit or flight cabin class independently proven.',
      ],
    });
    const evidence = data.evidence.map(
      ({ parentKey, ...facts }) =>
        new Evidence({
          ...facts,
          _id: reference(evidenceIds, facts.seedKey),
          sourceDataset: SOURCE_DATASET,
          travelRequest: travelId,
          parentEvidence: parentKey ? reference(evidenceIds, parentKey) : null,
          relationships: canonicalRelationships
            .filter((item) => item.from === facts.seedKey)
            .map((item) => ({
              type: item.type,
              evidence: reference(evidenceIds, item.to),
            })),
        }),
    );
    const expenses = data.expenses.map(
      ({ evidenceKeys, ...facts }) =>
        new Expense({
          ...facts,
          _id: reference(expenseIds, facts.seedKey),
          sourceDataset: SOURCE_DATASET,
          travelRequest: travelId,
          employee: claimantId,
          sourceEvidence: evidenceKeys.map((key) =>
            reference(evidenceIds, key),
          ),
        }),
    );
    const claim = new Claim({
      _id: reference(claimIds, CLAIM_KEY),
      seedKey: CLAIM_KEY,
      sourceDataset: SOURCE_DATASET,
      travelRequest: travelId,
      employee: claimantId,
      currency: 'INR',
      status: 'DRAFT',
      approvals: [],
      expenses: expenses.map((item) => item._id),
    });
    stage = 'structural validation';
    await Promise.all(
      [...employees, travel, ...evidence, ...expenses, claim].map((document) =>
        document.validate(),
      ),
    );
    await Promise.all([
      Employee.init(),
      TravelRequest.init(),
      Evidence.init(),
      Expense.init(),
      Claim.init(),
    ]);
    stage = 'upserts';
    await Employee.bulkWrite(
      employees.map((item) => operation(item, 'employeeCode')),
    );
    await TravelRequest.bulkWrite([operation(travel, 'seedKey')]);
    await Evidence.bulkWrite(
      evidence.map((item) => operation(item, 'seedKey')),
    );
    await Expense.bulkWrite(expenses.map((item) => operation(item, 'seedKey')));
    await Claim.bulkWrite([operation(claim, 'seedKey')]);
    stage = 'persisted invariants';
    const result = await verifySeed();
    logger.info(
      { counts: result.counts, rawSourceTotalsMinor: result.totalsMinor },
      'Canonical seed verified; raw costs are not reimbursement',
    );
  } catch {
    // Driver/parser errors may contain credentials, paths or source bodies.
    logger.error(
      { stage },
      'Seed failed. Check source pack against canonical hashes, database access, and seed identity conflicts. No secret details logged.',
    );
    process.exitCode = 1;
  } finally {
    try {
      await disconnectFromDatabase();
    } catch {
      logger.error('Seed database disconnect failed');
      process.exitCode = 1;
    }
  }
}

void main();
