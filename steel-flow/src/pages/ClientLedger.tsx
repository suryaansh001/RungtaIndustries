import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { mockLedgerEntries } from '@/lib/billing-data';
import { mockParties } from '@/lib/mock-data';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, BookOpen, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const REF_TYPE_STYLE: Record<string, string> = {
  Invoice:    'bg-info/10 text-info border-info/20',
  Payment:    'bg-success/10 text-success border-success/20',
  Adjustment: 'bg-warning/10 text-warning border-warning/20',
};

export default function ClientLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const party = mockParties.find(p => p.id === id);
  const entries = mockLedgerEntries
    .filter(e => e.clientId === id)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!party) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground text-sm">Client not found.</p>
          <Button variant="outline" onClick={() => navigate('/parties')} className="border-border">
            Back to Parties
          </Button>
        </div>
      </AppLayout>
    );
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const openingBalance = 0;
  const closingBalance = openingBalance + totalDebit - totalCredit;

  function handleExport() {
    const rows = [
      ['Date', 'Ref Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
      ...entries.map(e => [e.date, e.refType, e.refNumber, e.description, e.debit || '', e.credit || '', e.runningBalance]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ledger-${party.name.replace(/ /g, '-')}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'Ledger exported', description: `${party.name} ledger downloaded.` });
  }

  return (
    <AppLayout>
      <Button variant="ghost" onClick={() => navigate(`/parties/${id}`)} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to {party.name}
      </Button>

      <PageHeader
        title={`${party.name} — Ledger`}
        description="Complete transaction ledger with running balance."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Opening Balance"
          value={`₹${openingBalance.toLocaleString('en-IN')}`}
          icon={Wallet}
          className="border-white/10 glass-card"
        />
        <KPICard
          title="Total Debit"
          value={`₹${(totalDebit / 100000).toFixed(2)}L`}
          icon={TrendingDown}
          className="border-destructive/20 glass-card"
        />
        <KPICard
          title="Total Credit"
          value={`₹${(totalCredit / 1000).toFixed(0)}K`}
          icon={TrendingUp}
          className="border-success/20 glass-card"
        />
        <KPICard
          title="Closing Balance"
          value={`₹${(closingBalance / 100000).toFixed(2)}L`}
          icon={BookOpen}
          className={cn('glass-card', closingBalance > 0 ? 'border-warning/20' : 'border-success/20')}
        />
      </div>

      {/* Table + Export */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Ledger Entries</h3>
          <Button size="sm" variant="outline" onClick={handleExport} className="border-info/30 text-info hover:bg-info/10 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export Ledger
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Date</TableHead>
                <TableHead className="text-muted-foreground text-xs">Ref Type</TableHead>
                <TableHead className="text-muted-foreground text-xs">Reference</TableHead>
                <TableHead className="text-muted-foreground text-xs max-w-xs">Description</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Debit (₹)</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Credit (₹)</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Balance (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Opening balance row */}
              <TableRow className="border-border bg-secondary/20">
                <TableCell className="text-xs text-muted-foreground" colSpan={4}>
                  <span className="italic">Opening Balance</span>
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono-id text-sm font-medium text-foreground">
                  ₹{openingBalance.toLocaleString('en-IN')}
                </TableCell>
              </TableRow>

              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                    No ledger entries found.
                  </TableCell>
                </TableRow>
              )}

              {entries.map(entry => (
                <TableRow key={entry.id} className="border-border hover:bg-secondary/30 row-hover-border">
                  <TableCell className="text-xs text-muted-foreground">{entry.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', REF_TYPE_STYLE[entry.refType] ?? '')}>
                      {entry.refType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono-id text-sm text-info">{entry.refNumber}</span>
                  </TableCell>
                  <TableCell className="text-sm text-foreground max-w-xs truncate">
                    {entry.description}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.debit > 0 ? (
                      <span className="font-mono-id text-sm font-semibold text-destructive">
                        ₹{entry.debit.toLocaleString('en-IN')}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.credit > 0 ? (
                      <span className="font-mono-id text-sm font-semibold text-success">
                        ₹{entry.credit.toLocaleString('en-IN')}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono-id text-sm font-bold',
                      entry.runningBalance > 0 ? 'text-warning' : 'text-success')}>
                      ₹{entry.runningBalance.toLocaleString('en-IN')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}

              {/* Closing balance row */}
              {entries.length > 0 && (
                <TableRow className="border-border bg-secondary/30 font-semibold">
                  <TableCell colSpan={4} className="text-sm text-foreground">Closing Balance</TableCell>
                  <TableCell className="text-right font-mono-id text-sm text-destructive">
                    ₹{totalDebit.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right font-mono-id text-sm text-success">
                    ₹{totalCredit.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right font-mono-id text-sm font-bold text-info">
                    ₹{closingBalance.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
