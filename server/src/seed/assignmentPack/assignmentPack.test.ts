import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Types } from 'mongoose';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { importAssignmentPack } from './importAssignmentPack.js';

const packPath = process.env.ASSIGNMENT_PACK_PATH;

test('canonical import preserves 15 emails, two external receipt pointers and known source totals', async () => {
  assert.ok(packPath, 'Set ASSIGNMENT_PACK_PATH for source-backed tests');
  const data = await importAssignmentPack(packPath);
  assert.deepEqual(
    [data.employees.length, data.evidence.length, data.expenses.length],
    [9, 17, 14],
  );
  const dinner = data.evidence.find(
    (item) => item.seedKey === 'evidence-email-11',
  );
  assert.ok(dinner?.kind === 'EMAIL');
  assert.equal(dinner.receivedAt.toISOString(), '2026-06-18T17:17:03.000Z');
  assert.match(dinner.bodyText, /Vertex procurement team, 4 people/);
  assert.equal(dinner.attachments[0]?.representation, 'EXTERNAL_PACK_POINTER');
  assert.equal(
    dinner.attachments[0]?.sourceRelativePath,
    'receipts/dinner_bill_18jun.png',
  );
  const hotel = data.evidence.find(
    (item) => item.seedKey === 'evidence-image-hotel',
  );
  assert.ok(hotel?.kind === 'IMAGE');
  assert.equal(hotel.receiptMetadata.method, 'CANONICAL_DOCUMENT');
  assert.equal(hotel.receiptMetadata.totalMinor, 2150400);
  assert.equal(
    data.expenses
      .filter((item) => item.paidBy === 'EMPLOYEE')
      .reduce((sum, item) => sum + item.amountMinor, 0),
    2731804,
  );
  assert.ok(
    data.expenses.every(
      (item) =>
        !item.evidenceKeys.some((key) =>
          ['08', '10', '13', '14'].some(
            (number) => key === `evidence-email-${number}`,
          ),
        ),
    ),
  );
  assert.equal(
    data.expenses.find((item) => item.componentType === 'HOTEL_MIXED_TAX')
      ?.expenseDate,
    null,
  );
});

test('missing configuration, altered sources and incomplete inventories fail without database access', async () => {
  await assert.rejects(importAssignmentPack(undefined), /ASSIGNMENT_PACK_PATH/);
  assert.ok(packPath);
  const temporary = await mkdtemp(path.join(tmpdir(), 'ai-planet-seed-'));
  if (
    path.dirname(temporary) !== path.resolve(tmpdir()) ||
    !path.basename(temporary).startsWith('ai-planet-seed-')
  )
    throw new Error('Unsafe temporary cleanup path');
  try {
    await assert.rejects(importAssignmentPack(temporary), /inventory differs/);
    await cp(packPath, temporary, { recursive: true });
    await appendFile(
      path.join(temporary, 'sample_emails/09_uber_receipt_3.eml'),
      '\nChanged fixture',
    );
    await assert.rejects(
      importAssignmentPack(temporary),
      /hash mismatch: sample_emails\/09_uber_receipt_3.eml/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

const expenseFacts = {
  seedKey: 'structural-test',
  sourceDataset: 'test',
  travelRequest: new Types.ObjectId(),
  employee: new Types.ObjectId(),
  category: 'LODGING',
  componentType: 'ROOM',
  expenseDate: '2026-06-16',
  merchant: 'Test hotel',
  description: 'Structural validation only',
  currency: 'INR',
  paidBy: 'EMPLOYEE',
  sourceReviewState: 'CLEAR',
  sourceEvidence: [new Types.ObjectId()],
};
test('money, dates, enums and proof references are structural; policy limits are not schema rules', async () => {
  for (const amountMinor of [-1, 1415.02, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      new Expense({ ...expenseFacts, amountMinor }).validate(),
    );
  }
  await new Expense({ ...expenseFacts, amountMinor: 999999 }).validate();
  for (const invalid of [
    { expenseDate: '2026-02-30' },
    { paidBy: 'OTHER' },
    { category: 'INVALID' },
    { sourceEvidence: [] },
    { employee: null },
  ]) {
    await assert.rejects(
      new Expense({ ...expenseFacts, amountMinor: 100, ...invalid }).validate(),
    );
  }
  const evidence = new Evidence({
    seedKey: 'structural-image',
    sourceDataset: 'test',
    travelRequest: new Types.ObjectId(),
    kind: 'IMAGE',
    sourceFilename: 'image.png',
    sourceRelativePath: '../image.png',
    mimeType: 'image/png',
    classification: 'SUPPORTING_DOCUMENT',
    contentHashSha256: 'a'.repeat(64),
  });
  await assert.rejects(evidence.validate());
});
