import { useState } from "react";

interface Item {
  r2_key: string;
  url: string;
  description: string;
}

export default function ImageGallery({ images }: { images: Item[] }) {
  const [selected, setSelected] = useState<Item | null>(null);

  if (images.length === 0) {
    return <p className="text-[13px] text-[var(--ink-soft)]">No images linked.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {images.map((image) => (
          <button
            key={image.r2_key}
            className="overflow-hidden rounded-lg border border-[var(--line)]"
            onClick={() => setSelected(image)}
          >
            <img src={image.url} alt={image.description} className="h-28 w-full object-cover" />
          </button>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={() => setSelected(null)}>
          <div className="max-h-full w-full max-w-4xl overflow-auto rounded-lg bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <img src={selected.url} alt={selected.description} className="max-h-[70vh] w-auto" />
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{selected.description}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
