import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KPICard } from '@/components/KPICard';
import { StatusBadge, CoilNumberBadge, HoldingDaysBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Weight, Boxes, BarChart3, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { partyService } from '@/lib/services/partyService';
import { coilService } from '@/lib/services/coilService';
import { packetService } from '@/lib/services/packetService';
import { transactionService } from '@/lib/services/transactionService';
import { transferService } from '@/lib/services/transferService';

type Coil = {
  id: string; coilNumber: string; size: string; productType: string;
  weight: number; remainingWeight?: number; holdingDays: number; status: string; stage: string;
};
type Packet = {
  id: string; packetNumber: string; size: string; coilType: string;
  weight: number; holdingDays: number; status: string;
};
type Txn = {
  id: string; date: string; activity: string; coilNumber?: string;
  packetNumber?: string; weight: number; remark?: string;
};
type Transfer = {
  id: string; transferNumber: string; date: string;
  fromParty: string; toParty: string; coilCount: number; totalWeight: number; status: string;
};

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: party, loading: loadingParty, refetch: refetchParty } = useApi(
    () => partyService.getOne(id!), [id]
  );
  const { data: coilsRes, loading: loadingCoils } = useApi(
    () => coilService.getAll({ party_id: id, limit: 500 }), [id]
  );
  const { data: packetsRes, loading: loadingPackets } = useApi(
    () => packetService.getAll({ party_id: id, limit: 500 }), [id]
  );
  const { data: txnRes, loading: loadingTxn } = useApi(
    () => transactionService.getAll({ party_id: id, limit: 200 }), [id]
  );
  const { data: transfersRes, loading: loadingTransfers } = useApi(
    () => transferService.getAll({ limit: 200 }), [id]
  );

  const coils: Coil[] = coilsRes?.data ?? [];
  const packets: Packet[] = packetsRes?.data ?? [];
  const txns: Txn[] = txnRes?.data ?? [];
  // Filter transfers involving this party
  const allTransfers: Transfer[] = transfersRes?.data ?? [];
  const partyTransfers = allTransfers.filter(
    (t) => t.fromParty === party?.name || t.toParty === party?.name
  );

  if (loadingParty) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading party…</div>
      </AppLayout>
    );
  }

  if (!party) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <p className="text-muted-foreground">Party not found</p>
          <Button variant="outline" onClick={() => navigate('/parties')}>Back to Parties</Button>
        </div>
      </AppLayout>
    );
  }

  const totalCoilWeight = coils.reduce((s, c) => s + (c.remainingWeight ?? c.weight ?? 0), 0);
  const totalPacketWeight = packets.reduce((s, p) => s + (p.weight ?? 0), 0);
  const inStockCoils = coils.filter((c) => c.status === 'in_stock').length;
  const inStockPackets = packets.filter((p) => p.status === 'in_stock').length;

  return (
    <AppLayout>
      <Button
        variant="ghost"
        onClick={() => navigate('/parties')}
        className="mb-4 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Parties
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">{party.name}</h1>
            <StatusBadge status={party.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {party.contact && <span>Contact: {party.contact}</span>}
            {party.mobile && <span>📞 {party.mobile}</span>}
            {(party.gst || party.gstNumber) && <span>GST: {party.gst || party.gstNumber}</span>}
            {party.address && <span>📍 {party.address}</span>}
            {party.creditLimit > 0 && <span>Credit: ₹{(party.creditLimit || 0).toLocaleString()}</span>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetchParty}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Coils In Stock"
          value={`${inStockCoils} / ${coils.length}`}
          icon={Package}
        />
        <KPICard
          title="Coil Weight"
          value={`${(totalCoilWeight / 1000).toFixed(1)} T`}
          icon={Weight}
        />
        <KPICard
          title="Packets In Stock"
          value={`${inStockPackets} / ${packets.length}`}
          icon={Boxes}
        />
        <KPICard
          title="Total Transfers"
          value={partyTransfers.length}
          icon={BarChart3}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="coils" className="space-y-4">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="coils" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Coils {coils.length > 0 && <Badge className="ml-1.5 bg-primary/20 text-primary text-xs">{coils.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="packets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Packets {packets.length > 0 && <Badge className="ml-1.5 bg-primary/20 text-primary text-xs">{packets.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Transactions {txns.length > 0 && <Badge className="ml-1.5 bg-primary/20 text-primary text-xs">{txns.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Transfers {partyTransfers.length > 0 && <Badge className="ml-1.5 bg-primary/20 text-primary text-xs">{partyTransfers.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Coils Tab */}
        <TabsContent value="coils">
          {loadingCoils ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading coils…</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Coil #</TableHead>
                    <TableHead className="text-muted-foreground">Grade</TableHead>
                    <TableHead className="text-muted-foreground">Size</TableHead>
                    <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                    <TableHead className="text-muted-foreground text-right">Remaining</TableHead>
                    <TableHead className="text-muted-foreground">Holding</TableHead>
                    <TableHead className="text-muted-foreground">Stage</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coils.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-border hover:bg-secondary/50 cursor-pointer"
                      onClick={() => navigate(`/coils/${c.id}`)}
                    >
                      <TableCell><CoilNumberBadge number={c.coilNumber} /></TableCell>
                      <TableCell className="text-muted-foreground">{c.productType}</TableCell>
                      <TableCell className="text-foreground">{c.size}</TableCell>
                      <TableCell className="text-right text-foreground">{c.weight.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-foreground">
                        {(c.remainingWeight ?? c.weight).toLocaleString()}
                      </TableCell>
                      <TableCell><HoldingDaysBadge days={c.holdingDays} /></TableCell>
                      <TableCell><StatusBadge status={c.stage?.toLowerCase()} /></TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                  {coils.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coils found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Packets Tab */}
        <TabsContent value="packets">
          {loadingPackets ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading packets…</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Packet #</TableHead>
                    <TableHead className="text-muted-foreground">Size</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                    <TableHead className="text-muted-foreground">Holding</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packets.map((p) => (
                    <TableRow key={p.id} className="border-border hover:bg-secondary/50">
                      <TableCell className="font-mono text-sm text-primary">{p.packetNumber}</TableCell>
                      <TableCell className="text-foreground">{p.size}</TableCell>
                      <TableCell className="text-muted-foreground">{p.coilType}</TableCell>
                      <TableCell className="text-right text-foreground">{p.weight.toLocaleString()}</TableCell>
                      <TableCell><HoldingDaysBadge days={p.holdingDays} /></TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                  {packets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No packets found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          {loadingTxn ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading transactions…</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Activity</TableHead>
                    <TableHead className="text-muted-foreground">Reference</TableHead>
                    <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                    <TableHead className="text-muted-foreground">Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id} className="border-border hover:bg-secondary/50">
                      <TableCell className="text-muted-foreground text-sm">{t.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            t.activity.includes('In') ? 'border-green-500/30 text-green-400' :
                            t.activity.includes('Out') ? 'border-red-500/30 text-red-400' :
                            'border-border text-muted-foreground'
                          }`}
                        >
                          {t.activity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-primary">
                        {t.coilNumber || t.packetNumber || '—'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        t.weight < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {t.weight > 0 ? '+' : ''}{t.weight.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.remark || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {txns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers">
          {loadingTransfers ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading transfers…</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Transfer #</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Direction</TableHead>
                    <TableHead className="text-muted-foreground">Other Party</TableHead>
                    <TableHead className="text-muted-foreground text-right">Coils</TableHead>
                    <TableHead className="text-muted-foreground text-right">Weight (kg)</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partyTransfers.map((t) => {
                    const isOut = t.fromParty === party.name;
                    return (
                      <TableRow key={t.id} className="border-border hover:bg-secondary/50">
                        <TableCell className="font-mono text-sm text-primary">{t.transferNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{t.date}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={isOut
                              ? 'border-red-500/30 text-red-400 text-xs'
                              : 'border-green-500/30 text-green-400 text-xs'
                            }
                          >
                            {isOut ? '↑ OUT' : '↓ IN'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground">{isOut ? t.toParty : t.fromParty}</TableCell>
                        <TableCell className="text-right text-foreground">{t.coilCount}</TableCell>
                        <TableCell className="text-right text-foreground">{t.totalWeight.toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {partyTransfers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transfers found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
