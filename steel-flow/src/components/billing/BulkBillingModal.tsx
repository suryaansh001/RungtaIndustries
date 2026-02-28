import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { mockBulkBillableClients } from '@/lib/billing-data';
import { CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkBillingModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const YEARS = ['2025', '2026'];

export function BulkBillingModal({ open, onOpenChange }: BulkBillingModalProps) {
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select');
  const [selectedMonth, setSelectedMonth] = useState('March');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [generatedCount, setGeneratedCount] = useState(0);

  function toggleClient(clientId: string) {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedClients.size === mockBulkBillableClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(mockBulkBillableClients.map(c => c.clientId)));
    }
  }

  function handleGenerate() {
    setGeneratedCount(selectedClients.size);
    setStep('done');
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => { setStep('select'); setSelectedClients(new Set()); }, 300);
  }

  const totalAmount = mockBulkBillableClients
    .filter(c => selectedClients.has(c.clientId))
    .reduce((s, c) => s + c.billableAmount, 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[640px] bg-[hsl(225,25%,8%)] border border-white/10 p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-white/10">
          <DialogTitle className="flex items-center gap-2 text-foreground text-base">
            <Zap className="h-4 w-4 text-info" />
            Generate Monthly Invoices
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP: SELECT MONTH ── */}
        {step === 'select' && (
          <div className="p-6 space-y-5 animate-fade-in-up">
            <p className="text-sm text-muted-foreground">
              Select the billing period. The system will preview all clients with billable transactions.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {MONTHS.map(m => (
                      <SelectItem key={m} value={m} className="text-foreground">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {YEARS.map(y => (
                      <SelectItem key={y} value={y} className="text-foreground">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button onClick={() => setStep('preview')} className="bg-info hover:bg-info/90 text-white">
                Preview Billable Clients →
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && (
          <div className="animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Billing period: <span className="text-foreground font-medium">{selectedMonth} {selectedYear}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Select clients to generate invoices for.</p>
            </div>

            <div className="overflow-y-auto max-h-[340px] px-6 pb-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedClients.size === mockBulkBillableClients.length}
                        onCheckedChange={toggleAll}
                        className="border-border"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">Client</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Items</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Billable Amt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockBulkBillableClients.map(client => (
                    <TableRow
                      key={client.clientId}
                      className={cn(
                        'border-white/10 cursor-pointer transition-colors',
                        selectedClients.has(client.clientId) ? 'bg-info/5' : 'hover:bg-white/[0.03]'
                      )}
                      onClick={() => toggleClient(client.clientId)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.has(client.clientId)}
                          onCheckedChange={() => toggleClient(client.clientId)}
                          className="border-border"
                        />
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{client.clientName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">
                          {client.billableItems.join(' · ')}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{client.itemCount}</TableCell>
                      <TableCell className="text-right font-mono-id text-sm font-medium text-foreground">
                        ₹{client.billableAmount.toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedClients.size > 0 && (
              <div className="mx-6 mb-4 glass-card rounded-lg p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{selectedClients.size} client{selectedClients.size > 1 ? 's' : ''} selected</span>
                <span className="font-mono-id font-semibold text-info">₹{totalAmount.toLocaleString('en-IN')} total</span>
              </div>
            )}

            <div className="px-6 py-4 border-t border-white/10 flex justify-between">
              <Button variant="outline" onClick={() => setStep('select')} className="border-border">← Back</Button>
              <Button
                onClick={handleGenerate}
                disabled={selectedClients.size === 0}
                className="bg-info hover:bg-info/90 text-white"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Generate {selectedClients.size > 0 ? `${selectedClients.size} ` : ''}Invoice{selectedClients.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <div className="p-8 text-center space-y-4 animate-fade-in-up">
            <div className="h-14 w-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {generatedCount} invoice{generatedCount !== 1 ? 's' : ''} generated successfully.
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Billing period: {selectedMonth} {selectedYear}. Invoices are now in <span className="text-info font-medium">Generated</span> status.
              </p>
            </div>
            <Button onClick={handleClose} className="bg-info hover:bg-info/90 text-white mt-2">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
