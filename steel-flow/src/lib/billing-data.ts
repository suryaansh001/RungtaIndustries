// ─────────────────────────────────────────────
//  Billing Module — Types & Mock Data
// ─────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'generated' | 'sent' | 'partially_paid' | 'paid' | 'overdue';
export type BillingType = 'product' | 'storage' | 'processing' | 'manual';
export type PaymentMode = 'cash' | 'bank' | 'upi' | 'cheque';
export type ActivityAction = 'Created' | 'Generated' | 'Sent' | 'Payment Added' | 'Cancelled' | 'Draft Saved';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  billingType: BillingType;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  roundOff: number;
  total: number;
  paid: number;
  outstanding: number;
  status: InvoiceStatus;
  generatedBy?: string;
  generatedAt?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  notes: string;
  addedBy: string;
}

export interface LedgerEntry {
  id: string;
  clientId: string;
  date: string;
  refType: 'Invoice' | 'Payment' | 'Adjustment';
  refNumber: string;
  debit: number;
  credit: number;
  runningBalance: number;
  description: string;
}

export interface BillingActivity {
  id: string;
  date: string;
  user: string;
  action: ActivityAction;
  reference: string;
  details: string;
}

export interface BillingSettings {
  gstPercent: number;
  defaultPaymentTerms: string;
  autoOverdueDays: number;
  invoicePrefix: string;
  companyName: string;
  companyAddress: string;
  bankDetails: string;
  footerNotes: string;
}

export interface AgingRow {
  clientId: string;
  clientName: string;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  total: number;
}

export interface BulkBillableClient {
  clientId: string;
  clientName: string;
  billableAmount: number;
  itemCount: number;
  billableItems: string[];
}

// ─── BILLING SETTINGS ───────────────────────
export const mockBillingSettings: BillingSettings = {
  gstPercent: 18,
  defaultPaymentTerms: 'Net 15',
  autoOverdueDays: 15,
  invoicePrefix: 'INV',
  companyName: 'Rungta Industrial Corporation',
  companyAddress: 'Plot No. 45, MIDC Industrial Area, Pune – 411019, Maharashtra',
  bankDetails: 'HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234 | Branch: Pune Main',
  footerNotes: 'All disputes subject to Pune jurisdiction. Late payment will attract interest @ 18% p.a.',
};

// ─── MOCK INVOICES ───────────────────────────
export const mockInvoices: Invoice[] = [
  // INV-001 — Tata Steel — Storage — Jan 2026 — PAID
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-0001',
    clientId: '1',
    clientName: 'Tata Steel Ltd',
    billingType: 'storage',
    invoiceDate: '2026-01-05',
    dueDate: '2026-01-20',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-001-1', description: 'HR Coil Storage — Dec 2025 (12,500 kg)', quantity: 12500, rate: 2.50, amount: 31250 },
      { id: 'li-001-2', description: 'CR Coil Storage — Dec 2025 (8,500 kg)', quantity: 8500, rate: 3.00, amount: 25500 },
      { id: 'li-001-3', description: 'Handling Charges', quantity: 1, rate: 500, amount: 500 },
    ],
    subtotal: 57250, gstPercent: 18, gstAmount: 10305, roundOff: 0, total: 67555,
    paid: 67555, outstanding: 0, status: 'paid',
    generatedBy: 'admin', generatedAt: '2026-01-05T10:00:00', notes: 'Full payment via NEFT',
  },
  // INV-002 — JSW Steel — Storage — Jan 2026 — PAID
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2026-0002',
    clientId: '2',
    clientName: 'JSW Steel',
    billingType: 'storage',
    invoiceDate: '2026-01-10',
    dueDate: '2026-01-25',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-002-1', description: 'GP Coil Storage — Dec 2025 (15,000 kg)', quantity: 15000, rate: 2.80, amount: 42000 },
    ],
    subtotal: 42000, gstPercent: 18, gstAmount: 7560, roundOff: 0, total: 49560,
    paid: 49560, outstanding: 0, status: 'paid',
    generatedBy: 'admin', generatedAt: '2026-01-10T11:30:00',
  },
  // INV-003 — SAIL Industries — Processing — Jan 2026 — SENT
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2026-0003',
    clientId: '3',
    clientName: 'SAIL Industries',
    billingType: 'processing',
    invoiceDate: '2026-01-15',
    dueDate: '2026-01-30',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-003-1', description: 'Slitting — CR Coils (6,200 kg)', quantity: 6200, rate: 1.50, amount: 9300 },
      { id: 'li-003-2', description: 'Slitting — HR Coils (8,000 kg)', quantity: 8000, rate: 1.20, amount: 9600 },
    ],
    subtotal: 18900, gstPercent: 18, gstAmount: 3402, roundOff: 0, total: 22302,
    paid: 0, outstanding: 22302, status: 'sent',
    generatedBy: 'admin', generatedAt: '2026-01-15T09:15:00',
  },
  // INV-004 — Uttam Galva — Storage — Jan 2026 — PARTIALLY PAID
  {
    id: 'inv-004',
    invoiceNumber: 'INV-2026-0004',
    clientId: '5',
    clientName: 'Uttam Galva',
    billingType: 'storage',
    invoiceDate: '2026-01-20',
    dueDate: '2026-02-04',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-004-1', description: 'CR Coil Storage — Dec 2025 (9,800 kg)', quantity: 9800, rate: 3.20, amount: 31360 },
      { id: 'li-004-2', description: 'HR Coil Storage — Dec 2025 (5,000 kg)', quantity: 5000, rate: 2.50, amount: 12500 },
    ],
    subtotal: 43860, gstPercent: 18, gstAmount: 7895, roundOff: 0, total: 51755,
    paid: 25000, outstanding: 26755, status: 'partially_paid',
    generatedBy: 'operator1', generatedAt: '2026-01-20T14:00:00',
  },
  // INV-005 — Tata Steel — Storage — Feb 2026 — OVERDUE
  {
    id: 'inv-005',
    invoiceNumber: 'INV-2026-0005',
    clientId: '1',
    clientName: 'Tata Steel Ltd',
    billingType: 'storage',
    invoiceDate: '2026-02-01',
    dueDate: '2026-02-15',
    paymentTerms: 'Net 14',
    lineItems: [
      { id: 'li-005-1', description: 'HR Coil Storage — Jan 2026 (12,500 kg × 31 days)', quantity: 12500, rate: 2.50, amount: 31250 },
      { id: 'li-005-2', description: 'CR Coil Storage — Jan 2026 (8,500 kg × 31 days)', quantity: 8500, rate: 3.00, amount: 25500 },
      { id: 'li-005-3', description: 'Delayed Dispatch Surcharge', quantity: 1, rate: 5000, amount: 5000 },
    ],
    subtotal: 61750, gstPercent: 18, gstAmount: 11115, roundOff: 0, total: 72865,
    paid: 0, outstanding: 72865, status: 'overdue',
    generatedBy: 'admin', generatedAt: '2026-02-01T10:00:00',
  },
  // INV-006 — JSW Steel — Processing — Feb 2026 — OVERDUE
  {
    id: 'inv-006',
    invoiceNumber: 'INV-2026-0006',
    clientId: '2',
    clientName: 'JSW Steel',
    billingType: 'processing',
    invoiceDate: '2026-02-05',
    dueDate: '2026-02-20',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-006-1', description: 'Slitting Service — GP Coils (15,000 kg)', quantity: 15000, rate: 1.80, amount: 27000 },
    ],
    subtotal: 27000, gstPercent: 18, gstAmount: 4860, roundOff: 0, total: 31860,
    paid: 0, outstanding: 31860, status: 'overdue',
    generatedBy: 'operator1', generatedAt: '2026-02-05T11:00:00',
  },
  // INV-007 — SAIL Industries — Manual — Feb 2026 — GENERATED
  {
    id: 'inv-007',
    invoiceNumber: 'INV-2026-0007',
    clientId: '3',
    clientName: 'SAIL Industries',
    billingType: 'manual',
    invoiceDate: '2026-02-10',
    dueDate: '2026-02-25',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-007-1', description: 'Special Handling & Loading Charges', quantity: 1, rate: 8500, amount: 8500 },
      { id: 'li-007-2', description: 'Documentation Charges', quantity: 1, rate: 500, amount: 500 },
    ],
    subtotal: 9000, gstPercent: 18, gstAmount: 1620, roundOff: 0, total: 10620,
    paid: 0, outstanding: 10620, status: 'generated',
    generatedBy: 'admin', generatedAt: '2026-02-10T09:00:00',
  },
  // INV-008 — Uttam Galva — Storage — Feb 2026 — SENT
  {
    id: 'inv-008',
    invoiceNumber: 'INV-2026-0008',
    clientId: '5',
    clientName: 'Uttam Galva',
    billingType: 'storage',
    invoiceDate: '2026-02-12',
    dueDate: '2026-02-27',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-008-1', description: 'CR Coil Storage — Jan 2026 (9,800 kg × 31 days)', quantity: 9800, rate: 3.20, amount: 31360 },
      { id: 'li-008-2', description: 'HR Coil Storage — Jan 2026 (5,000 kg × 31 days)', quantity: 5000, rate: 2.50, amount: 12500 },
    ],
    subtotal: 43860, gstPercent: 18, gstAmount: 7895, roundOff: 0, total: 51755,
    paid: 0, outstanding: 51755, status: 'sent',
    generatedBy: 'operator1', generatedAt: '2026-02-12T14:00:00',
  },
  // INV-009 — Tata Steel — Product — Feb 2026 — GENERATED
  {
    id: 'inv-009',
    invoiceNumber: 'INV-2026-0009',
    clientId: '1',
    clientName: 'Tata Steel Ltd',
    billingType: 'product',
    invoiceDate: '2026-02-15',
    dueDate: '2026-03-01',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-009-1', description: 'CR Coil Lot — RIC-C-2026-0002 (8,500 kg)', quantity: 8500, rate: 62, amount: 527000 },
      { id: 'li-009-2', description: 'Loading & Transport Charges', quantity: 1, rate: 8500, amount: 8500 },
    ],
    subtotal: 535500, gstPercent: 18, gstAmount: 96390, roundOff: 0, total: 631890,
    paid: 0, outstanding: 631890, status: 'generated',
    generatedBy: 'admin', generatedAt: '2026-02-15T10:30:00',
  },
  // INV-010 — JSW Steel — Storage — Feb 2026 — DRAFT
  {
    id: 'inv-010',
    invoiceNumber: 'INV-2026-0010',
    clientId: '2',
    clientName: 'JSW Steel',
    billingType: 'storage',
    invoiceDate: '2026-02-18',
    dueDate: '2026-03-04',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-010-1', description: 'GP Coil Storage — Jan 2026 (15,000 kg)', quantity: 15000, rate: 2.80, amount: 42000 },
      { id: 'li-010-2', description: 'Processing Charges — Slitting', quantity: 1, rate: 4800, amount: 4800 },
    ],
    subtotal: 46800, gstPercent: 18, gstAmount: 8424, roundOff: 0, total: 55224,
    paid: 0, outstanding: 55224, status: 'draft',
  },
  // INV-011 — SAIL Industries — Storage — Feb 2026 — DRAFT
  {
    id: 'inv-011',
    invoiceNumber: 'INV-2026-0011',
    clientId: '3',
    clientName: 'SAIL Industries',
    billingType: 'storage',
    invoiceDate: '2026-02-20',
    dueDate: '2026-03-06',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-011-1', description: 'HR Coil Storage — Feb 2026 (28,800 kg × 20 days)', quantity: 28800, rate: 2.20, amount: 63360 },
    ],
    subtotal: 63360, gstPercent: 18, gstAmount: 11405, roundOff: 0, total: 74765,
    paid: 0, outstanding: 74765, status: 'draft',
  },
  // INV-012 — Uttam Galva — Processing — Feb 2026 — DRAFT
  {
    id: 'inv-012',
    invoiceNumber: 'INV-2026-0012',
    clientId: '5',
    clientName: 'Uttam Galva',
    billingType: 'processing',
    invoiceDate: '2026-02-22',
    dueDate: '2026-03-08',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-012-1', description: 'Slitting Service — CR Coils (9,800 kg)', quantity: 9800, rate: 1.80, amount: 17640 },
    ],
    subtotal: 17640, gstPercent: 18, gstAmount: 3175, roundOff: 1, total: 20816,
    paid: 0, outstanding: 20816, status: 'draft',
  },
  // INV-013 — Tata Steel — Storage — Feb 2026 — GENERATED
  {
    id: 'inv-013',
    invoiceNumber: 'INV-2026-0013',
    clientId: '1',
    clientName: 'Tata Steel Ltd',
    billingType: 'storage',
    invoiceDate: '2026-02-25',
    dueDate: '2026-03-11',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-013-1', description: 'HR Coil Storage — Feb 2026 (12,500 kg × 25 days)', quantity: 12500, rate: 2.50, amount: 31250 },
      { id: 'li-013-2', description: 'CR Coil Storage — Feb 2026 (8,500 kg × 25 days)', quantity: 8500, rate: 3.00, amount: 25500 },
    ],
    subtotal: 56750, gstPercent: 18, gstAmount: 10215, roundOff: 0, total: 66965,
    paid: 0, outstanding: 66965, status: 'generated',
    generatedBy: 'operator1', generatedAt: '2026-02-25T09:45:00',
  },
  // INV-014 — JSW Steel — Product — Feb 2026 — SENT
  {
    id: 'inv-014',
    invoiceNumber: 'INV-2026-0014',
    clientId: '2',
    clientName: 'JSW Steel',
    billingType: 'product',
    invoiceDate: '2026-02-26',
    dueDate: '2026-03-13',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-014-1', description: 'GP Coil Lot — RIC-C-2026-0003 (15,000 kg)', quantity: 15000, rate: 58, amount: 870000 },
    ],
    subtotal: 870000, gstPercent: 18, gstAmount: 156600, roundOff: 0, total: 1026600,
    paid: 0, outstanding: 1026600, status: 'sent',
    generatedBy: 'admin', generatedAt: '2026-02-26T16:00:00',
  },
  // INV-015 — SAIL Industries — Storage — Feb 2026 — PARTIALLY PAID
  {
    id: 'inv-015',
    invoiceNumber: 'INV-2026-0015',
    clientId: '3',
    clientName: 'SAIL Industries',
    billingType: 'storage',
    invoiceDate: '2026-02-27',
    dueDate: '2026-03-13',
    paymentTerms: 'Net 15',
    lineItems: [
      { id: 'li-015-1', description: 'HR Coil Storage — Feb 2026 (28,800 kg)', quantity: 28800, rate: 2.20, amount: 63360 },
      { id: 'li-015-2', description: 'Oversize Handling Fee', quantity: 1, rate: 1500, amount: 1500 },
    ],
    subtotal: 64860, gstPercent: 18, gstAmount: 11675, roundOff: 0, total: 76535,
    paid: 30000, outstanding: 46535, status: 'partially_paid',
    generatedBy: 'admin', generatedAt: '2026-02-27T11:00:00',
  },
];

// ─── MOCK PAYMENTS ───────────────────────────
export const mockPayments: Payment[] = [
  {
    id: 'pmt-001', invoiceId: 'inv-001', invoiceNumber: 'INV-2026-0001',
    clientId: '1', clientName: 'Tata Steel Ltd',
    date: '2026-01-22', amount: 67555, mode: 'bank',
    reference: 'NEFT/TL/20260122/001', notes: 'Full payment cleared', addedBy: 'admin',
  },
  {
    id: 'pmt-002', invoiceId: 'inv-002', invoiceNumber: 'INV-2026-0002',
    clientId: '2', clientName: 'JSW Steel',
    date: '2026-01-26', amount: 49560, mode: 'upi',
    reference: 'UPI/JSW/20260126', notes: '', addedBy: 'operator1',
  },
  {
    id: 'pmt-003', invoiceId: 'inv-004', invoiceNumber: 'INV-2026-0004',
    clientId: '5', clientName: 'Uttam Galva',
    date: '2026-02-05', amount: 25000, mode: 'cash',
    reference: 'CASH/UG/20260205', notes: 'Advance payment, balance pending', addedBy: 'operator1',
  },
  {
    id: 'pmt-004', invoiceId: 'inv-015', invoiceNumber: 'INV-2026-0015',
    clientId: '3', clientName: 'SAIL Industries',
    date: '2026-02-28', amount: 30000, mode: 'bank',
    reference: 'NEFT/SAIL/20260228/001', notes: 'Partial payment', addedBy: 'admin',
  },
];

// ─── MOCK LEDGER ENTRIES (per client) ────────
export const mockLedgerEntries: LedgerEntry[] = [
  // Tata Steel (id: 1)
  { id: 'led-001', clientId: '1', date: '2026-01-05', refType: 'Invoice', refNumber: 'INV-2026-0001', debit: 67555, credit: 0, runningBalance: 67555, description: 'Storage Invoice — Dec 2025' },
  { id: 'led-002', clientId: '1', date: '2026-01-22', refType: 'Payment', refNumber: 'PMT-001', debit: 0, credit: 67555, runningBalance: 0, description: 'Payment via NEFT' },
  { id: 'led-003', clientId: '1', date: '2026-02-01', refType: 'Invoice', refNumber: 'INV-2026-0005', debit: 72865, credit: 0, runningBalance: 72865, description: 'Storage Invoice — Jan 2026 (Overdue)' },
  { id: 'led-004', clientId: '1', date: '2026-02-15', refType: 'Invoice', refNumber: 'INV-2026-0009', debit: 631890, credit: 0, runningBalance: 704755, description: 'Product Invoice — CR Coil Lot' },
  { id: 'led-005', clientId: '1', date: '2026-02-25', refType: 'Invoice', refNumber: 'INV-2026-0013', debit: 66965, credit: 0, runningBalance: 771720, description: 'Storage Invoice — Feb 2026' },

  // JSW Steel (id: 2)
  { id: 'led-006', clientId: '2', date: '2026-01-10', refType: 'Invoice', refNumber: 'INV-2026-0002', debit: 49560, credit: 0, runningBalance: 49560, description: 'Storage Invoice — Dec 2025' },
  { id: 'led-007', clientId: '2', date: '2026-01-26', refType: 'Payment', refNumber: 'PMT-002', debit: 0, credit: 49560, runningBalance: 0, description: 'Payment via UPI' },
  { id: 'led-008', clientId: '2', date: '2026-02-05', refType: 'Invoice', refNumber: 'INV-2026-0006', debit: 31860, credit: 0, runningBalance: 31860, description: 'Processing Invoice — Overdue' },
  { id: 'led-009', clientId: '2', date: '2026-02-26', refType: 'Invoice', refNumber: 'INV-2026-0014', debit: 1026600, credit: 0, runningBalance: 1058460, description: 'Product Invoice — GP Coil Lot' },

  // SAIL Industries (id: 3)
  { id: 'led-010', clientId: '3', date: '2026-01-15', refType: 'Invoice', refNumber: 'INV-2026-0003', debit: 22302, credit: 0, runningBalance: 22302, description: 'Processing Invoice — Jan 2026' },
  { id: 'led-011', clientId: '3', date: '2026-02-10', refType: 'Invoice', refNumber: 'INV-2026-0007', debit: 10620, credit: 0, runningBalance: 32922, description: 'Manual Adjustment — Feb 2026' },
  { id: 'led-012', clientId: '3', date: '2026-02-27', refType: 'Invoice', refNumber: 'INV-2026-0015', debit: 76535, credit: 0, runningBalance: 109457, description: 'Storage Invoice — Feb 2026' },
  { id: 'led-013', clientId: '3', date: '2026-02-28', refType: 'Payment', refNumber: 'PMT-004', debit: 0, credit: 30000, runningBalance: 79457, description: 'Partial Payment via NEFT' },

  // Uttam Galva (id: 5)
  { id: 'led-014', clientId: '5', date: '2026-01-20', refType: 'Invoice', refNumber: 'INV-2026-0004', debit: 51755, credit: 0, runningBalance: 51755, description: 'Storage Invoice — Dec 2025' },
  { id: 'led-015', clientId: '5', date: '2026-02-05', refType: 'Payment', refNumber: 'PMT-003', debit: 0, credit: 25000, runningBalance: 26755, description: 'Advance Payment via Cash' },
  { id: 'led-016', clientId: '5', date: '2026-02-12', refType: 'Invoice', refNumber: 'INV-2026-0008', debit: 51755, credit: 0, runningBalance: 78510, description: 'Storage Invoice — Jan 2026' },
];

// ─── BILLING ACTIVITY LOG ────────────────────
export const mockBillingActivity: BillingActivity[] = [
  { id: 'act-020', date: '2026-02-28 14:30', user: 'admin', action: 'Payment Added', reference: 'INV-2026-0015', details: 'Payment of ₹30,000 via NEFT — SAIL Industries' },
  { id: 'act-019', date: '2026-02-27 11:15', user: 'admin', action: 'Generated', reference: 'INV-2026-0015', details: 'Storage invoice generated for SAIL Industries' },
  { id: 'act-018', date: '2026-02-26 16:30', user: 'admin', action: 'Sent', reference: 'INV-2026-0014', details: 'Invoice emailed to JSW Steel' },
  { id: 'act-017', date: '2026-02-26 16:00', user: 'admin', action: 'Generated', reference: 'INV-2026-0014', details: 'Product invoice generated for JSW Steel' },
  { id: 'act-016', date: '2026-02-25 09:45', user: 'operator1', action: 'Generated', reference: 'INV-2026-0013', details: 'Storage invoice generated for Tata Steel' },
  { id: 'act-015', date: '2026-02-22 10:00', user: 'operator1', action: 'Draft Saved', reference: 'INV-2026-0012', details: 'Draft saved — Uttam Galva processing' },
  { id: 'act-014', date: '2026-02-20 11:30', user: 'operator1', action: 'Draft Saved', reference: 'INV-2026-0011', details: 'Draft saved — SAIL Industries storage' },
  { id: 'act-013', date: '2026-02-18 09:00', user: 'operator1', action: 'Draft Saved', reference: 'INV-2026-0010', details: 'Draft saved — JSW Steel storage' },
  { id: 'act-012', date: '2026-02-15 10:30', user: 'admin', action: 'Generated', reference: 'INV-2026-0009', details: 'Product invoice generated for Tata Steel' },
  { id: 'act-011', date: '2026-02-12 15:00', user: 'operator1', action: 'Sent', reference: 'INV-2026-0008', details: 'Invoice sent to Uttam Galva via email' },
  { id: 'act-010', date: '2026-02-12 14:00', user: 'operator1', action: 'Generated', reference: 'INV-2026-0008', details: 'Storage invoice generated for Uttam Galva' },
  { id: 'act-009', date: '2026-02-10 09:00', user: 'admin', action: 'Generated', reference: 'INV-2026-0007', details: 'Manual adjustment invoice — SAIL Industries' },
  { id: 'act-008', date: '2026-02-05 11:00', user: 'operator1', action: 'Generated', reference: 'INV-2026-0006', details: 'Processing invoice generated for JSW Steel' },
  { id: 'act-007', date: '2026-02-05 10:00', user: 'operator1', action: 'Payment Added', reference: 'INV-2026-0004', details: 'Partial payment ₹25,000 via Cash — Uttam Galva' },
  { id: 'act-006', date: '2026-02-01 10:00', user: 'admin', action: 'Generated', reference: 'INV-2026-0005', details: 'Storage invoice generated for Tata Steel' },
  { id: 'act-005', date: '2026-01-26 09:00', user: 'operator1', action: 'Payment Added', reference: 'INV-2026-0002', details: 'Full payment ₹49,560 via UPI — JSW Steel' },
  { id: 'act-004', date: '2026-01-22 14:00', user: 'admin', action: 'Payment Added', reference: 'INV-2026-0001', details: 'Full payment ₹67,555 via NEFT — Tata Steel' },
  { id: 'act-003', date: '2026-01-20 14:00', user: 'operator1', action: 'Generated', reference: 'INV-2026-0004', details: 'Storage invoice generated for Uttam Galva' },
  { id: 'act-002', date: '2026-01-15 09:15', user: 'admin', action: 'Generated', reference: 'INV-2026-0003', details: 'Processing invoice generated for SAIL Industries' },
  { id: 'act-001', date: '2026-01-10 11:30', user: 'admin', action: 'Generated', reference: 'INV-2026-0002', details: 'Storage invoice generated for JSW Steel' },
];

// ─── AGING REPORT ────────────────────────────
export const mockAgingReport: AgingRow[] = [
  { clientId: '1', clientName: 'Tata Steel Ltd',  d0_30: 139830, d31_60: 72865,  d61_90: 0, d90plus: 0, total: 212695 },
  { clientId: '2', clientName: 'JSW Steel',        d0_30: 1026600, d31_60: 31860, d61_90: 0, d90plus: 0, total: 1058460 },
  { clientId: '3', clientName: 'SAIL Industries',  d0_30: 57155,  d31_60: 22302,  d61_90: 0, d90plus: 0, total: 79457 },
  { clientId: '5', clientName: 'Uttam Galva',      d0_30: 51755,  d31_60: 26755,  d61_90: 0, d90plus: 0, total: 78510 },
];

// ─── REVENUE ANALYTICS ───────────────────────
export const mockMonthlyRevenue = [
  { month: 'Sep 25', storage: 85000,  processing: 32000, product: 45000,  manual: 12000 },
  { month: 'Oct 25', storage: 92000,  processing: 38000, product: 52000,  manual: 8000 },
  { month: 'Nov 25', storage: 78000,  processing: 28000, product: 38000,  manual: 5000 },
  { month: 'Dec 25', storage: 115000, processing: 45000, product: 65000,  manual: 15000 },
  { month: 'Jan 26', storage: 128000, processing: 18900, product: 67555,  manual: 0 },
  { month: 'Feb 26', storage: 251475, processing: 42480, product: 1658490, manual: 10620 },
];

export const mockRevenueCategoryData = [
  { name: 'Storage',    value: 749475, fill: 'hsl(217, 91%, 60%)' },
  { name: 'Processing', value: 204380, fill: 'hsl(142, 71%, 45%)' },
  { name: 'Product',    value: 1926045, fill: 'hsl(38, 92%, 50%)' },
  { name: 'Manual',     value: 50620,  fill: 'hsl(280, 65%, 60%)' },
];

export const mockProductionVelocity = [
  { week: 'W1 Jan', avgDays: 4.2, completed: 12 },
  { week: 'W2 Jan', avgDays: 3.8, completed: 15 },
  { week: 'W3 Jan', avgDays: 5.1, completed: 9 },
  { week: 'W4 Jan', avgDays: 4.5, completed: 11 },
  { week: 'W1 Feb', avgDays: 3.6, completed: 18 },
  { week: 'W2 Feb', avgDays: 4.0, completed: 14 },
  { week: 'W3 Feb', avgDays: 4.8, completed: 10 },
  { week: 'W4 Feb', avgDays: 3.9, completed: 16 },
];

// ─── BULK BILLING PREVIEW ────────────────────
export const mockBulkBillableClients: BulkBillableClient[] = [
  { clientId: '1', clientName: 'Tata Steel Ltd',  billableAmount: 57250, itemCount: 3, billableItems: ['HR Coil Storage (12,500 kg)', 'CR Coil Storage (8,500 kg)', 'Handling'] },
  { clientId: '2', clientName: 'JSW Steel',        billableAmount: 46800, itemCount: 2, billableItems: ['GP Coil Storage (15,000 kg)', 'Processing charges'] },
  { clientId: '3', clientName: 'SAIL Industries',  billableAmount: 63360, itemCount: 1, billableItems: ['HR Coil Storage (28,800 kg)'] },
  { clientId: '5', clientName: 'Uttam Galva',      billableAmount: 43860, itemCount: 2, billableItems: ['CR Coil Storage (9,800 kg)', 'HR Coil Storage (5,000 kg)'] },
];

// ─── HELPER: Get last invoice number ─────────
export function getLastInvoiceNumber(): string {
  const generated = mockInvoices
    .filter(i => i.status !== 'draft')
    .map(i => i.invoiceNumber)
    .sort()
    .reverse();
  return generated[0] ?? 'INV-2026-0000';
}

export function getNextInvoiceNumber(prefix = 'INV'): string {
  const last = getLastInvoiceNumber();
  const parts = last.split('-');
  const num = parseInt(parts[parts.length - 1] ?? '0', 10);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(num + 1).padStart(4, '0')}`;
}
