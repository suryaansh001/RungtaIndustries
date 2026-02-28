import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { mockAgingReport } from '@/lib/billing-data';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Download, ChevronDown, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

function fmt(n: number) {
  if (n === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className="font-mono-id text-sm font-semibold">₹{n.toLocaleString('en-IN')}</span>;
}

export default function AgingReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const totalOutstanding = mockAgingReport.reduce((s, r) => s + r.total, 0);
  const total0_30 = mockAgingReport.reduce((s, r) => s + r.d0_30, 0);
  const total31_60 = mockAgingReport.reduce((s, r) => s + r.d31_60, 0);
  const total61_90 = mockAgingReport.reduce((s, r) => s + r.d61_90, 0);
  const total90plus = mockAgingReport.reduce((s, r) => s + r.d90plus, 0);

  function toggleRow(clientId: string) {
    setOpenRows(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  }

  function handleExport() {
    const rows = [
      ['Client', '0–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total Outstanding'],
      ...mockAgingReport.map(r => [r.clientName, r.d0_30, r.d31_60, r.d61_90, r.d90plus, r.total]),
      ['TOTAL', total0_30, total31_60, total61_90, total90plus, totalOutstanding],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `aging-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Aging report exported', description: 'CSV downloaded.' });
  }

  // Chart data
  const chartData = mockAgingReport.map(r => ({
    name: r.clientName.split(' ')[0],
    '0–30': r.d0_30,
    '31–60': r.d31_60,
    '61–90': r.d61_90,
    '90+': r.d90plus,
  }));

  return (
    <AppLayout>
      <PageHeader title="Aging Report" description="Outstanding receivables bucketed by age as of today (Feb 28, 2026)." />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPICard title="Total Outstanding" value={`₹${(totalOutstanding / 100000).toFixed(1)}L`} icon={TrendingUp} />
        <KPICard title="0–30 Days" value={`₹${(total0_30 / 1000).toFixed(0)}K`} icon={AlertTriangle} className="border-success/20" />
        <KPICard title="31–60 Days" value={`₹${(total31_60 / 1000).toFixed(0)}K`} icon={AlertTriangle} className="border-warning/20" />
        <KPICard title="61–90 Days" value={`₹${(total61_90 / 1000).toFixed(0)}K`} icon={AlertTriangle} className="border-info/20" />
        <KPICard title="90+ Days" value={`₹${(total90plus / 1000).toFixed(0)}K`} icon={AlertTriangle} className="border-destructive/20" />
      </div>

      {/* Aging Chart */}
      <div className="rounded-lg border border-border bg-card p-4 mb-6 glass-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Aging Breakdown by Client</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(218, 25%, 22%)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(222, 25%, 13%)', border: '1px solid hsl(218, 25%, 22%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }}
              formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(215, 20%, 65%)' }} />
            <Bar dataKey="0–30"  stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="31–60" stackId="a" fill="hsl(38, 92%, 50%)" />
            <Bar dataKey="61–90" stackId="a" fill="hsl(217, 91%, 60%)" />
            <Bar dataKey="90+"   stackId="a" fill="hsl(0, 84%, 60%)" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Aging Table</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="border-info/30 text-info hover:bg-info/10 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs w-6" />
              <TableHead className="text-muted-foreground text-xs">Client</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">
                <span className="text-success">0–30 Days</span>
              </TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">
                <span className="text-warning">31–60 Days</span>
              </TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">
                <span className="text-info">61–90 Days</span>
              </TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">
                <span className="text-destructive">90+ Days</span>
              </TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Total Outstanding</TableHead>
              <TableHead className="text-muted-foreground text-xs w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAgingReport.map(row => (
              <>
                <TableRow
                  key={row.clientId}
                  className="border-border hover:bg-secondary/40 row-hover-border cursor-pointer"
                  onClick={() => toggleRow(row.clientId)}
                >
                  <TableCell className="text-muted-foreground">
                    {openRows.has(row.clientId)
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">{row.clientName}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono-id text-sm', row.d0_30 > 0 ? 'text-success font-semibold' : 'text-muted-foreground text-xs')}>
                      {row.d0_30 > 0 ? `₹${row.d0_30.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono-id text-sm', row.d31_60 > 0 ? 'text-warning font-semibold' : 'text-muted-foreground text-xs')}>
                      {row.d31_60 > 0 ? `₹${row.d31_60.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono-id text-sm', row.d61_90 > 0 ? 'text-info font-semibold' : 'text-muted-foreground text-xs')}>
                      {row.d61_90 > 0 ? `₹${row.d61_90.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono-id text-sm', row.d90plus > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground text-xs')}>
                      {row.d90plus > 0 ? `₹${row.d90plus.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono-id text-sm font-bold text-foreground">
                    ₹{row.total.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => navigate(`/clients/${row.clientId}/ledger`)}
                      className="text-xs text-info hover:bg-info/10 h-7"
                    >
                      View Ledger
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Expanded breakdown */}
                {openRows.has(row.clientId) && (
                  <TableRow key={`${row.clientId}-detail`} className="border-border bg-secondary/10">
                    <TableCell />
                    <TableCell colSpan={7} className="py-3">
                      <div className="grid grid-cols-4 gap-3 animate-fade-in-up">
                        {[
                          { label: '0–30 Days', value: row.d0_30, color: 'text-success', bg: 'bg-success/10 border-success/20' },
                          { label: '31–60 Days', value: row.d31_60, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
                          { label: '61–90 Days', value: row.d61_90, color: 'text-info', bg: 'bg-info/10 border-info/20' },
                          { label: '90+ Days', value: row.d90plus, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
                        ].map(bucket => (
                          <div key={bucket.label} className={cn('rounded-lg border p-3 text-center', bucket.bg)}>
                            <p className="text-xs text-muted-foreground mb-1">{bucket.label}</p>
                            <p className={cn('font-mono-id text-base font-bold', bucket.color)}>
                              {bucket.value > 0 ? `₹${bucket.value.toLocaleString('en-IN')}` : '₹0'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}

            {/* Totals row */}
            <TableRow className="border-border bg-secondary/30 font-bold">
              <TableCell />
              <TableCell className="text-sm text-foreground">TOTAL</TableCell>
              <TableCell className="text-right font-mono-id text-sm text-success">₹{total0_30.toLocaleString('en-IN')}</TableCell>
              <TableCell className="text-right font-mono-id text-sm text-warning">₹{total31_60.toLocaleString('en-IN')}</TableCell>
              <TableCell className="text-right font-mono-id text-sm text-info">₹{total61_90.toLocaleString('en-IN')}</TableCell>
              <TableCell className="text-right font-mono-id text-sm text-destructive">₹{total90plus.toLocaleString('en-IN')}</TableCell>
              <TableCell className="text-right font-mono-id text-sm text-info">₹{totalOutstanding.toLocaleString('en-IN')}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
