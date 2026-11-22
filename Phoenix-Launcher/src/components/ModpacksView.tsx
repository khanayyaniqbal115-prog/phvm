import { useEffect, useState } from 'react';
import { Check, ChevronDown, Download, RefreshCw, Search } from 'lucide-react';
import { useMojangVersions } from '../hooks/useMojangVersions';
import type { InstalledMod, MinecraftInstance, ModLoader, ModrinthHit } from '../types/launcher';
import { ModBadgeIcon } from './PhoenixIcons';
import { VersionPickerModal } from './VersionPickerModal';

interface ModpacksViewProps {
  instances: MinecraftInstance[];
  activeInstanceId: string;
  onInstallToInstance: (instanceId: string, mod: InstalledMod) => void;
  onCreateInstanceFromModpack: (hit: ModrinthHit, versionLabel: string, pickedMc?: string) => void;
}

function formatCompactDownloads(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

export function ModpacksView({
  instances,
  activeInstanceId,
  onInstallToInstance,
  onCreateInstanceFromModpack,
}: ModpacksViewProps) {
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'all' | 'modpack' | 'mod' | 'shader'>('all');
  const [mcVersion, setMcVersion] = useState<string>('all');
  const [loader, setLoader] = useState<string>('all');
  const [category, setCategory] = useState<string>('optimization');
  const [sortBy, setSortBy] = useState<'downloads' | 'relevance' | 'updated'>('downloads');

  const [targetInstanceId, setTargetInstanceId] = useState(activeInstanceId);
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [sourceLabel, setSourceLabel] = useState<'modrinth-live' | 'offline-curated'>('modrinth-live');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  const { manifest, loading: versionsLoading, refresh: refreshVersions } = useMojangVersions();

  useEffect(() => {
    setTargetInstanceId(activeInstanceId);
  }, [activeInstanceId]);

  const fetchCatalog = async (signal?: AbortSignal) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        query,
        projectType,
        version: mcVersion,
        loader,
        category,
        index: sortBy,
        limit: '18',
      });
      const res = await fetch(`/api/modrinth/search?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHits(data.hits ?? []);
      setSourceLabel(data.source ?? 'modrinth-live');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Modrinth catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchCatalog(controller.signal);
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, projectType, mcVersion, loader, category, sortBy]);

  const targetInstance = instances.find((i) => i.id === targetInstanceId) ?? instances[0];

  const handleInstall = async (hit: ModrinthHit, intoExisting = false) => {
    setInstallingId(hit.project_id);
    try {
      // For a modpack the version the person picked in the filter wins; for a mod it is the instance's version.
      const wantedMc =
        hit.project_type === 'modpack' && mcVersion !== 'all' ? mcVersion : targetInstance?.mcVersion ?? '1.20.1';
      const res = await fetch(
        `/api/modrinth/project/${encodeURIComponent(hit.project_id)}/versions?loader=${encodeURIComponent(
          hit.project_type === 'modpack' ? loader || 'fabric' : targetInstance?.loader ?? 'fabric'
        )}&version=${encodeURIComponent(wantedMc)}`
      );
      const data = await res.json();
      const firstVer = Array.isArray(data.versions) && data.versions[0];
      const versionNumber = firstVer?.version_number || hit.latest_version || 'latest';

      if (hit.project_type === 'modpack' && intoExisting) {
        // Add the pack to the selected profile instead of creating a new one; the launcher installs it on the next launch.
        if (targetInstance) {
          onInstallToInstance(targetInstance.id, {
            id: hit.project_id,
            slug: hit.slug,
            title: hit.title,
            version: versionNumber,
            category: 'Modpack',
            enabled: true,
            source: 'modrinth',
            downloads: hit.downloads,
            projectType: 'modpack',
          });
        }
      } else if (hit.project_type === 'modpack') {
        onCreateInstanceFromModpack(hit, versionNumber, mcVersion !== 'all' ? mcVersion : undefined);
      } else if (targetInstance) {
        onInstallToInstance(targetInstance.id, {
          id: hit.project_id,
          slug: hit.slug,
          title: hit.title,
          version: versionNumber,
          category: hit.categories[0] || 'Mod',
          enabled: true,
          source: 'modrinth',
          downloads: hit.downloads,
          projectType: hit.project_type,
        });
      }
    } finally {
      setInstallingId(null);
    }
  };

  const isInstalledInTarget = (projectId: string) =>
    Boolean(targetInstance?.mods.some((m) => m.id === projectId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            Modpacks &amp; Performance Mods
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse live Modrinth projects, filter by Minecraft version or loader, and install into any instance.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Target Instance:</span>
          <select
            value={targetInstanceId}
            onChange={(e) => setTargetInstanceId(e.target.value)}
            className="rounded-lg bg-[#131822] border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 focus:outline-none focus:border-orange-500"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.mcVersion})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-[#131822] border border-white/[0.08] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Sodium, Fabulously Optimized, Create, Lithium..."
              className="w-full rounded-lg bg-[#0B0E14] border border-white/10 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-white/[0.06]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'modpack', label: 'Modpacks' },
                { id: 'mod', label: 'Mods' },
                { id: 'shader', label: 'Shaders' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setProjectType(tab.id);
                  if (tab.id === 'shader') {
                    setCategory('all');
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  projectType === tab.id
                    ? 'bg-orange-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowVersionPicker(true)}
            aria-label="Minecraft version filter"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B0E14] border border-white/10 hover:border-orange-500/50 px-3 py-2 text-xs font-mono-tabular text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{mcVersion === 'all' ? 'All Versions' : `MC ${mcVersion}`}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <select
            value={loader}
            onChange={(e) => setLoader(e.target.value as ModLoader | 'all')}
            aria-label="Modloader filter"
            className="rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Loaders</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
            <option value="quilt">Quilt</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'optimization', label: 'FPS & Optimization' },
                { id: 'high', label: 'High-End Shaders' },
                { id: 'all', label: 'Any Category' },
                { id: 'adventure', label: 'Adventure' },
                { id: 'magic', label: 'Magic' },
                { id: 'technology', label: 'Tech' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id);
                  if (cat.id === 'high') {
                    setProjectType('shader');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  category === cat.id
                    ? 'bg-[#1A2130] text-orange-300 border border-orange-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{sourceLabel === 'modrinth-live' ? 'Live Modrinth API' : 'Offline Curated Catalog'}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'downloads' | 'relevance' | 'updated')}
              aria-label="Sort results"
              className="rounded bg-[#0B0E14] border border-white/10 px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-orange-500"
            >
              <option value="downloads">Most Downloaded</option>
              <option value="relevance">Relevance</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-xl bg-[#131822] border border-red-500/30 p-8 text-center">
          <p className="text-sm font-medium text-red-300">{errorMsg}</p>
          <button
            type="button"
            onClick={() => fetchCatalog()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1A2130] border border-white/10 px-4 py-2 text-xs font-medium text-white hover:border-orange-500/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Search
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-xl bg-[#131822] border border-white/[0.06] animate-pulse p-4"
            />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-xl bg-[#131822] border border-white/[0.08] p-10 text-center">
          <p className="text-sm font-medium text-slate-200">
            No modpacks or mods matched your active filters.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Try switching Category to Any Category or clearing the version filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('all');
              setMcVersion('all');
              setLoader('all');
            }}
            className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {hits.map((hit) => {
            const installed = isInstalledInTarget(hit.project_id);
            const isBusy = installingId === hit.project_id;
            const showCustomIcon = !hit.icon_url || brokenImages[hit.project_id];

            return (
              <div
                key={hit.project_id}
                className="flex flex-col justify-between rounded-xl bg-[#131822] border border-white/[0.08] p-4 hover:border-white/20 transition-colors"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#0B0E14] border border-white/[0.08] flex items-center justify-center">
                      {showCustomIcon ? (
                        <ModBadgeIcon
                          slug={hit.slug}
                          category={hit.categories[0]}
                          projectType={hit.project_type}
                          className="w-7 h-7"
                        />
                      ) : (
                        <img
                          src={hit.icon_url}
                          alt={hit.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [hit.project_id]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base text-slate-100 truncate">
                        {hit.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400 font-mono-tabular truncate">
                        {hit.project_type === 'modpack'
                          ? 'Modpack'
                          : hit.project_type === 'shader'
                          ? 'Shader Pack'
                          : 'Mod'}{' '}
                        · by {hit.author} · {formatCompactDownloads(hit.downloads)} downloads
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-300 line-clamp-2">
                    {hit.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ModBadgeIcon
                      slug={hit.slug}
                      category={hit.categories[0]}
                      projectType={hit.project_type}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="text-[11px] font-mono-tabular text-slate-400 truncate">
                      {hit.categories.slice(0, 3).join(' · ')}
                    </span>
                  </div>

                  {hit.project_type === 'modpack' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy || !targetInstance}
                        onClick={() => handleInstall(hit, true)}
                        title={targetInstance ? `Add this pack to "${targetInstance.name}" (its Minecraft version and loader follow the pack)` : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-orange-500/60 hover:text-white disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        {isBusy ? 'Adding...' : 'Add to target'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleInstall(hit)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isBusy ? 'Creating...' : 'New Instance'}
                      </button>
                    </div>
                  ) : installed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      Installed
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleInstall(hit)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-orange-500/60 hover:text-white disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-orange-400" />
                      {isBusy ? 'Adding...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VersionPickerModal
        open={showVersionPicker}
        selectedVersion={mcVersion}
        allowAllOption
        manifest={manifest}
        loading={versionsLoading}
        onRefresh={refreshVersions}
        onSelect={(verId) => setMcVersion(verId)}
        onClose={() => setShowVersionPicker(false)}
        title="Filter Modrinth by Minecraft Version"
      />
    </div>
  );
}
