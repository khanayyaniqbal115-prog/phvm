import { Flame, X } from 'lucide-react';
import { CHANGELOG, CHANGELOG_VERSION } from '../utils/changelog';

/** Shown once after the launcher was updated. */
export function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-label="What's new">
      <div className="w-full max-w-md rounded-xl bg-[#131822] border border-orange-500/30 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-base font-bold text-white">What's new in {CHANGELOG_VERSION}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {CHANGELOG.map((c) => (
            <li key={c.title}>
              <div className="text-sm font-semibold text-white">{c.title}</div>
              <p className="text-xs text-slate-400">{c.text}</p>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-orange-500 hover:bg-orange-400 py-2.5 text-sm font-semibold text-slate-950">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
