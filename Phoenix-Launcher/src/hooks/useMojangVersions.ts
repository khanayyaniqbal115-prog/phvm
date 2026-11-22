import { useEffect, useState } from 'react';
import type { MojangManifestResponse } from '../types/launcher';

const DEFAULT_FALLBACK_MANIFEST: MojangManifestResponse = {
  source: 'offline-curated',
  latestRelease: '1.21.4',
  latestSnapshot: '1.21.4',
  versions: [
    { id: '1.21.4', type: 'release', releaseTime: '2024-12-03T10:12:57+00:00' },
    { id: '1.21.1', type: 'release', releaseTime: '2024-08-08T12:24:45+00:00' },
    { id: '1.20.1', type: 'release', releaseTime: '2023-06-12T13:25:51+00:00' },
    { id: '1.19.2', type: 'release', releaseTime: '2022-08-05T11:57:05+00:00' },
    { id: '1.16.5', type: 'release', releaseTime: '2021-01-15T10:03:45+00:00' },
    { id: '1.12.2', type: 'release', releaseTime: '2017-09-18T08:39:46+00:00' },
    { id: '1.8.9', type: 'release', releaseTime: '2015-12-03T09:24:39+00:00' },
    { id: 'b1.7.3', type: 'old_beta', releaseTime: '2011-07-08T22:00:00+00:00' },
    { id: 'a1.2.6', type: 'old_alpha', releaseTime: '2010-12-03T22:00:00+00:00' },
  ],
};

let cachedManifest: MojangManifestResponse | null = null;
let inflightPromise: Promise<MojangManifestResponse> | null = null;

async function fetchMojangManifest(): Promise<MojangManifestResponse> {
  if (cachedManifest) return cachedManifest;
  if (!inflightPromise) {
    inflightPromise = fetch('/api/mojang/versions')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MojangManifestResponse;
        if (!Array.isArray(json.versions) || json.versions.length === 0) {
          return DEFAULT_FALLBACK_MANIFEST;
        }
        cachedManifest = json;
        return json;
      })
      .catch(() => DEFAULT_FALLBACK_MANIFEST)
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function useMojangVersions() {
  const [manifest, setManifest] = useState<MojangManifestResponse>(
    () => cachedManifest ?? DEFAULT_FALLBACK_MANIFEST
  );
  const [loading, setLoading] = useState<boolean>(() => !cachedManifest);

  useEffect(() => {
    let active = true;
    if (cachedManifest) {
      setManifest(cachedManifest);
      setLoading(false);
      return;
    }

    fetchMojangManifest().then((data) => {
      if (!active) return;
      setManifest(data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    cachedManifest = null;
    setLoading(true);
    const data = await fetchMojangManifest();
    setManifest(data);
    setLoading(false);
  };

  return { manifest, loading, refresh };
}
