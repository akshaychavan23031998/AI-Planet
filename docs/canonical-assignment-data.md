# Canonical assignment data

## 1. Purpose

This document freezes the source-backed interpretation of the supplied Nortex travel-expense pack before domain modeling. It is the single derived contract for later modeling, deterministic import/seed, policy implementation, APIs, UI labels, tests and the assignment note. It separates **source facts**, **deterministic conclusions**, **approved product decisions**, and **unknowns / needs review**. It is documentation, not runtime fixtures, a schema or a final settlement.

## 2. Interpretation vocabulary

| Category                  | Meaning                                                               | Example                                                                          |
| ------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Source fact               | Directly stated or visible in a supplied artifact.                    | Final hotel invoice total is INR 21,504.                                         |
| Deterministic conclusion  | Follows from facts and an explicit policy rule or arithmetic.         | Bengaluru is Tier 1; room tariff entitlement is INR 6,000/night excluding taxes. |
| Approved product decision | Approved take-home behavior, not a historical event.                  | Never fabricate the missing Travel Request ID.                                   |
| Unknown / needs review    | Evidence is absent, incomplete or does not establish a unique answer. | Final hotel tax allocation across mixed folio items.                             |

A paid expense candidate is not automatically approved or reimbursable. Classification labels describe business meaning; they do not prescribe code enums.

## 3. Source precedence and inventory

The problem statement says the pack is the specification. Actual emails and receipt images establish events, amounts, ownership, payment and approval evidence; `expense_policy.md` establishes current rules; `employee_master.csv` establishes people and reporting relationships. The workbook establishes form terminology, fields, proof expectations and settlement mechanics, but its grey/italic values are a worked example only. Never silently merge illustrative values with actual evidence.

The external HTML prototype is the approved visual and interaction baseline. Where a prototype business fact conflicts with the pack, the pack wins. Prototype actions, including recording a local approval or resolving a review, are not historical evidence.

Original reference root: `C:\Users\Akshay\Downloads\expense_reimbursement_takehome`. Paths below are relative to that root. Source files were inspected read-only; the raw pack and prototype are not copied into this repository.

| Source                                    | Version/date and responsibility                                                                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack/PROBLEM_STATEMENT.md`               | No revision/effective date stated. Defines the manual travel-to-settlement problem, pack precedence, working application, short note and recording; 48-hour timebox, roughly eight hours of work. Does not prescribe architecture. |
| `pack/expense_policy.md`                  | NTX-HR-POL-11, Rev 4, effective 01 Apr 2026, India-based employees. Current rules.                                                                                                                                                 |
| `pack/employee_master.csv`                | No revision date stated; nine employees. Identity, role, department, cost centre, city and reporting-manager code.                                                                                                                 |
| `pack/Travel_Expense_Forms_Template.xlsx` | **Travel Request Form** (NTX-TRF-02) and **Expense Settlement Form** (NTX-SET-02), both Rev Nov 2025. Package metadata says created/modified 02 Sep 2026; file metadata is not a trip or submission date.                          |
| `pack/sample_emails/`                     | All 15 exact filenames, message references and dates are inventoried in the single ledger in section 6. Messages span 08–20 Jun 2026; the colleague's forwarded ride is dated 12 May 2026.                                         |
| `pack/receipts/dinner_bill_18jun.png`     | Actual receipt image dated 18 Jun 2026; linked by email 11; visually inspected.                                                                                                                                                    |
| `pack/receipts/hotel_invoice_1188.png`    | Actual final invoice image for 16–19 Jun 2026; linked by email 12; visually inspected.                                                                                                                                             |
| `expense-management-prototype.html`       | Approved external visual/interaction baseline, titled “Nortex Expense — Travel Settlement Prototype”; no version/date established from reviewed content. Not historical approval/payment evidence.                                 |

The actual pack matches the supplied inventory: four root files, 15 emails and two images (21 files). Both workbook sheets, all email headers/bodies/MIME structures, CSV rows, policy, problem statement and both images were inspected. No assignment artifact remained unverified. Forms predate the effective policy; current policy controls conflicting approval requirements.

## 4. Canonical employee and hierarchy facts

**Source fact — `employee_master.csv`:**

| Employee code | Person          | Role / designation                                     | Department; cost centre; city | Reports to                            |
| ------------- | --------------- | ------------------------------------------------------ | ----------------------------- | ------------------------------------- |
| NX-4471       | Chaitanya Reddy | Employee; Manager - Key Accounts; claimant             | Sales; CE110; Pune            | NX-2210                               |
| NX-2210       | Suresh Iyer     | Reporting Manager; Deputy General Manager              | Sales; CE110; Pune            | NX-1108                               |
| NX-1108       | Meera Krishnan  | Head of Department; Head of Department - Sales         | Sales; CE100; Mumbai          | NX-1002                               |
| NX-1002       | Arvind Rao      | Head of Division; Head of Division - Commercial        | Commercial; CE001; Mumbai     | NX-1000                               |
| NX-1000       | Nandita Shah    | MD; Managing Director                                  | Corporate; CE001; Mumbai      | Blank; no further manager established |
| NX-3305       | Ravi Menon      | Finance; Manager - Finance Shared Services             | Finance; CE900; Pune          | NX-3300                               |
| NX-3300       | Kavitha Balan   | Finance; Controller                                    | Finance; CE900; Pune          | NX-1002                               |
| NX-5182       | Deepa Nair      | Employee; Manager - Presales; unrelated receipt owner  | Sales; CE110; Chennai         | NX-2210                               |
| NX-4490       | Imran Qureshi   | Employee; Executive - Sales; no supplied trip evidence | Sales; CE110; Pune            | NX-2210                               |

Verified claimant chain: **Chaitanya Reddy → Suresh Iyer → Meera Krishnan → Arvind Rao → Nandita Shah**. Finance's reporting chain is Ravi → Kavitha → Arvind. Reporting relationships do not prove approvals. Email 02 addresses Ravi; email 03 is sent by Finance Shared Services and does not name the individual disbursement operator. Deepa's shared manager/cost centre does not make her receipt Chaitanya's expense.

## 5. Canonical trip facts

| Fact                                    | Canonical interpretation                                                          | Basis/category                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Claimant                                | Chaitanya Reddy, NX-4471                                                          | Source fact: CSV, email 03; ticket/receipts identify Chaitanya.                                                                   |
| Origin / destination                    | Pune → Bengaluru, return to Pune                                                  | Source fact: emails 01, 04, 06, 07, 15.                                                                                           |
| Travel dates                            | 16–20 Jun 2026 inclusive                                                          | Source fact: request and flight itinerary; return cab 20 Jun. Five calendar days is arithmetic, not an automatic allowance claim. |
| Purpose                                 | Customer meeting / Vertex account review plus site/plant visit planned for 18 Jun | Source fact: email 01. Actual completion of the plant visit not independently proven.                                             |
| Category / cost centre                  | Domestic, Tier 1; CE110                                                           | Source fact: email 01/CSV; Bengaluru's Tier 1 status also in policy §3.1.                                                         |
| Estimated spend                         | INR 48,000                                                                        | Source fact: email 01; authoritative employee/company split absent.                                                               |
| Advance requested / disbursed           | INR 20,000 / INR 20,000                                                           | Source fact: emails 01–03; credited 10 Jun, ADV/2026/0619.                                                                        |
| Mode                                    | Flight, Pune–Bengaluru return                                                     | Source fact: emails 01/04. Domestic economy required by policy; actual ticket does not explicitly state cabin class.              |
| Planned lodging                         | Four nights                                                                       | Source fact: email 01.                                                                                                            |
| Supported actual lodging                | Three nights, 16 Jun check-in, 19 Jun check-out; Keys Prime Whitefield            | Source fact: emails 05/12 and image. No fourth night established.                                                                 |
| Travel Request ID                       | **Unknown / Needs confirmation**                                                  | No actual source email/receipt proves one. TRQ-2026-0000 is illustrative.                                                         |
| Business approval evidence              | RM approval by Suresh on 08 Jun; HOD approval not proven                          | Source fact: email 02. Deterministic conclusion: INR 48,000 requires RM + HOD.                                                    |
| Settlement submission / final approvals | Not established                                                                   | No submitted claim, Finance verification or settlement payment/recovery event supplied. Advance credit is not settlement payment. |

## 6. Canonical evidence ledger

Exactly one row per source email, all under `pack/sample_emails/`. Message IDs omit surrounding angle brackets. Header timestamps use the supplied `+0530` offset; body event times are recorded separately. Filename order is not necessarily chronological (14 precedes 13 on 19 Jun). Amounts are INR. Related numbers identify ledger rows, not invented application IDs.

| Seq | Source filename                  | Message / document reference                            | Header date (+0530)  | Type / semantic classification                                                 | Key source facts                                                                                                                                                                                                | Expected claim treatment                                                                  | Related evidence / review note                                                                                                      |
| --- | -------------------------------- | ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 01  | `01_travel_approval_request.eml` | `t-approval-001@nortexindustries.com`                   | 08 Jun 2026 11:12:04 | Claimant request / Supporting trip evidence                                    | Chaitanya to Suresh; Bengaluru 16–20 Jun; Vertex review, plant visit 18 Jun; flight return from Pune; four lodging nights; estimate INR 48,000; advance INR 20,000; CE110.                                      | Trip context, not expense. Real Travel Request ID unknown.                                | 02 explicitly replies to 01. RM + HOD needed; borne-by estimate split absent.                                                       |
| 02  | `02_travel_approval_granted.eml` | `t-approval-002@nortexindustries.com`                   | 08 Jun 2026 18:40:55 | Manager reply / Approval evidence                                              | Suresh approves, reminds INR 6,000/night limit, asks Ravi to process INR 20,000; Ravi CC'd.                                                                                                                     | Record RM approval only, not all required approvals; not expense.                         | In-Reply-To and References identify 01; context for 03. HOD approval absent.                                                        |
| 03  | `03_advance_disbursed.eml`       | `adv-0619@nortexindustries.com`; ADV/2026/0619          | 10 Jun 2026 15:02:11 | Finance notice / Advance                                                       | INR 20,000 credited to Chaitanya NX-4471's registered account; settle within seven days of return.                                                                                                              | Settlement adjustment, not expense.                                                       | 01/02 request/process advance. Reference suffix 0619 is not the credit date.                                                        |
| 04  | `04_flight_eticket.eml`          | `mmt-eticket-9119735@makemytrip.com`; NF9119735; QK4TZ9 | 11 Jun 2026 09:44:07 | MakeMyTrip ticket / Company-paid trip cost                                     | Chaitanya; 16 Jun PNQ 07:55 → BLR 09:30, 6E-6284: INR 4,120 fare + INR 896 tax/fees = INR 5,016. 20 Jun BLR 19:15 → PNQ 20:55, 6E-6491: INR 5,540. Both Nortex corporate card ending 4417.                      | Audit-visible sectors; combined INR 10,556 never increases employee reimbursement.        | 01 trip, 06/07/15 airport transfers. No return fare/tax split or cabin class stated; ticket is not boarding-pass proof.             |
| 05  | `05_hotel_voucher.eml`           | `mmt-hotel-8095495@makemytrip.com`; NH8095495           | 11 Jun 2026 09:51:33 | MakeMyTrip booking / Supporting trip evidence                                  | Keys Prime Hotel, Whitefield; Chaitanya; 16–19 Jun, three nights, Superior King, Room Only; INR 5,750/night; room INR 17,250; GST 12% INR 2,070; total INR 19,320; Pay at Hotel.                                | Booking support, not additional paid expense or strongest final proof.                    | 12 final paid folio. Preserve voucher; its room-only tax is not a final mixed-folio allocation.                                     |
| 06  | `06_uber_receipt_1.eml`          | `uber-r1-88213@uber.com`                                | 16 Jun 2026 06:41:22 | Uber paid receipt / Employee-paid expense candidate                            | 16 Jun 05:20, Baner → Pune Airport; INR 1,415.02 = fare INR 1,229 + surcharge INR 96 + tax INR 90.02; personal HDFC card ending 2288.                                                                           | Unique airport-transfer candidate under §3.4.                                             | 01/04. Embedded 20% offer up to INR 150 is marketing, not fare or deduction.                                                        |
| 07  | `07_uber_receipt_2.eml`          | `uber-r2-88461@uber.com`                                | 16 Jun 2026 10:38:04 | Uber paid receipt / Employee-paid expense candidate                            | 16 Jun 09:52, BLR airport → Keys Prime Whitefield; INR 743; personal HDFC card ending 2288.                                                                                                                     | Unique airport-transfer candidate.                                                        | 04 arrival and 05 hotel; actuals against receipt.                                                                                   |
| 08  | `08_uber_payment_failed.eml`     | `uber-fail-88902@uber.com`                              | 17 Jun 2026 20:14:51 | Uber failure / Payment failure                                                 | Charge failed; INR 172 due; 17 Jun 19:35, Vertex Technologies Whitefield → Keys Prime Whitefield.                                                                                                               | Not a paid expense; preserve context.                                                     | Same ride succeeds in 09; matching time, route, amount. No second expense.                                                          |
| 09  | `09_uber_receipt_3.eml`          | `uber-r3-88902b@uber.com`                               | 17 Jun 2026 21:02:17 | Uber paid receipt / Employee-paid expense candidate                            | INR 172 paid; 17 Jun 19:35, Vertex Technologies → Keys Prime Whitefield; personal HDFC card ending 2288.                                                                                                        | Represent paid ride once.                                                                 | Resolves failure 08; canonical paid evidence for duplicate 10.                                                                      |
| 10  | `10_uber_receipt_3_resend.eml`   | `uber-r3-resend@uber.com`                               | 18 Jun 2026 08:11:40 | Forwarded/resend / Duplicate                                                   | Repeats 17 Jun 19:35, route, INR 172 and personal HDFC card ending 2288 from 09.                                                                                                                                | No second reimbursement; retain duplicate evidence.                                       | **10 → duplicate of 09**. Different Message-ID does not mean different expense.                                                     |
| 11  | `11_dinner_bill.eml`             | `self-dinner-18jun@nortexindustries.com`; bill 4471     | 18 Jun 2026 22:47:03 | Self-mail + attachment pointer / Needs review                                  | Vertex procurement team dinner, four people, retained for claim. Image: Spice Terrace, 18 Jun, INR 2,255, card ending 2288.                                                                                     | Business Entertainment candidate, not ordinary meals; no silent reimbursement.            | `receipts/dinner_bill_18jun.png`. §3.5: names/organisations and prior HOD approval above INR 2,000 required; names/approval absent. |
| 12  | `12_hotel_invoice.eml`           | `keys-inv-1188@keysprimewhitefield.in`; KPW/26-27/1188  | 19 Jun 2026 11:20:09 | Final invoice + attachment pointer / Employee-paid mixed expense, needs review | Three nights 16–19 Jun; rooms INR 17,250; laundry INR 450; mini bar INR 380; dining INR 1,120; subtotal INR 19,200; CGST INR 1,152 + SGST INR 1,152; total INR 21,504. Settled by guest, HDFC card ending 2288. | Room tariff passes; INR 830 disallowed base; dining meal candidate; mixed tax unresolved. | `receipts/hotel_invoice_1188.png`; booking 05. Email/image/voucher are not three paid expenses.                                     |
| 13  | `13_colleague_forward.eml`       | `deepa-fwd-2211@nortexindustries.com`                   | 19 Jun 2026 16:33:12 | Deepa's forwarded receipt / Claimant mismatch                                  | Deepa asks Chaitanya to include her old ride and settle offline; INR 640, 12 May 2026 08:10, Guindy → Chennai Airport.                                                                                          | Excluded: another person's expense, outside trip; audit-visible.                          | CSV NX-5182; §4 claimant ownership exclusion. Payment method not supplied.                                                          |
| 14  | `14_promo_noise.eml`             | `mmt-promo-3391@makemytrip.com`                         | 19 Jun 2026 07:00:00 | MakeMyTrip marketing / Irrelevant-noise                                        | MONSOON30 offer, save up to INR 6,000, valid till 21 Jun; 12,000+ properties.                                                                                                                                   | No incurred expense; retain classification evidence.                                      | Numbers/currency do not establish a bill or discount on actual supplied bookings.                                                   |
| 15  | `15_return_cab.eml`              | `uber-r4-89551@uber.com`                                | 20 Jun 2026 21:29:44 | Uber paid receipt / Employee-paid expense candidate                            | 20 Jun 21:05, Pune Airport → Baner; INR 1,229.02; personal HDFC card ending 2288.                                                                                                                               | Unique airport-transfer candidate.                                                        | 04 return sector; supports return date.                                                                                             |

## 7. Receipt evidence

Emails 11 and 12 are `multipart/mixed`. Each includes text and an `image/png` attachment whose headers declare base64 but whose raw body is a textual `[ATTACHMENT: see receipts/... in this pack]` pointer, **not embedded PNG bytes**. Actual images are under `pack/receipts/`. A future importer must preserve this relationship, not treat decoded placeholder text as an image. Other emails are plain text. No production parser or OCR was created.

### Dinner — `receipts/dinner_bill_18jun.png`

**Source facts, visually verified:** parent `11_dinner_bill.eml`; Spice Terrace, Whitefield, Bengaluru 560066; GSTIN 29AAFCS1188K1ZP; bill 4471; table 12; four covers; 18 Jun 2026 21:38; paid by card ending 2288. The image does not name the claimant or attendees; the self-mail supplies customer/claim context and the card suffix agrees with his other receipts.

| Visible line      | Quantity | INR line amount |
| ----------------- | -------- | --------------- |
| Paneer Tikka      | 2        | 760.00          |
| Andhra Chicken    | 1        | 420.00          |
| Butter Naan       | 4        | 320.00          |
| Dal Makhani       | 1        | 310.00          |
| Fresh Lime Soda   | 2        | 240.00          |
| Subtotal          | —        | 2,050.00        |
| CGST 2.5%         | —        | 51.25           |
| SGST 2.5%         | —        | 51.25           |
| Service charge 5% | —        | 102.50          |
| Total             | —        | 2,255.00        |

Amounts are line totals, not unit prices. No alcohol line is visible. The source does not establish individual attendee names or prior HOD entertainment approval. Bill number 4471 is a merchant reference, not proof of employee ownership or a Travel Request ID by itself. Gross amount is known; policy acceptance remains under review.

### Hotel — `receipts/hotel_invoice_1188.png`

**Source facts, visually verified:** parent `12_hotel_invoice.eml`; Keys Prime Whitefield; KPW/26-27/1188; GSTIN 29AACCK7712M1Z4; guest Chaitanya Reddy; company Nortex Industries Ltd; room 412, Superior King; check-in 16 Jun 2026 14:10; check-out 19 Jun 2026 11:05; three nights. Settled by guest, card ending 2288; balance due INR 0.00. The email additionally identifies HDFC credit card. Printed company name does not imply company payment.

| Date / component visible | INR       |
| ------------------------ | --------- |
| 16 Jun room charge       | 5,750.00  |
| 17 Jun room charge       | 5,750.00  |
| 17 Jun laundry           | 450.00    |
| 18 Jun room charge       | 5,750.00  |
| 18 Jun mini bar          | 380.00    |
| 18 Jun in-room dining    | 1,120.00  |
| Subtotal                 | 19,200.00 |
| CGST 6%                  | 1,152.00  |
| SGST 6%                  | 1,152.00  |
| Invoice total            | 21,504.00 |

The image confirms email amounts and adds item dates. In-room dining is dated 18 Jun but has no itemisation or explicit tax allocation; it is not room tariff. Room nights pass §3.1; laundry and mini bar are disallowed base items under §4. Do not silently allocate the aggregated INR 2,304 tax.

## 8. Evidence relationships

| Relationship                            | Support                                                                                           | Canonical consequence                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 → 02 request/reply                   | 02 In-Reply-To and References identify 01.                                                        | Preserve request and proven RM approval separately.                                                                                            |
| 01/02 → 03 advance                      | Same claimant and INR 20,000 requested/processed/credited; Finance reference in 03.               | Settlement context, not expense; no fabricated Travel Request ID link.                                                                         |
| 08 → 09 failure then payment            | Same 17 Jun 19:35 ride, route and amount; later paid receipt.                                     | Only 09 represents payment; retain 08.                                                                                                         |
| 10 → duplicate of 09                    | Same ride date/time, route, amount and card; forwarded content.                                   | INR 172 represented once; retain both emails.                                                                                                  |
| 11 → `receipts/dinner_bill_18jun.png`   | Named MIME pointer; image/self-mail context.                                                      | Two evidence artifacts for one dinner context, not two expenses.                                                                               |
| 12 → `receipts/hotel_invoice_1188.png`  | Named MIME pointer; matching invoice number/dates/amounts.                                        | Two evidence artifacts for one final folio context.                                                                                            |
| 05 → 12 booking to final hotel evidence | Same guest, hotel, dates, nights and room amount; no explicit shared booking ID on final invoice. | Retain booking voucher; use paid final invoice for actual payment. No double count or automatic transfer of voucher tax into final allocation. |

## 9. Relevant policy rules

**Source: `expense_policy.md`, NTX-HR-POL-11 Rev 4, effective 01 Apr 2026.** Rules below are source facts; scenario applications are deterministic unless marked unknown.

| Area                           | Rule / consequence                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Travel Request (§1.1)          | Approval before booking; issued ID ties bookings, bills, settlement and payment. RM approval alone does not prove complete compliance; actual ID/HOD approval absent.                                                                                                                                                   |
| Advance (§1.2–1.3)             | Up to 60% of estimated **employee-borne** cost; Finance disburses and advance adjusts settlement. Excess recoverable through next payroll. Total INR 48,000 estimate cannot establish cap compliance.                                                                                                                   |
| Approvals (§2)                 | Matrix below determines business levels; Finance verification follows business approvals on every claim, regardless of value.                                                                                                                                                                                           |
| Approval safeguards (§2.2–2.3) | No self-approval; claimant's own approval level is skipped to next level up. Approvers may return with remarks for correction/resubmission against the same ID. No historical submission/return events supplied.                                                                                                        |
| Lodging (§3.1)                 | Tier 1 INR 6,000/night; Tier 2 INR 4,000; Tier 3/others INR 2,800; room tariff excluding taxes. Tier 1 includes Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Pune and Kolkata. Room tariff taxes reimbursable in full; excess shown as disallowed, not omitted. INR 5,750/night passes.                            |
| Air (§3.2)                     | Domestic economy only; centrally booked, company billed; employee does not claim it. Corporate-card sectors remain audit costs.                                                                                                                                                                                         |
| Meals (§3.3)                   | Actuals up to INR 1,500/full day Tier 1, INR 1,000 Tier 2/below. Travel days count as full days; bills above INR 500 required. Not a flat automatic allowance. In-room dining belongs in meal review.                                                                                                                   |
| Conveyance (§3.4)              | Actuals against receipt; airport transfers at both ends covered. Four unique successful claimant Uber receipts are supported candidates.                                                                                                                                                                                |
| Business Entertainment (§3.5)  | Customer/partner meals separate from meal allowance; attendee names and organisations required; prior HOD approval above INR 2,000. Dinner INR 2,255 triggers this condition. Four people / Vertex procurement team do not provide individual names.                                                                    |
| Non-reimbursable (§4)          | Laundry, mini bar, in-room entertainment, spa/gym; personal phone/data; alcohol except approved entertainment; fines/penalties/challans; independently purchased travel insurance; expenses of others. Relevant: laundry INR 450, mini bar INR 380, Deepa INR 640. In-room **dining** is not in-room **entertainment**. |
| Submission (§5.1–5.3)          | Within seven calendar days of return; every line needs specific proof or is returned. Duplicate bill submission is a breach; Finance reconciles bill number/date/amount/merchant. Duplicate inbox evidence alone does not prove a duplicate claim was submitted.                                                        |
| Payment (§5.4)                 | Verified claims processed on 10th and 25th. No actual settlement submission/verification/payment date established.                                                                                                                                                                                                      |

Approval matrix, preserving the source's INR boundaries:

| Estimated / claimed value                       | Required business approvals                               |
| ----------------------------------------------- | --------------------------------------------------------- |
| Up to INR 25,000                                | Reporting Manager                                         |
| INR 25,001–75,000                               | Reporting Manager + Head of Department                    |
| INR 75,001–2,00,000                             | Reporting Manager + Head of Department + Head of Division |
| Above INR 2,00,000, or any international travel | All preceding business levels + MD/CEO                    |

**Deterministic conclusion:** INR 48,000 requires RM + HOD; only RM is proven. A later settlement claim's approval route depends on its own claimed value, not automatically the travel estimate. Sub-rupee handling between the printed whole-INR bands is unspecified; do not silently invent it in later rule implementation.

## 10. Excel template semantics

Both sheets are Rev Nov 2025. **Travel Request B39:B42** says shaded cells are inputs, grey italic values are one worked example to clear before use, total is a formula and policy determines approval levels. Styles confirm grey italic example values. **Settlement B62:B67** defines paid-by values, specific proof, disallowed handling and settlement semantics.

| Sheet / area                    | Fields and meaning                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Travel Request rows 5–16        | ID/issue date; employee name/code/designation/department/cost centre/RM; from/to dates, days, category, visiting place/company, currency, purpose, mode.                                     |
| Travel Request rows 19–27       | Cost head, basis, estimate, Borne By, formula total, requested advance. Heads: air/rail, lodging, conveyance, meals/allowance, other.                                                        |
| Travel Request rows 30–35       | Level/role/name/decision/date/remarks; printed RM, HOD, HODiv, Finance, MD/CEO slots. Blank decisions are not approvals. Policy overrides printed Finance-before-MD ordering.                |
| Settlement rows 5–7             | ID, settlement date, employee/code, cost centre, currency. Settlement date is blank; no submission date.                                                                                     |
| Settlement lodging rows 10–15   | Check-in/out, nights, hotel, city, Paid By, amount, Proof Ref.                                                                                                                               |
| Settlement transport rows 18–29 | Date/time, from/to, mode, Paid By, amount, Proof Ref.                                                                                                                                        |
| Settlement other rows 32–41     | Date, head, description, Paid By, amount, Proof Ref; meals/allowance, entertainment, miscellaneous.                                                                                          |
| Settlement summary rows 44–50   | Employee gross, company memo, disallowed deduction, net reimbursable, advance, payable/recoverable. Concepts, not actual established settlement amounts.                                     |
| Settlement approvals rows 53–58 | Employee submission, RM, HOD, Finance verification, Finance payment released; name/decision/date/remarks. Higher business-level slots absent, but current policy still controls if required. |

| Cell                 | Actual formula / semantic                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Travel Request D25   | `SUM(D20:D24)`; example total INR 43,500.                                                                                    |
| Settlement H15       | `SUM(H11:H14)`; lodging gross.                                                                                               |
| Settlement H29       | `SUM(H19:H28)`; transport gross.                                                                                             |
| Settlement H41       | `SUM(H33:H40)`; other gross.                                                                                                 |
| Settlement H44       | `SUMIF(G11:G14,"Employee",H11:H14)+SUMIF(G19:G28,"Employee",H19:H28)+SUMIF(G33:G40,"Employee",H33:H40)`; employee rows only. |
| Settlement H45       | Same three SUMIF ranges using `"Company"`; memo/audit only.                                                                  |
| Settlement H46 / H48 | Input disallowed / advance amounts; not formulas.                                                                            |
| Settlement H47       | `H44-H46`; employee gross less disallowed.                                                                                   |
| Settlement H49       | `IF(H47-H48>0,H47-H48,0)`; payable.                                                                                          |
| Settlement H50       | `IF(H48-H47>0,H48-H47,0)`; recoverable.                                                                                      |

Paid By must be exactly **Employee** or **Company** because SUMIF depends on it. Company-paid rows remain for audit/policy checks, not reimbursement. Proof Ref must identify a specific document, not “attached mail.” Show disallowed items with remarks and deduct once: do not omit or double deduct. Formula totals must not be overwritten. Blank settlement rows and cached zero totals do not establish actual zero expenses.

**Wording conflict:** B67 says exactly one payable/recoverable amount should be non-zero, but formulas return both zero when net claim equals advance (also in the blank template). Canonical mutual exclusivity means never both positive; at equality neither is due. Do not invent a payment to satisfy literal legend wording. This is a formula-based conclusion, not this trip's final settlement.

## 11. Worked-example conflicts

| Topic                        | Workbook example                                                                                                        | Actual evidence                                                    | Canonical treatment                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Travel Request ID            | C5 on both sheets: TRQ-2026-0000                                                                                        | No actual ID proven in emails/images.                              | Unknown / Needs confirmation; never promote example to real ID.                         |
| Estimate                     | Request D20:D24: INR 10,500 air + INR 23,000 lodging + INR 4,000 conveyance + INR 6,000 meals = INR 43,500; D25 agrees. | Email 01: INR 48,000.                                              | INR 48,000 is actual request estimate.                                                  |
| Borne-by split / advance cap | Air/lodging Company; conveyance/meals Employee; INR 20,000 example advance.                                             | Actual request supplies no authoritative estimated borne-by split. | Do not use example employee INR 10,000 or total INR 48,000 as the real cap denominator. |
| Hotel payer / nights         | Request E21 Company; INR 23,000 four-night estimate.                                                                    | Invoice: guest paid by HDFC card ending 2288; three nights.        | Employee-paid actual folio; room base INR 17,250.                                       |
| Flight estimate              | INR 10,500 illustrative return-economy basis.                                                                           | Actual sectors INR 10,556, corporate-paid.                         | Actual amount/payer prevail; example cannot prove actual cabin class.                   |

Some illustrative identity/date fields agree with actual evidence; their canonical authority still comes from CSV/emails/images. Approval slots, revisions and the formula/legend discrepancy are documented, not silently merged into current policy.

## 12. Known arithmetic cross-checks — not final settlement

| Cross-check                                      | Exact arithmetic / known amount                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Company-paid flights                             | INR 5,016 + INR 5,540 = **INR 10,556**.                                                                                       |
| Unique successful claimant Uber (06, 07, 09, 15) | INR 1,415.02 + INR 743.00 + INR 172.00 + INR 1,229.02 = **INR 3,559.04**. Excludes failure 08, duplicate 10 and colleague 13. |
| Hotel room base                                  | 3 × INR 5,750 = **INR 17,250**.                                                                                               |
| Known disallowed hotel base                      | INR 450 + INR 380 = **INR 830**; not necessarily final tax-inclusive disallowance.                                            |
| Hotel dining                                     | **INR 1,120**, dated 18 Jun; meal-policy review.                                                                              |
| Hotel subtotal                                   | INR 17,250 + INR 450 + INR 380 + INR 1,120 = **INR 19,200**.                                                                  |
| Final hotel tax                                  | INR 1,152 + INR 1,152 = **INR 2,304**, aggregated.                                                                            |
| Gross final hotel invoice                        | INR 19,200 + INR 2,304 = **INR 21,504**.                                                                                      |
| Booking-stage total                              | INR 17,250 + INR 2,070 = **INR 19,320**; not another payment.                                                                 |
| Dinner gross                                     | INR 2,050 + INR 51.25 + INR 51.25 + INR 102.50 = **INR 2,255**, unresolved entertainment candidate.                           |
| Advance                                          | **INR 20,000**, credited; not an expense.                                                                                     |

**Exact final reimbursable total, payable or recoverable: unable to determine exactly from supplied evidence.** Material hotel tax allocation and dinner review remain unresolved. These cross-checks are not an approved settlement.

## 13. Ambiguity register

| Issue                        | What source proves                                                                                      | What is missing                                                           | Implementation treatment                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Travel Request ID            | Policy requires issued ID; workbook ID illustrative.                                                    | Actual issued identifier or proof of issuance.                            | Needs confirmation; never fabricate.                                                                                                                         |
| HOD pre-travel approval      | INR 48,000 requires RM + HOD; 02 proves RM only.                                                        | HOD approval before booking.                                              | Visible policy exception; no invented historical approval or prototype action passed off as source.                                                          |
| Advance 60% verification     | INR 20,000 requested/disbursed; INR 48,000 total estimate.                                              | Authoritative estimated employee-borne subtotal.                          | **Unable to determine from authoritative source data** whether cap was satisfied. Neither compliant nor breached can be concluded using total/example split. |
| Fourth lodging night         | Four planned; three supported 16–19 Jun; return 20 Jun.                                                 | Remaining-night accommodation, if any.                                    | Preserve discrepancy; no fabricated night/expense.                                                                                                           |
| Hotel mixed tax allocation   | Voucher room-stage GST INR 2,070; final mixed tax INR 2,304; policy reimburses room tariff taxes fully. | Explicit final per-item allocation and traceable resolution of mixed tax. | Needs traceable manual resolution. No automatic voucher-tax reuse, proportional allocation or assertion INR 830 is full disallowance.                        |
| In-room dining               | Image proves INR 1,120 on 18 Jun; meals distinct from lodging.                                          | Item detail and resolved meal/tax treatment.                              | Meal candidate / policy review, not room tariff. Below daily Tier 1 cap on its own does not establish final approval.                                        |
| Business dinner              | Vertex procurement team, four people; 18 Jun INR 2,255.                                                 | Individual names and proven prior HOD entertainment approval.             | Source state: Needs review. **Approved product decision:** canonical demo excludes if unresolved rather than fabricating attendees/approval.                 |
| Submission deadline          | Return 20 Jun; seven-calendar-day rule.                                                                 | Actual settlement submission date.                                        | Cannot assess actual timeliness. Adding seven days gives nominal 27 Jun 2026; do not invent submission or mark late merely from today's date.                |
| Actual cabin class           | Ticket sectors and corporate payer.                                                                     | Explicit cabin class on ticket.                                           | Economy required, not proven by illustrative workbook; corporate-paid treatment remains proven.                                                              |
| Approval threshold precision | Policy prints whole-INR boundaries 25,000/25,001 and 75,000/75,001.                                     | Treatment of paise between printed bands.                                 | Preserve literal thresholds; later boundary convention needs explicit decision. Does not affect INR 48,000 travel route.                                     |

## 14. Approved product decisions to preserve

These are approved task instructions, **not historical source facts**:

- Never fabricate missing Travel Request ID or historical approvals.
- Never silently hide duplicate, noise, failed, rejected or excluded evidence.
- Company-paid costs remain visible without increasing employee reimbursement.
- Failed payment is not a paid expense; successful INR 172 ride is represented once.
- Another employee's receipt is excluded but audit-visible.
- Laundry and mini bar are explicitly disallowed, not deleted.
- Hotel tax remains unresolved until a traceable manual decision is recorded.
- Dinner stays a review issue; canonical demo excludes it if unresolved rather than inventing attendees/prior approval.
- Every eventual claim line traces to specific evidence; email plus attachment is not two expenses.
- No precise final settlement while unresolved evidence materially affects it.

## 15. Deferred domain-model decisions

Defer to Task 4: one versus two expense records for flight sectors; separate hotel records versus structured folio components; exact MongoDB fields/Mongoose schemas; TypeScript enum names; internal IDs; physical evidence-to-expense storage; validation-result persistence; claim snapshot representation. Facts and semantic relationships do not prescribe database shape. No models, fixtures, parser, seed/import code, database writes, application rules or UI changes belong to this task.

## 16. Future acceptance-test contract

Future expectations, not executable tests:

1. All 15 emails remain represented with original message references and distinct email/event dates.
2. Both images trace to parent emails; MIME pointer bodies are not embedded image bytes or extra expenses.
3. Failed Uber 08 creates no paid expense; successful INR 172 receipt 09 represents that ride once.
4. Email 10 is duplicate of 09 despite distinct Message-ID; stays visible, adds no reimbursement.
5. Corporate-paid flights remain visible and never increase employee reimbursement; combined INR 10,556.
6. Unique successful claimant Uber total is INR 3,559.04.
7. Deepa's INR 640 Chennai receipt is excluded for claimant mismatch and retained.
8. MakeMyTrip 14 is noise; promotional currency in 06 does not alter receipt amount.
9. Each INR 5,750 room night passes Bengaluru INR 6,000 excluding-tax limit; only three nights supported.
10. Laundry INR 450 and mini bar INR 380 explicitly disallowed; INR 830 is base, not resolved tax-inclusive deduction.
11. Final INR 21,504 folio is employee-paid; INR 19,320 voucher is supporting evidence, not additional payment.
12. Hotel tax INR 2,304 remains explicit ambiguity until traceably resolved; INR 1,120 dining is meal candidate, not room tariff.
13. Dinner INR 2,255 needs attendee details/prior HOD approval, never silently accepted. Unresolved demo exclusion is distinguished from source facts.
14. Advance INR 20,000 is settlement context; cap cannot be verified from total estimate alone.
15. INR 48,000 travel estimate requires RM + HOD; only RM proven. Later claim route uses its own established value.
16. Actual Travel Request ID unknown; TRQ-2026-0000 and INR 43,500 remain illustrative, not canonical trip facts.
17. Timeliness unknown without submission date; no fourth night or completed plant visit fabricated.
18. Hierarchy matches CSV; Finance follows required business approvals rather than illustrative form row order.
19. Company rows audit-only; specific proof required; disallowed deducted once; payable/recoverable never both positive, both zero at equality.
20. No exact final reimbursable/payable/recoverable asserted while material evidence/tax ambiguity is unresolved.
