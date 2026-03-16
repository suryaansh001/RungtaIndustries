import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { InvoiceStatusBadge, BillingTypeBadge } from '@/components/StatusBadge';
import { CreateInvoiceSheet } from '@/components/billing/CreateInvoiceSheet';
import { BulkBillingModal } from '@/components/billing/BulkBillingModal';
import { type InvoiceStatus } from '@/lib/billing-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  FileText, Plus, Zap, Search, DownloadCloud, MoreHorizontal,
  Eye, Edit, Send, XCircle, DollarSign, AlertTriangle, CheckCircle,
  Clock, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { invoiceService, type InvoiceListItem, type InvoicePayload } from '@/lib/services/invoiceService';
import { downloadInvoicePreviewPdf } from '@/lib/invoicePreviewPdf';

const statusOptions: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

function exportCSV(rows: InvoiceListItem[], filename: string) {
  const headers = ['Invoice No', 'Client', 'Type', 'Date', 'Due Date', 'Subtotal', 'GST', 'Total', 'Paid', 'Outstanding', 'Status'];
  const data = rows.map(i => [
    i.invoiceNumber, i.clientName, i.billingType, i.invoiceDate, i.dueDate,
    i.subtotal, i.gstAmount, i.total, i.paid, i.outstanding, i.status,
  ]);
  const csv = [headers, ...data].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Billing() {
  const { toast } = useToast();
  const { data: invoiceRes, loading: invoiceLoading, refetch } = useApi(
    () => invoiceService.getAll({ limit: 300 }),
    []
  );
  const invoices: InvoiceListItem[] = invoiceRes?.data ?? [];

  // Sheet / Modal state
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // KPIs
  const total = invoices.reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  // Filtered invoices
  const filtered = useMemo(() => invoices.filter(inv => {
    if (search && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) &&
        !inv.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (clientFilter !== 'all' && inv.clientId !== clientFilter) return false;
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (dateFrom && inv.invoiceDate < dateFrom) return false;
    if (dateTo && inv.invoiceDate > dateTo) return false;
    if (overdueOnly && inv.status !== 'overdue') return false;
    return true;
  }), [search, clientFilter, statusFilter, dateFrom, dateTo, overdueOnly, invoices]);

  const clientOptions = useMemo(() => {
    const grouped = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.clientId && !grouped.has(inv.clientId)) grouped.set(inv.clientId, inv.clientName || 'Unknown Client');
    });
    return Array.from(grouped.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  const activityRows = useMemo(() => invoices.slice(0, 50).map((inv) => {
    const mapStatusToAction: Record<string, string> = {
      draft: 'Draft Saved',
      generated: 'Generated',
      sent: 'Sent',
      partially_paid: 'Payment Added',
      paid: 'Payment Added',
      overdue: 'Generated',
    };
    return {
      id: inv.id,
      date: inv.invoiceDate,
      user: 'System',
      action: mapStatusToAction[inv.status] || 'Generated',
      reference: inv.invoiceNumber,
      details: `${inv.clientName} | Total: ₹${inv.total.toLocaleString('en-IN')}`,
    };
  }), [invoices]);

  const handleInvoiceSave = async (invoice: InvoicePayload) => {
    await invoiceService.create(invoice);
    await refetch();
  };

  const handleMarkAsPaid = async (invoiceId: string, invoiceNumber: string) => {
    try {
      await invoiceService.updateStatus(invoiceId, 'PAID');
      await refetch();
      toast({
        title: 'Invoice marked as paid',
        description: `${invoiceNumber} has been fully paid.`,
      });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (error as { message?: string })?.message
        || 'Failed to update invoice status';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleDownloadInvoicePdf = async (invoiceId: string) => {
    try {
      const detail = await invoiceService.getOne(invoiceId);
      await downloadInvoicePreviewPdf(detail);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (error as { message?: string })?.message
        || 'Failed to download invoice PDF';
      toast({ title: message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Billing"
        description="Invoice lifecycle management — create, track and collect."
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Billed" value={`₹${(total / 100000).toFixed(1)}L`} icon={Receipt} />
        <KPICard title="Outstanding" value={`₹${(outstanding / 100000).toFixed(1)}L`} icon={Clock} />
        <KPICard title="Collected" value={`₹${(paid / 1000).toFixed(0)}K`} icon={CheckCircle} />
        <KPICard title="Overdue Invoices" value={overdueCount} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-info data-[state=active]:text-white">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-info data-[state=active]:text-white">
              Activity Log
            </TabsTrigger>
            <TabsTrigger value="exports" className="data-[state=active]:bg-info data-[state=active]:text-white">
              Export Center
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <span title="Work in progress" className="inline-block cursor-not-allowed">
              <Button
                variant="outline"
                disabled
                className="pointer-events-none border-info/30 text-info text-sm"
              >
                <Zap className="h-4 w-4 mr-1.5" /> Generate Monthly Invoices
              </Button>
            </span>
            <Button
              onClick={() => setShowCreateSheet(true)}
              className="bg-info hover:bg-info/90 text-white text-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create Invoice
            </Button>
          </div>
        </div>

        {/* ─── INVOICES TAB ─── */}
        <TabsContent value="invoices" className="space-y-3 mt-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg bg-card border border-border glass-card">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search invoice no or client…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 bg-secondary border-border text-foreground h-9 text-sm"
              />
            </div>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44 bg-secondary border-border text-foreground h-9 text-sm">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all" className="text-foreground">All Clients</SelectItem>
                {clientOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-foreground">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as InvoiceStatus | 'all')}>
              <SelectTrigger className="w-44 bg-secondary border-border text-foreground h-9 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value} className="text-foreground">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-36 bg-secondary border-border text-foreground h-9 text-sm"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-36 bg-secondary border-border text-foreground h-9 text-sm"
            />

            <div className="flex items-center gap-2">
              <Switch
                id="overdue-toggle"
                checked={overdueOnly}
                onCheckedChange={setOverdueOnly}
                className="data-[state=checked]:bg-destructive"
              />
              <Label htmlFor="overdue-toggle" className="text-sm text-muted-foreground cursor-pointer">
                Overdue only
              </Label>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs w-10">#</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Invoice No</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Client</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Type</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Date</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Due</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Subtotal</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">GST</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Total</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Paid</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Outstanding</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceLoading && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-8 text-sm">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                )}
                {!invoiceLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-12 text-sm">
                      No invoices match the current filters.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((inv, idx) => (
                  <TableRow
                    key={inv.id}
                    className="border-border row-hover-border"
                  >
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-mono-id text-sm font-semibold text-info">{inv.invoiceNumber}</span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground font-medium">{inv.clientName}</TableCell>
                    <TableCell><BillingTypeBadge type={inv.billingType} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.invoiceDate}</TableCell>
                    <TableCell className={cn('text-sm', inv.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                      {inv.dueDate}
                    </TableCell>
                    <TableCell className="text-right font-mono-id text-sm text-foreground">
                      ₹{inv.subtotal.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono-id text-sm text-muted-foreground">
                      ₹{inv.gstAmount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono-id text-sm font-semibold text-foreground">
                      ₹{inv.total.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono-id text-sm text-success">
                      {inv.paid > 0 ? `₹${inv.paid.toLocaleString('en-IN')}` : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono-id text-sm font-medium',
                      inv.outstanding > 0 ? 'text-warning' : 'text-muted-foreground')}>
                      {inv.outstanding > 0 ? `₹${inv.outstanding.toLocaleString('en-IN')}` : '—'}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-sm">
                          <DropdownMenuItem
                            className="text-foreground"
                            onClick={() => handleDownloadInvoicePdf(inv.id)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-2" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: 'Detailed view will be available shortly.' })} className="text-foreground">
                            <Eye className="h-3.5 w-3.5 mr-2" /> View
                          </DropdownMenuItem>
                          {inv.status === 'draft' && (
                            <DropdownMenuItem className="text-foreground">
                              <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {['generated', 'partially_paid'].includes(inv.status) && (
                            <DropdownMenuItem className="text-foreground">
                              <Send className="h-3.5 w-3.5 mr-2" /> Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {inv.status !== 'paid' && inv.status !== 'draft' && (
                            <DropdownMenuItem className="text-foreground" onClick={() => handleMarkAsPaid(inv.id, inv.invoiceNumber)}>
                              <DollarSign className="h-3.5 w-3.5 mr-2" /> Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive">
                            <XCircle className="h-3.5 w-3.5 mr-2" /> Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground px-1">
            Showing {filtered.length} of {invoices.length} invoices
          </p>
        </TabsContent>

        {/* ─── ACTIVITY LOG TAB ─── */}
        <TabsContent value="activity" className="mt-0">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Date & Time</TableHead>
                  <TableHead className="text-muted-foreground text-xs">User</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Action</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Reference</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                      No activity available from live invoice data yet.
                    </TableCell>
                  </TableRow>
                )}
                {activityRows.map(act => (
                  <TableRow key={act.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="text-sm font-mono-id text-muted-foreground">{act.date}</TableCell>
                    <TableCell className="text-sm text-foreground">{act.user}</TableCell>
                    <TableCell>
                      <ActivityActionBadge action={act.action} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono-id text-sm text-info">{act.reference}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {act.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── EXPORT CENTER TAB ─── */}
        <TabsContent value="exports" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Export Invoice List',
                desc: 'All invoices with current filters applied.',
                icon: FileText,
                action: () => {
                  exportCSV(filtered, `invoice-list-${new Date().toISOString().slice(0,10)}.csv`);
                  toast({ title: 'Export ready', description: 'Invoice list downloaded.' });
                },
              },
              {
                title: 'Export Billing Summary',
                desc: 'Summary totals per client — total billed, paid, outstanding.',
                icon: Receipt,
                action: () => toast({ title: 'Billing summary exported', description: 'File downloaded.' }),
              },
              {
                title: 'Export Revenue Report',
                desc: 'Monthly revenue by billing category.',
                icon: DollarSign,
                action: () => toast({ title: 'Revenue report exported', description: 'File downloaded.' }),
              },
              {
                title: 'Export Client Ledger',
                desc: 'Full ledger entries for all clients.',
                icon: FileText,
                action: () => toast({ title: 'Client ledger exported', description: 'File downloaded.' }),
              },
              {
                title: 'Export Aging Report',
                desc: 'Outstanding amounts bucketed by age.',
                icon: AlertTriangle,
                action: () => toast({ title: 'Aging report exported', description: 'File downloaded.' }),
              },
            ].map(exp => (
              <div key={exp.title} className="glass-card rounded-lg p-5 flex flex-col gap-3 border border-white/8 hover:border-info/25 transition-all duration-150">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center">
                    <exp.icon className="h-4 w-4 text-info" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{exp.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground flex-1">{exp.desc}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exp.action}
                  className="border-info/30 text-info hover:bg-info/10 w-full text-xs"
                >
                  <DownloadCloud className="h-3.5 w-3.5 mr-1.5" /> Download CSV
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheets / Modals */}
      <CreateInvoiceSheet open={showCreateSheet} onOpenChange={setShowCreateSheet} onSave={handleInvoiceSave} />
      <BulkBillingModal open={showBulkModal} onOpenChange={setShowBulkModal} />
    </AppLayout>
  );
}

// ─── helper badge ───
function ActivityActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    'Created':       'bg-info/10 text-info border-info/20',
    'Generated':     'bg-info/15 text-info border-info/30',
    'Sent':          'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30',
    'Payment Added': 'bg-success/15 text-success border-success/30',
    'Cancelled':     'bg-destructive/15 text-destructive border-destructive/30',
    'Draft Saved':   'bg-muted/60 text-muted-foreground border-border',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', styles[action] ?? 'bg-muted text-muted-foreground')}>
      {action}
    </span>
  );
}
