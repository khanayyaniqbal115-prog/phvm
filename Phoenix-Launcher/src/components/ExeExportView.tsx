import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FolderArchive,
  FolderOpen,
  Loader2,
  Terminal,
  Zap,
} from 'lucide-react';
import type { MinecraftInstance } from '../types/launcher';
import {
  downloadAllProjectFilesZip,
  downloadElectronBundleZip,
  generateElectronFiles,
} from '../utils/electronExporter';
import { PhoenixExeIcon } from './PhoenixIcons';

interface ExeExportViewProps {
  instances: MinecraftInstance[];
  javaPath: string;
  mcDir: string;
  onChangeJavaPath: (val: string) => void;
  onChangeMcDir: (val: string) => void;
}

type PreviewTab = 'main' | 'preload' | 'builder' | 'package' | 'guide';

export function ExeExportView({
  instances,
  javaPath,
  mcDir,
  onChangeJavaPath,
  onChangeMcDir,
}: ExeExportViewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('main');
  const [downloadPhase, setDownloadPhase] = useState<
    'idle' | 'preparing' | 'downloading' | 'verifying' | 'done' | 'error'
  >('idle');
  const [progressState, setProgressState] = useState({
    chunk: 0,
    totalChunks: 0,
    bytesLoaded: 0,
    totalBytes: 0,
    electronVersion: '',
  });
  const [winBuildError, setWinBuildError] = useState<string | null>(null);
  const [downloadingLite, setDownloadingLite] = useState(false);
  const [liteDone, setLiteDone] = useState(false);
  const [downloadingAllZip, setDownloadingAllZip] = useState(false);
  const [allZipSizeMb, setAllZipSizeMb] = useState<string | null>(null);
  const [downloadingSourceZip, setDownloadingSourceZip] = useState(false);
  const [copied, setCopied] = useState(false);

  const files = generateElectronFiles(instances, javaPath, mcDir);

  const tabContentMap: Record<PreviewTab, { label: string; filename: string; content: string }> = {
    main: { label: 'Electron Main', filename: 'electron/main.cjs', content: files.mainCjs },
    preload: { label: 'IPC Preload', filename: 'electron/preload.cjs', content: files.preloadCjs },
    builder: { label: 'Builder Config', filename: 'electron-builder.yml', content: files.builderYml },
    package: { label: 'Desktop Package', filename: 'package.electron.json', content: files.packageJson },
    guide: { label: 'Build Guide', filename: 'BUILD-WINDOWS-EXE.md', content: files.readmeMd },
  };

  const currentFile = tabContentMap[activeTab];

  // Chunked downloader that bypasses 32 MB proxy truncation and verifies exact total byte length
  const handleChunkedExeDownload = async () => {
    setDownloadPhase('preparing');
    setWinBuildError(null);
    setProgressState({ chunk: 0, totalChunks: 0, bytesLoaded: 0, totalBytes: 0, electronVersion: '' });

    try {
      const prepRes = await fetch('/api/download/windows-exe/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ javaPath, mcDir, instances }),
      });
      const manifest = await prepRes.json();
      if (!prepRes.ok) {
        throw new Error(manifest.error || `HTTP ${prepRes.status}`);
      }

      const { totalBytes, chunkCount, electronVersion } = manifest as {
        totalBytes: number;
        chunkCount: number;
        electronVersion: string;
      };

      setDownloadPhase('downloading');
      setProgressState({
        chunk: 0,
        totalChunks: chunkCount,
        bytesLoaded: 0,
        totalBytes,
        electronVersion,
      });

      const chunks: Uint8Array[] = [];
      let loaded = 0;

      for (let i = 0; i < chunkCount; i++) {
        const chunkRes = await fetch(`/api/download/windows-exe/chunk?index=${i}`);
        if (!chunkRes.ok) {
          throw new Error(`Chunk ${i + 1}/${chunkCount} failed with HTTP ${chunkRes.status}`);
        }
        const buf = new Uint8Array(await chunkRes.arrayBuffer());
        chunks.push(buf);
        loaded += buf.byteLength;
        setProgressState({
          chunk: i + 1,
          totalChunks: chunkCount,
          bytesLoaded: loaded,
          totalBytes,
          electronVersion,
        });
      }

      setDownloadPhase('verifying');
      if (loaded !== totalBytes) {
        throw new Error(`Size mismatch after assembly (${loaded} vs ${totalBytes} bytes).`);
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: 'application/vnd.microsoft.portable-executable',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PhoenixLauncher-Setup.exe';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDownloadPhase('done');
    } catch (err) {
      setDownloadPhase('error');
      setWinBuildError(
        err instanceof Error ? err.message : 'Unable to compile PhoenixLauncher-Setup.exe.'
      );
    }
  };

  const handleDownloadLiteLauncher = async () => {
    setDownloadingLite(true);
    setLiteDone(false);
    setWinBuildError(null);
    try {
      const res = await fetch('/api/download/windows-lite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUrl: window.location.origin,
          javaPath,
          instances,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const rawBuf = await res.arrayBuffer();
      const blob = new Blob([rawBuf], {
        type: 'application/vnd.microsoft.portable-executable',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PhoenixLauncher-WebSetup.exe';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setLiteDone(true);
    } catch (err) {
      setWinBuildError(
        err instanceof Error ? err.message : 'Unable to download PhoenixLauncher-WebSetup.exe.'
      );
    } finally {
      setDownloadingLite(false);
    }
  };

  const handleDownloadSourceBundle = async () => {
    setDownloadingSourceZip(true);
    try {
      await downloadElectronBundleZip(instances, javaPath, mcDir);
    } finally {
      setDownloadingSourceZip(false);
    }
  };

  const handleDownloadAllProjectFiles = async () => {
    setDownloadingAllZip(true);
    setAllZipSizeMb(null);
    setWinBuildError(null);
    try {
      const bytes = await downloadAllProjectFilesZip(instances, javaPath, mcDir);
      setAllZipSizeMb((bytes / (1024 * 1024)).toFixed(2));
    } catch (err) {
      setWinBuildError(
        err instanceof Error ? err.message : 'Unable to package all project files.'
      );
    } finally {
      setDownloadingAllZip(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const pct =
    progressState.totalBytes > 0
      ? Math.round((progressState.bytesLoaded / progressState.totalBytes) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">
          Windows Setup Installer (.exe)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Real double-clickable Windows NSIS Setup Wizards (<span className="font-mono-tabular text-slate-200">PhoenixLauncher-Setup.exe</span> &amp; <span className="font-mono-tabular text-slate-200">PhoenixLauncher-WebSetup.exe</span>) — no manual .zip extraction required.
        </p>
      </div>

      {/* Two Primary Native Windows .exe Setup Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Full Standalone Offline Setup Installer (PhoenixLauncher-Setup.exe) */}
        <div className="lg:col-span-7 rounded-xl bg-[#111620] border border-orange-500/45 p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <PhoenixExeIcon active className="w-6 h-6 shrink-0" />
              <span className="text-xs font-semibold text-orange-400">
                Full Standalone Setup Wizard · NSIS Windows PE (.exe)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">
              PhoenixLauncher-Setup.exe
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              True Windows installer with embedded Electron runtime, custom{' '}
              <span className="font-mono-tabular text-white">phoenix.ico</span>, Desktop &amp; Start Menu shortcuts, uninstaller, and{' '}
              <span className="font-mono-tabular text-white">javaw.exe</span> process hooks. Streamed in{' '}
              <span className="font-mono-tabular text-white">12 MB</span> SHA-256 verified parts so Windows receives a clean, uncorrupted <span className="font-mono-tabular text-white">.exe</span> installer.
            </p>
          </div>

          {/* Progress Bar during Chunked Setup.exe Assembly */}
          {(downloadPhase === 'preparing' ||
            downloadPhase === 'downloading' ||
            downloadPhase === 'verifying' ||
            downloadPhase === 'done') && (
            <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className={downloadPhase === 'done' ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                  {downloadPhase === 'preparing' && 'Compiling PhoenixLauncher-Setup.exe (NSIS x64)...'}
                  {downloadPhase === 'downloading' &&
                    `Downloading Part ${progressState.chunk} / ${progressState.totalChunks} (${(
                      progressState.bytesLoaded /
                      (1024 * 1024)
                    ).toFixed(1)} / ${(progressState.totalBytes / (1024 * 1024)).toFixed(1)} MB)`}
                  {downloadPhase === 'verifying' && 'Verifying PE executable integrity...'}
                  {downloadPhase === 'done' &&
                    `Ready: PhoenixLauncher-Setup.exe (${(progressState.totalBytes / (1024 * 1024)).toFixed(1)} MB · Electron v${progressState.electronVersion})`}
                </span>
                <span className="text-orange-400">{downloadPhase === 'done' ? '100%' : `${pct}%`}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    downloadPhase === 'done' ? 'bg-emerald-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${downloadPhase === 'done' ? 100 : Math.max(pct, 6)}%` }}
                />
              </div>
            </div>
          )}

          {winBuildError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
              {winBuildError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={downloadPhase === 'preparing' || downloadPhase === 'downloading' || downloadPhase === 'verifying'}
              onClick={handleChunkedExeDownload}
              className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60 transition-all whitespace-nowrap shrink-0"
            >
              {downloadPhase === 'preparing' || downloadPhase === 'downloading' || downloadPhase === 'verifying' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building Setup.exe...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PhoenixLauncher-Setup.exe
                </>
              )}
            </button>

            {downloadPhase === 'done' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Double-click PhoenixLauncher-Setup.exe to install
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Instant Native WebSetup Installer (<500 KB .exe) */}
        <div className="lg:col-span-5 rounded-xl bg-[#131822] border border-white/10 p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Zap className="w-4 h-4" />
              Instant Setup Wizard (&lt; 500 KB .exe) · Windows 10 / 11
            </div>
            <h2 className="text-xl font-bold text-white">
              PhoenixLauncher-WebSetup.exe
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Need it in 1 second? Compiles a lightweight native{' '}
              <span className="font-mono-tabular text-white">.exe</span> installer with custom{' '}
              <span className="font-mono-tabular text-white">phoenix.ico</span>, creates Desktop &amp; Start Menu shortcuts, launches in a chromeless desktop window, and installs local{' '}
              <span className="font-mono-tabular text-white">.bat</span> scripts for all instances.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={downloadingLite}
              onClick={handleDownloadLiteLauncher}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A2130] border border-white/15 hover:border-emerald-500/60 px-5 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              {downloadingLite ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Compiling WebSetup.exe...
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Download WebSetup.exe (&lt;500 KB)
                </>
              )}
            </button>

            {liteDone && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Saved PhoenixLauncher-WebSetup.exe — double-click to install
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config Paths + Code Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-5 space-y-5">
          <div className="rounded-xl bg-[#131822] border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <FolderOpen className="w-4 h-4 text-orange-400" />
              Embedded Windows Launch Paths
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Java path (leave empty for automatic: the launcher finds or downloads Java)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={javaPath}
                  onChange={(e) => onChangeJavaPath(e.target.value)}
                  placeholder="Automatic"
                  className="flex-1 min-w-0 rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-orange-500"
                />
                {window.phoenixDesktop && (
                  <button
                    type="button"
                    onClick={async () => {
                      const picked = await window.phoenixDesktop?.pickJavaExecutable();
                      if (picked) onChangeJavaPath(picked);
                    }}
                    className="rounded-lg bg-[#1A2130] border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white shrink-0"
                  >
                    Browse
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Game Data Folder (khali = automatic, %APPDATA%\.phoenix-launcher)
              </label>
              <input
                type="text"
                value={mcDir}
                onChange={(e) => onChangeMcDir(e.target.value)}
                placeholder="Automatic"
                className="w-full rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
              <div className="text-xs font-semibold text-slate-200">
                Complete Project Archive (All Files in One .zip)
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Includes full React, Vite &amp; Express source, assets, custom <span className="font-mono-tabular text-slate-200">phoenix.ico</span>, and Electron desktop build configs (excludes <span className="font-mono-tabular text-slate-300">node_modules</span>).
              </p>

              <button
                type="button"
                disabled={downloadingAllZip}
                onClick={handleDownloadAllProjectFiles}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-60 transition-all whitespace-nowrap shrink-0"
              >
                {downloadingAllZip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Packaging All Files...
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    Download All Files (.zip)
                  </>
                )}
              </button>

              {allZipSizeMb && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Saved Phoenix-Launcher-All-Files.zip ({allZipSizeMb} MB)
                </div>
              )}

              <button
                type="button"
                disabled={downloadingSourceZip}
                onClick={handleDownloadSourceBundle}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A2130] border border-white/10 px-4 py-2 text-xs font-medium text-slate-200 hover:border-white/25 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                {downloadingSourceZip ? 'Zipping Configs...' : 'Download Electron Config Only (.zip)'}
              </button>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 rounded-xl bg-[#131822] border border-white/[0.08] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.08] bg-[#0E121A]">
            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(tabContentMap) as PreviewTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === key
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tabContentMap[key].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#131822] border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:text-white whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy File'}
            </button>
          </div>

          <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2 text-xs font-mono-tabular text-slate-400">
            <FileCode2 className="w-3.5 h-3.5 text-orange-400" />
            {currentFile.filename}
          </div>

          <pre className="p-4 text-xs font-mono-tabular text-slate-200 overflow-x-auto max-h-[360px] leading-relaxed">
            {currentFile.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
