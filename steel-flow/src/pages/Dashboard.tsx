import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { HoldingDaysBadge } from '@/components/StatusBadge';
import { Package, Boxes, Users, ArrowLeftRight, DollarSign, Clock, Weight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApi } from '@/hooks/useApi';
import { dashboardService } from '@/lib/services/dashboardService';
import { partyService } from '@/lib/services/partyService';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: dash, loading } = useApi(() => dashboardService.getDashboard());
  const { data: partiesRes } = useApi(() => partyService.getAll({ limit: 50 }));

  const s = dash?.summary ?? { totalCoils: 0, totalCoilWeight: 0, totalPackets: 0, totalPacketWeight: 0, activeParties: 0, transfersToday: 0, billedThisMonth: 0, avgHoldingDays: 0 };
  const agingData = dash?.aging ?? [];
  const parties = (partiesRes?.data ?? []).filter((p: { status: string }) => p.status === 'active');

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Overview of steel inventory operations" />
      {loading && <div className="text-muted-foreground text-sm mb-4">Loading dashboard...</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Coils" value={s.totalCoils.toLocaleString()} icon={Package} />
        <KPICard title="Coil Weight" value={`${s.totalCoilWeight.toLocaleString()} T`} icon={Weight} />
        <KPICard title="Total Packets" value={s.totalPackets.toLocaleString()} icon={Boxes} />
        <KPICard title="Packet Weight" value={`${s.totalPacketWeight.toLocaleString()} T`} icon={Weight} />
        <KPICard title="Active Parties" value={s.activeParties} icon={Users} />
        <KPICard title="Transfers Today" value={s.transfersToday} icon={ArrowLeftRight} />
        <KPICard title="Billed This Month" value={`₹${(s.billedThisMonth / 1000).toFixed(0)}K`} icon={DollarSign} />
        <KPICard title="Avg Holding" value={`${s.avgHoldingDays} days`} icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Activity — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(218, 25%, 22%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 13%)', border: '1px solid hsl(218, 25%, 22%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
              <Bar dataKey="stockIn" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} name="Stock In" />
              <Bar dataKey="stockOut" stackId="a" fill="hsl(0, 84%, 60%)" name="Stock Out" />
              <Bar dataKey="transfer" stackId="a" fill="hsl(217, 91%, 60%)" name="Transfer" />
              <Bar dataKey="processing" stackId="a" fill="hsl(38, 92%, 50%)" radius={[2, 2, 0, 0]} name="Processing" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Aging Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={agingData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                {agingData.map((entry: { fill: string }, i: number) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 25%, 13%)', border: '1px solid hsl(218, 25%, 22%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(215, 20%, 65%)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Party Stock Summary */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Party Stock Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Party</TableHead>
                <TableHead className="text-muted-foreground text-right">Coils</TableHead>
                <TableHead className="text-muted-foreground text-right">Coil Wt (T)</TableHead>
                <TableHead className="text-muted-foreground text-right">Packets</TableHead>
                <TableHead className="text-muted-foreground text-right">Pkt Wt (T)</TableHead>
                <TableHead className="text-muted-foreground text-right">Avg Hold</TableHead>
                <TableHead className="text-muted-foreground text-right">Max Hold</TableHead>
                <TableHead className="text-muted-foreground text-right">Billed</TableHead>
                <TableHead className="text-muted-foreground">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party: { id: string; name: string; coilCount: number; coilWeight: number; packetCount: number; packetWeight: number; avgHolding: number; maxHolding: number; billed: number; lastActivity: string }) => (
                <TableRow
                  key={party.id}
                  className="border-border cursor-pointer hover:bg-secondary/50"
                  onClick={() => navigate(`/parties/${party.id}`)}
                >
                  <TableCell className="font-medium text-foreground">{party.name}</TableCell>
                  <TableCell className="text-right text-foreground">{party.coilCount}</TableCell>
                  <TableCell className="text-right text-foreground">{(party.coilWeight / 1000).toFixed(1)}</TableCell>
                  <TableCell className="text-right text-foreground">{party.packetCount}</TableCell>
                  <TableCell className="text-right text-foreground">{(party.packetWeight / 1000).toFixed(1)}</TableCell>
                  <TableCell className="text-right"><HoldingDaysBadge days={party.avgHolding} /></TableCell>
                  <TableCell className="text-right"><HoldingDaysBadge days={party.maxHolding} /></TableCell>
                  <TableCell className="text-right text-foreground">₹{party.billed.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{party.lastActivity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
