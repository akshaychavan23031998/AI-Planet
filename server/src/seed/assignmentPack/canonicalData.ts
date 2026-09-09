import type { InferSchemaType } from 'mongoose';
import type { Expense } from '../../modules/expenses/expense.model.js';

export const SOURCE_DATASET = 'assignment-pack-v1';
export const TRAVEL_KEY = 'travel-bengaluru-2026-06';
export const CLAIM_KEY = 'claim-bengaluru-2026-06';

// Byte hashes pin this importer to the reviewed source pack, including reference-only files.
export const sourceHashes: Record<string, string> = {
  'employee_master.csv':
    '2775e9b3d54bb1fb432d77e90f1f833cdceb4cbcfa1192279f13bbbc88d5f544',
  'expense_policy.md':
    '93cc7d582c4d6a193fb5482526595f367bc24cb5a67fab9484db48bd715bccf4',
  'PROBLEM_STATEMENT.md':
    '6078ca1f3d042d884eff237ef9c984b80e6e582bdd13fa7e5fdf7b6c0ffc9edb',
  'receipts/dinner_bill_18jun.png':
    '19a5d1a74e3461265df98ff196b41f01fa30bbb60b0d08bb931af7ec82bb89cf',
  'receipts/hotel_invoice_1188.png':
    '9ccb787f8443888ed34a95f9a2d72649affdecc8e45af08d87b7e4f358d5d786',
  'sample_emails/01_travel_approval_request.eml':
    'e089836f23b8a11e282b664d52c3c6fa51274270e210ff2452b95947d74c1f96',
  'sample_emails/02_travel_approval_granted.eml':
    '945ad7e5c4d8dc3cc8a5f588b36747f75593c8a98284653a3499f3eba6f88cf9',
  'sample_emails/03_advance_disbursed.eml':
    '567a1ea5054c4aa3fe40ebafc5f2c853ec8a6879935503fa3dd05ca29ecc9c59',
  'sample_emails/04_flight_eticket.eml':
    '6c6d97aec886e518a5754ce453746e856027d0e0dd5e1d384a823c74570ce4e9',
  'sample_emails/05_hotel_voucher.eml':
    'fc97209049134b313ec1040d001a2ca588f2cf264b1a664003c9c57e208a615f',
  'sample_emails/06_uber_receipt_1.eml':
    'cab26bba09e90857222aad0287b51a3b3fa02fb4a67bedeb31095283707fc858',
  'sample_emails/07_uber_receipt_2.eml':
    '052754727331c7774563d0b25740f3ca2bd409c8a83925b04ef83423d477ad72',
  'sample_emails/08_uber_payment_failed.eml':
    'c431cf9053c6ed6318d90b7d283b8cb53fc3c01f79c4498274f771b73b0f7b0b',
  'sample_emails/09_uber_receipt_3.eml':
    'a55cbc5e10e087033b12f99524c20fba8331420000ee52d8544aef6608fc90d7',
  'sample_emails/10_uber_receipt_3_resend.eml':
    '10a8be6ed25f980889356c9e98dca11f20912181405c1103eba8ad68c3c8af8e',
  'sample_emails/11_dinner_bill.eml':
    '6643affba45d06cf17614820c092e73990548e3cff2544eaf8b3ffaa1d86f27e',
  'sample_emails/12_hotel_invoice.eml':
    'f0e2d2f5ee7fab9b36cd1b5baafe60a04c7956ecd8b0684d26ec1bc158653b01',
  'sample_emails/13_colleague_forward.eml':
    '80b161780babac212e477d5dd9a2899444e0d089e04d323d8d13b8a864cd60f7',
  'sample_emails/14_promo_noise.eml':
    '0fdcdd980ed9e0253de228f9c2fe64aa176f539791fd683db0b22afb9a199b55',
  'sample_emails/15_return_cab.eml':
    '81872918b26206139e9030b1901cd75fe19cb7ad43bb871fc0ad5342e5158ea9',
  'Travel_Expense_Forms_Template.xlsx':
    '6bb808799863da4529398aaa55d9edf11a1372afa3117934b90f602c10668304',
};

export const canonicalEmails = [
  {
    seedKey: 'evidence-email-01',
    filename: '01_travel_approval_request.eml',
    messageId: '<t-approval-001@nortexindustries.com>',
    classification: 'SUPPORTING_TRIP',
  },
  {
    seedKey: 'evidence-email-02',
    filename: '02_travel_approval_granted.eml',
    messageId: '<t-approval-002@nortexindustries.com>',
    classification: 'APPROVAL',
  },
  {
    seedKey: 'evidence-email-03',
    filename: '03_advance_disbursed.eml',
    messageId: '<adv-0619@nortexindustries.com>',
    classification: 'ADVANCE',
  },
  {
    seedKey: 'evidence-email-04',
    filename: '04_flight_eticket.eml',
    messageId: '<mmt-eticket-9119735@makemytrip.com>',
    classification: 'COMPANY_PAID_COST',
  },
  {
    seedKey: 'evidence-email-05',
    filename: '05_hotel_voucher.eml',
    messageId: '<mmt-hotel-8095495@makemytrip.com>',
    classification: 'SUPPORTING_TRIP',
  },
  {
    seedKey: 'evidence-email-06',
    filename: '06_uber_receipt_1.eml',
    messageId: '<uber-r1-88213@uber.com>',
    classification: 'EMPLOYEE_PAID_CANDIDATE',
  },
  {
    seedKey: 'evidence-email-07',
    filename: '07_uber_receipt_2.eml',
    messageId: '<uber-r2-88461@uber.com>',
    classification: 'EMPLOYEE_PAID_CANDIDATE',
  },
  {
    seedKey: 'evidence-email-08',
    filename: '08_uber_payment_failed.eml',
    messageId: '<uber-fail-88902@uber.com>',
    classification: 'PAYMENT_FAILURE',
  },
  {
    seedKey: 'evidence-email-09',
    filename: '09_uber_receipt_3.eml',
    messageId: '<uber-r3-88902b@uber.com>',
    classification: 'EMPLOYEE_PAID_CANDIDATE',
  },
  {
    seedKey: 'evidence-email-10',
    filename: '10_uber_receipt_3_resend.eml',
    messageId: '<uber-r3-resend@uber.com>',
    classification: 'DUPLICATE',
  },
  {
    seedKey: 'evidence-email-11',
    filename: '11_dinner_bill.eml',
    messageId: '<self-dinner-18jun@nortexindustries.com>',
    classification: 'NEEDS_REVIEW',
  },
  {
    seedKey: 'evidence-email-12',
    filename: '12_hotel_invoice.eml',
    messageId: '<keys-inv-1188@keysprimewhitefield.in>',
    classification: 'NEEDS_REVIEW',
  },
  {
    seedKey: 'evidence-email-13',
    filename: '13_colleague_forward.eml',
    messageId: '<deepa-fwd-2211@nortexindustries.com>',
    classification: 'CLAIMANT_MISMATCH',
  },
  {
    seedKey: 'evidence-email-14',
    filename: '14_promo_noise.eml',
    messageId: '<mmt-promo-3391@makemytrip.com>',
    classification: 'NOISE',
  },
  {
    seedKey: 'evidence-email-15',
    filename: '15_return_cab.eml',
    messageId: '<uber-r4-89551@uber.com>',
    classification: 'EMPLOYEE_PAID_CANDIDATE',
  },
] as const;

export const canonicalRelationships = [
  { from: 'evidence-email-01', type: 'HAS_REPLY', to: 'evidence-email-02' },
  { from: 'evidence-email-08', type: 'RESOLVED_BY', to: 'evidence-email-09' },
  { from: 'evidence-email-10', type: 'DUPLICATE_OF', to: 'evidence-email-09' },
  {
    from: 'evidence-email-11',
    type: 'HAS_ATTACHMENT',
    to: 'evidence-image-dinner',
  },
  {
    from: 'evidence-email-12',
    type: 'HAS_ATTACHMENT',
    to: 'evidence-image-hotel',
  },
  { from: 'evidence-email-05', type: 'FINALIZED_BY', to: 'evidence-email-12' },
] as const;

// Pre-extracted in docs/canonical-assignment-data.md, sections 7 and 12; not OCR.
export const canonicalImages = [
  {
    seedKey: 'evidence-image-dinner',
    filename: 'dinner_bill_18jun.png',
    parentKey: 'evidence-email-11',
    receiptMetadata: {
      method: 'CANONICAL_DOCUMENT',
      canonicalReference: 'docs/canonical-assignment-data.md',
      merchant: 'Spice Terrace',
      documentNumber: '4471',
      gstin: '29AAFCS1188K1ZP',
      currency: 'INR',
      totalMinor: 225500,
      subtotalMinor: 205000,
      receiptDate: '2026-06-18',
      occurredAt: new Date('2026-06-18T21:38:00+05:30'),
      cardLastFour: '2288',
      covers: 4,
      attendeeOrganization: 'Vertex procurement team',
      lines: [
        { description: 'Paneer Tikka', quantity: 2, amountMinor: 76000 },
        { description: 'Andhra Chicken', quantity: 1, amountMinor: 42000 },
        { description: 'Butter Naan', quantity: 4, amountMinor: 32000 },
        { description: 'Dal Makhani', quantity: 1, amountMinor: 31000 },
        { description: 'Fresh Lime Soda', quantity: 2, amountMinor: 24000 },
        { description: 'CGST 2.5%', amountMinor: 5125 },
        { description: 'SGST 2.5%', amountMinor: 5125 },
        { description: 'Service charge 5%', amountMinor: 10250 },
      ],
    },
  },
  {
    seedKey: 'evidence-image-hotel',
    filename: 'hotel_invoice_1188.png',
    parentKey: 'evidence-email-12',
    receiptMetadata: {
      method: 'CANONICAL_DOCUMENT',
      canonicalReference: 'docs/canonical-assignment-data.md',
      merchant: 'Keys Prime Whitefield',
      documentNumber: 'KPW/26-27/1188',
      gstin: '29AACCK7712M1Z4',
      currency: 'INR',
      totalMinor: 2150400,
      subtotalMinor: 1920000,
      cardLastFour: '2288',
      guestName: 'Chaitanya Reddy',
      checkInAt: new Date('2026-06-16T14:10:00+05:30'),
      checkOutAt: new Date('2026-06-19T11:05:00+05:30'),
      nights: 3,
      room: '412 Superior King',
      balanceDueMinor: 0,
      lines: [
        { description: 'Room', date: '2026-06-16', amountMinor: 575000 },
        { description: 'Room', date: '2026-06-17', amountMinor: 575000 },
        { description: 'Laundry', date: '2026-06-17', amountMinor: 45000 },
        { description: 'Room', date: '2026-06-18', amountMinor: 575000 },
        { description: 'Mini bar', date: '2026-06-18', amountMinor: 38000 },
        {
          description: 'In-room dining',
          date: '2026-06-18',
          amountMinor: 112000,
        },
        { description: 'CGST 6%', amountMinor: 115200 },
        { description: 'SGST 6%', amountMinor: 115200 },
      ],
    },
  },
];

type ExpenseFacts = Pick<
  InferSchemaType<typeof Expense.schema>,
  | 'seedKey'
  | 'category'
  | 'componentType'
  | 'expenseDate'
  | 'occurredAt'
  | 'merchant'
  | 'description'
  | 'amountMinor'
  | 'currency'
  | 'paidBy'
  | 'sourceReviewState'
  | 'sourceReviewNote'
  | 'details'
>;
export type CanonicalExpense = ExpenseFacts & { evidenceKeys: string[] };

export const canonicalExpenses: CanonicalExpense[] = [
  {
    seedKey: 'expense-flight-outbound',
    category: 'AIR_TRAVEL',
    componentType: 'FLIGHT_SECTOR',
    expenseDate: '2026-06-16',
    occurredAt: new Date('2026-06-16T07:55:00+05:30'),
    merchant: 'IndiGo',
    description: 'Pune to Bengaluru outbound sector',
    amountMinor: 501600,
    currency: 'INR',
    paidBy: 'COMPANY',
    sourceReviewState: 'CLEAR',
    evidenceKeys: ['evidence-email-04'],
    details: {
      origin: 'Pune',
      destination: 'Bengaluru',
      flightNumber: '6E-6284',
      pnr: 'QK4TZ9',
      bookingReference: 'NF9119735',
      paymentMethod: 'Nortex corporate card',
      cardLastFour: '4417',
      baseFareMinor: 412000,
      taxesAndFeesMinor: 89600,
    },
  },
  {
    seedKey: 'expense-flight-return',
    category: 'AIR_TRAVEL',
    componentType: 'FLIGHT_SECTOR',
    expenseDate: '2026-06-20',
    occurredAt: new Date('2026-06-20T19:15:00+05:30'),
    merchant: 'IndiGo',
    description: 'Bengaluru to Pune return sector',
    amountMinor: 554000,
    currency: 'INR',
    paidBy: 'COMPANY',
    sourceReviewState: 'CLEAR',
    evidenceKeys: ['evidence-email-04'],
    details: {
      origin: 'Bengaluru',
      destination: 'Pune',
      flightNumber: '6E-6491',
      pnr: 'QK4TZ9',
      bookingReference: 'NF9119735',
      paymentMethod: 'Nortex corporate card',
      cardLastFour: '4417',
    },
  },
  ...[
    {
      key: '01',
      email: '06',
      date: '2026-06-16',
      time: '05:20',
      amount: 141502,
      origin: 'Baner, Pune',
      destination: 'Pune Airport',
    },
    {
      key: '02',
      email: '07',
      date: '2026-06-16',
      time: '09:52',
      amount: 74300,
      origin: 'BLR Airport',
      destination: 'Keys Prime Whitefield',
    },
    {
      key: '03',
      email: '09',
      date: '2026-06-17',
      time: '19:35',
      amount: 17200,
      origin: 'Vertex Technologies, Whitefield',
      destination: 'Keys Prime Whitefield',
    },
    {
      key: '04',
      email: '15',
      date: '2026-06-20',
      time: '21:05',
      amount: 122902,
      origin: 'Pune Airport',
      destination: 'Baner, Pune',
    },
  ].map((ride): CanonicalExpense => ({
    seedKey: `expense-uber-${ride.key}`,
    category: 'LOCAL_CONVEYANCE',
    componentType: 'RIDE',
    expenseDate: ride.date,
    occurredAt: new Date(`${ride.date}T${ride.time}:00+05:30`),
    merchant: 'Uber',
    description: `${ride.origin} to ${ride.destination}`,
    amountMinor: ride.amount,
    currency: 'INR',
    paidBy: 'EMPLOYEE',
    sourceReviewState: 'CLEAR',
    evidenceKeys: [`evidence-email-${ride.email}`],
    details: {
      origin: ride.origin,
      destination: ride.destination,
      paymentMethod: 'Personal HDFC credit card',
      cardLastFour: '2288',
    },
  })),
  {
    seedKey: 'expense-dinner',
    category: 'BUSINESS_ENTERTAINMENT',
    componentType: 'DINNER',
    expenseDate: '2026-06-18',
    occurredAt: new Date('2026-06-18T21:38:00+05:30'),
    merchant: 'Spice Terrace',
    description: 'Dinner with Vertex procurement team',
    amountMinor: 225500,
    currency: 'INR',
    paidBy: 'EMPLOYEE',
    sourceReviewState: 'NEEDS_REVIEW',
    sourceReviewNote:
      'Individual attendee names and prior HOD approval are not supplied. No policy decision recorded.',
    evidenceKeys: ['evidence-email-11', 'evidence-image-dinner'],
    details: {
      invoiceNumber: '4471',
      covers: 4,
      attendeeOrganization: 'Vertex procurement team',
      paymentMethod: 'Card',
      cardLastFour: '2288',
    },
  },
  ...[
    {
      key: 'room-16',
      date: '2026-06-16',
      amount: 575000,
      category: 'LODGING',
      component: 'ROOM',
      review: 'CLEAR',
      note: 'Room night 16 Jun',
    },
    {
      key: 'room-17',
      date: '2026-06-17',
      amount: 575000,
      category: 'LODGING',
      component: 'ROOM',
      review: 'CLEAR',
      note: 'Room night 17 Jun',
    },
    {
      key: 'room-18',
      date: '2026-06-18',
      amount: 575000,
      category: 'LODGING',
      component: 'ROOM',
      review: 'CLEAR',
      note: 'Room night 18 Jun',
    },
    {
      key: 'laundry',
      date: '2026-06-17',
      amount: 45000,
      category: 'OTHER',
      component: 'LAUNDRY',
      review: 'CLEAR',
      note: 'Laundry',
    },
    {
      key: 'minibar',
      date: '2026-06-18',
      amount: 38000,
      category: 'OTHER',
      component: 'MINIBAR',
      review: 'CLEAR',
      note: 'Mini bar',
    },
    {
      key: 'dining',
      date: '2026-06-18',
      amount: 112000,
      category: 'MEAL',
      component: 'IN_ROOM_DINING',
      review: 'NEEDS_REVIEW',
      note: 'In-room dining; item details and meal/tax treatment unresolved',
    },
    {
      key: 'mixed-tax',
      date: null,
      amount: 230400,
      category: 'OTHER',
      component: 'HOTEL_MIXED_TAX',
      review: 'NEEDS_REVIEW',
      note: 'Aggregated folio tax; no per-item allocation or separate event date supplied',
    },
  ].map((item): CanonicalExpense => ({
    seedKey: `expense-hotel-${item.key}`,
    category: item.category as CanonicalExpense['category'],
    componentType: item.component as CanonicalExpense['componentType'],
    expenseDate: item.date,
    merchant: 'Keys Prime Whitefield',
    description: item.note,
    amountMinor: item.amount,
    currency: 'INR',
    paidBy: 'EMPLOYEE',
    sourceReviewState: item.review as CanonicalExpense['sourceReviewState'],
    sourceReviewNote: item.review === 'NEEDS_REVIEW' ? item.note : '',
    evidenceKeys: ['evidence-email-12', 'evidence-image-hotel'],
    details: {
      invoiceNumber: 'KPW/26-27/1188',
      paymentMethod: 'Guest HDFC credit card',
      cardLastFour: '2288',
    },
  })),
];
