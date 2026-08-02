import { useRef, useState, type ReactNode } from 'react';

const isMedia = (f: File) => /^(image|video)\//.test(f.type);

/**
 * Drop target for photos & video. Highlights while a file is over it and hands
 * back only media files — dragging a folder or a text selection does nothing.
 */
export function DropZone({
  onFiles,
  className = '',
  label = 'Drop photos or video here',
  children,
}: {
  onFiles: (files: File[]) => void;
  className?: string;
  label?: string;
  children?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  // dragenter/leave fire for every child element; count depth instead of guessing.
  const depth = useRef(0);

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${className}`}
      onDragEnter={(e) => {
        e.preventDefault();
        if (++depth.current === 1) setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        if (--depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files).filter(isMedia);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      <div className="dropzone-veil" aria-hidden={!over}>
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Wires an element outside React's tree (e.g. inside the guide iframe) to the same behaviour. */
export function attachDrop(el: HTMLElement, onFiles: (files: File[]) => void): () => void {
  const on = (e: DragEvent) => {
    e.preventDefault();
    el.classList.add('ls-drop-over');
  };
  const off = () => el.classList.remove('ls-drop-over');
  const drop = (e: DragEvent) => {
    e.preventDefault();
    off();
    const files = Array.from(e.dataTransfer?.files ?? []).filter(isMedia);
    if (files.length) onFiles(files);
  };
  el.addEventListener('dragover', on);
  el.addEventListener('dragleave', off);
  el.addEventListener('drop', drop);
  return () => {
    el.removeEventListener('dragover', on);
    el.removeEventListener('dragleave', off);
    el.removeEventListener('drop', drop);
  };
}
