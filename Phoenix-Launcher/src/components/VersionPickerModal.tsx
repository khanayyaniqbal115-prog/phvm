import { useMemo, useState } from 'react';
import { Check, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type { MojangManifestResponse, MojangVersionType } from '../types/launcher';

interface VersionPickerModalProps {
  open: boolean;
  selectedVersion: string;
  allowAllOption?: boolean;
  manifest: MojangManifestResponse;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (versionId: string) => void;
  onClose: () => void;
  title?: string;
}

type TypeFilter = 'all' | MojangVersionType;

function formatReleaseDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatTypeLabel(type: MojangVersionType): string {
  switch (type) {
    case 'release':
      return 'Release';
    case 'snapshot':
      return 'Snapshot';
    case 'old_beta':
      return 'Old Beta';
    case 'old_alpha':
      return 'Old Alpha';
  }
}

export function VersionPickerModal({
  open,
  selectedVersion,
  allowAllOption = false,
  manifest,
  loading,
  onRefresh,
  onSelect,
  onClose,
  title = 'Select Minecraft Version',
}: VersionPickerModalProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const counts = useMemo(() => {
    const c = { all: manifest.versions.length, release: 0, snapshot: 0, old_beta: 0, old_alpha: 0 };
    for (const v of manifest.versions) {
      if (v.type in c) {
        c[v.type]++;
      }
    }
    return c;
  }, [manifest.versions]);

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return manifest.versions
      .filter((v) => {
        if (typeFilter !== 'all' && v.type !== typeFilter) return false;
        if (q && !v.id.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, 180);
  }, [manifest.versions, search, typeFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111620] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-slate-400">
              {manifest.source === 'mojang-live'
                ? `Live Mojang Manifest · ${manifest.versions.length.toLocaleString()} builds available`
                : `Curated Offline Manifest · ${manifest.versions.length} builds`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh Mojang versions"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#090C12] border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:border-orange-500/40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
              Sync
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close version picker"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pinned Latest Release & Snapshot Quick Picks */}
        <div className="px-5 pt-4 pb-3 bg-[#0B0E14]/60 border-b border-white/[0.06] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onSelect(manifest.latestRelease);
                onClose();
              }}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                selectedVersion === manifest.latestRelease
                  ? 'bg-orange-500/15 border-orange-500/60 text-white'
                  : 'bg-[#131822] border-white/10 hover:border-orange-500/40 text-slate-200'
              }`}
            >
              <div>
                <div className="text-[11px] text-emerald-400 font-medium">Latest Release</div>
                <div className="text-sm font-bold font-mono-tabular text-white">
                  Minecraft {manifest.latestRelease}
                </div>
              </div>
              {selectedVersion === manifest.latestRelease && (
                <Check className="w-4 h-4 text-orange-400 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelect(manifest.latestSnapshot);
                onClose();
              }}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                selectedVersion === manifest.latestSnapshot
                  ? 'bg-orange-500/15 border-orange-500/60 text-white'
                  : 'bg-[#131822] border-white/10 hover:border-orange-500/40 text-slate-200'
              }`}
            >
              <div>
                <div className="text-[11px] text-amber-400 font-medium inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Latest Snapshot
                </div>
                <div className="text-sm font-bold font-mono-tabular text-white">
                  {manifest.latestSnapshot}
                </div>
              </div>
              {selectedVersion === manifest.latestSnapshot && (
                <Check className="w-4 h-4 text-orange-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Search + Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search any version (1.21.4, 26.4-snapshot, b1.7.3, a1.2.6)..."
                autoFocus
                className="w-full rounded-lg bg-[#090C12] border border-white/10 pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 font-mono-tabular focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#090C12] p-1 rounded-lg border border-white/[0.08] overflow-x-auto">
              {(
                [
                  { id: 'all', label: `All (${counts.all})` },
                  { id: 'release', label: `Releases (${counts.release})` },
                  { id: 'snapshot', label: `Snapshots (${counts.snapshot})` },
                  { id: 'old_beta', label: `Beta (${counts.old_beta})` },
                  { id: 'old_alpha', label: `Alpha (${counts.old_alpha})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    typeFilter === tab.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {allowAllOption && !search.trim() && typeFilter === 'all' && (
            <button
              type="button"
              onClick={() => {
                onSelect('all');
                onClose();
              }}
              className={`w-full flex items-center justify-between rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                selectedVersion === 'all'
                  ? 'bg-orange-500/15 border border-orange-500/50 text-white'
                  : 'hover:bg-white/[0.04] border border-transparent text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">All Minecraft Versions</span>
                <span className="text-xs text-slate-400">Show mods across every build</span>
              </div>
              {selectedVersion === 'all' && <Check className="w-4 h-4 text-orange-400" />}
            </button>
          )}

          {filteredVersions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No Minecraft builds matched "{search}".
            </div>
          ) : (
            filteredVersions.map((ver) => {
              const isSelected = selectedVersion === ver.id;
              return (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => {
                    onSelect(ver.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-3.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-orange-500/15 border border-orange-500/50 text-white'
                      : 'hover:bg-white/[0.04] border border-transparent text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono-tabular text-sm font-semibold text-white truncate">
                      {ver.id}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        ver.type === 'release'
                          ? 'text-emerald-400'
                          : ver.type === 'snapshot'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatTypeLabel(ver.type)}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:inline" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-slate-500 font-mono-tabular hidden sm:inline">
                      {formatReleaseDate(ver.releaseTime)}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
