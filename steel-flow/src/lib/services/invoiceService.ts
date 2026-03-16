import api from '../api';
import type { InvoiceStatus } from '../billing-data';

export interface InvoiceLineItemPayload {
  description: string;
  hsn_sac_code?: string;
  gst_rate: number;
  quantity: number;
  unit: string;
  rate: number;
}

export interface InvoicePayload {
  invoice_number: string;
  invoice_date: string;
  delivery_note?: string;
  terms_of_payment?: string;
  reference_no_date?: string;
  destination?: string;
  party_id?: string;

  seller_company_name: string;
  seller_full_address?: string;
  seller_gstin_uin?: string;
  seller_state_name?: string;
  seller_state_code?: string;
  seller_email?: string;

  consignee_company_name?: string;
  consignee_address?: string;
  consignee_gstin_uin?: string;
  consignee_state_name?: string;
  consignee_state_code?: string;

  buyer_company_name: string;
  buyer_address?: string;
  buyer_gstin_uin?: string;
  buyer_state_name?: string;
  buyer_state_code?: string;

  line_items: InvoiceLineItemPayload[];

  round_off?: number;
  total_invoice_amount_words?: string;
  tax_analysis_rows?: Array<Record<string, unknown>>;

  bank_account_holder_name?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_branch_ifsc_code?: string;
  bank_swift_code?: string;

  company_pan?: string;
  remarks?: string;
  declaration_text?: string;
  authorized_signatory?: string;
  is_computer_generated?: boolean;
  status: 'DRAFT' | 'GENERATED';
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  billingType: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  paid: number;
  outstanding: number;
  status: InvoiceStatus;
}

export const invoiceService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/invoices', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/invoices/${id}`).then((r) => r.data.data),

  create: (body: InvoicePayload) =>
    api.post('/invoices', body).then((r) => r.data.data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/invoices/${id}/status`, { status }).then((r) => r.data.data),
};
