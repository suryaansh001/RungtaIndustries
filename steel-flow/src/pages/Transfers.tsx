import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeftRight, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { transferService } from '@/lib/services/transferService';
import { partyService } from '@/lib/services/partyService';
import { coilService } from '@/lib/services/coilService';

type Transfer = {
  id: string; transferNumber: string; date: string;
  fromParty: string; toParty: string; coilCount: number;
  totalWeight: number; status: string; reversible: boolean; remark: string;
};
type Coil = { id: string; coilNumber: string; weight: number; size: string; status: string };

const GRADES = ['HR', 'CR', 'GP', 'GC', 'EG', 'CRCA'];

export default function Transfers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromPartyId, setFromPartyId] = useState('');
  const [toPartyId, setToPartyId] = useState('');
  const [grade, setGrade] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [reversible, setReversible] = useState(false);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline new-party creation
  const [addingNewParty, setAddingNewParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyGst, setNewPartyGst] = useState('');
  const [newPartyMobile, setNewPartyMobile] = useState('');
  const [newPartyContact, setNewPartyContact] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);

  // Available coils for selected party + grade
  const [availableCoils, setAvailableCoils] = useState<Coil[]>([]);
  const [loadingCoils, setLoadingCoils] = useState(false);

  const { data: res, loading, refetch } = useApi(() => transferService.getAll({ limit: 100 }));
  const transfers: Transfer[] = res?.data ?? [];
  const { data: partiesRes } = useApi(() => partyService.getAll({ limit: 100 }));
  const parties: { id: string; name: string }[] = partiesRes?.data ?? [];

  // Local copy that gets newly-created parties appended without a full refetch
  const [localParties, setLocalParties] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { setLocalParties(partiesRes?.data ?? []); }, [partiesRes]);

  // Whenever fromParty or grade changes, fetch available coils
  useEffect(() => {
    if (!fromPartyId || !grade) { setAvailableCoils([]); return; }
    setLoadingCoils(true);
    coilService
      .getAll({ party_id: fromPartyId, grade, limit: 500 })
      .then((r) => {
        const inStock = (r?.data ?? []).filter((c: Coil) => c.status === 'in_stock' || !c.status);
        setAvailableCoils(inStock);
      })
      .catch(() => setAvailableCoils([]))
      .finally(() => setLoadingCoils(false));
  }, [fromPartyId, grade]);

  const qty = parseInt(quantity) || 0;
  const enoughStock = availableCoils.length >= qty && qty > 0;
  const selectedCoils = availableCoils.slice(0, qty);

  const resetForm = () => {
    setFromPartyId(''); setToPartyId(''); setGrade('');
    setQuantity(''); setTransferDate(''); setReversible(false); setRemark('');
    setAvailableCoils([]);
    setAddingNewParty(false);
    setNewPartyName(''); setNewPartyGst(''); setNewPartyMobile(''); setNewPartyContact('');
  };

  const handleCreateNewParty = async () => {
    if (!newPartyName.trim()) { alert('Party name is required'); return; }
    setCreatingParty(true);
    try {
      const created = await partyService.create({
        name: newPartyName.trim(),
        gst_number: newPartyGst || undefined,
        mobile_number: newPartyMobile || undefined,
        contact_person: newPartyContact || undefined,
      });
      const newEntry = { id: created.id, name: created.name };
      setLocalParties((prev) => [...prev, newEntry]);
      setToPartyId(created.id);
      setAddingNewParty(false);
      setNewPartyName(''); setNewPartyGst(''); setNewPartyMobile(''); setNewPartyContact('');
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to create party'
      );
    } finally {
      setCreatingParty(false);
    }
  };

  const openDialog = () => { resetForm(); setDialogOpen(true); };

  const handleCreate = async () => {
    if (!fromPartyId || !toPartyId) { alert('Select both parties'); return; }
    if (fromPartyId === toPartyId) { alert('From and To parties must differ'); return; }
    if (!grade) { alert('Select a grade'); return; }
    if (qty <= 0) { alert('Enter a valid quantity'); return; }
    if (!enoughStock) {
      alert(`Only ${availableCoils.length} coil(s) of ${grade} available for this party`);
      return;
    }
    setSaving(true);
    try {
      await transferService.create({
        from_party_id: fromPartyId,
        to_party_id: toPartyId,
        coil_ids: selectedCoils.map((c) => c.id),
        transfer_date: transferDate || undefined,
        is_reversible: reversible,
        remark,
      });
      setDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          'Transfer failed'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Transfers" description="Manage coil ownership transfers between parties">
        <Button onClick={openDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Transfer
        </Button>
      </PageHeader>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="orders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Transfer Orders
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Transfer #</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">From</TableHead>
                  <TableHead className="text-muted-foreground">To</TableHead>
                  <TableHead className="text-muted-foreground text-right">Coils</TableHead>
                  <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Reversible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.filter((t) => t.status !== 'completed').map((t) => (
                  <TableRow key={t.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-mono text-sm text-primary">{t.transferNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-foreground">{t.fromParty}</TableCell>
                    <TableCell className="text-foreground">{t.toParty}</TableCell>
                    <TableCell className="text-right text-foreground">{t.coilCount}</TableCell>
                    <TableCell className="text-right text-foreground">{t.totalWeight.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{t.reversible ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
                {transfers.filter((t) => t.status !== 'completed').length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No pending transfers</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Transfer #</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">From</TableHead>
                  <TableHead className="text-muted-foreground">To</TableHead>
                  <TableHead className="text-muted-foreground text-right">Coils</TableHead>
                  <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                  <TableHead className="text-muted-foreground">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.filter((t) => t.status === 'completed').map((t) => (
                  <TableRow key={t.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-mono text-sm text-primary">{t.transferNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-foreground">{t.fromParty}</TableCell>
                    <TableCell className="text-foreground">{t.toParty}</TableCell>
                    <TableCell className="text-right text-foreground">{t.coilCount}</TableCell>
                    <TableCell className="text-right text-foreground">{t.totalWeight.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.remark || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── New Transfer Dialog (centre) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Transfer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* From / To */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">From Party</Label>
              <Select value={fromPartyId} onValueChange={setFromPartyId}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Select source party" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">To Party</Label>
              <Select
                value={addingNewParty ? '__new__' : toPartyId}
                onValueChange={(v) => {
                  if (v === '__new__') { setAddingNewParty(true); setToPartyId(''); }
                  else { setAddingNewParty(false); setToPartyId(v); }
                }}
              >
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Select destination party" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {localParties.filter((p) => p.id !== fromPartyId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-primary font-medium">
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" /> Add New Party…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Inline new-party form */}
              {addingNewParty && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2 mt-1">
                  <p className="text-xs font-semibold uppercase text-primary tracking-wide">New Party Details</p>
                  <Input
                    className="bg-secondary border-border text-foreground text-sm"
                    placeholder="Party name *"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="bg-secondary border-border text-foreground text-sm"
                      placeholder="GST number (optional)"
                      value={newPartyGst}
                      onChange={(e) => setNewPartyGst(e.target.value)}
                    />
                    <Input
                      className="bg-secondary border-border text-foreground text-sm"
                      placeholder="Mobile (optional)"
                      value={newPartyMobile}
                      onChange={(e) => setNewPartyMobile(e.target.value)}
                    />
                  </div>
                  <Input
                    className="bg-secondary border-border text-foreground text-sm"
                    placeholder="Contact person (optional)"
                    value={newPartyContact}
                    onChange={(e) => setNewPartyContact(e.target.value)}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-border text-muted-foreground text-xs"
                      onClick={() => {
                        setAddingNewParty(false);
                        setNewPartyName(''); setNewPartyGst('');
                        setNewPartyMobile(''); setNewPartyContact('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                      onClick={handleCreateNewParty}
                      disabled={creatingParty || !newPartyName.trim()}
                    >
                      {creatingParty ? 'Creating…' : 'Create & Select'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Grade + Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Grade</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Quantity (coils)</Label>
                <Input
                  type="number"
                  min="1"
                  className="bg-secondary border-border text-foreground"
                  placeholder="e.g. 3"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            {/* Stock check feedback */}
            {fromPartyId && grade && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${
                loadingCoils ? 'border-border text-muted-foreground' :
                enoughStock ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                qty > 0 ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                'border-border text-muted-foreground'
              }`}>
                {loadingCoils ? (
                  <span>Checking stock…</span>
                ) : enoughStock ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {availableCoils.length} coil(s) available — will transfer{' '}
                      <strong>{qty}</strong> (oldest first)
                    </span>
                  </>
                ) : qty > 0 ? (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      Only <strong>{availableCoils.length}</strong> coil(s) of {grade} in stock for this party
                    </span>
                  </>
                ) : (
                  <span>{availableCoils.length} coil(s) of {grade} available</span>
                )}
              </div>
            )}

            {/* Preview coils that will be transferred */}
            {enoughStock && selectedCoils.length > 0 && (
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Coils to be transferred</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCoils.map((c) => (
                    <Badge key={c.id} variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                      {c.coilNumber}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Date + Reversible + Remark */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Transfer Date</Label>
                <Input
                  type="date"
                  className="bg-secondary border-border text-foreground"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={reversible}
                    onChange={(e) => setReversible(e.target.checked)}
                  />
                  Reversible
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Remark</Label>
              <Input
                className="bg-secondary border-border text-foreground"
                placeholder="Optional"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCreate}
                disabled={saving || !enoughStock}
              >
                {saving ? 'Processing…' : 'Execute Transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
