import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { InvoiceStatusBadge, BillingTypeBadge } from '@/components/StatusBadge';
import { PaymentEntrySheet } from '@/components/billing/PaymentEntrySheet';
import { mockInvoices, mockPayments, mockBillingSettings } from '@/lib/billing-data';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, CreditCard, Send, FileDown, FileText, XCircle, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const MODE_LABEL: Record<string, string> = {
  cash: 'Cash', bank: 'Bank Transfer', upi: 'UPI', cheque: 'Cheque',
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  const invoice = mockInvoices.find(i => i.id === id);
  const payments = mockPayments.filter(p => p.invoiceId === id);

  if (!invoice) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground text-sm">Invoice not found.</p>
          <Button variant="outline" onClick={() => navigate('/billing')} className="border-border">
            Back to Billing
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isLocked = invoice.status !== 'draft';

  function handleMarkSent() {
    toast({ title: 'Marked as sent', description: `${invoice.invoiceNumber} status updated to Sent.` });
  }

  function handleDownloadPDF() {
    try {
      generateInvoicePdf(invoice, mockBillingSettings);
      toast({ title: 'PDF downloaded', description: `${invoice.invoiceNumber}.pdf saved to your downloads.` });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: 'PDF failed', description: 'Could not generate PDF. Please try again.', variant: 'destructive' });
    }
  }

  function handleDownloadExcel() {
    // Simple CSV export
    const rows = [
      ['Invoice Number', invoice.invoiceNumber],
      ['Client', invoice.clientName],
      ['Date', invoice.invoiceDate],
      ['Due Date', invoice.dueDate],
      ['Status', invoice.status],
      [''],
      ['Description', 'Qty', 'Rate', 'Amount'],
      ...invoice.lineItems.map(li => [li.description, li.quantity, li.rate, li.amount]),
      [''],
      ['Subtotal', '', '', invoice.subtotal],
      [`GST (${invoice.gstPercent}%)`, '', '', invoice.gstAmount],
      ['Total', '', '', invoice.total],
      ['Paid', '', '', invoice.paid],
      ['Outstanding', '', '', invoice.outstanding],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${invoice.invoiceNumber}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel exported', description: `${invoice.invoiceNumber}.csv downloaded.` });
  }

  function handleCancel() {
    if (!isAdmin) { toast({ title: 'Admin only', description: 'Only admins can cancel invoices.', variant: 'destructive' }); return; }
    toast({ title: 'Invoice cancelled', description: `${invoice.invoiceNumber} has been cancelled.` });
  }

  return (
    <AppLayout>
      {/* Back */}
      <Button variant="ghost" onClick={() => navigate('/billing')} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Billing
      </Button>

      {/* Header Card */}
      <div className="glass-card rounded-xl p-5 mb-6 border border-white/10 animate-fade-in-up billing-blue-glow">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Left: Invoice identity */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono-id text-2xl font-bold text-info tracking-wide">
                {invoice.invoiceNumber}
              </span>
              <InvoiceStatusBadge status={invoice.status} />
              <BillingTypeBadge type={invoice.billingType} />
              {isLocked && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  <Lock className="h-2.5 w-2.5 mr-1" /> Locked
                </Badge>
              )}
            </div>
            <p className="text-lg font-semibold text-foreground">{invoice.clientName}</p>
            <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
              <span>Issue: <span className="text-foreground">{invoice.invoiceDate}</span></span>
              <span>Due: <span className={cn('font-medium', invoice.status === 'overdue' ? 'text-destructive' : 'text-foreground')}>{invoice.dueDate}</span></span>
              <span>Terms: <span className="text-foreground">{invoice.paymentTerms}</span></span>
              {invoice.generatedBy && (
                <span>Generated by: <span className="text-foreground">{invoice.generatedBy}</span></span>
              )}
            </div>
            {invoice.notes && (
              <p className="text-sm text-muted-foreground italic">"{invoice.notes}"</p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {['generated', 'partially_paid', 'overdue'].includes(invoice.status) && (
              <Button
                size="sm"
                onClick={() => setShowPaymentSheet(true)}
                className="bg-info hover:bg-info/90 text-white text-xs"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Add Payment
              </Button>
            )}
            {['generated'].includes(invoice.status) && (
              <Button size="sm" variant="outline" onClick={handleMarkSent} className="border-[#6366F1]/30 text-[#818CF8] hover:bg-[#6366F1]/10 text-xs">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Mark Sent
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="border-border text-muted-foreground hover:text-foreground text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadExcel} className="border-border text-muted-foreground hover:text-foreground text-xs">
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Excel
            </Button>
            {isAdmin && invoice.status !== 'paid' && (
              <Button size="sm" variant="outline" onClick={handleCancel} className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs">
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Body: two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Line Items (60%) ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">#</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Description</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Qty / Kg</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Rate (₹)</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((li, idx) => (
                  <TableRow key={li.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="text-sm text-foreground">{li.description}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground font-mono-id">
                      {li.quantity.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground font-mono-id">
                      {li.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-foreground font-mono-id">
                      {li.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals footer */}
            <div className="p-4 border-t border-border space-y-1.5">
              <div className="flex justify-end gap-8 text-sm">
                <div className="space-y-1 text-right">
                  <div className="flex gap-8 text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono-id text-foreground">₹{invoice.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex gap-8 text-muted-foreground">
                    <span>GST ({invoice.gstPercent}%)</span>
                    <span className="font-mono-id text-foreground">₹{invoice.gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {invoice.roundOff !== 0 && (
                    <div className="flex gap-8 text-muted-foreground">
                      <span>Round Off</span>
                      <span className="font-mono-id text-foreground">{invoice.roundOff > 0 ? '+' : ''}₹{invoice.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="bg-border my-1" />
                  <div className="flex gap-8 font-semibold text-base">
                    <span className="text-foreground">Grand Total</span>
                    <span className="font-mono-id text-info">₹{invoice.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Payment Panel (40%) ── */}
        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="glass-card rounded-xl p-5 border border-white/10 billing-blue-glow">
            <h3 className="text-sm font-semibold text-foreground mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoice Total</span>
                <span className="font-mono-id font-bold text-foreground text-base">
                  ₹{invoice.total.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Paid</span>
                <span className="font-mono-id font-semibold text-success text-base">
                  ₹{invoice.paid.toLocaleString('en-IN')}
                </span>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">Outstanding</span>
                <span className={cn('font-mono-id font-bold text-lg',
                  invoice.outstanding === 0 ? 'text-success' : 'text-warning')}>
                  ₹{invoice.outstanding.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Collection progress bar */}
            {invoice.total > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Collection progress</span>
                  <span>{Math.round(invoice.paid / invoice.total * 100)}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, invoice.paid / invoice.total * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Payment History</h3>
            </div>
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Date</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Amount</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Mode</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Reference</TableHead>
                      <TableHead className="text-muted-foreground text-xs">By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="text-xs text-muted-foreground">{p.date}</TableCell>
                        <TableCell className="text-right font-mono-id text-sm text-success font-medium">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">
                          {MODE_LABEL[p.mode] ?? p.mode}
                        </TableCell>
                        <TableCell className="font-mono-id text-xs text-foreground max-w-[120px] truncate">
                          {p.reference || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.addedBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {['generated', 'sent', 'partially_paid', 'overdue'].includes(invoice.status) && (
              <div className="p-3 border-t border-border">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setShowPaymentSheet(true)}
                  className="w-full border-info/30 text-info hover:bg-info/10 text-xs"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Add Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentEntrySheet
        open={showPaymentSheet}
        onOpenChange={setShowPaymentSheet}
        lockedInvoiceId={invoice.id}
      />
    </AppLayout>
  );
}
