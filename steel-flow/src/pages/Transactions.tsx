import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { ActivityBadge, CoilNumberBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, TrendingUp, TrendingDown, Scale, DollarSign, AlertTriangle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { transactionService } from '@/lib/services/transactionService';

type Txn = { id: string; date: string; activity: string; partyName: string; coilNumber: string | null; packetNumber: string | null; productType: string; weight: number | null; rate: number | null; amount: number | null; remark: string };

export default function Transactions() {
  const [search, setSearch] = useState('');
  const { data: res, loading } = useApi(() => transactionService.getAll({ limit: 200 }));
  const all: Txn[] = res?.data ?? [];

  const filtered = all.filter((t) =>
    (t.partyName || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.coilNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.activity || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalInflow = all.filter((t) => (t.weight ?? 0) > 0).reduce((s, t) => s + (t.weight ?? 0), 0);
  const totalOutflow = Math.abs(all.filter((t) => (t.weight ?? 0) < 0).reduce((s, t) => s + (t.weight ?? 0), 0));
  const totalBilled = all.reduce((s, t) => s + (t.amount ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Transactions" description="Immutable transaction ledger" />

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 mb-6 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <p className="text-sm text-warning">This ledger is immutable and cannot be modified.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Inflow" value={`${totalInflow.toLocaleString()} kg`} icon={TrendingUp} />
        <KPICard title="Total Outflow" value={`${totalOutflow.toLocaleString()} kg`} icon={TrendingDown} />
        <KPICard title="Net Weight" value={`${(totalInflow - totalOutflow).toLocaleString()} kg`} icon={Scale} />
        <KPICard title="Total Billed" value={`₹${totalBilled.toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary border-border text-foreground" />
      </div>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground">Activity</TableHead>
              <TableHead className="text-muted-foreground">Party</TableHead>
              <TableHead className="text-muted-foreground">Coil #</TableHead>
              <TableHead className="text-muted-foreground">Packet #</TableHead>
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground text-right">Weight</TableHead>
              <TableHead className="text-muted-foreground text-right">Rate</TableHead>
              <TableHead className="text-muted-foreground text-right">Amount</TableHead>
              <TableHead className="text-muted-foreground">Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id} className="border-border">
                <TableCell className="text-muted-foreground">{t.date}</TableCell>
                <TableCell><ActivityBadge activity={t.activity} /></TableCell>
                <TableCell className="text-foreground">{t.partyName}</TableCell>
                <TableCell>{t.coilNumber ? <CoilNumberBadge number={t.coilNumber} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{t.packetNumber ? <span className="font-mono text-sm text-primary">{t.packetNumber}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-muted-foreground">{t.productType}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${(t.weight ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {(t.weight ?? 0) > 0 ? '+' : ''}{(t.weight ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-foreground">{t.rate != null ? `₹${t.rate}` : '—'}</TableCell>
                <TableCell className="text-right text-foreground">{t.amount != null ? `₹${t.amount.toLocaleString()}` : '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{t.remark}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
