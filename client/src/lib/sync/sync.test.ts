/**
 * Sync has two pieces worth pinning: the OAuth config gate (which client ID applies where) and the
 * media diff (copy only what the other side lacks, and never twice). The path-traversal gate that
 * guards writing synced file names to disk is asserted here too — it's the security boundary for
 * this feature and it's a pure function, so it's cheap to hold onto.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeMediaName } from '../../../../server/src/lib/safeName';
import { driveClientId, driveOriginAllowed, BUILTIN_DRIVE_CLIENT_ID } from './syncProviders';
import { syncMediaWithProvider } from './syncManager';

// An in-memory provider standing in for Drive / a sync folder, injected in place of the registry.
const fake = vi.hoisted(() => {
  const store = new Map<string, string>();
  const provider = {
    id: 'fake',
    label: 'fake',
    supported: () => true,
    available: () => true as const,
    connect: async () => ({}),
    isConnected: async () => true,
    disconnect: async () => {},
    upload: async (_c: never, name: string, blob: Blob) => void store.set(name, await blob.text()),
    download: async (_c: never, name: string) => (store.has(name) ? new Blob([store.get(name)!]) : null),
    list: async () => [...store.keys()],
  };
  return { store, provider };
});

vi.mock('./syncProviders', async (orig) => {
  const actual = await orig<typeof import('./syncProviders')>();
  return { ...actual, getSyncProvider: (id: string) => (id === 'fake' ? fake.provider : actual.getSyncProvider(id)) };
});

function atOrigin(origin: string, hostname: string) {
  vi.stubGlobal('location', { origin, hostname });
}

describe('drive config gate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the built-in client id on localhost (any port) and the published origin', () => {
    for (const [origin, host] of [
      ['http://localhost:8787', 'localhost'],
      ['http://localhost:5188', 'localhost'],
      ['http://127.0.0.1:8787', '127.0.0.1'],
      ['https://adervec.github.io', 'adervec.github.io'],
    ] as const) {
      atOrigin(origin, host);
      expect(driveOriginAllowed(), origin).toBe(true);
      expect(driveClientId({ provider: 'googleDrive' })).toBe(BUILTIN_DRIVE_CLIENT_ID);
    }
  });

  it('refuses the built-in id on any other origin, so a fork must bring its own', () => {
    atOrigin('https://evil.example', 'evil.example');
    expect(driveOriginAllowed()).toBe(false);
    expect(driveClientId({ provider: 'googleDrive' })).toBe('');
    expect(driveClientId({ provider: 'googleDrive', driveClientId: 'mine.apps.googleusercontent.com' })).toBe(
      'mine.apps.googleusercontent.com'
    );
  });

  it('prefers a user-supplied id over the built-in one', () => {
    atOrigin('http://localhost:8787', 'localhost');
    expect(driveClientId({ provider: 'googleDrive', driveClientId: ' mine ' })).toBe('mine');
  });
});

describe('safeMediaName (path-traversal gate)', () => {
  it('accepts the uuid names the uploader generates', () => {
    expect(safeMediaName('13985898-2ed3-48c6-8557-684228573aca.jpg')).toBe('13985898-2ed3-48c6-8557-684228573aca.jpg');
    expect(safeMediaName('13985898-2ed3-48c6-8557-684228573aca.mp4')).toBeTruthy();
  });

  it('refuses anything that could escape the media directory', () => {
    const bad: unknown[] = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32\\config\\sam',
      '/etc/passwd',
      'C:\\Windows\\win.ini',
      '13985898-2ed3-48c6-8557-684228573aca.jpg/../../evil.sh',
      'sub/13985898-2ed3-48c6-8557-684228573aca.jpg',
      '13985898-2ed3-48c6-8557-684228573aca.jpg\u0000.png',
      'app.db',
      '',
      null,
      42,
    ];
    expect(bad.filter((n) => safeMediaName(n) !== null)).toEqual([]);
  });
});

describe('media sync', () => {
  const A = '13985898-2ed3-48c6-8557-684228573aca.jpg'; // on disk here, not in the cloud
  const B = '2ed39858-48c6-4855-9842-28573aca1398.jpg'; // in the cloud, missing here

  afterEach(() => {
    vi.unstubAllGlobals();
    fake.store.clear();
  });

  function stubFetch(manifest: { present: string[]; missing: string[] }, written: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { method?: string }) => {
        if (url === '/api/backup/media-manifest') return { ok: true, json: async () => manifest };
        if (url.startsWith('/media/')) return { ok: true, blob: async () => new Blob([`bytes-of-${url.slice(7)}`]) };
        if (url.startsWith('/api/backup/media-file/') && init?.method === 'PUT') {
          written.push(decodeURIComponent(url.split('/').pop()!));
          return { ok: true, json: async () => ({ ok: true }) };
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );
  }

  it('copies each side only what the other is missing', async () => {
    fake.store.set(B, `bytes-of-${B}`);
    const written: string[] = [];
    stubFetch({ present: [A], missing: [B] }, written);

    const r = await syncMediaWithProvider('fake', { provider: 'fake' });

    expect(r).toMatchObject({ uploaded: 1, downloaded: 1 });
    expect(fake.store.has(A)).toBe(true); // A pushed up
    expect(written).toEqual([B]); // B pulled down
  });

  it('is a no-op once both sides agree — nothing re-uploaded, nothing rewritten', async () => {
    fake.store.set(A, `bytes-of-${A}`);
    const written: string[] = [];
    stubFetch({ present: [A], missing: [] }, written);

    const r = await syncMediaWithProvider('fake', { provider: 'fake' });

    expect(r).toMatchObject({ uploaded: 0, downloaded: 0 });
    expect(written).toEqual([]);
    expect(fake.store.size).toBe(1);
  });
});
