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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { mockParties } from '@/lib/mock-data';
import {
  type Invoice, type InvoiceLineItem, type BillingType,
  mockBillingSettings, getLastInvoiceNumber, getNextInvoiceNumber,
} from '@/lib/billing-data';
import {
  ChevronRight, Plus, Trash2, Copy, AlertCircle, CheckCircle2, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CreateInvoiceSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editInvoice?: Invoice | null;
  onSave?: (invoice: Partial<Invoice>, isDraft: boolean) => void;
}

const BILLING_TYPES: { value: BillingType; label: string }[] = [
  { value: 'storage', label: 'Storage Charges' },
  { value: 'processing', label: 'Processing Charges' },
  { value: 'product', label: 'Product-based' },
  { value: 'manual', label: 'Manual Adjustment' },
];

const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 15', 'Net 30', 'Net 45', 'Due on Receipt'];

const emptyLineItem = (): InvoiceLineItem => ({
  id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  quantity: 1,
  rate: 0,
  amount: 0,
});

const STEP_LABELS = ['Header', 'Line Items', 'Review'];

export function CreateInvoiceSheet({
  open, onOpenChange, editInvoice, onSave,
}: CreateInvoiceSheetProps) {
  const { toast } = useToast();
  const lastInvNo = getLastInvoiceNumber();
  const nextInvNo = getNextInvoiceNumber(mockBillingSettings.invoicePrefix);

  // ── Form State ────────────────────────────
  const [step, setStep] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvNo);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [billingType, setBillingType] = useState<BillingType>('storage');
  const [paymentTerms, setPaymentTerms] = useState(mockBillingSettings.defaultPaymentTerms);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyLineItem()]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    if (editInvoice) {
      setInvoiceNumber(editInvoice.invoiceNumber);
      setInvoiceDate(editInvoice.invoiceDate);
      setDueDate(editInvoice.dueDate);
      setClientId(editInvoice.clientId);
      setBillingType(editInvoice.billingType);
      setPaymentTerms(editInvoice.paymentTerms);
      setNotes(editInvoice.notes ?? '');
      setLineItems(editInvoice.lineItems.length ? editInvoice.lineItems : [emptyLineItem()]);
    } else {
      resetForm();
    }
  }, [editInvoice, open]);

  // Auto-calc due date from payment terms
  useEffect(() => {
    if (!invoiceDate || !paymentTerms) return;
    const days = parseInt(paymentTerms.replace('Net ', ''), 10);
    if (isNaN(days)) return;
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [invoiceDate, paymentTerms]);

  function resetForm() {
    setStep(1);
    setInvoiceNumber(nextInvNo);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setClientId('');
    setBillingType('storage');
    setPaymentTerms(mockBillingSettings.defaultPaymentTerms);
    setNotes('');
    setLineItems([emptyLineItem()]);
    setDateFrom('');
    setDateTo('');
  }

  // ── Calculations ──────────────────────────
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const gstAmount = Math.round(subtotal * mockBillingSettings.gstPercent) / 100;
  const rawTotal = subtotal + gstAmount;
  const roundOff = Math.round(rawTotal) - rawTotal;
  const grandTotal = Math.round(rawTotal);

  // ── Line Item Helpers ─────────────────────
  function updateLineItem(id: string, field: keyof InvoiceLineItem, val: string | number) {
    setLineItems(prev => prev.map(li => {
      if (li.id !== id) return li;
      const updated = { ...li, [field]: val };
      if (field === 'quantity' || field === 'rate') {
        updated.amount = Number(updated.quantity) * Number(updated.rate);
      }
      return updated;
    }));
  }

  function addLineItem() {
    setLineItems(prev => [...prev, emptyLineItem()]);
  }

  function removeLineItem(id: string) {
    setLineItems(prev => prev.filter(li => li.id !== id));
  }

  const clientName = mockParties.find(p => p.id === clientId)?.name ?? '';

  function buildInvoice(status: 'draft' | 'generated'): Partial<Invoice> {
    return {
      invoiceNumber,
      clientId,
      clientName,
      billingType,
      invoiceDate,
      dueDate,
      paymentTerms,
      lineItems,
      subtotal,
      gstPercent: mockBillingSettings.gstPercent,
      gstAmount,
      roundOff,
      total: grandTotal,
      paid: 0,
      outstanding: grandTotal,
      status,
      notes,
      ...(status === 'generated'
        ? { generatedBy: 'admin', generatedAt: new Date().toISOString() }
        : {}),
    };
  }

  function handleSaveDraft() {
    if (!clientId) { toast({ title: 'Select a client', variant: 'destructive' }); return; }
    onSave?.(buildInvoice('draft'), true);
    toast({ title: 'Draft saved', description: `${invoiceNumber} saved as draft.` });
    onOpenChange(false);
  }

  function handleGenerate() {
    if (!clientId) { toast({ title: 'Select a client', variant: 'destructive' }); return; }
    if (lineItems.some(li => !li.description.trim())) {
      toast({ title: 'Fill all line item descriptions', variant: 'destructive' }); return;
    }
    onSave?.(buildInvoice('generated'), false);
    toast({ title: 'Invoice generated', description: `${invoiceNumber} is now locked & generated.` });
    onOpenChange(false);
  }

  const isLocked = editInvoice?.status !== 'draft' && editInvoice != null;

  return (
    <Sheet open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent side="right" className="sm:max-w-[860px] w-full overflow-y-auto flex flex-col p-0 bg-[hsl(225,25%,8%)] border-l border-white/10">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-white/10 bg-card/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-info" />
              {editInvoice ? 'Edit Invoice' : 'Create Invoice'}
              {isLocked && <Badge variant="outline" className="text-xs text-warning border-warning/30 ml-2">Locked</Badge>}
            </SheetTitle>
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {STEP_LABELS.map((label, i) => (
                <div key={i} className="flex items-center">
                  <button
                    onClick={() => !isLocked && setStep(i + 1)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
                      step === i + 1
                        ? 'bg-info/20 text-info border border-info/30'
                        : step > i + 1
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'text-muted-foreground border border-border'
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                      step === i + 1 ? 'bg-info text-white' : step > i + 1 ? 'bg-success text-white' : 'bg-border text-muted-foreground'
                    )}>
                      {step > i + 1 ? '✓' : i + 1}
                    </span>
                    {label}
                  </button>
                  {i < STEP_LABELS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: HEADER ── */}
          {step === 1 && (
            <div className="p-6 space-y-6 animate-fade-in-up">
              {/* Invoice number preview */}
              <div className="glass-card rounded-lg p-4 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Serial Number Logic</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Previous Invoice Number:</span>
                  <span className="font-mono-id text-info font-semibold">{lastInvNo}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Invoice Number <span className="text-info">(editable)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      disabled={isLocked}
                      className="font-mono-id bg-secondary border-border text-info font-semibold tracking-wide"
                    />
                    <Button
                      variant="outline" size="icon"
                      onClick={() => setInvoiceNumber(nextInvNo)}
                      title="Reset to auto-increment"
                      className="border-border shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Auto-incremented. You may modify the suffix freely. Uniqueness validated on submit.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Client */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Client <span className="text-destructive">*</span></Label>
                  <Select value={clientId} onValueChange={setClientId} disabled={isLocked}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {mockParties.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-foreground">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing Type */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Billing Type</Label>
                  <Select value={billingType} onValueChange={v => setBillingType(v as BillingType)} disabled={isLocked}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {BILLING_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-foreground">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Terms */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {PAYMENT_TERMS.map(t => (
                        <SelectItem key={t} value={t} className="text-foreground">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice Date */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Due Date <span className="text-[11px] text-muted-foreground">(auto from terms)</span></Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>

                {/* Notes */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Notes / Remarks</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes for this invoice…"
                    className="bg-secondary border-border text-foreground resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!clientId}
                  className="bg-info hover:bg-info/90 text-white"
                >
                  Next: Line Items →
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: LINE ITEMS ── */}
          {step === 2 && (
            <div className="p-6 animate-fade-in-up">
              {/* Date range for auto-fetch */}
              <div className="mb-4 p-3 glass-card rounded-lg flex items-center gap-4">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Billable Period:</span>
                <Input
                  type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-secondary border-border text-foreground h-8 text-xs"
                />
                <span className="text-muted-foreground text-xs">→</span>
                <Input
                  type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-secondary border-border text-foreground h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="border-info/30 text-info hover:bg-info/10 text-xs shrink-0">
                  Fetch Transactions
                </Button>
              </div>

              <div className="flex gap-4">
                {/* Line Items Table */}
                <div className="flex-1 min-w-0">
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-muted-foreground text-xs">Description</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right w-24">Qty / Kg</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right w-24">Rate (₹)</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right w-28">Amount (₹)</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((li, idx) => (
                          <TableRow key={li.id} className="border-white/10 hover:bg-white/[0.03]">
                            <TableCell className="py-2">
                              <Input
                                value={li.description}
                                onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                                disabled={isLocked}
                                placeholder={`Line item ${idx + 1}…`}
                                className="bg-transparent border-0 border-b border-white/10 rounded-none px-0 h-7 text-sm text-foreground focus-visible:ring-0 focus-visible:border-info"
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                type="number"
                                value={li.quantity}
                                onChange={e => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                                disabled={isLocked}
                                className="bg-transparent border-0 border-b border-white/10 rounded-none px-0 h-7 text-sm text-right text-foreground focus-visible:ring-0 focus-visible:border-info"
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                type="number"
                                value={li.rate}
                                onChange={e => updateLineItem(li.id, 'rate', parseFloat(e.target.value) || 0)}
                                disabled={isLocked}
                                className="bg-transparent border-0 border-b border-white/10 rounded-none px-0 h-7 text-sm text-right text-foreground focus-visible:ring-0 focus-visible:border-info"
                              />
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <span className="text-sm font-medium text-foreground font-mono-id">
                                {li.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              {!isLocked && lineItems.length > 1 && (
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => removeLineItem(li.id)}
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {!isLocked && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={addLineItem}
                      className="mt-2 text-info hover:text-info hover:bg-info/10 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Line Item
                    </Button>
                  )}
                </div>

                {/* Floating Calculation Summary */}
                <div className="w-56 shrink-0">
                  <div className="glass-card rounded-lg p-4 space-y-3 sticky top-4 billing-blue-glow border border-info/15">
                    <p className="text-xs font-semibold text-info uppercase tracking-wider">Summary</p>
                    <Separator className="bg-white/10" />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono-id text-foreground">₹{subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST ({mockBillingSettings.gstPercent}%)</span>
                        <span className="font-mono-id text-foreground">₹{gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                      {roundOff !== 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Round Off</span>
                          <span className="font-mono-id text-foreground">{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator className="bg-white/10" />
                      <div className="flex justify-between font-semibold">
                        <span className="text-foreground">Grand Total</span>
                        <span className="font-mono-id text-info text-base">₹{grandTotal.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {lineItems.some(li => !li.description.trim()) && (
                      <div className="flex gap-1.5 items-start text-xs text-warning/80 pt-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>Fill all descriptions before generating.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-5">
                <Button variant="outline" onClick={() => setStep(1)} className="border-border">← Back</Button>
                <Button onClick={() => setStep(3)} className="bg-info hover:bg-info/90 text-white">
                  Next: Review →
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: REVIEW ── */}
          {step === 3 && (
            <div className="p-6 space-y-5 animate-fade-in-up">
              <div className="glass-card rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice Number</p>
                    <p className="font-mono-id font-bold text-info text-lg">{invoiceNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-semibold text-foreground">{clientName || '—'}</p>
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice Date</p>
                    <p className="text-foreground">{invoiceDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="text-foreground">{dueDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Billing Type</p>
                    <p className="text-foreground capitalize">{billingType}</p>
                  </div>
                </div>
              </div>

              {/* Line Items Preview */}
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Description</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Qty</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Rate</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map(li => (
                      <TableRow key={li.id} className="border-white/10">
                        <TableCell className="text-sm text-foreground">{li.description}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{li.quantity.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">₹{li.rate.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground font-mono-id">₹{li.amount.toLocaleString('en-IN')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="glass-card rounded-lg p-4 max-w-xs ml-auto space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono-id">₹{subtotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>GST ({mockBillingSettings.gstPercent}%)</span><span className="font-mono-id">₹{gstAmount.toLocaleString('en-IN')}</span></div>
                {roundOff !== 0 && <div className="flex justify-between text-muted-foreground"><span>Round Off</span><span className="font-mono-id">{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span></div>}
                <Separator className="bg-white/10" />
                <div className="flex justify-between font-bold text-base"><span className="text-foreground">Grand Total</span><span className="font-mono-id text-info">₹{grandTotal.toLocaleString('en-IN')}</span></div>
              </div>

              {/* Draft note */}
              <div className="flex gap-2 text-xs text-muted-foreground bg-warning/5 border border-warning/15 rounded-md p-3">
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="text-warning font-medium">Draft mode:</span> All fields remain editable.{' '}
                  <span className="text-info font-medium">Generate</span> will lock the invoice number and line items.
                </div>
              </div>

              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(2)} className="border-border">← Back</Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    className="border-warning/30 text-warning hover:bg-warning/10"
                  >
                    Save as Draft
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    className="bg-info hover:bg-info/90 text-white"
                    disabled={lineItems.some(li => !li.description.trim()) || !clientId}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Generate Invoice
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
