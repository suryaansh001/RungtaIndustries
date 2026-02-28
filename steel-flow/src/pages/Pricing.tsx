import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { pricingService } from '@/lib/services/pricingService';
import { useAuth } from '@/contexts/AuthContext';

type Pricing = { id: string; productType: string; activity: string; jwLine: string | null; rate: number; unit: string; effectiveFrom: string; effectiveTo: string | null; status: string };

export default function Pricing() {
  const { isAdmin } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const formRef = useRef<Record<string, string>>({});

  const { data: res, loading, refetch } = useApi(() => pricingService.getAll());
  const pricing: Pricing[] = res?.data ?? [];

  const handleSave = async () => {
    try {
      await pricingService.create({
        coil_grade: formRef.current.coil_grade,
        activity_type: formRef.current.activity_type,
        rate: Number(formRef.current.rate),
        rate_unit: formRef.current.rate_unit || 'per_kg',
        jw_line: formRef.current.jw_line || undefined,
        effective_from: formRef.current.effective_from,
        effective_to: formRef.current.effective_to || undefined,
      });
      setSheetOpen(false);
      refetch();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 'Failed to save');
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Pricing" description="Manage JW and storage rates">
        {isAdmin && (
          <Button onClick={() => setSheetOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Add Rate
          </Button>
        )}
      </PageHeader>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Product Type</TableHead>
              <TableHead className="text-muted-foreground">Activity</TableHead>
              <TableHead className="text-muted-foreground">JW Line</TableHead>
              <TableHead className="text-muted-foreground text-right">Rate</TableHead>
              <TableHead className="text-muted-foreground">Unit</TableHead>
              <TableHead className="text-muted-foreground">Effective From</TableHead>
              <TableHead className="text-muted-foreground">Effective To</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricing.map((p) => (
              <TableRow key={p.id} className="border-border hover:bg-secondary/50">
                <TableCell className="font-medium text-foreground">{p.productType}</TableCell>
                <TableCell className="text-muted-foreground">{p.activity}</TableCell>
                <TableCell className="text-muted-foreground">{p.jwLine || '—'}</TableCell>
                <TableCell className="text-right text-foreground">₹{p.rate}</TableCell>
                <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                <TableCell className="text-muted-foreground">{p.effectiveFrom}</TableCell>
                <TableCell className="text-muted-foreground">{p.effectiveTo || '—'}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Add Rate</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Coil Grade *</Label>
              <Select onValueChange={(v) => { formRef.current.coil_grade = v; }}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {['HR', 'CR', 'GP', 'GC', 'BP', 'Chequered'].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Activity Type *</Label>
              <Select onValueChange={(v) => { formRef.current.activity_type = v; }}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {['storage', 'processing', 'handling'].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { label: 'Rate (₹) *', key: 'rate', type: 'number' },
              { label: 'JW Line', key: 'jw_line', type: 'text' },
              { label: 'Effective From *', key: 'effective_from', type: 'date' },
              { label: 'Effective To', key: 'effective_to', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">{label}</Label>
                <Input type={type} className="bg-secondary border-border text-foreground" placeholder={label.replace(' *', '')}
                  onChange={(e) => { formRef.current[key] = e.target.value; }} />
              </div>
            ))}
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4" onClick={handleSave}>Save Rate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
