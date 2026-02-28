import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KPICard } from '@/components/KPICard';
import { StatusBadge, CoilNumberBadge, HoldingDaysBadge } from '@/components/StatusBadge';
import { mockCoils, mockTransactions } from '@/lib/mock-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Weight, Clock, Package } from 'lucide-react';

export default function CoilDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const coil = mockCoils.find(c => c.id === id);
  if (!coil) return <AppLayout><p className="text-muted-foreground">Coil not found</p></AppLayout>;

  const coilTxns = mockTransactions.filter(t => t.coilNumber === coil.coilNumber);

  return (
    <AppLayout>
      <Button variant="ghost" onClick={() => navigate('/coils')} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Coils
      </Button>

      <div className="flex items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono-id text-2xl font-bold text-primary">{coil.coilNumber}</span>
            <StatusBadge status={coil.status} />
            <StatusBadge status={coil.stage.toLowerCase()} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Party: {coil.partyName} · {coil.productType} / {coil.coilType} · JW: {coil.jwLine}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KPICard title="Original Weight" value={`${coil.weight.toLocaleString()} kg`} icon={Weight} />
        <KPICard title="Remaining Weight" value={`${coil.remainingWeight.toLocaleString()} kg`} icon={Package} />
        <KPICard title="Holding Days" value={coil.holdingDays} icon={Clock} subtitle={coil.stockInDate} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="ledger" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Ledger</TabsTrigger>
          <TabsTrigger value="transfers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Transfer History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Coil Number', coil.coilNumber], ['Party', coil.partyName], ['Product Type', coil.productType],
                ['Coil Type', coil.coilType], ['Size', coil.size], ['Thickness', `${coil.thickness} mm`],
                ['Width', `${coil.width} mm`], ['Length', `${coil.length} mm`], ['Net Weight', `${coil.weight} kg`],
                ['Kata Weight', `${coil.kataWeight} kg`], ['Stock In Date', coil.stockInDate], ['JW Line', coil.jwLine],
                ['Truck/DO', coil.truckDo], ['Kanta', coil.kantaName], ['Kata #', coil.kataNumber],
                ['Chalan #', coil.chalanNumber], ['Rate', `₹${coil.rate}/kg`], ['Stage', coil.stage],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className={`text-sm font-medium mt-0.5 ${label === 'Coil Number' ? 'font-mono-id text-primary' : 'text-foreground'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Activity</TableHead>
                  <TableHead className="text-muted-foreground text-right">Weight Change</TableHead>
                  <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-muted-foreground">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coilTxns.map(t => (
                  <TableRow key={t.id} className="border-border">
                    <TableCell className="text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-foreground">{t.activity}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${t.weight >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {t.weight > 0 ? '+' : ''}{t.weight.toLocaleString()} kg
                    </TableCell>
                    <TableCell className="text-right text-foreground">₹{t.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{t.remark}</TableCell>
                  </TableRow>
                ))}
                {coilTxns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No ledger entries</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transfers">
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No transfer history for this coil
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
