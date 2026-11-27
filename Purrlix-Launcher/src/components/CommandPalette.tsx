import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CornerDownLeft, Play, Search } from 'lucide-react';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: 'Pages' | 'Profiles' | 'Actions';
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
}

/** Ctrl+K: type a few letters, press Enter. */
export function CommandPalette({ open, items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(shown[index]);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-[12vh]" onMouseDown={onClose} role="presentation">
      <div
        className="w-full max-w-lg rounded-xl bg-[#160F27] border border-white/15 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Go to a page, pick a profile or start the game..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-500"
          />
          <kbd className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">Nothing matches "{query}".</li>}
          {shown.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(item)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === index ? 'bg-orange-500/15 text-white' : 'text-slate-300'}`}
              >
                {item.group === 'Actions' ? <Play className="w-3.5 h-3.5 text-orange-400" /> : <Command className="w-3.5 h-3.5 text-slate-500" />}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-[11px] text-slate-500 shrink-0">{item.hint}</span>}
                <span className="text-[10px] text-slate-600 shrink-0">{item.group}</span>
                {i === index && <CornerDownLeft className="w-3 h-3 text-orange-300 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
