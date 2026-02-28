import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, HoldingDaysBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { packetService } from '@/lib/services/packetService';

type Packet = { id: string; packetNumber: string; partyName: string; size: string; coilType: string; weight: number; rate: number; storageCharge: number; holdingDays: number; status: string };

export default function Packets() {
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: res, loading, refetch } = useApi(() => packetService.getAll({ limit: 200 }));
  const all: Packet[] = res?.data ?? [];

  const filtered = all.filter((p) =>
    (p.packetNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.partyName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Packets" description="Manage packet storage and tracking">
        <Button onClick={() => setSheetOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add Packet
        </Button>
      </PageHeader>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search packets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary border-border text-foreground" />
      </div>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Packet #</TableHead>
              <TableHead className="text-muted-foreground">Party</TableHead>
              <TableHead className="text-muted-foreground">Size</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground text-right">Weight</TableHead>
              <TableHead className="text-muted-foreground text-right">Rate</TableHead>
              <TableHead className="text-muted-foreground text-right">Storage Charge</TableHead>
              <TableHead className="text-muted-foreground">Holding</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((pkt) => (
              <TableRow key={pkt.id} className="border-border hover:bg-secondary/50">
                <TableCell className="font-mono text-sm text-primary">{pkt.packetNumber}</TableCell>
                <TableCell className="text-foreground">{pkt.partyName}</TableCell>
                <TableCell className="text-foreground">{pkt.size}</TableCell>
                <TableCell className="text-muted-foreground">{pkt.coilType}</TableCell>
                <TableCell className="text-right text-foreground">{pkt.weight.toLocaleString()}</TableCell>
                <TableCell className="text-right text-foreground">₹{pkt.rate}</TableCell>
                <TableCell className="text-right text-foreground">₹{(pkt.storageCharge || 0).toLocaleString()}</TableCell>
                <TableCell><HoldingDaysBadge days={pkt.holdingDays} /></TableCell>
                <TableCell><StatusBadge status={pkt.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Add Packet</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            {['Packet Number', 'Party ID', 'Coil Grade', 'Size', 'Net Weight (kg)', 'Kata Weight (kg)', 'Truck/DO', 'Kanta Name', 'Kata #'].map((f) => (
              <div key={f} className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">{f}</Label>
                <Input className="bg-secondary border-border text-foreground" placeholder={f} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Rate per kg (auto)</Label>
              <Input className="bg-muted border-border text-muted-foreground" readOnly value="Auto-filled from pricing" />
            </div>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4" onClick={() => { setSheetOpen(false); refetch(); }}>Save Packet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
