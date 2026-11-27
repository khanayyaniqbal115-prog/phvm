import { useEffect, useState } from 'react';
import { Check, Loader2, Trash2, UserPlus, X } from 'lucide-react';
import type { PlayerProfile, SkinAsset } from '../types/launcher';
import { SkinHeadAvatar } from './SkinHeadAvatar';

interface AccountModalProps {
  profiles: PlayerProfile[];
  activeProfileId: string;
  skins: SkinAsset[];
  /** When true the window cannot be closed (first launch, no account yet). */
  required: boolean;
  onSelect: (id: string) => void;
  onAddLocal: (username: string) => void;
  onAddMicrosoft: (account: { uuid: string; username: string }) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function AccountModal({
  profiles,
  activeProfileId,
  skins,
  required,
  onSelect,
  onAddLocal,
  onAddMicrosoft,
  onRemove,
  onClose,
}: AccountModalProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [view, setView] = useState<'list' | 'add'>(profiles.length === 0 ? 'add' : 'list');
  const [tab, setTab] = useState<'local' | 'microsoft'>('local');
  const [name, setName] = useState('');
  const [msBusy, setMsBusy] = useState(false);
  const [msCode, setMsCode] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [msError, setMsError] = useState<string | null>(null);
  const [msConfigured, setMsConfigured] = useState(true);

  useEffect(() => {
    if (!desktop) return;
    desktop.getInfo().then((info) => setMsConfigured(info.microsoftConfigured)).catch(() => {});
    return desktop.onMicrosoftCode((code) => setMsCode(code));
  }, [desktop]);

  const nameValid = NAME_RE.test(name.trim());

  const submitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValid) return;
    onAddLocal(name.trim());
    setName('');
    setView('list');
  };

  const startMicrosoft = async () => {
    if (!desktop) return;
    setMsBusy(true);
    setMsError(null);
    setMsCode(null);
    const res = await desktop.microsoftLogin();
    setMsBusy(false);
    setMsCode(null);
    if (res.ok && res.uuid && res.username) {
      onAddMicrosoft({ uuid: res.uuid, username: res.username });
      setView('list');
    } else {
      setMsError(res.error || 'Sign-in failed.');
    }
  };

  const cancelMicrosoft = () => {
    desktop?.microsoftCancel();
    setMsBusy(false);
    setMsCode(null);
  };

  const skinFor = (p: PlayerProfile) => skins.find((s) => s.id === p.activeSkinId) ?? skins[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#160F27] border border-white/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-base font-bold text-white">
            {view === 'add' ? (required ? 'Welcome to Purrlix Launcher' : 'Add an account') : 'Accounts'}
          </h2>
          {!required && (
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {view === 'list' && (
          <div className="p-5 space-y-3">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {profiles.map((p) => {
                const skin = skinFor(p);
                const active = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      active ? 'border-orange-500/60 bg-orange-500/10' : 'border-white/10 bg-[#09060F]'
                    }`}
                  >
                    <button type="button" onClick={() => onSelect(p.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
                      {skin && <SkinHeadAvatar skinDataUrl={skin.dataUrl} alt={p.username} size={32} />}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{p.username}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.accountType === 'microsoft' ? 'Microsoft account' : 'Local account'}
                        </div>
                      </div>
                    </button>
                    {active && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => {
                        if (p.accountType === 'microsoft' && p.uuid) desktop?.microsoftRemove(p.uuid);
                        onRemove(p.id);
                      }}
                      aria-label={`Remove ${p.username}`}
                      className="p-1.5 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setView('add')}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1E1536] hover:border-orange-500/50 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <UserPlus className="w-4 h-4 text-orange-400" />
              Add account
            </button>
          </div>
        )}

        {view === 'add' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-400">
              {required ? 'Choose how you want to play.' : 'Pick the type of account to add.'}
            </p>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#09060F] border border-white/10 p-1">
              {(['local', 'microsoft'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    tab === t ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t === 'local' ? 'Local account' : 'Microsoft'}
                </button>
              ))}
            </div>

            {tab === 'local' && (
              <form onSubmit={submitLocal} className="space-y-3">
                <div>
                  <label htmlFor="acc-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Player name
                  </label>
                  <input
                    id="acc-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={16}
                    placeholder="Enter your name"
                    className="w-full rounded-lg bg-[#09060F] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                  <p className={`mt-1.5 text-[11px] ${name && !nameValid ? 'text-red-400' : 'text-slate-500'}`}>
                    3 to 16 characters: letters, numbers and underscore.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!nameValid}
                  className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500 px-4 py-2.5 text-sm font-bold text-white"
                >
                  Add local account
                </button>
                <p className="text-[11px] text-slate-500">
                  Local accounts play singleplayer, LAN and servers that allow offline players.
                </p>
              </form>
            )}

            {tab === 'microsoft' && (
              <div className="space-y-3">
                {!desktop && (
                  <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    Microsoft sign-in is available in the Windows app only.
                  </p>
                )}
                {desktop && !msConfigured && (
                  <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    Microsoft sign-in is not set up in this build yet. The developer needs to add a Microsoft client ID in
                    electron/config.cjs. You can use a local account for now.
                  </p>
                )}
                {msCode && (
                  <div className="rounded-xl bg-[#09060F] border border-orange-500/40 p-4 text-center space-y-1.5">
                    <div className="text-xs text-slate-400">Enter this code on {msCode.verificationUri.replace(/^https?:\/\//, '')}</div>
                    <div className="text-2xl font-mono-tabular font-bold tracking-widest text-orange-400">{msCode.userCode}</div>
                    <div className="text-[11px] text-slate-500">Your browser opened automatically.</div>
                  </div>
                )}
                {msError && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{msError}</p>}
                {msBusy ? (
                  <button
                    type="button"
                    onClick={cancelMicrosoft}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1E1536] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for sign-in. Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startMicrosoft}
                    disabled={!desktop || !msConfigured}
                    className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Sign in with Microsoft
                  </button>
                )}
              </div>
            )}

            {!required && profiles.length > 0 && (
              <button type="button" onClick={() => setView('list')} className="text-xs font-medium text-slate-400 hover:text-white">
                Back to accounts
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
