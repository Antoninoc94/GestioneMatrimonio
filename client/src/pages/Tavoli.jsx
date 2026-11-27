import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Download, Tag, UtensilsCrossed, AlertTriangle, ChevronDown, Users, Map as MapIcon, Settings2, BookmarkCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api';
import AssegnaOspiti from './tavoli/AssegnaOspiti';
import PiantaSala from './tavoli/PiantaSala';
import GestioneTavoli from './tavoli/GestioneTavoli';
import Preset from './tavoli/Preset';
import { useScelta } from '../components/Scelta';
import { calcolaAvvisi, tipoTavolo, formaTavolo, ellePosti } from './tavoli/util';

const empty = { nome: '', descrizione: '', capienza: 8, note: '', forma: 'tondo', tipo: 'normale', elle_posti: 'entrambi' };

const VISTE = [
  { id: 'assegna', label: 'Assegna ospiti', corto: 'Assegna', icon: Users },
  { id: 'pianta', label: 'Pianta sala', corto: 'Pianta', icon: MapIcon },
  { id: 'gestisci', label: 'Gestisci tavoli', corto: 'Gestisci', icon: Settings2 },
];

export default function Tavoli() {
  const [dialogo, chiedi] = useScelta();
  const [tavoli, setTavoli] = useState([]);
  const [ospiti, setOspiti] = useState([]);
  const [modal, setModal] = useState(false);
  const [presetAperti, setPresetAperti] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  // Chiusi sul telefono: aperti occuperebbero mezzo schermo prima dei tavoli.
  const [avvisiAperti, setAvvisiAperti] = useState(() => {
    try { return window.matchMedia('(min-width: 640px)').matches; } catch { return true; }
  });
  // La scheda sta nell'URL: un ricaricamento o il tasto indietro non la perdono.
  const [params, setParams] = useSearchParams();
  const vista = VISTE.some(v => v.id === params.get('vista')) ? params.get('vista') : 'assegna';
  const setVista = id => setParams(p => { p.set('vista', id); return p; }, { replace: true });

  const load = () => {
    api.get('/tavoli').then(r => setTavoli(r.data));
    api.get('/ospiti').then(r => setOspiti(r.data));
  };
  useEffect(() => { load(); }, []);

  const errore = (err, msg) => alert(err.response?.data?.error || msg);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = t => {
    setForm({ nome: t.nome, descrizione: t.descrizione || '', capienza: t.capienza, note: t.note || '', forma: t.forma || 'tondo', tipo: t.tipo || 'normale', elle_posti: t.elle_posti || 'entrambi' });
    setEditId(t.id);
    setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/tavoli/${editId}`, form);
      else await api.post('/tavoli', form);
      setModal(false);
    } catch (err) {
      errore(err, 'Salvataggio del tavolo non riuscito');
    }
    load();
  };

  // Modifica parziale (solo i campi in `patch`), mostrata subito e poi salvata.
  const salvaTavolo = async (id, patch) => {
    setTavoli(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
    try {
      await api.put(`/tavoli/${id}`, patch);
    } catch (err) {
      errore(err, 'Salvataggio del tavolo non riuscito');
    }
    load();
  };

  const riordina = async ids => {
    setTavoli(ts => ids.map(id => ts.find(t => t.id === id)).filter(Boolean));
    try {
      await api.post('/tavoli/ordine', { ids });
    } catch (err) {
      errore(err, 'Riordino non riuscito');
      load();
    }
  };

  // Niente ricaricamento a buon fine: la pianta ha già la posizione giusta e
  // un refetch durante una serie di trascinamenti farebbe solo sfarfallare.
  const salvaPosizioni = async posizioni => {
    const byId = new Map(posizioni.map(p => [p.id, p]));
    setTavoli(ts => ts.map(t => (byId.has(t.id) ? { ...t, pos_x: byId.get(t.id).x, pos_y: byId.get(t.id).y } : t)));
    try {
      await api.post('/tavoli/posizioni', { posizioni });
    } catch (err) {
      errore(err, 'Posizione del tavolo non salvata');
      load();
    }
  };

  // Le sedie di un tavolo, tutte insieme (null = di nuovo automatiche).
  const salvaPosti = async (id, posti) => {
    if (posti) {
      const byId = new Map(posti.map(p => [p.id, p.posto]));
      setTavoli(ts => ts.map(t => (t.id === id
        ? { ...t, posti_scelti: true, ospiti: t.ospiti.map(o => ({ ...o, posto: byId.get(o.id) ?? null })) }
        : t)));
    }
    try {
      await api.post(`/tavoli/${id}/posti`, posti ? { posti } : { automatico: true });
    } catch (err) {
      errore(err, 'Posti non salvati');
    }
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo tavolo? Gli ospiti assegnati verranno scollegati.')) return;
    await api.delete(`/tavoli/${id}`);
    load();
  };

  // tavoloId null = toglie dal tavolo. Un errore qui va mostrato: senza alert
  // il click sembra semplicemente non fare nulla.
  const assignGuests = async (ids, tavoloId) => {
    try {
      // Una richiesta per tutto il gruppo, applicata in un'unica transazione.
      await api.post('/ospiti/bulk/aggiorna', { ids, tavolo_id: tavoloId });
    } catch (err) {
      alert(err.response?.data?.error || 'Errore durante l\'assegnazione del tavolo');
    }
    load();
  };
  // Familiari che oggi stanno dove sta lui: chi è già stato messo altrove di
  // proposito non va trascinato indietro.
  const insiemeA = o =>
    o.parent_id ? [] : ospiti.filter(f => f.parent_id === o.id && (f.tavolo_id || null) === (o.tavolo_id || null));

  // Unica strada per assegnare/spostare/togliere. Il partner segue l'invitato,
  // i bambini restano da sistemare a parte (tavolo dei bambini). Discrimina
  // `tipo`, cioè l'età: un figlio ormai adulto siede con i suoi come chiunque
  // altro, mentre `relazione` resterebbe 'figlio' per sempre.
  const assignWithFamily = async (o, tavoloId) => {
    const insieme = insiemeA(o);
    const seguono = insieme.filter(f => f.tipo !== 'bambino');
    const bambini = insieme.filter(f => f.tipo === 'bambino');
    const ids = [o.id];
    if (seguono.length) {
      const chi = seguono.length > 1 ? `i ${seguono.length} familiari`
        : seguono[0].relazione === 'partner' ? 'il partner' : 'il familiare';
      const azione = tavoloId === null ? 'Rimuovere dal tavolo'
        : o.tavolo_id ? 'Spostare' : 'Assegnare al tavolo';
      // Dirlo esplicitamente, altrimenti i bambini rimasti indietro sembrano un bug.
      const nota = bambini.length
        ? `\n${bambini.length === 1 ? 'Il bambino resta' : `I ${bambini.length} bambini restano`} dov'è.`
        : '';
      const scelta = await chiedi({
        titolo: `${azione} anche ${chi}?`,
        testo: `Con ${o.nome}: ${seguono.map(f => f.nome).join(', ')}.${nota}`,
        azioni: [
          { valore: 'tutti', label: `Sì, ${seguono.length > 1 ? 'tutti insieme' : 'insieme'}`, primaria: true },
          { valore: 'solo', label: `Solo ${o.nome}` },
        ],
      });
      if (scelta === null) return;
      if (scelta === 'tutti') ids.push(...seguono.map(f => f.id));
    }
    return assignGuests(ids, tavoloId);
  };

  const senzaTavolo = ospiti.filter(o => !o.tavolo_id);
  const totaleAssegnati = ospiti.filter(o => o.tavolo_id).length;
  const avvisi = calcolaAvvisi(tavoli, ospiti);

  const [exporting, setExporting] = useState(false);
  const [exportingCards, setExportingCards] = useState(false);
  const [exportingCatering, setExportingCatering] = useState(false);

  const exportSegnaposti = () => {
    // La sedia vera (scelta o automatica) arriva con i tavoli, non con la lista ospiti.
    const postoDi = new Map(tavoli.flatMap(t => t.ospiti.map(o => [o.id, o.posto])));
    const ordineTavolo = new Map(tavoli.map((t, i) => [t.id, i]));
    // Tutti i confermati con un tavolo, partner e figli compresi, in ordine di
    // tavolo e di sedia: chi li dispone in sala li trova già in fila.
    const tutti = ospiti.filter(o => o.tavolo_id && o.rsvp === 'confermato').sort((a, b) =>
      (ordineTavolo.get(a.tavolo_id) ?? 1e9) - (ordineTavolo.get(b.tavolo_id) ?? 1e9)
      || (postoDi.get(a.id) ?? 1e9) - (postoDi.get(b.id) ?? 1e9));
    if (tutti.length === 0) {
      const seduti = ospiti.filter(o => o.tavolo_id);
      if (seduti.length === 0) return alert('Nessun ospite ha ancora un tavolo.');
      const attesa = seduti.filter(o => o.rsvp === 'attesa').length;
      const declinati = seduti.filter(o => o.rsvp === 'declinato').length;
      const dettaglio = [attesa && `${attesa} in attesa`, declinati && `${declinati} declinat${declinati === 1 ? 'o' : 'i'}`].filter(Boolean).join(', ');
      return alert(`Hai ${seduti.length} ${seduti.length === 1 ? 'ospite' : 'ospiti'} a un tavolo, ma nessuno è confermato${dettaglio ? ` (${dettaglio})` : ''}.\n\nI segnaposto si stampano solo per i confermati.`);
    }
    setExportingCards(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];

      // 2 colonne × 4 righe = 8 card per pagina
      const COLS = 2, ROWS = 4;
      const MARGIN = 10;
      const PAGE_W = 210, PAGE_H = 297;
      const cardW = (PAGE_W - MARGIN * (COLS + 1)) / COLS;   // ~90mm
      const cardH = (PAGE_H - MARGIN * (ROWS + 1)) / ROWS;   // ~63mm

      const tavoloMap = {};
      tavoli.forEach(t => { tavoloMap[t.id] = t.nome; });

      tutti.forEach((o, idx) => {
        const pos  = idx % (COLS * ROWS);
        const col  = pos % COLS;
        const row  = Math.floor(pos / COLS);

        if (pos === 0 && idx > 0) doc.addPage();

        const cx = MARGIN + col * (cardW + MARGIN);
        const cy = MARGIN + row * (cardH + MARGIN);

        // Bordo card
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.4);
        doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'S');

        // Linea rose in alto
        doc.setFillColor(...rose);
        doc.roundedRect(cx, cy, cardW, 5, 3, 3, 'F');
        doc.setFillColor(...rose);
        doc.rect(cx, cy + 2, cardW, 3, 'F');

        // Nome ospite
        const nome = o.cognome ? `${o.nome} ${o.cognome}` : o.nome;
        doc.setFont('times', 'bold');
        doc.setFontSize(nome.length > 20 ? 14 : 17);
        doc.setTextColor(17, 24, 39);
        const nomeLines = doc.splitTextToSize(nome, cardW - 10);
        const nomeY = cy + cardH / 2 - (nomeLines.length - 1) * 4;
        doc.text(nomeLines, cx + cardW / 2, nomeY, { align: 'center', baseline: 'middle' });

        // Separatore
        doc.setDrawColor(...rose);
        doc.setLineWidth(0.3);
        doc.line(cx + 12, cy + cardH / 2 + 8, cx + cardW - 12, cy + cardH / 2 + 8);

        // Nome tavolo e numero della sedia, come sulla pianta e sulla pagina
        // "Trova il tuo tavolo" (si conta da 1)
        const sedia = postoDi.get(o.id);
        const tavolo = [tavoloMap[o.tavolo_id], sedia != null && `Posto ${sedia + 1}`].filter(Boolean).join('  ·  ');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(tavolo, cx + cardW / 2, cy + cardH / 2 + 15, { align: 'center' });

        // Piccolo cuore decorativo
        doc.setTextColor(...rose);
        doc.setFontSize(8);
        doc.text('*', cx + cardW / 2, cy + cardH - 6, { align: 'center' });
      });

      doc.save('segnaposti.pdf');
    } finally {
      setExportingCards(false);
    }
  };

  const exportSeatingPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];
      const COL_W = 85;
      const GAP = 12;
      const LEFT = 14;
      const PAGE_H = 297;
      const FOOTER_H = 15;
      const CARD_PAD = 4;
      const CARD_HEAD = 16; // name + bar + spacing
      const head = t => CARD_HEAD + (t.descrizione ? 4 : 0); // + riga di descrizione
      const GUEST_ROW = 5;
      const ROW_GAP = 4;

      // Build ordered guest lines per table (main guests + their children/partners indented)
      // tableOspiti = guests of this table; ospiti (closure) = all guests for parent lookup
      const buildGuestLines = tableOspiti => {
        const ospIds = new Set(tableOspiti.map(o => o.id));
        // Mains: no parent, OR parent is in another table (orphan)
        const mains = tableOspiti.filter(o => !o.parent_id || !ospIds.has(o.parent_id));
        const byParent = {};
        tableOspiti.filter(o => o.parent_id && ospIds.has(o.parent_id)).forEach(o => {
          (byParent[o.parent_id] = byParent[o.parent_id] || []).push(o);
        });
        const lines = [];
        for (const o of mains) {
          let parentNote = null;
          if (o.parent_id) {
            const p = ospiti.find(p => p.id === o.parent_id);
            if (p) parentNote = p.cognome ? `${p.cognome} ${p.nome}` : p.nome;
          }
          lines.push({ o, indent: false, parentNote });
          for (const c of byParent[o.id] || []) lines.push({ o: c, indent: true, parentNote: null });
        }
        return lines;
      };

      const cardHeight = t => {
        const lines = buildGuestLines(t.ospiti);
        const rows = Math.max(1, lines.length);
        return head(t) + rows * GUEST_ROW + CARD_PAD;
      };

      const drawCard = (t, cx, cy, height) => {
        const pieno = t.ospiti.length >= t.capienza;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...(pieno ? [253, 186, 116] : [229, 231, 235]));
        doc.setLineWidth(0.4);
        doc.roundedRect(cx, cy, COL_W, height, 3, 3, 'FD');

        // Name
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(t.nome, cx + CARD_PAD, cy + CARD_PAD + 4);

        // Capacity label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text(`${t.ospiti.length}/${t.capienza}`, cx + COL_W - CARD_PAD, cy + CARD_PAD + 4, { align: 'right' });

        // Capacity bar
        const barW = COL_W - 2 * CARD_PAD;
        const fillW = t.capienza > 0 ? Math.min((t.ospiti.length / t.capienza) * barW, barW) : 0;
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(cx + CARD_PAD, cy + CARD_PAD + 7, barW, 2, 1, 1, 'F');
        if (fillW > 0) {
          doc.setFillColor(...(pieno ? [249, 115, 22] : [52, 211, 153]));
          doc.roundedRect(cx + CARD_PAD, cy + CARD_PAD + 7, fillW, 2, 1, 1, 'F');
        }

        // Descrizione, sotto la barra
        if (t.descrizione) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...gray);
          doc.text(doc.splitTextToSize(t.descrizione, COL_W - 2 * CARD_PAD)[0], cx + CARD_PAD, cy + CARD_PAD + 13);
        }

        // Guests
        if (t.ospiti.length === 0) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(156, 163, 175);
          doc.text('Nessun ospite assegnato', cx + CARD_PAD, cy + head(t) + CARD_PAD);
        } else {
          const lines = buildGuestLines(t.ospiti);
          lines.forEach(({ o, indent, parentNote }, idx) => {
            const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;
            const prefix = indent ? '  > ' : '- ';
            const gy = cy + head(t) + idx * GUEST_ROW;
            if (indent) {
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(120, 130, 140);
            } else {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(55, 65, 81);
            }
            let label = `${prefix}${name}`;
            if (o.intolleranze) label += `  (${o.intolleranze})`;
            if (parentNote) label += `  [di ${parentNote}]`;
            doc.text(doc.splitTextToSize(label, COL_W - 2 * CARD_PAD)[0], cx + CARD_PAD, gy);
          });
        }
      };

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Disposizione Tavoli', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${tavoli.length} tavoli · ${totaleAssegnati}/${ospiti.length} ospiti · ${new Date().toLocaleDateString('it-IT')}`, 14, 20);

      // Cards — paired rows, 2 columns
      let y = 34;
      for (let i = 0; i < tavoli.length; i += 2) {
        const tL = tavoli[i];
        const tR = tavoli[i + 1];
        const rowH = Math.max(cardHeight(tL), tR ? cardHeight(tR) : 0);

        if (y + rowH > PAGE_H - FOOTER_H) {
          doc.addPage();
          y = 14;
        }

        drawCard(tL, LEFT, y, rowH);
        if (tR) drawCard(tR, LEFT + COL_W + GAP, y, rowH);

        y += rowH + ROW_GAP;
      }

      // Senza Tavolo — raggruppati per nucleo familiare, su più pagine se necessario
      if (senzaTavolo.length > 0) {
        const senzaLines = buildGuestLines(senzaTavolo);
        const LINE_H = 5.5;
        const COL2_X = LEFT + COL_W + GAP;  // 111
        const MAX_W = COL_W;

        let idx = 0;
        let continua = false;
        while (idx < senzaLines.length) {
          // Serve spazio almeno per il titolo + una riga, altrimenti pagina nuova
          if (y + 12 + LINE_H > PAGE_H - FOOTER_H) { doc.addPage(); y = 14; }

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...rose);
          doc.text(continua ? 'OSPITI SENZA TAVOLO (segue)' : `OSPITI SENZA TAVOLO (${senzaTavolo.length})`, LEFT, y + 6);
          y += 12;

          // Quante righe per colonna entrano nello spazio rimasto su questa pagina
          const maxRowsCol = Math.max(1, Math.floor((PAGE_H - FOOTER_H - y) / LINE_H));
          const remaining = senzaLines.length - idx;
          const half = Math.min(maxRowsCol, Math.ceil(remaining / 2));
          const chunk = senzaLines.slice(idx, idx + half * 2);

          chunk.forEach(({ o, indent, parentNote }, i) => {
            const isRight = i >= half;
            const row = isRight ? i - half : i;
            const cx = isRight ? COL2_X : LEFT;
            const cy = y + row * LINE_H;
            const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;

            if (indent) {
              const rel = o.relazione === 'figlio' ? 'figlio' : 'partner';
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(120, 130, 140);
              doc.text(doc.splitTextToSize(`  > ${name} [${rel}]`, MAX_W - 4)[0], cx + 4, cy);
            } else {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(55, 65, 81);
              let label = `- ${name}`;
              if (parentNote) label += ` [di ${parentNote}]`;
              doc.text(doc.splitTextToSize(label, MAX_W)[0], cx, cy);
            }
          });

          y += half * LINE_H;
          idx += chunk.length;
          continua = true;

          if (idx < senzaLines.length) { doc.addPage(); y = 14; }
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Seating Chart - ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('seating-chart.pdf');
    } finally {
      setExporting(false);
    }
  };

  // Riepilogo da dare a catering e location: coperti per tavolo (adulti e
  // bambini, per il menu) e l'elenco di intolleranze con chi e dove siede.
  // Contano i confermati; chi è ancora in attesa è a parte, perché il numero
  // finale può ancora cambiare. I declinati non compaiono.
  const exportCateringPDF = () => {
    setExportingCatering(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];
      const oggi = new Date().toLocaleDateString('it-IT');
      const nome = o => (o.cognome ? `${o.cognome} ${o.nome}` : o.nome);
      const attivi = ospiti.filter(o => o.rsvp !== 'declinato');
      const conf = attivi.filter(o => o.rsvp === 'confermato');
      const conta = lista => ({
        adulti: lista.filter(o => o.rsvp === 'confermato' && o.tipo !== 'bambino').length,
        bambini: lista.filter(o => o.rsvp === 'confermato' && o.tipo === 'bambino').length,
        attesa: lista.filter(o => o.rsvp === 'attesa').length,
      });
      const intolleranzeDi = lista => lista.filter(o => o.intolleranze?.trim())
        .map(o => `${nome(o)}: ${o.intolleranze.trim()}${o.rsvp === 'attesa' ? ' (in attesa)' : ''}`).join('\n');

      const gruppi = [
        ...tavoli.map(t => ({ nome: t.nome, lista: attivi.filter(o => o.tavolo_id === t.id) })),
        { nome: 'Senza tavolo', lista: attivi.filter(o => !o.tavolo_id) },
      ].filter(g => g.lista.length > 0);

      const tot = conta(attivi);

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Riepilogo Catering', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${conf.length} confermati (${tot.adulti} adulti, ${tot.bambini} bambini) · ${tot.attesa} in attesa · ${oggi}`, 14, 20);

      doc.setTextColor(...gray);
      doc.setFontSize(9);
      doc.text('Coperti confermati per tavolo. "In attesa" sono ospiti che non hanno ancora risposto.', 14, 36);

      autoTable(doc, {
        startY: 40,
        head: [['Tavolo', 'Adulti', 'Bambini', 'Totale', 'In attesa', 'Intolleranze / allergie']],
        body: gruppi.map(g => {
          const c = conta(g.lista);
          return [g.nome, c.adulti, c.bambini, c.adulti + c.bambini, c.attesa || '', intolleranzeDi(g.lista)];
        }),
        foot: [['Totale', tot.adulti, tot.bambini, tot.adulti + tot.bambini, tot.attesa || '', '']],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2, valign: 'top' },
        headStyles: { fillColor: rose, textColor: 255 },
        footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold' },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 17, halign: 'center' },
          3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 18, halign: 'center' },
        },
        margin: { left: 14, right: 14, bottom: 16 },
      });

      // Elenco intolleranze: una riga per persona, per chi prepara i piatti
      const conIntolleranze = attivi.filter(o => o.intolleranze?.trim())
        .map(o => ({ o, tavolo: tavoli.find(t => t.id === o.tavolo_id)?.nome || 'Senza tavolo' }))
        .sort((a, b) => a.tavolo.localeCompare(b.tavolo, 'it') || nome(a.o).localeCompare(nome(b.o), 'it'));

      if (conIntolleranze.length > 0) {
        let y = doc.lastAutoTable.finalY + 10;
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...rose);
        doc.text(`Intolleranze e allergie (${conIntolleranze.length})`, 14, y);
        autoTable(doc, {
          startY: y + 3,
          head: [['Ospite', 'Tavolo', 'Menu', 'Intolleranza / allergia', 'Stato']],
          body: conIntolleranze.map(({ o, tavolo }) => [
            nome(o), tavolo, o.tipo === 'bambino' ? 'Bambino' : 'Adulto', o.intolleranze.trim(),
            o.rsvp === 'confermato' ? 'Confermato' : 'In attesa',
          ]),
          theme: 'striped',
          styles: { fontSize: 8.5, cellPadding: 2 },
          headStyles: { fillColor: rose, textColor: 255 },
          columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 32 }, 2: { cellWidth: 20 }, 4: { cellWidth: 22 } },
          margin: { left: 14, right: 14, bottom: 16 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Riepilogo Catering - ${oggi}`, 14, 290);
      }

      doc.save('riepilogo-catering.pdf');
    } finally {
      setExportingCatering(false);
    }
  };

  return (
    <div>
      {dialogo}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Disposizione Tavoli</h1>
          <p className="page-subtitle">{tavoli.length} tavoli · {totaleAssegnati}/{ospiti.length} ospiti assegnati</p>
          <Link to="/landing#qr" className="text-xs text-rose-500 hover:text-rose-600 font-medium">QR "Trova il tuo tavolo" per gli invitati</Link>
        </div>
        {/* Sul telefono una riga sola, icona sopra al testo */}
        <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
          <button className="btn-secondary flex-col sm:flex-row justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 text-[11px] sm:text-sm" onClick={() => setPresetAperti(true)}>
            <BookmarkCheck size={15} /> Preset
          </button>
          <button className="btn-secondary flex-col sm:flex-row justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 text-[11px] sm:text-sm" onClick={exportSegnaposti} disabled={exportingCards}>
            <Tag size={15} /> {exportingCards ? 'Esporto…' : 'Segnaposti'}
          </button>
          <button className="btn-secondary flex-col sm:flex-row justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 text-[11px] sm:text-sm" onClick={exportCateringPDF} disabled={exportingCatering}>
            <UtensilsCrossed size={15} /> {exportingCatering ? 'Esporto…' : 'Catering'}
          </button>
          <button className="btn-secondary flex-col sm:flex-row justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 text-[11px] sm:text-sm" onClick={exportSeatingPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary flex-col sm:flex-row justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 text-[11px] sm:text-sm" onClick={openNew}>
            <Plus size={16} /> <span className="sm:hidden">Nuovo</span><span className="hidden sm:inline">Nuovo Tavolo</span>
          </button>
        </div>
      </div>

      {avvisi.length > 0 && (
        <div className="card mb-4 border-amber-200 bg-amber-50/50">
          <button className="w-full flex items-center gap-2 text-left" onClick={() => setAvvisiAperti(a => !a)}>
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800 flex-1">
              {avvisi.length === 1 ? '1 cosa da sistemare' : `${avvisi.length} cose da sistemare`}
            </span>
            <ChevronDown size={14} className={`text-amber-500 transition-transform ${avvisiAperti ? '' : '-rotate-90'}`} />
          </button>
          {avvisiAperti && (
            <ul className="mt-2 space-y-1.5">
              {avvisi.map(a => (
                <li key={a.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.livello === 'errore' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="flex-1 min-w-0 text-gray-700">{a.testo}</span>
                  {a.azione && (
                    <button className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-0.5 rounded border border-rose-200 bg-white hover:bg-rose-50"
                      onClick={() => assignGuests(a.azione.ids, a.azione.tavoloId)}>
                      {a.azione.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Sezioni tavoli" className="grid grid-cols-3 sm:flex gap-1 mb-4 border-b border-gray-200">
        {VISTE.map(({ id, label, corto, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={vista === id} aria-label={label} onClick={() => setVista(id)}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${vista === id ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon size={15} /> <span className="sm:hidden">{corto}</span><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {vista === 'assegna' && (
        <AssegnaOspiti tavoli={tavoli} ospiti={ospiti} assignWithFamily={assignWithFamily} assignGuests={assignGuests} openEdit={openEdit} del={del} />
      )}
      {vista === 'pianta' && (
        <PiantaSala tavoli={tavoli} salvaPosizioni={salvaPosizioni} salvaTavolo={salvaTavolo} salvaPosti={salvaPosti} />
      )}
      {vista === 'gestisci' && (
        <GestioneTavoli tavoli={tavoli} ospiti={ospiti} salvaTavolo={salvaTavolo} del={del} riordina={riordina} openNew={openNew} />
      )}

      {presetAperti && <Preset tavoli={tavoli} onClose={() => setPresetAperti(false)} onApplicato={load} />}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Tavolo' : 'Nuovo Tavolo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome tavolo *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Es. Tavolo degli Sposi" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Descrizione</label>
                  <input className="form-input" value={form.descrizione} maxLength={120} onChange={e => setForm({ ...form, descrizione: e.target.value })}
                    placeholder="Facoltativa, es. Amici dell'università" />
                </div>
                <div>
                  <label className="form-label">Capienza</label>
                  <div className="flex items-center gap-2">
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: Math.max(1, (form.capienza || 1) - 1) })}>−</button>
                    <input type="number" min={1} inputMode="numeric" className="form-input text-center font-bold text-lg" value={form.capienza}
                      onChange={e => setForm({ ...form, capienza: parseInt(e.target.value) || 1 })} />
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: (form.capienza || 1) + 1 })}>+</button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {Object.entries(tipoTavolo).map(([k, v]) => <option key={k} value={k}>{v.emoji ? `${v.emoji} ` : ''}{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Forma</label>
                  <select className="form-input" value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
                    {Object.entries(formaTavolo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {form.forma === 'elle' && form.tipo !== 'sposi' && (
                  <div>
                    <label className="form-label">Posti del tavolo a L</label>
                    <select className="form-input" value={form.elle_posti} onChange={e => setForm({ ...form, elle_posti: e.target.value })}>
                      {Object.entries(ellePosti).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Note</label>
                <input className="form-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
