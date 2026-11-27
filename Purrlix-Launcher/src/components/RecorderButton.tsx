import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, FolderOpen, Square } from 'lucide-react';

/** Screen recorder: click or press F9 to start/stop. Videos are saved to Videos/Purrlix Recordings. */
export function RecorderButton() {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!canRecord) return;
    try {
      let stream: MediaStream;
      if (desktop) {
        // Desktop app: capture the screen by id (works from the F9 hotkey while the game is in front, no click needed)
        const src = await desktop.recorderSource();
        if (!src.ok) throw new Error(src.error);
        const video = { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: src.id, maxFrameRate: 30 } };
        const audio = { mandatory: { chromeMediaSource: 'desktop' } };
        try {
          stream = await (navigator.mediaDevices as unknown as { getUserMedia: (c: unknown) => Promise<MediaStream> }).getUserMedia({ audio, video });
        } catch {
          stream = await (navigator.mediaDevices as unknown as { getUserMedia: (c: unknown) => Promise<MediaStream> }).getUserMedia({ audio: false, video });
        }
      } else {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        }
      }
      streamRef.current = stream;
      // H.264 can use the graphics chip, VP8 is far lighter on the CPU than VP9: both keep the game smoother while recording
      const mime = ['video/webm;codecs=h264', 'video/webm;codecs=vp8'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: 'video/webm' });
        if (desktop) {
          const res = await desktop.saveRecording(await blob.arrayBuffer());
          const msg = res.ok ? 'Recording saved to Videos/Purrlix Recordings' : `Save failed: ${res.error ?? 'unknown error'}`;
          setNote(msg);
          void desktop.recorderNote(msg);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Purrlix-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          setNote('Recording downloaded');
        }
        setTimeout(() => setNote(''), 5000);
      };
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stop());
      rec.start(1000);
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
      void desktop?.recorderNote('Recording started. Press F9 to stop.');
    } catch (err) {
      const why = err instanceof Error && err.message ? err.message : 'unknown error';
      void desktop?.recorderNote(`Could not start recording: ${why}`);
      setNote('Could not start recording');
      setTimeout(() => setNote(''), 4000);
    }
  }, [desktop, canRecord, stop]);

  const toggle = useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    if (desktop) return desktop.onRecorderToggle(toggle);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, toggle]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  if (!canRecord) return null;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        title="Record screen (F9)" aria-label="Record screen"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
          recording ? 'bg-red-500/15 border-red-500/40 text-red-200' : 'bg-[#1E1536] border-white/10 text-slate-200 hover:text-white'
        }`}
      >
        {recording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 text-red-400 fill-red-400" />}
        {recording ? `${mm}:${ss}` : 'Record'}
      </button>
      {desktop && <button
        type="button"
        onClick={() => desktop.openRecordings()}
        title="Open recordings folder"
        aria-label="Open recordings folder"
        className="rounded-lg bg-[#1E1536] border border-white/10 p-1.5 text-slate-300 hover:text-white"
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </button>}
      {note && <span className="text-[11px] text-slate-400">{note}</span>}
    </div>
  );
}
