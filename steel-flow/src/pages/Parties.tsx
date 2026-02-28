import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { partyService } from '@/lib/services/partyService';

type Party = { id: string; name: string; contact: string; mobile: string; creditLimit: number; billingCycle: string; status: string };

export default function Parties() {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<Record<string, string>>({});

  const { data: res, loading, refetch } = useApi(
    () => partyService.getAll({ search, include_inactive: showInactive ? 1 : 0, limit: 100 }),
    [search, showInactive]
  );
  const parties: Party[] = res?.data ?? [];

  const handleSave = async () => {
    try {
      await partyService.create({
        name: formRef.current.name,
        gst_number: formRef.current.gst,
        contact_person: formRef.current.contact,
        mobile_number: formRef.current.mobile,
        address: formRef.current.address,
        credit_limit: Number(formRef.current.credit_limit) || 0,
        billing_cycle: formRef.current.billing_cycle || 'monthly',
      });
      setSheetOpen(false);
      refetch();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 'Failed to save');
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Parties" description="Manage party accounts and billing">
        <Button onClick={() => setSheetOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add Party
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search parties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary border-border text-foreground" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-border" />
          Show Inactive
        </label>
      </div>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Contact</TableHead>
              <TableHead className="text-muted-foreground">Mobile</TableHead>
              <TableHead className="text-muted-foreground text-right">Credit Limit</TableHead>
              <TableHead className="text-muted-foreground">Billing Cycle</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party) => (
              <TableRow key={party.id} className="border-border cursor-pointer hover:bg-secondary/50" onClick={() => navigate(`/parties/${party.id}`)}>
                <TableCell className="font-medium text-foreground">{party.name}</TableCell>
                <TableCell className="text-foreground">{party.contact}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">{party.mobile}</TableCell>
                <TableCell className="text-right text-foreground">₹{(party.creditLimit || 0).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{party.billingCycle}</TableCell>
                <TableCell><StatusBadge status={party.status} /></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }} className="text-muted-foreground hover:text-foreground">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Add Party</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            {[
              { label: 'Name *', key: 'name' }, { label: 'GST', key: 'gst' },
              { label: 'Contact', key: 'contact' }, { label: 'Mobile', key: 'mobile' },
              { label: 'Address', key: 'address' }, { label: 'Credit Limit', key: 'credit_limit' },
              { label: 'Billing Cycle', key: 'billing_cycle' },
            ].map(({ label, key }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">{label}</Label>
                <Input className="bg-secondary border-border text-foreground" placeholder={label.replace(' *', '')}
                  onChange={(e) => { formRef.current[key] = e.target.value; }} />
              </div>
            ))}
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4" onClick={handleSave}>Save Party</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
