import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { simpleParser } from 'mailparser';
import type { AddressObject } from 'mailparser';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import {
  canonicalEmails,
  canonicalImages,
  canonicalExpenses,
  sourceHashes,
} from './canonicalData.js';

const roles = {
  Employee: 'EMPLOYEE',
  'Reporting Manager': 'REPORTING_MANAGER',
  'Head of Department': 'HEAD_OF_DEPARTMENT',
  'Head of Division': 'HEAD_OF_DIVISION',
  MD: 'MANAGING_DIRECTOR',
  Finance: 'FINANCE',
} as const;
const employeeRow = z
  .object({
    emp_code: z.string().regex(/^NX-\d{4}$/),
    name: z.string().min(1),
    email: z.email(),
    designation: z.string().min(1),
    department: z.string().min(1),
    cost_centre: z.string().min(1),
    city: z.string().min(1),
    reporting_manager_code: z.string(),
    role: z.enum(Object.keys(roles) as (keyof typeof roles)[]),
  })
  .strict();

function addresses(value: AddressObject | AddressObject[] | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((group) => group.value)
    .map((item) => {
      if (!item.address)
        throw new Error('Email contains an unsupported recipient');
      return { name: item.name, address: item.address };
    });
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error('Source pack must not contain symbolic links');
    if (entry.isDirectory()) files.push(...(await listFiles(root, relative)));
    else if (entry.isFile()) files.push(relative);
    else throw new Error('Unsupported source entry');
  }
  return files.sort();
}

export async function importAssignmentPack(packPath: string | undefined) {
  if (!packPath?.trim())
    throw new Error('ASSIGNMENT_PACK_PATH is required for seed only');
  const root = path.resolve(packPath);
  if (!(await stat(root)).isDirectory())
    throw new Error('Assignment pack must be a directory');
  const actualPaths = await listFiles(root);
  const expectedPaths = Object.keys(sourceHashes).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error(
      'Source inventory differs from the 21-file canonical assignment pack',
    );
  }
  const files = new Map<string, Buffer>();
  for (const relative of expectedPaths) {
    const bytes = await readFile(path.join(root, relative));
    if (
      createHash('sha256').update(bytes).digest('hex') !==
      sourceHashes[relative]
    ) {
      throw new Error(`Canonical source hash mismatch: ${relative}`);
    }
    files.set(relative, bytes);
  }
  function source(relative: string): Buffer {
    const bytes = files.get(relative);
    if (!bytes) throw new Error(`Missing canonical source: ${relative}`);
    return bytes;
  }

  const parsedRows: unknown = parse(source('employee_master.csv'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
  const rows = z.array(employeeRow).length(9).parse(parsedRows);
  const codes = new Set(rows.map((row) => row.emp_code));
  if (
    codes.size !== 9 ||
    rows.some(
      (row) =>
        row.reporting_manager_code && !codes.has(row.reporting_manager_code),
    )
  ) {
    throw new Error('Canonical employee identities or hierarchy are invalid');
  }
  const employees = rows.map((row) => ({
    employeeCode: row.emp_code,
    name: row.name,
    designation: row.designation,
    organizationalRole: roles[row.role],
    department: row.department,
    costCentre: row.cost_centre,
    city: row.city,
    reportingManagerCode: row.reporting_manager_code || null,
  }));

  const emails = await Promise.all(
    canonicalEmails.map(async (expected) => {
      const relative = `sample_emails/${expected.filename}`;
      const bytes = source(relative);
      const parsed = await simpleParser(bytes, {
        skipHtmlToText: true,
        skipTextToHtml: true,
      });
      if (
        parsed.messageId !== expected.messageId ||
        !parsed.subject ||
        !parsed.text ||
        !parsed.date ||
        Number.isNaN(parsed.date.valueOf())
      ) {
        throw new Error(
          `Canonical email identity or required headers missing: ${expected.filename}`,
        );
      }
      const sender = addresses(parsed.from);
      if (sender.length !== 1)
        throw new Error('Canonical email must have one sender');
      const images = canonicalImages.filter(
        (image) => image.parentKey === expected.seedKey,
      );
      if (parsed.attachments.length !== images.length)
        throw new Error('Canonical attachment count mismatch');
      const attachments = parsed.attachments.map((attachment) => {
        const image = images.find(
          (item) => item.filename === attachment.filename,
        );
        if (
          !image ||
          attachment.contentType !== 'image/png' ||
          !bytes.includes(
            `[ATTACHMENT: see receipts/${image.filename} in this pack]`,
          )
        ) {
          throw new Error('Canonical external receipt pointer mismatch');
        }
        // The declared base64 body is a pointer, not an actual attachment image.
        return {
          filename: image.filename,
          mimeType: attachment.contentType,
          sourceRelativePath: `receipts/${image.filename}`,
          representation: 'EXTERNAL_PACK_POINTER',
        };
      });
      return {
        seedKey: expected.seedKey,
        kind: 'EMAIL' as const,
        sourceFilename: expected.filename,
        sourceRelativePath: relative,
        mimeType: 'message/rfc822',
        messageId: parsed.messageId,
        subject: parsed.subject,
        sender: sender[0],
        to: addresses(parsed.to),
        cc: addresses(parsed.cc),
        receivedAt: parsed.date,
        bodyText: parsed.text,
        classification: expected.classification,
        contentHashSha256: sourceHashes[relative],
        attachments,
        parentKey: null,
      };
    }),
  );
  const images = canonicalImages.map((image) => {
    const relative = `receipts/${image.filename}`;
    if (
      !source(relative)
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw new Error('Canonical image is not a PNG');
    }
    return {
      seedKey: image.seedKey,
      kind: 'IMAGE' as const,
      sourceFilename: image.filename,
      sourceRelativePath: relative,
      mimeType: 'image/png',
      contentHashSha256: sourceHashes[relative],
      classification: 'SUPPORTING_DOCUMENT' as const,
      parentKey: image.parentKey,
      assetReference: relative,
      receiptMetadata: image.receiptMetadata,
    };
  });
  return {
    employees,
    evidence: [...emails, ...images],
    expenses: canonicalExpenses,
  };
}
