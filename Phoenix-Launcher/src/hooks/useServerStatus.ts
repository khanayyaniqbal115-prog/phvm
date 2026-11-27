import { useEffect, useState } from 'react';

export interface ServerStatus {
  online: boolean;
  players: number | null;
  max: number | null;
}

/** Live player counts for a list of server addresses (refreshed every minute). */
export function useServerStatus(hosts: string[]): { status: Record<string, ServerStatus>; loading: boolean } {
  const [status, setStatus] = useState<Record<string, ServerStatus>>({});
  const [loading, setLoading] = useState(true);
  const key = hosts.join(',');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/server-status?hosts=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Record<string, ServerStatus>;
        if (!cancelled) setStatus(data);
      } catch {
        /* keep the previous numbers */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key]);

  return { status, loading };
}
