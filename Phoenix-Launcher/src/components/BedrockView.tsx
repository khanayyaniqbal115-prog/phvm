import { useEffect, useState } from 'react';
import { ExternalLink, Gamepad2, Plus, Smartphone, Trash2, Users } from 'lucide-react';
import { useStored } from '../utils/prefs';

interface BedrockServer {
  name: string;
  host: string;
  port: number;
}

const FEATURED: BedrockServer[] = [
  { name: 'The Hive', host: 'geo.hivebedrock.network', port: 19132 },
  { name: 'CubeCraft', host: 'play.cubecraft.net', port: 19132 },
  { name: 'Lifeboat', host: 'mco.lbsg.net', port: 19132 },
  { name: 'Mineplex', host: 'mco.mineplex.com', port: 19132 },
];

interface Live {
  online: boolean;
  players?: number;
  max?: number;
}

/** Opens a minecraft: link. In the desktop app the main process does it; on phones and the web the browser does. */
async function openMinecraft(uri: string): Promise<string | null> {
  const api = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  if (api?.openMinecraft) {
    const res = await api.openMinecraft(uri);
    return res.ok ? null : res.error ?? 'Could not open Minecraft';
  }
  window.location.href = uri;
  return null;
}

export function BedrockView() {
  const [custom, setCustom] = useStored<BedrockServer[]>('phoenix-bedrock-servers', []);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('19132');
  const [message, setMessage] = useState<string | null>(null);
  const servers = [...FEATURED, ...custom];
  const key = servers.map((s) => `${s.host}:${s.port}`).join(',');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        servers.map(async (s) => {
          const id = `${s.host}:${s.port}`;
          try {
            const res = await fetch(`https://api.mcstatus.io/v2/status/bedrock/${encodeURIComponent(id)}`);
            const data = (await res.json()) as { online?: boolean; players?: { online?: number; max?: number } };
            return [id, { online: !!data.online, players: data.players?.online, max: data.players?.max }] as const;
          } catch {
            return [id, { online: false }] as const;
          }
        })
      );
      if (!cancelled) setLive(Object.fromEntries(entries));
    };
    void load();
    const t = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const run = async (uri: string) => {
    setMessage(null);
    const err = await openMinecraft(uri);
    if (err) setMessage(err);
  };

  const addServer = () => {
    const h = host.trim().toLowerCase();
    const p = parseInt(port, 10);
    if (!/^[a-z0-9.-]{3,100}$/.test(h) || !(p > 0 && p < 65536)) {
      setMessage('Enter a valid server address and port (default 19132).');
      return;
    }
    setCustom([...custom, { name: name.trim() || h, host: h, port: p }]);
    setName('');
    setHost('');
    setPort('19132');
  };

  const primary = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-[#1a0e05] text-xs font-bold hover:bg-orange-400';
  const secondary = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A2130] border border-white/10 text-slate-200 text-xs font-semibold hover:border-orange-500/40';
  const field = 'bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60';

  return (
    <div className="space-y-4 max-w-3xl">
      <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-orange-400" /> Bedrock and Pocket Edition</h2>
        <p className="text-xs text-slate-300">
          Bedrock (Windows 10/11, Android, iPhone, consoles) is a different game from Java Edition, so Phoenix cannot run it or load Java mods into it.
          What Phoenix can do is open the installed Bedrock app for you and send it straight to a server.
          Java Edition cannot run on phones at all.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => run('minecraft:')}><Gamepad2 className="w-3.5 h-3.5" /> Open Minecraft Bedrock</button>
          <a className={secondary} href="minecraft:"><Smartphone className="w-3.5 h-3.5" /> Open Pocket Edition (phone)</a>
        </div>
        {message && <p className="text-xs text-amber-300" role="alert">{message}</p>}
      </section>

      <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-orange-400" /> Servers</h2>
        <ul className="space-y-2">
          {servers.map((s) => {
            const id = `${s.host}:${s.port}`;
            const l = live[id];
            const isCustom = custom.some((c) => c.host === s.host && c.port === s.port);
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#0B0E14] border border-white/5 px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${l?.online ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden />
                <div className="flex-1 min-w-[160px]">
                  <div className="text-xs font-semibold text-white">{s.name}</div>
                  <div className="text-[11px] text-slate-400">{id}{l?.online && l.players != null ? ` - ${l.players}${l.max ? `/${l.max}` : ''} online` : l ? ' - offline or unreachable' : ''}</div>
                </div>
                <button type="button" className={primary} onClick={() => run(`minecraft://connect/?serverUrl=${s.host}&serverPort=${s.port}`)}>Join</button>
                <button type="button" className={secondary} onClick={() => run(`minecraft://?addExternalServer=${encodeURIComponent(s.name)}|${s.host}:${s.port}`)}><Plus className="w-3.5 h-3.5" /> Add to my list</button>
                {isCustom && (
                  <button type="button" className={secondary} aria-label={`Remove ${s.name}`} onClick={() => setCustom(custom.filter((c) => !(c.host === s.host && c.port === s.port)))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <input className={`${field} w-32`} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={`${field} flex-1 min-w-[160px]`} placeholder="Server address" value={host} onChange={(e) => setHost(e.target.value)} />
          <input className={`${field} w-20`} placeholder="19132" value={port} onChange={(e) => setPort(e.target.value)} />
          <button type="button" className={primary} onClick={addServer}><Plus className="w-3.5 h-3.5" /> Add server</button>
        </div>
        <p className="text-[11px] text-slate-500">Server addresses can change; if one is offline, add the current address yourself. Live counts come from mcstatus.io.</p>
        <a className="inline-flex items-center gap-1 text-[11px] text-orange-300 hover:underline" href="https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc" target="_blank" rel="noreferrer">
          <ExternalLink className="w-3 h-3" /> Get Minecraft (Java + Bedrock)
        </a>
      </section>
    </div>
  );
}
