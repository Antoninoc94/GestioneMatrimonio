import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn } from 'lucide-react';

// Genera l'immagine ritagliata come Blob a partire dall'area scelta nel Cropper.
function getCroppedBlob(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropPixels.width;
      canvas.height = cropPixels.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, cropPixels.width, cropPixels.height
      );
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Ritaglio fallito')), 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// Modale di ritaglio stile Facebook: rettangolo con proporzioni fisse (16:9)
// trascinabile e uno slider di zoom. `imageSrc` può essere un blob: URL locale
// (foto appena scelta) oppure l'URL della foto originale già salvata sul server.
export default function PhotoCropper({ imageSrc, initialCrop, onCancel, onConfirm }) {
  const [crop, setCrop] = useState(initialCrop ? { x: initialCrop.x, y: initialCrop.y } : { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom || 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const confirm = async () => {
    if (!croppedAreaPixels) return;
    setWorking(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob, { x: crop.x, y: crop.y, zoom });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Scegli l'inquadratura</h3>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-gray-900" style={{ height: 320 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          <ZoomIn size={16} className="text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="px-4 pb-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            Annulla
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={working || !croppedAreaPixels}
            className="px-4 py-2 rounded-lg text-sm text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check size={16} /> {working ? 'Applico…' : 'Conferma ritaglio'}
          </button>
        </div>
      </div>
    </div>
  );
}
