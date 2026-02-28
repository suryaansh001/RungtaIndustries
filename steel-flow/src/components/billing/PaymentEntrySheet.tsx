import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { mockParties } from '@/lib/mock-data';
import { mockInvoices, type Payment, type PaymentMode } from '@/lib/billing-data';
import { AlertCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PaymentEntrySheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lockedInvoiceId?: string;
  onPaymentAdded?: (payment: Partial<Payment>) => void;
}

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash',   label: 'Cash' },
  { value: 'bank',   label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
  { value: 'upi',    label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
];

export function PaymentEntrySheet({
  open, onOpenChange, lockedInvoiceId, onPaymentAdded,
}: PaymentEntrySheetProps) {
  const { toast } = useToast();

  const [clientId, setClientId] = useState('');
  const [invoiceId, setInvoiceId] = useState(lockedInvoiceId ?? '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>('bank');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // When opened from a specific invoice, lock client + invoice
  useEffect(() => {
    if (lockedInvoiceId) {
      setInvoiceId(lockedInvoiceId);
      const inv = mockInvoices.find(i => i.id === lockedInvoiceId);
      if (inv) setClientId(inv.clientId);
    }
  }, [lockedInvoiceId, open]);

  function resetForm() {
    setClientId('');
    setInvoiceId(lockedInvoiceId ?? '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setAmount('');
    setMode('bank');
    setReference('');
    setNotes('');
  }

  // Get invoices for selected client
  const clientInvoices = mockInvoices.filter(
    i => i.clientId === clientId && ['sent', 'generated', 'partially_paid', 'overdue'].includes(i.status)
  );

  const selectedInvoice = mockInvoices.find(i => i.id === invoiceId);
  const outstanding = selectedInvoice?.outstanding ?? 0;
  const parsedAmount = parseFloat(amount) || 0;
  const isOverpayment = parsedAmount > outstanding && outstanding > 0;
  const isUnderPayment = parsedAmount > 0 && parsedAmount < outstanding;
  const resultStatus = parsedAmount >= outstanding ? 'Paid' : parsedAmount > 0 ? 'Partially Paid' : '—';

  function handleSubmit() {
    if (!clientId || !invoiceId || parsedAmount <= 0) {
      toast({ title: 'Fill all required fields', variant: 'destructive' }); return;
    }
    const inv = mockInvoices.find(i => i.id === invoiceId)!;
    const payment: Partial<Payment> = {
      id: `pmt-${Date.now()}`,
      invoiceId,
      invoiceNumber: inv.invoiceNumber,
      clientId,
      clientName: inv.clientName,
      date: paymentDate,
      amount: parsedAmount,
      mode,
      reference,
      notes,
      addedBy: 'admin',
    };
    onPaymentAdded?.(payment);
    toast({
      title: 'Payment recorded',
      description: `₹${parsedAmount.toLocaleString('en-IN')} added to ${inv.invoiceNumber}. Status → ${resultStatus}`,
    });
    onOpenChange(false);
    resetForm();
  }

  const isLocked = !!lockedInvoiceId;

  return (
    <Sheet open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent side="right" className="sm:max-w-[500px] w-full overflow-y-auto flex flex-col p-0 bg-[hsl(225,25%,8%)] border-l border-white/10">
        <SheetHeader className="px-6 py-4 border-b border-white/10 bg-card/60 backdrop-blur-sm shrink-0">
          <SheetTitle className="text-foreground text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-info" />
            Add Payment
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 animate-fade-in-up">
          {/* Client */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Client <span className="text-destructive">*</span></Label>
            <Select value={clientId} onValueChange={v => { setClientId(v); setInvoiceId(''); }} disabled={isLocked}>
              <SelectTrigger className={cn('bg-secondary border-border text-foreground', isLocked && 'opacity-70 cursor-not-allowed')}>
                <SelectValue placeholder="Select client…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {mockParties.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-foreground">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Invoice <span className="text-destructive">*</span></Label>
            <Select value={invoiceId} onValueChange={setInvoiceId} disabled={isLocked || !clientId}>
              <SelectTrigger className={cn('bg-secondary border-border text-foreground', isLocked && 'opacity-70 cursor-not-allowed')}>
                <SelectValue placeholder="Select invoice…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {clientInvoices.map(i => (
                  <SelectItem key={i.id} value={i.id} className="text-foreground">
                    <span className="font-mono-id">{i.invoiceNumber}</span>
                    <span className="ml-2 text-muted-foreground text-xs">— Outstanding: ₹{i.outstanding.toLocaleString('en-IN')}</span>
                  </SelectItem>
                ))}
                {clientId && clientInvoices.length === 0 && (
                  <SelectItem value="__none" disabled className="text-muted-foreground text-sm">No outstanding invoices</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice summary if selected */}
          {selectedInvoice && (
            <div className="glass-card rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono-id text-foreground">₹{selectedInvoice.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-mono-id text-success">₹{selectedInvoice.paid.toLocaleString('en-IN')}</span>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Outstanding</span>
                <span className="font-mono-id text-warning">₹{outstanding.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Payment Date <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>

            {/* Mode */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Payment Mode</Label>
              <Select value={mode} onValueChange={v => setMode(v as PaymentMode)}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {PAYMENT_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value} className="text-foreground">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Amount (₹) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter payment amount…"
              className="bg-secondary border-border text-foreground font-mono-id text-base"
            />
            {isOverpayment && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Payment (₹{parsedAmount.toLocaleString('en-IN')}) exceeds outstanding (₹{outstanding.toLocaleString('en-IN')}).
              </div>
            )}
            {isUnderPayment && (
              <p className="text-xs text-muted-foreground">
                Partial payment — status will become <span className="text-warning font-medium">Partially Paid</span>.
              </p>
            )}
            {parsedAmount > 0 && !isOverpayment && (
              <p className="text-xs text-muted-foreground">
                After this payment → Status: <span className={cn('font-medium', resultStatus === 'Paid' ? 'text-success' : 'text-warning')}>{resultStatus}</span>
              </p>
            )}
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Reference Number</Label>
            <Input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="NEFT ref / UPI ID / Cheque no…"
              className="bg-secondary border-border text-foreground font-mono-id"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="bg-secondary border-border text-foreground resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!clientId || !invoiceId || parsedAmount <= 0}
              className="bg-info hover:bg-info/90 text-white flex-1"
            >
              Record Payment
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
