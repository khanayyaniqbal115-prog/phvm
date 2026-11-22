import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Search } from 'lucide-react';

interface Hit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  author: string;
  project_type: string;
}

const TYPES = [
  { id: 'mod', label: 'Mods' },
  { id: 'shader', label: 'Shaders' },
  { id: 'modpack', label: 'Modpacks' },
] as const;

function compact(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);
}

/** Web version of the Mods page: browse Modrinth and open projects. Installing needs the Windows app. */
export function WebModBrowser({ mcVersion, loader }: { mcVersion: string; loader: string }) {
  const [type, setType] = useState<(typeof TYPES)[number]['id']>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ query, projectType: type, version: mcVersion, loader, limit: '24' });
        const res = await fetch(`/api/modrinth/search?${params}`);
        const data = (await res.json()) as { hits?: Hit[] };
        setHits(data.hits ?? []);
        if (!data.hits?.length) setError('Nothing found. Try another word or another Minecraft version.');
      } catch {
        setError('Could not reach Modrinth. Check your internet and try again.');
      } finally {
        setLoading(false);
      }
    },
    [query, type, mcVersion, loader]
  );

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Browse mods</h1>
        <p className="text-xs text-slate-400 mt-1">
          Showing results for Minecraft {mcVersion} ({loader}). Open a project to download it, or use the Windows app to install it into a profile in one click.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${type === t.id ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-[#1A2130] border-white/10 text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Modrinth..."
          className="flex-1 rounded-lg bg-[#090C12] border border-white/10 focus:border-orange-500/60 outline-none px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-orange-400">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
        </button>
      </form>
      {error && <p className="text-xs text-amber-200">{error}</p>}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hits.map((h) => (
          <li key={h.project_id} className="rounded-xl bg-[#111620] border border-white/10 p-3 flex gap-3">
            {h.icon_url ? (
              <img src={h.icon_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-black/30" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-orange-500/15 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-white truncate">{h.title}</h3>
                <span className="text-[11px] text-slate-500 shrink-0">{compact(h.downloads)} downloads</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{h.description}</p>
              <a
                href={`https://modrinth.com/${h.project_type}/${h.slug}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200"
              >
                Open on Modrinth <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
