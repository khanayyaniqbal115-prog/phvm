import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'phoenix-web-banner-dismissed';

/** Shown only in the web version: install it as an app, or get the desktop launcher for real play. */
export function WebBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden) return null;

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/25 px-4 py-2 text-xs text-orange-100 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex-1 min-w-[220px]">
        You are using the web version: skins, servers and mod browsing work here. To play Java Edition, install mods and manage worlds, use the Windows app.
      </span>
      {prompt && (
        <button
          type="button"
          onClick={() => void prompt.prompt().then(() => setPrompt(null))}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1A2130] border border-white/10 px-2.5 py-1 font-semibold text-white"
        >
          <Smartphone className="w-3.5 h-3.5" /> Install as an app
        </button>
      )}
      <a
        href="https://github.com/khanayyaniqbal115-prog/phvm/releases/latest"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-2.5 py-1 font-semibold text-slate-950 hover:bg-orange-400"
      >
        <Download className="w-3.5 h-3.5" /> Get the Windows app
      </a>
      <button type="button" onClick={close} aria-label="Hide this message" className="p-1 text-orange-200/70 hover:text-white">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
