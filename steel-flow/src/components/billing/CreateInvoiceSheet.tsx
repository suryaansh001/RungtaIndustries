import { useEffect, useMemo, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { partyService } from '@/lib/services/partyService';
import { type InvoicePayload } from '@/lib/services/invoiceService';
import { getLastInvoiceNumber, getNextInvoiceNumber, mockBillingSettings } from '@/lib/billing-data';
import { FileText, Plus, Trash2 } from 'lucide-react';

type Step = 'header' | 'items' | 'preview';

type PartyRow = {
  id: string;
  name: string;
  gst?: string;
  address?: string;
};

type LineItemInput = {
  id: string;
  description: string;
  hsn_sac_code: string;
  gst_rate: string;
  quantity: string;
  unit: string;
  rate: string;
};

interface CreateInvoiceSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave?: (invoice: InvoicePayload, isDraft: boolean) => Promise<void> | void;
}

const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 15', 'Net 30', 'Net 45', 'Due on Receipt'];

const emptyLineItem = (): LineItemInput => ({
  id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  hsn_sac_code: '',
  gst_rate: '18',
  quantity: '',
  unit: 'TON',
  rate: '',
});

const numberInputRegex = /^\d*(\.\d{0,3})?$/;

const toNum = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Number(n.toFixed(2));
const round3 = (n: number) => Number(n.toFixed(3));
const fmt2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function amountToWords(value: number) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const belowThousand = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const left = hundred ? `${units[hundred]} Hundred` : '';
    if (!rest) return left;
    const right = rest < 20 ? units[rest] : `${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${units[rest % 10]}` : ''}`;
    return `${left}${left ? ' ' : ''}${right}`;
  };

  const n = Math.floor(Math.abs(value));
  if (!n) return 'Indian Rupees Zero Only';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));

  return `Indian Rupees ${parts.join(' ').trim()} Only`;
}

export function CreateInvoiceSheet({ open, onOpenChange, onSave }: CreateInvoiceSheetProps) {
  const { toast } = useToast();
  const { data: partyRes } = useApi(() => partyService.getAll({ limit: 200 }), []);
  const parties: PartyRow[] = partyRes?.data ?? [];

  const [step, setStep] = useState<Step>('header');
  const [isSaving, setIsSaving] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState(getNextInvoiceNumber(mockBillingSettings.invoicePrefix));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryNote, setDeliveryNote] = useState('');
  const [termsOfPayment, setTermsOfPayment] = useState(mockBillingSettings.defaultPaymentTerms);
  const [referenceNoDate, setReferenceNoDate] = useState('');
  const [destination, setDestination] = useState('');

  const [selectedPartyId, setSelectedPartyId] = useState('');

  const [sellerCompanyName, setSellerCompanyName] = useState('RUNGTA INDUSTRIAL CORPORATION');
  const [sellerAddress, setSellerAddress] = useState('F-543, ROAD No.6-D, V.K.I AREA, Jaipur, Rajasthan - 302013, India');
  const [sellerGstin, setSellerGstin] = useState('08AABFR8172R1ZE');
  const [sellerStateName, setSellerStateName] = useState('Rajasthan');
  const [sellerStateCode, setSellerStateCode] = useState('08');
  const [sellerEmail, setSellerEmail] = useState('rungta@gmail.com');

  const [consigneeCompanyName, setConsigneeCompanyName] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [consigneeGstin, setConsigneeGstin] = useState('');
  const [consigneeStateName, setConsigneeStateName] = useState('');
  const [consigneeStateCode, setConsigneeStateCode] = useState('');

  const [buyerCompanyName, setBuyerCompanyName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerStateName, setBuyerStateName] = useState('Rajasthan');
  const [buyerStateCode, setBuyerStateCode] = useState('08');

  const [lineItems, setLineItems] = useState<LineItemInput[]>([emptyLineItem()]);

  const [roundOffInput, setRoundOffInput] = useState('0');

  const [bankAccountHolderName, setBankAccountHolderName] = useState('RUNGTA INDUSTRIAL CORPORATION');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [bankAccountNumber, setBankAccountNumber] = useState('0542000011197');
  const [bankBranchIfsc, setBankBranchIfsc] = useState('Vaishkarma Ind Area, Jaipur & HDFC0003774');
  const [bankSwift, setBankSwift] = useState('');

  const [companyPan, setCompanyPan] = useState('AABFR8172R');
  const [remarks, setRemarks] = useState('');
  const [declarationText, setDeclarationText] = useState('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('Authorised Signatory');

  const computedLineItems = useMemo(() => lineItems.map((li, idx) => {
    const quantity = round3(toNum(li.quantity));
    const rate = round2(toNum(li.rate));
    const gstRate = round2(toNum(li.gst_rate));
    const taxableAmount = round2(quantity * rate);
    const cgstAmount = round2((taxableAmount * gstRate) / 200);
    const sgstAmount = round2((taxableAmount * gstRate) / 200);
    const totalAmount = round2(taxableAmount + cgstAmount + sgstAmount);
    return {
      ...li,
      slNo: idx + 1,
      quantity,
      rate,
      gstRate,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      totalAmount,
    };
  }), [lineItems]);

  const totals = useMemo(() => {
    const totalQuantity = round3(computedLineItems.reduce((sum, li) => sum + li.quantity, 0));
    const totalTaxableValue = round2(computedLineItems.reduce((sum, li) => sum + li.taxableAmount, 0));
    const cgstAmount = round2(computedLineItems.reduce((sum, li) => sum + li.cgstAmount, 0));
    const sgstAmount = round2(computedLineItems.reduce((sum, li) => sum + li.sgstAmount, 0));
    const roundOff = round2(toNum(roundOffInput));
    const totalInvoiceAmount = round2(totalTaxableValue + cgstAmount + sgstAmount + roundOff);
    return {
      totalQuantity,
      totalTaxableValue,
      cgstAmount,
      sgstAmount,
      roundOff,
      totalInvoiceAmount,
      totalInvoiceAmountWords: amountToWords(totalInvoiceAmount),
      taxAmountWords: amountToWords(cgstAmount + sgstAmount),
    };
  }, [computedLineItems, roundOffInput]);

  const taxGroups = useMemo(() => {
    const grouped: Record<string, { hsnSac: string; rate: number; taxableValue: number; cgst: number; sgst: number }> = {};
    computedLineItems.forEach((li) => {
      const key = `${li.hsn_sac_code || ''}-${li.gstRate}`;
      if (!grouped[key]) {
        grouped[key] = { hsnSac: li.hsn_sac_code || '', rate: li.gstRate, taxableValue: 0, cgst: 0, sgst: 0 };
      }
      grouped[key].taxableValue = round2(grouped[key].taxableValue + li.taxableAmount);
      grouped[key].cgst = round2(grouped[key].cgst + li.cgstAmount);
      grouped[key].sgst = round2(grouped[key].sgst + li.sgstAmount);
    });
    return Object.values(grouped);
  }, [computedLineItems]);

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(getNextInvoiceNumber(mockBillingSettings.invoicePrefix));
  }, [open]);

  useEffect(() => {
    if (!selectedPartyId) return;
    const party = parties.find((p) => p.id === selectedPartyId);
    if (!party) return;
    setBuyerCompanyName(party.name || '');
    setBuyerAddress(party.address || '');
    setBuyerGstin(party.gst || '');

    setConsigneeCompanyName((prev) => prev || party.name || '');
    setConsigneeAddress((prev) => prev || party.address || '');
    setConsigneeGstin((prev) => prev || party.gst || '');
  }, [selectedPartyId, parties]);

  const handleNumericEdit = (id: string, field: 'quantity' | 'rate' | 'gst_rate', value: string) => {
    if (value !== '' && !numberInputRegex.test(value)) return;
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  };

  const updateTextField = (id: string, field: 'description' | 'hsn_sac_code' | 'unit', value: string) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLineItem()]);
  const removeLine = (id: string) => setLineItems((prev) => prev.length > 1 ? prev.filter((li) => li.id !== id) : prev);

  const resetForm = () => {
    setStep('header');
    setIsSaving(false);
    setInvoiceNumber(getNextInvoiceNumber(mockBillingSettings.invoicePrefix));
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setDeliveryNote('');
    setTermsOfPayment(mockBillingSettings.defaultPaymentTerms);
    setReferenceNoDate('');
    setDestination('');
    setSelectedPartyId('');

    setConsigneeCompanyName('');
    setConsigneeAddress('');
    setConsigneeGstin('');
    setConsigneeStateName('');
    setConsigneeStateCode('');

    setBuyerCompanyName('');
    setBuyerAddress('');
    setBuyerGstin('');
    setBuyerStateName('Rajasthan');
    setBuyerStateCode('08');

    setLineItems([emptyLineItem()]);
    setRoundOffInput('0');
    setRemarks('');
  };

  const validateBeforeSubmit = () => {
    if (!invoiceNumber.trim()) return 'Invoice number is required';
    if (!buyerCompanyName.trim()) return 'Buyer company name is required';
    if (!sellerCompanyName.trim()) return 'Seller company name is required';
    if (computedLineItems.some((li) => !li.description.trim())) return 'Each line item requires a description';
    if (computedLineItems.some((li) => li.quantity <= 0)) return 'Quantity must be greater than 0';
    if (computedLineItems.some((li) => li.rate <= 0)) return 'Rate must be greater than 0';
    return null;
  };

  const getPayload = (isDraft: boolean): InvoicePayload => ({
    invoice_number: invoiceNumber.trim(),
    invoice_date: invoiceDate,
    delivery_note: deliveryNote || undefined,
    terms_of_payment: termsOfPayment || undefined,
    reference_no_date: referenceNoDate || undefined,
    destination: destination || undefined,
    party_id: selectedPartyId || undefined,

    seller_company_name: sellerCompanyName,
    seller_full_address: sellerAddress || undefined,
    seller_gstin_uin: sellerGstin || undefined,
    seller_state_name: sellerStateName || undefined,
    seller_state_code: sellerStateCode || undefined,
    seller_email: sellerEmail || undefined,

    consignee_company_name: consigneeCompanyName || undefined,
    consignee_address: consigneeAddress || undefined,
    consignee_gstin_uin: consigneeGstin || undefined,
    consignee_state_name: consigneeStateName || undefined,
    consignee_state_code: consigneeStateCode || undefined,

    buyer_company_name: buyerCompanyName,
    buyer_address: buyerAddress || undefined,
    buyer_gstin_uin: buyerGstin || undefined,
    buyer_state_name: buyerStateName || undefined,
    buyer_state_code: buyerStateCode || undefined,

    line_items: computedLineItems.map((li) => ({
      description: li.description,
      hsn_sac_code: li.hsn_sac_code || undefined,
      gst_rate: li.gstRate,
      quantity: li.quantity,
      unit: li.unit || 'TON',
      rate: li.rate,
    })),

    round_off: totals.roundOff,
    total_invoice_amount_words: totals.totalInvoiceAmountWords,

    bank_account_holder_name: bankAccountHolderName || undefined,
    bank_name: bankName || undefined,
    bank_account_number: bankAccountNumber || undefined,
    bank_branch_ifsc_code: bankBranchIfsc || undefined,
    bank_swift_code: bankSwift || undefined,

    company_pan: companyPan || undefined,
    remarks: remarks || undefined,
    declaration_text: declarationText || undefined,
    authorized_signatory: authorizedSignatory || undefined,
    is_computer_generated: true,
    status: isDraft ? 'DRAFT' : 'GENERATED',
  });

  const submit = async (isDraft: boolean) => {
    const err = validateBeforeSubmit();
    if (err) {
      toast({ title: err, variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await onSave?.(getPayload(isDraft), isDraft);
      toast({
        title: isDraft ? 'Draft saved' : 'Invoice generated',
        description: `${invoiceNumber} ${isDraft ? 'saved to draft' : 'generated and saved'} successfully.`,
      });
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (error as { message?: string })?.message
        || 'Failed to save invoice';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent side="right" className="!w-screen sm:!max-w-none overflow-y-auto p-0 bg-card border-none rounded-none">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="text-foreground text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-info" />
            Create Tax Invoice
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Previous invoice: <span className="font-mono-id text-info">{getLastInvoiceNumber()}</span>
          </p>
        </SheetHeader>

        <div className="px-6 py-4 flex items-center gap-2 border-b border-border text-xs">
          <Button variant={step === 'header' ? 'default' : 'outline'} onClick={() => setStep('header')} className="h-8">1. Header</Button>
          <Button variant={step === 'items' ? 'default' : 'outline'} onClick={() => setStep('items')} className="h-8">2. Items</Button>
          <Button variant={step === 'preview' ? 'default' : 'outline'} onClick={() => setStep('preview')} className="h-8">3. Preview</Button>
        </div>

        {step === 'header' && (
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Invoice Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Invoice Number</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Delivery Note</Label><Input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Terms of Payment</Label>
                <Select value={termsOfPayment} onValueChange={setTermsOfPayment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_TERMS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Reference No. & Date</Label><Input value={referenceNoDate} onChange={(e) => setReferenceNoDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
            </div>

            <Separator />

            {/* Seller Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Seller Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Company Name</Label><Input value={sellerCompanyName} onChange={(e) => setSellerCompanyName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>GSTIN/UIN</Label><Input value={sellerGstin} onChange={(e) => setSellerGstin(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label>State</Label><Input value={sellerStateName} onChange={(e) => setSellerStateName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>State Code</Label><Input value={sellerStateCode} onChange={(e) => setSellerStateCode(e.target.value)} /></div>
                </div>
                <div className="md:col-span-2 space-y-1.5"><Label>Full Address</Label><Textarea rows={2} value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} /></div>
              </div>
            </div>

            <Separator />

            {/* Party selector + Consignee */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Consignee (Ship To)</h3>
              <div className="space-y-1.5">
                <Label>Select Party (auto-fills Consignee &amp; Buyer)</Label>
                <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                  <SelectTrigger><SelectValue placeholder="Select party..." /></SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Company Name</Label><Input value={consigneeCompanyName} onChange={(e) => setConsigneeCompanyName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>GSTIN/UIN</Label><Input value={consigneeGstin} onChange={(e) => setConsigneeGstin(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>State Name</Label><Input value={consigneeStateName} onChange={(e) => setConsigneeStateName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>State Code</Label><Input value={consigneeStateCode} onChange={(e) => setConsigneeStateCode(e.target.value)} /></div>
                <div className="md:col-span-2 space-y-1.5"><Label>Address</Label><Textarea rows={2} value={consigneeAddress} onChange={(e) => setConsigneeAddress(e.target.value)} /></div>
              </div>
            </div>

            <Separator />

            {/* Buyer (Bill To) — below consignee */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Buyer (Bill To)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Company Name</Label><Input value={buyerCompanyName} onChange={(e) => setBuyerCompanyName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>GSTIN/UIN</Label><Input value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>State Name</Label><Input value={buyerStateName} onChange={(e) => setBuyerStateName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>State Code</Label><Input value={buyerStateCode} onChange={(e) => setBuyerStateCode(e.target.value)} /></div>
                <div className="md:col-span-2 space-y-1.5"><Label>Address</Label><Textarea rows={2} value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} /></div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep('items')}>Next: Line Items</Button>
            </div>
          </div>
        )}

        {step === 'items' && (
          <div className="p-6 space-y-5">
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Sl</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">HSN/SAC</TableHead>
                    <TableHead className="w-24">GST %</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-24">Rate</TableHead>
                    <TableHead className="w-24 text-right">Taxable</TableHead>
                    <TableHead className="w-24 text-right">CGST</TableHead>
                    <TableHead className="w-24 text-right">SGST</TableHead>
                    <TableHead className="w-24 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedLineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell>{li.slNo}</TableCell>
                      <TableCell><Input value={li.description} onChange={(e) => updateTextField(li.id, 'description', e.target.value)} placeholder="Description" /></TableCell>
                      <TableCell><Input value={li.hsn_sac_code} onChange={(e) => updateTextField(li.id, 'hsn_sac_code', e.target.value)} /></TableCell>
                      <TableCell><Input value={li.gst_rate} onChange={(e) => handleNumericEdit(li.id, 'gst_rate', e.target.value)} /></TableCell>
                      <TableCell><Input value={li.quantity} onChange={(e) => handleNumericEdit(li.id, 'quantity', e.target.value)} /></TableCell>
                      <TableCell><Input value={li.unit} onChange={(e) => updateTextField(li.id, 'unit', e.target.value.toUpperCase())} /></TableCell>
                      <TableCell><Input value={li.rate} onChange={(e) => handleNumericEdit(li.id, 'rate', e.target.value)} /></TableCell>
                      <TableCell className="text-right font-mono-id">{li.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono-id">{li.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono-id">{li.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono-id font-medium">{li.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(li.id)} disabled={lineItems.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" onClick={addLine} className="text-info border-info/30">
              <Plus className="h-4 w-4 mr-1" /> Add Line
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Statutory & Payment Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Bank Account Holder</Label><Input value={bankAccountHolderName} onChange={(e) => setBankAccountHolderName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Bank Name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Account Number</Label><Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Branch & IFSC</Label><Input value={bankBranchIfsc} onChange={(e) => setBankBranchIfsc(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>SWIFT</Label><Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Company PAN</Label><Input value={companyPan} onChange={(e) => setCompanyPan(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Remarks / Notes</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Declaration Text</Label><Textarea rows={2} value={declarationText} onChange={(e) => setDeclarationText(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Authorized Signatory</Label><Input value={authorizedSignatory} onChange={(e) => setAuthorizedSignatory(e.target.value)} /></div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-2 h-fit">
                <h3 className="text-sm font-semibold">Auto Calculation</h3>
                <div className="flex justify-between text-sm"><span>Total Quantity</span><span className="font-mono-id">{totals.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</span></div>
                <div className="flex justify-between text-sm"><span>Total Taxable Value</span><span className="font-mono-id">{totals.totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-sm"><span>CGST</span><span className="font-mono-id">{totals.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-sm"><span>SGST/UTGST</span><span className="font-mono-id">{totals.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="space-y-1.5 pt-2"><Label>Round Off (+/-)</Label><Input value={roundOffInput} onChange={(e) => { if (e.target.value === '' || /^-?\d*(\.\d{0,2})?$/.test(e.target.value)) setRoundOffInput(e.target.value); }} /></div>
                <Separator />
                <div className="flex justify-between text-base font-semibold"><span>Total Invoice Amount</span><span className="font-mono-id text-info">{totals.totalInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <p className="text-xs text-muted-foreground">{totals.totalInvoiceAmountWords}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('header')}>Back</Button>
              <Button onClick={() => setStep('preview')}>Next: Preview</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-6 space-y-5">
            {/* ── Authentic Tax Invoice Document ── */}
            <div
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '11px',
                color: '#000',
                background: '#fff',
                border: '1px solid #000',
                width: '100%',
                maxWidth: '900px',
                margin: '0 auto',
              }}
            >
              {/* Title */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', padding: '6px 8px', borderBottom: '1px solid #000', letterSpacing: '1px' }}>
                Tax Invoice
              </div>

              {/* Company branding (left) + Invoice Meta (right) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000' }}>
                <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '3px' }}>{sellerCompanyName}</p>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{sellerAddress}</p>
                  <p style={{ marginTop: '4px' }}>GSTIN/UIN: <strong>{sellerGstin}</strong></p>
                  <p>State Name: {sellerStateName}, <strong>Code: {sellerStateCode}</strong></p>
                  {sellerEmail && <p>E-Mail: {sellerEmail}</p>}
                  {companyPan && <p>PAN No.: {companyPan}</p>}
                </div>
                <div style={{ padding: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600, width: '45%' }}>Invoice No.</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>{invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>Dated</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{invoiceDate}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>Delivery Note</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{deliveryNote || ''}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>Mode/Terms of Payment</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{termsOfPayment || ''}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>Reference No. &amp; Date</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{referenceNoDate || ''}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>Dispatched through</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{destination || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consignee (left) + Buyer (right) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000' }}>
                <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
                  <p style={{ fontWeight: 600, marginBottom: '3px', textDecoration: 'underline' }}>Consignee (Ship to)</p>
                  <p style={{ fontWeight: 'bold' }}>{consigneeCompanyName || '-'}</p>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{consigneeAddress}</p>
                  {consigneeGstin && <p>GSTIN/UIN: {consigneeGstin}</p>}
                  {consigneeStateName && (
                    <p>State Name: {consigneeStateName}{consigneeStateCode ? `, Code: ${consigneeStateCode}` : ''}</p>
                  )}
                </div>
                <div style={{ padding: '8px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '3px', textDecoration: 'underline' }}>Buyer (Bill to)</p>
                  <p style={{ fontWeight: 'bold' }}>{buyerCompanyName || '-'}</p>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{buyerAddress}</p>
                  {buyerGstin && <p>GSTIN/UIN: {buyerGstin}</p>}
                  {buyerStateName && (
                    <p>State Name: {buyerStateName}{buyerStateCode ? `, Code: ${buyerStateCode}` : ''}</p>
                  )}
                </div>
              </div>

              {/* Main Service Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '32px' }}>Sl No.</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Description of Services</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '64px' }}>HSN/SAC</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', width: '58px' }}>GST Rate</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', width: '72px' }}>Quantity</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', width: '80px' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '42px' }}>Per</th>
                    <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', width: '90px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {computedLineItems.map((li) => (
                    <tr key={li.id}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{li.slNo}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{li.description}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{li.hsn_sac_code || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{li.gstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>
                        {li.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{fmt2(li.rate)}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{li.unit}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{fmt2(li.taxableAmount)}</td>
                    </tr>
                  ))}
                  {/* CGST / SGST sub-rows per HSN+rate group */}
                  {taxGroups.flatMap((g) => [
                    <tr key={`cgst-${g.hsnSac}-${g.rate}`}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>CGST@{g.rate / 2}%</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{fmt2(g.cgst)}</td>
                    </tr>,
                    <tr key={`sgst-${g.hsnSac}-${g.rate}`}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>SGST@{g.rate / 2}%</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{fmt2(g.sgst)}</td>
                    </tr>,
                  ])}
                  {/* Rounding Off */}
                  {totals.roundOff !== 0 && (
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Rounding Off</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>
                        {totals.roundOff > 0 ? '+' : ''}{fmt2(totals.roundOff)}
                      </td>
                    </tr>
                  )}
                  {/* Totals row */}
                  <tr style={{ borderTop: '2px solid #000' }}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>Total</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                      {totals.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                      &#8377;{fmt2(totals.totalInvoiceAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount chargeable in words */}
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>
                  <strong>Amount Chargeable (in words):&nbsp;</strong>
                  <em>{totals.totalInvoiceAmountWords}</em>
                </span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '8px' }}>E. &amp; O.E</span>
              </div>

              {/* Tax Analysis Table */}
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #000' }}>
                <p style={{ fontWeight: 700, marginBottom: '4px' }}>Tax Analysis</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>HSN/SAC</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Central Tax Rate</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Central Tax Amt</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>State Tax Rate</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>State Tax Amt</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Total Tax Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxGroups.map((g) => (
                      <tr key={`taxrow-${g.hsnSac}-${g.rate}`}>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{g.hsnSac}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(g.taxableValue)}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{g.rate / 2}%</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(g.cgst)}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{g.rate / 2}%</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(g.sgst)}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(g.cgst + g.sgst)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold' }}>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }}>Total</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(totals.totalTaxableValue)}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(totals.cgstAmount)}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }} />
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(totals.sgstAmount)}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{fmt2(totals.cgstAmount + totals.sgstAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax amount in words */}
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #000' }}>
                <strong>Tax Amount (in words):&nbsp;</strong>
                <em>{totals.taxAmountWords}</em>
              </div>

              {/* Bank Details + Declaration + Authorised Signatory */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
                  <p style={{ fontWeight: 700, marginBottom: '5px' }}>Company's Bank Details</p>
                  <p>A/c Holder Name: <strong>{bankAccountHolderName}</strong></p>
                  <p>Bank Name: {bankName}</p>
                  <p>A/c No.: <strong>{bankAccountNumber}</strong></p>
                  <p>Branch &amp; IFSC Code: {bankBranchIfsc}</p>
                  {bankSwift && <p>SWIFT: {bankSwift}</p>}
                  {remarks && (
                    <p style={{ marginTop: '6px' }}><strong>Remarks:</strong> {remarks}</p>
                  )}
                  {declarationText && (
                    <p style={{ marginTop: '8px', fontSize: '10px', color: '#444', lineHeight: 1.4 }}>
                      {declarationText}
                    </p>
                  )}
                </div>
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}>
                  <p style={{ textAlign: 'right', fontWeight: 700 }}>for {sellerCompanyName}</p>
                  <div style={{ textAlign: 'right', marginTop: '40px' }}>
                    <div style={{ display: 'inline-block', borderTop: '1px solid #000', paddingTop: '4px', minWidth: '140px' }}>
                      <p style={{ fontWeight: 600 }}>{authorizedSignatory}</p>
                      <p style={{ fontSize: '10px' }}>Authorised Signatory</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', padding: '5px 8px', borderTop: '1px solid #000', fontSize: '10px', color: '#333' }}>
                This is a Computer Generated Invoice
              </div>
            </div>

            <div className="flex justify-between max-w-[900px] mx-auto">
              <Button variant="outline" onClick={() => setStep('items')}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => submit(true)} disabled={isSaving}>Save Draft</Button>
                <Button onClick={() => submit(false)} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save & Generate'}</Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
