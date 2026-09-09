import type { DemoEmployee } from '../api/demo';
import type {
  TravelRequest,
  Evidence,
  Expense,
  ClaimSummary,
  Classification,
} from '../api/types';
export const tripId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
export const people: DemoEmployee[] = [
  {
    id: '111111111111111111111111',
    employeeCode: 'NX-4471',
    name: 'Chaitanya Reddy',
    organizationalRole: 'EMPLOYEE',
  },
  {
    id: '222222222222222222222222',
    employeeCode: 'NX-2210',
    name: 'Suresh Iyer',
    organizationalRole: 'REPORTING_MANAGER',
  },
  {
    id: '333333333333333333333333',
    employeeCode: 'NX-1108',
    name: 'Meera Krishnan',
    organizationalRole: 'HEAD_OF_DEPARTMENT',
  },
  {
    id: '444444444444444444444444',
    employeeCode: 'NX-3305',
    name: 'Ravi Menon',
    organizationalRole: 'FINANCE',
  },
];
const classifications: Classification[] = [
  'SUPPORTING_TRIP',
  'APPROVAL',
  'ADVANCE',
  'COMPANY_PAID_COST',
  'SUPPORTING_TRIP',
  'EMPLOYEE_PAID_CANDIDATE',
  'EMPLOYEE_PAID_CANDIDATE',
  'PAYMENT_FAILURE',
  'EMPLOYEE_PAID_CANDIDATE',
  'DUPLICATE',
  'NEEDS_REVIEW',
  'NEEDS_REVIEW',
  'CLAIMANT_MISMATCH',
  'NOISE',
  'EMPLOYEE_PAID_CANDIDATE',
  'SUPPORTING_DOCUMENT',
  'SUPPORTING_DOCUMENT',
];
const subjects = [
  'Travel request',
  'Manager approval',
  'Advance credited',
  'Company flight ticket',
  'Hotel voucher',
  'Uber airport ride',
  'Uber hotel ride',
  'Uber payment failed',
  'Uber successful payment',
  'Uber receipt resend',
  'Dinner at Spice Terrace',
  'Final hotel invoice',
  'Deepa receipt',
  'MakeMyTrip promotion',
  'Uber return ride',
  'Dinner receipt image',
  'Hotel invoice image',
];
export const evidence: Evidence[] = classifications.map(
  (classification, index) => ({
    id: (index + 1).toString(16).padStart(24, '0'),
    travelRequest: tripId,
    classification,
    kind: index < 15 ? 'EMAIL' : 'IMAGE',
    sourceFilename:
      index < 15
        ? `${String(index + 1).padStart(2, '0')}_source.eml`
        : `${index === 15 ? 'dinner' : 'hotel'}.png`,
    sourceRelativePath:
      index < 15
        ? `sample_emails/${index + 1}.eml`
        : `receipts/${index === 15 ? 'dinner' : 'hotel'}.png`,
    mimeType: index < 15 ? 'message/rfc822' : 'image/png',
    messageId: index < 15 ? `message-${index + 1}@example.com` : null,
    subject: subjects[index]!,
    sender:
      index < 15
        ? { name: 'Source sender', address: 'sender@example.com' }
        : null,
    to: [{ name: 'Chaitanya Reddy', address: 'employee@example.com' }],
    cc: [],
    receivedAt: index < 15 ? '2026-06-18T12:30:00Z' : null,
    bodyText:
      index < 15
        ? `Source text for ${subjects[index]}. <script>untrusted()</script>`
        : null,
    parentEvidence:
      index === 15
        ? '00000000000000000000000b'
        : index === 16
          ? '00000000000000000000000c'
          : null,
    relationships:
      index === 7
        ? [{ type: 'RESOLVED_BY', evidence: '000000000000000000000009' }]
        : index === 9
          ? [{ type: 'DUPLICATE_OF', evidence: '000000000000000000000009' }]
          : index === 10
            ? [{ type: 'HAS_ATTACHMENT', evidence: '000000000000000000000010' }]
            : [],
    attachments: [],
    assetReference:
      index >= 15 ? `receipts/${index === 15 ? 'dinner' : 'hotel'}.png` : null,
    metadata:
      index === 15
        ? {
            merchant: 'Spice Terrace',
            documentNumber: 'D-18',
            currency: 'INR',
            totalMinor: 225500,
            subtotalMinor: 205000,
            receiptDate: '2026-06-18',
            covers: 4,
            attendeeOrganization: 'Vertex procurement team',
            guestName: null,
            nights: null,
            lines: [
              {
                description: 'Dinner',
                amountMinor: 225500,
                date: '2026-06-18',
                quantity: 4,
              },
            ],
          }
        : null,
  }),
);
export const trip: TravelRequest = {
  id: tripId,
  travelRequestId: null,
  employee: people[0]!,
  origin: 'Pune',
  destination: 'Bengaluru',
  startDate: '2026-06-16',
  endDate: '2026-06-20',
  purpose: 'Vertex account review and site visit',
  travelType: 'DOMESTIC',
  costCentre: 'CE110',
  currency: 'INR',
  estimatedSpendMinor: 4800000,
  advanceRequestedMinor: 2000000,
  advanceDisbursedMinor: 2000000,
  advanceReference: 'ADV/2026/0619',
  advanceDisbursedDate: '2026-06-10',
  plannedLodgingNights: 4,
  evidencedLodgingNights: 3,
  preTravelApprovals: [
    {
      approver: people[1]!.id,
      role: 'REPORTING_MANAGER',
      decision: 'APPROVED',
      approvedAt: '2026-06-08T13:10:55Z',
      evidence: evidence[1]!.id,
    },
  ],
  sourceNotes: [
    'No HOD pre-travel approval is established by the supplied sources.',
    'Hotel mixed-tax allocation remains unresolved.',
  ],
};
export const claims: ClaimSummary[] = [
  { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', travelRequest: tripId, status: 'DRAFT' },
];
const amounts = [
  501600, 554000, 141502, 74300, 17200, 122902, 225500, 575000, 575000, 575000,
  45000, 38000, 112000, 230400,
];
export const expenses: Expense[] = amounts.map((amountMinor, index) => ({
  id: (index + 50).toString(16).padStart(24, '0'),
  category:
    index < 2
      ? 'AIR_TRAVEL'
      : index < 6
        ? 'LOCAL_CONVEYANCE'
        : index === 6
          ? 'BUSINESS_ENTERTAINMENT'
          : index < 10
            ? 'LODGING'
            : index === 12
              ? 'MEAL'
              : 'OTHER',
  componentType:
    index < 2
      ? 'FLIGHT_SECTOR'
      : index < 6
        ? 'RIDE'
        : index === 6
          ? 'DINNER'
          : 'ROOM',
  expenseDate: '2026-06-18',
  merchant:
    index < 2
      ? 'IndiGo'
      : index < 6
        ? 'Uber'
        : index === 6
          ? 'Spice Terrace'
          : 'Keys Prime Whitefield',
  description: `Normalized expense ${index + 1}`,
  amountMinor,
  currency: 'INR',
  paidBy: index < 2 ? 'COMPANY' : 'EMPLOYEE',
  sourceReviewState: index === 6 || index >= 12 ? 'NEEDS_REVIEW' : 'CLEAR',
  sourceReviewNote: index === 13 ? 'Mixed-tax allocation unresolved' : null,
  sourceEvidence: [
    evidence[
      index < 2
        ? 3
        : index === 6
          ? 10
          : index >= 7
            ? 11
            : [5, 6, 8, 14][index - 2]!
    ]!.id,
    ...(index === 6
      ? [evidence[15]!.id]
      : index >= 7
        ? [evidence[16]!.id]
        : []),
  ],
}));
