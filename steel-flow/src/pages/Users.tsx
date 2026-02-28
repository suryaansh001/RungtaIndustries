import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { userService } from '@/lib/services/userService';

type User = { id: string; username: string; email: string; role: string; status: string; lastLogin: string | null; created: string };

export default function Users() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const formRef = useRef<Record<string, string>>({});

  const { data: res, loading, refetch } = useApi(() => userService.getAll());
  const users: User[] = res?.data ?? [];

  const handleCreate = async () => {
    try {
      await userService.create({
        username: formRef.current.username,
        email: formRef.current.email,
        password: formRef.current.password,
        role: formRef.current.role || 'viewer',
      });
      setSheetOpen(false);
      refetch();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 'Failed to create user');
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Users" description="Manage system users and access">
        <Button onClick={() => setSheetOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </PageHeader>

      {loading && <div className="text-muted-foreground text-sm mb-2">Loading...</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Username</TableHead>
              <TableHead className="text-muted-foreground">Email</TableHead>
              <TableHead className="text-muted-foreground">Role</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Last Login</TableHead>
              <TableHead className="text-muted-foreground">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className="border-border hover:bg-secondary/50">
                <TableCell className="font-medium text-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                <TableCell className="text-foreground capitalize">{u.role}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.lastLogin || 'Never'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.created}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Add User</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            {[
              { label: 'Username *', key: 'username', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Password *', key: 'password', type: 'password' },
            ].map(({ label, key, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">{label}</Label>
                <Input type={type} className="bg-secondary border-border text-foreground" placeholder={label.replace(' *', '')}
                  onChange={(e) => { formRef.current[key] = e.target.value; }} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Role *</Label>
              <Select onValueChange={(v) => { formRef.current.role = v; }}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {['admin', 'operator', 'viewer'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4" onClick={handleCreate}>Create User</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
