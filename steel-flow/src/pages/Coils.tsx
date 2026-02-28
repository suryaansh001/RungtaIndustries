import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, CoilNumberBadge, HoldingDaysBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { coilService } from '@/lib/services/coilService';
import { partyService } from '@/lib/services/partyService';

type Coil = {
  id: string; coilNumber: string; partyId: string; partyName: string;
  size: string; productType: string; coilType?: string; jwLine?: string;
  stage: string; status: string; weight: number; remainingWeight?: number; holdingDays: number;
};

function nextCoilNumber(coils: Coil[]): string {
  const year = new Date().getFullYear();
  const prefix = `C-${year}-`;
  const nums = coils
    .map((c) => { const m = c.coilNumber.match(/C-\d{4}-(\d+)/); return m ? parseInt(m[1]) : 0; })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export default function Coils() {
  const [search, setSearch] = useState('');
  const [filterParty, setFilterParty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [productType, setProductType] = useState('');
  const [coilType, setCoilType] = useState('');
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const formRef = useRef<Record<string, string>>({});
  const navigate = useNavigate();

  const { data: coilsRes, loading, refetch } = useApi(() => coilService.getAll({ limit: 200 }));
  const { data: partiesRes } = useApi(() => partyService.getAll({ limit: 100 }));
  const allCoils: Coil[] = coilsRes?.data ?? [];
  const parties: { id: string; name: string }[] = partiesRes?.data ?? [];

  const openDialog = () => {
    formRef.current = {};
    setPartyId('');
    setProductType('');
    setCoilType('');
    const suggested = nextCoilNumber(allCoils);
    setSuggestedNumber(suggested);
    formRef.current.coil_number = suggested;
    setDialogOpen(true);
  };

  const filtered = allCoils.filter((c) => {
    const matchSearch =
      c.coilNumber.toLowerCase().includes(search.toLowerCase()) ||
      (c.partyName || '').toLowerCase().includes(search.toLowerCase());
    const matchParty = filterParty === 'all' || c.partyId === filterParty;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchParty && matchStatus;
  });

  const handleSave = async () => {
    const f = formRef.current;
    if (!f.coil_number || !partyId || !productType) {
      alert('Coil Number, Party and Product Type are required');
      return;
    }
    setSaving(true);
    try {
      await coilService.create({
        coil_number: f.coil_number,
        party_id: partyId,
        coil_grade: productType,
        coil_type: coilType || undefined,
        size: f.size || '',
        thickness_mm: f.thickness ? parseFloat(f.thickness) : undefined,
        width_mm: f.width ? parseFloat(f.width) : undefined,
        length_mm: f.length ? parseFloat(f.length) : undefined,
        net_weight_kg: f.net_weight ? parseFloat(f.net_weight) : undefined,
        kata_weight_kg: f.kata_weight ? parseFloat(f.kata_weight) : undefined,
        jw_line: f.jw_line || undefined,
        truck_do_number: f.truck_do || undefined,
        kanta_name: f.kanta_name || undefined,
        kata_number: f.kata_number || undefined,
        chalan_number: f.chalan || undefined,
        stock_in_date: f.stock_in_date || undefined,
        remark: f.remark || undefined,
      });
      setDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          'Failed to save coil'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Coils" description="Track and manage steel coil inventory">
        <Button onClick={openDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add Coil
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search coils..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border text-foreground"
          />
        </div>
        <Select value={filterParty} onValueChange={setFilterParty}>
          <SelectTrigger className="w-[180px] bg-secondary border-border text-foreground">
            <SelectValue placeholder="Party" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Parties</SelectItem>
            {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-secondary border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Coil #</TableHead>
              <TableHead className="text-muted-foreground">Party</TableHead>
              <TableHead className="text-muted-foreground">Size</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Stage</TableHead>
              <TableHead className="text-muted-foreground">JW Line</TableHead>
              <TableHead className="text-muted-foreground text-right">Weight</TableHead>
              <TableHead className="text-muted-foreground text-right">Remaining</TableHead>
              <TableHead className="text-muted-foreground">Holding</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((coil) => (
              <TableRow
                key={coil.id}
                className="border-border cursor-pointer hover:bg-secondary/50"
                onClick={() => navigate(`/coils/${coil.id}`)}
              >
                <TableCell><CoilNumberBadge number={coil.coilNumber} /></TableCell>
                <TableCell className="text-foreground">{coil.partyName}</TableCell>
                <TableCell className="text-foreground">{coil.size}</TableCell>
                <TableCell className="text-muted-foreground">{coil.productType} / {coil.coilType || '—'}</TableCell>
                <TableCell><StatusBadge status={coil.stage.toLowerCase()} /></TableCell>
                <TableCell className="text-muted-foreground">{coil.jwLine || '—'}</TableCell>
                <TableCell className="text-right text-foreground">{coil.weight.toLocaleString()}</TableCell>
                <TableCell className="text-right text-foreground">{coil.remainingWeight?.toLocaleString() ?? '—'}</TableCell>
                <TableCell><HoldingDaysBadge days={coil.holdingDays} /></TableCell>
                <TableCell><StatusBadge status={coil.status} /></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No coils found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Add Coil Dialog (centre) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Coil</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Identity */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Identity</h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Coil Number</Label>
                  <Input
                    className="bg-secondary border-border text-foreground font-mono"
                    defaultValue={suggestedNumber}
                    onChange={(e) => { formRef.current.coil_number = e.target.value; }}
                  />
                  <p className="text-xs text-muted-foreground">Auto-suggested from last entry — edit if needed</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Party *</Label>
                  <Select value={partyId} onValueChange={setPartyId}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Product Type *</Label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger className="bg-secondary border-border text-foreground">
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {['HR', 'CR', 'GP', 'GC', 'EG', 'CRCA'].map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Coil Type</Label>
                    <Select value={coilType} onValueChange={setCoilType}>
                      <SelectTrigger className="bg-secondary border-border text-foreground">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="Full">Full</SelectItem>
                        <SelectItem value="Slit">Slit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Dimensions */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Dimensions</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Size', key: 'size', placeholder: 'e.g. 4x1250' },
                  { label: 'Thickness (mm)', key: 'thickness', placeholder: 'mm' },
                  { label: 'Width (mm)', key: 'width', placeholder: 'mm' },
                  { label: 'Length (mm)', key: 'length', placeholder: 'mm' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">{label}</Label>
                    <Input
                      className="bg-secondary border-border text-foreground"
                      placeholder={placeholder}
                      onChange={(e) => { formRef.current[key] = e.target.value; }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Weight */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weight</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Net Weight (kg)', key: 'net_weight' },
                  { label: 'Kata Weight (kg)', key: 'kata_weight' },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">{label}</Label>
                    <Input
                      className="bg-secondary border-border text-foreground"
                      placeholder="kg"
                      onChange={(e) => { formRef.current[key] = e.target.value; }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Entry Details */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Entry Details</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Stock In Date', key: 'stock_in_date', type: 'date' },
                  { label: 'JW Line', key: 'jw_line' },
                  { label: 'Truck / DO #', key: 'truck_do' },
                  { label: 'Kanta Name', key: 'kanta_name' },
                  { label: 'Kata #', key: 'kata_number' },
                  { label: 'Chalan #', key: 'chalan' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">{label}</Label>
                    <Input
                      type={type || 'text'}
                      className="bg-secondary border-border text-foreground"
                      placeholder={label}
                      onChange={(e) => { formRef.current[key] = e.target.value; }}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 mt-3">
                <Label className="text-sm text-muted-foreground">Remark</Label>
                <Input
                  className="bg-secondary border-border text-foreground"
                  placeholder="Optional"
                  onChange={(e) => { formRef.current.remark = e.target.value; }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Coil'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
