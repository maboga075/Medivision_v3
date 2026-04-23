import React from 'react';
import { FileImage, UploadCloud, X } from 'lucide-react';
import { fileToBase64 } from '../../utils/clinicalData';
import type { ImageData } from '../../types/clinical';

interface ImageUploaderProps {
  images: ImageData[];
  onUpload: (img: ImageData) => void;
  onRemove: (index: number) => void;
}

export default function ImageUploader({ images, onUpload, onRemove }: ImageUploaderProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        onUpload(base64);
      }
    }
    // reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  return (
    <div className="mt-6 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl transition-all hover:bg-slate-100 hover:border-slate-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-extrabold text-slate-600 uppercase flex items-center gap-2">
          <FileImage className="w-5 h-5 text-indigo-500" /> Images
        </span>
        <label className="bg-white border-2 border-indigo-100 text-indigo-600 px-4 py-2 rounded-xl text-sm font-extrabold cursor-pointer hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm">
          <UploadCloud className="w-5 h-5" /> Ajouter
          <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-2xl border-2 border-slate-200 overflow-hidden group shadow-sm bg-white"
            >
              <img src={img.data} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-sm font-medium text-slate-400 py-6">
          Appuyez sur "Ajouter" pour joindre des clichés.
        </div>
      )}
    </div>
  );
}
