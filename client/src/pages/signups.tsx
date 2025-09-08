import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SignupsPage() {
  const [list, setList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/signups')
      .then((r) => r.json())
      .then((j) => { if (mounted) setList(Array.isArray(j) ? j : []); })
      .catch((e) => { if (mounted) setError(String(e)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Signup Requests</h1>

      {loading && (
        <div className="text-sm text-slate-500">Loading requests…</div>
      )}

      {error && (
        <div className="text-sm text-red-600">Error loading signups: {error}</div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="text-gray-600">No signups yet.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {list.map((s) => {
          const id = s.id || s._id || String(Math.random()).slice(2,10);
          const created = s.createdAt ? new Date(s.createdAt) : null;
          return (
            <Card key={id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{s.fullName || s.name || s.contactMethod || 'Unknown'}</div>
                  <div className="text-sm text-slate-500">{created ? created.toLocaleString() : (s.createdAt || '')}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">{s.contactMethod}</div>
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{s.contactNote || s.note || ''}</div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-slate-500">ID: {id}</div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(JSON.stringify(s))}>
                    Copy
                  </Button>
                  <Button size="sm" onClick={() => { window.open('/api/signups'); }}>
                    Raw
                  </Button>
                  {((s.id || s._id)) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const idToDelete = (s.id || s._id);
                        if (!idToDelete) return;
                        if (!confirm('Delete this signup request? This cannot be undone.')) return;
                        try {
                          setDeletingId(String(idToDelete));
                          const res = await fetch(`/api/signups/${encodeURIComponent(String(idToDelete))}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const text = await res.text().catch(() => res.statusText || 'Unknown');
                            throw new Error(text || `Status ${res.status}`);
                          }
                          setList((prev) => prev.filter((it) => (it.id || it._id) !== idToDelete));
                        } catch (err: any) {
                          setError(String(err?.message || err));
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === (s.id || s._id)}
                    >
                      {deletingId === (s.id || s._id) ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
