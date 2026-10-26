import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CatalogEntry {
  _id: string;
  name: string;
  description?: string;
  bio?: string;
  isActive: boolean;
}

function EntityManager({ type }: { type: 'categories' | 'authors' }) {
  const queryClient = useQueryClient();
  const isCategory = type === 'categories';
  const textField = isCategory ? 'description' : 'bio';
  const path = `/admin/${type}`;
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const query = useQuery({
    queryKey: ['admin', type],
    queryFn: async () => (await api.get<CatalogEntry[]>(path)).data,
  });
  const save = useMutation({
    mutationFn: () => editing
      ? api.patch(`${path}/${editing._id}`, { name: name.trim(), [textField]: details.trim() })
      : api.post(path, { name: name.trim(), [textField]: details.trim() }),
    onSuccess: async () => {
      setEditing(null);
      setName('');
      setDetails('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', type] }),
        queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-authors'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['collection'] }),
      ]);
    },
  });
  const toggle = useMutation({
    mutationFn: (entry: CatalogEntry) => api.patch(`${path}/${entry._id}`, { isActive: !entry.isActive }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', type] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['collection'] }),
      ]);
    },
  });

  function startEdit(entry: CatalogEntry) {
    setEditing(entry);
    setName(entry.name);
    setDetails(entry[textField] ?? '');
    save.reset();
  }

  return (
    <section className="space-y-5 rounded-xl border border-ink-100 bg-white p-5">
      <div>
        <h2 className="font-serif text-2xl">{isCategory ? 'Categories' : 'Authors'}</h2>
        <p className="mt-1 text-sm text-ink-500">
          {isCategory ? 'Organize books into storefront collections.' : 'Maintain the author directory used by book listings.'}
        </p>
      </div>
      <form
        className="space-y-3 rounded-lg bg-ink-50 p-4"
        onSubmit={(event) => { event.preventDefault(); save.mutate(); }}
      >
        <label className="block space-y-1.5 text-sm font-medium">
          {isCategory ? 'Category name' : 'Author name'}
          <Input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          {isCategory ? 'Description' : 'Biography'}
          <Textarea maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />
        </label>
        {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
        <div className="flex gap-2">
          <Button variant="accent" disabled={save.isPending}>
            {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add'}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={() => { setEditing(null); setName(''); setDetails(''); save.reset(); }}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </form>
      {query.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {query.isError && <p role="alert" className="text-sm text-red-700">{query.error.message}</p>}
      {toggle.isError && <p role="alert" className="text-sm text-red-700">{toggle.error.message}</p>}
      <ul className="divide-y divide-ink-100">
        {query.data?.map((entry) => (
          <li key={entry._id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{entry.name}</p>
              <p className="text-xs text-ink-500">{entry.isActive ? 'Active' : 'Hidden from storefront'}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="ghost" aria-label={`Edit ${entry.name}`} onClick={() => startEdit(entry)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(entry)}>
                {entry.isActive ? 'Hide' : 'Show'}
              </Button>
            </div>
          </li>
        ))}
        {!query.isLoading && !query.data?.length && <li className="py-4 text-sm text-ink-500">No entries yet.</li>}
      </ul>
    </section>
  );
}

export function AdminCatalogPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Storefront structure</p>
        <h1 className="mt-1 font-serif text-3xl">Categories and authors</h1>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <EntityManager type="categories" />
        <EntityManager type="authors" />
      </div>
    </div>
  );
}
