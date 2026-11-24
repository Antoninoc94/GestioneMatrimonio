import { useState } from 'react';

// Al posto di `confirm()` quando servono più di due risposte: "OK / Annulla"
// non distingue "solo lui" da "lascia perdere". Si usa così:
//   const [dialogo, chiedi] = useScelta();
//   const v = await chiedi({ titolo, testo, azioni: [{ valore, label, primaria }] });
//   ...
//   return <>{dialogo} ...</>;
// `v` è il `valore` dell'azione scelta, oppure null se si annulla o si chiude.
export function useScelta() {
  const [stato, setStato] = useState(null);

  const chiedi = opzioni => new Promise(resolve => setStato({ ...opzioni, resolve }));
  const chiudi = valore => {
    stato.resolve(valore);
    setStato(null);
  };

  const dialogo = stato && (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && chiudi(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={stato.titolo}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{stato.titolo}</h2>
        {stato.testo && <p className="text-sm text-gray-600 mb-4 whitespace-pre-line">{stato.testo}</p>}
        <div className="flex flex-col gap-2">
          {stato.azioni.map(a => (
            <button key={String(a.valore)} className={`${a.primaria ? 'btn-primary' : 'btn-secondary'} justify-center py-3 sm:py-2`}
              onClick={() => chiudi(a.valore)}>
              {a.label}
            </button>
          ))}
          <button className="text-sm text-gray-500 hover:text-gray-800 py-2" onClick={() => chiudi(null)}>
            {stato.annulla || 'Annulla'}
          </button>
        </div>
      </div>
    </div>
  );

  return [dialogo, chiedi];
}
