import { useEffect, useState } from 'react';
import axios from 'axios';
import { MapPin, Clock, Heart, ChevronRight } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

const toUtc = s => s && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;

const TEMI = {
  rose:    { primary: '#e11d48', light: '#fff1f2', border: '#fecdd3', text: '#9f1239', mid: '#fb7185' },
  lavanda: { primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', mid: '#a78bfa' },
  salvia:  { primary: '#059669', light: '#ecfdf5', border: '#a7f3d0', text: '#065f46', mid: '#34d399' },
  cielo:   { primary: '#0284c7', light: '#f0f9ff', border: '#bae6fd', text: '#075985', mid: '#38bdf8' },
  oro:     { primary: '#b45309', light: '#fffbeb', border: '#fde68a', text: '#92400e', mid: '#fbbf24' },
};

const TIPO_LABEL = {
  chiesa: 'Cerimonia', ricevimento: 'Ricevimento', altro: 'Location'
};

const TIPO_CRONOLOGIA = {
  cerimonia: '⛪', ricevimento: '🥂', aperitivo: '🍾', cena: '🍽️', ballo: '💃', altro: '✨'
};

export default function Landing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/landing/info')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff1f2' }}>
        <div style={{ color: '#e11d48', fontSize: '2rem' }}>💍</div>
      </div>
    );
  }

  const { config = {}, locations = [], cronologia = [] } = data || {};
  const tema = TEMI[config.landing_tema] || TEMI.rose;

  if (!config.landing_abilitata) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tema.light, flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem' }}>💍</div>
        <h1 style={{ color: tema.text, fontSize: '1.5rem', fontWeight: 700 }}>Pagina in arrivo</h1>
        <p style={{ color: '#6b7280' }}>La pagina del matrimonio sarà presto disponibile.</p>
      </div>
    );
  }

  const sposi = [config.nome_sposo1, config.nome_sposo2].filter(Boolean).join(' & ');
  const dataMatrimonio = config.data_matrimonio ? parseISO(toUtc(config.data_matrimonio + 'T00:00:00Z')) : null;
  const oggi = new Date();
  const giorniMancanti = dataMatrimonio ? differenceInDays(dataMatrimonio, oggi) : null;

  const chiesa = locations.find(l => l.tipo === 'chiesa');
  const ricevimento = locations.find(l => l.tipo === 'ricevimento');
  const altreLocation = locations.filter(l => l.tipo !== 'chiesa' && l.tipo !== 'ricevimento');

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', background: '#fafafa', minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{ position: 'relative', background: tema.primary, minHeight: config.landing_foto ? '70vh' : '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', overflow: 'hidden' }}>
        {config.landing_foto && (
          <img
            src={`/uploads/landing/${config.landing_foto}`}
            alt="Foto matrimonio"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: config.landing_foto ? 'rgba(0,0,0,0.45)' : `${tema.primary}cc` }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '3rem 1.5rem', maxWidth: '600px' }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '1rem', fontFamily: 'system-ui, sans-serif' }}>
            Vi invitiamo al nostro matrimonio
          </p>
          <h1 style={{ color: '#fff', fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 400, marginBottom: '1rem', lineHeight: 1.2 }}>
            {sposi || 'Il Nostro Matrimonio'}
          </h1>
          {dataMatrimonio && (
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', marginBottom: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
              {format(dataMatrimonio, "d MMMM yyyy", { locale: it })}
            </p>
          )}
          {giorniMancanti !== null && giorniMancanti > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', borderRadius: '2rem', padding: '0.5rem 1.25rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>
              <Heart size={14} fill="currentColor" />
              Mancano {giorniMancanti} giorni
            </div>
          )}
          {giorniMancanti === 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', borderRadius: '2rem', padding: '0.5rem 1.25rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>
              <Heart size={14} fill="currentColor" />
              È oggi! 🎉
            </div>
          )}
        </div>
      </div>

      {/* Messaggio benvenuto */}
      {config.landing_messaggio && (
        <div style={{ background: tema.light, borderTop: `3px solid ${tema.border}`, padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <p style={{ fontSize: '1.125rem', color: tema.text, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
              "{config.landing_messaggio}"
            </p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Location */}
        {(chiesa || ricevimento || altreLocation.length > 0) && (
          <Section title="Dove ci troviamo" tema={tema}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {[chiesa, ricevimento, ...altreLocation].filter(Boolean).map(loc => (
                <LocationCard key={loc.id} loc={loc} tema={tema} />
              ))}
            </div>
          </Section>
        )}

        {/* Cronologia */}
        {cronologia.length > 0 && (
          <Section title="Il programma del giorno" tema={tema}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1.25rem', top: 0, bottom: 0, width: '2px', background: tema.border }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {cronologia.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', gap: '1rem', paddingLeft: '0.25rem' }}>
                    <div style={{ flexShrink: 0, width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: tema.light, border: `2px solid ${tema.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', zIndex: 1 }}>
                      {TIPO_CRONOLOGIA[ev.tipo] || '✨'}
                    </div>
                    <div style={{ paddingTop: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: tema.text, fontSize: '0.875rem' }}>{ev.ora?.slice(0, 5)}</span>
                        <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '1rem' }}>{ev.titolo}</span>
                      </div>
                      {ev.luogo && (
                        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={12} /> {ev.luogo}
                        </p>
                      )}
                      {ev.descrizione && (
                        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.15rem' }}>{ev.descrizione}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Dress code */}
        {config.landing_dress_code && (
          <Section title="Dress Code" tema={tema}>
            <div style={{ background: tema.light, border: `1px solid ${tema.border}`, borderRadius: '0.75rem', padding: '1.25rem 1.5rem' }}>
              <p style={{ fontFamily: 'system-ui, sans-serif', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{config.landing_dress_code}</p>
            </div>
          </Section>
        )}

        {/* Info pratiche */}
        {config.landing_info_pratiche && (
          <Section title="Informazioni pratiche" tema={tema}>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem 1.5rem' }}>
              <p style={{ fontFamily: 'system-ui, sans-serif', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{config.landing_info_pratiche}</p>
            </div>
          </Section>
        )}

        {/* RSVP CTA */}
        {config.conferma_abilitata ? (
          <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6b7280', marginBottom: '1rem' }}>Ricordati di confermare la tua presenza!</p>
            <a
              href="/conferma"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: tema.primary, color: '#fff', padding: '0.75rem 2rem', borderRadius: '2rem', textDecoration: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: '1rem', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Conferma la presenza <ChevronRight size={18} />
            </a>
          </div>
        ) : null}

      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${tema.border}`, padding: '2rem', textAlign: 'center', background: tema.light }}>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: tema.mid, fontSize: '1.5rem' }}>💍</p>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: tema.text, fontWeight: 600, marginTop: '0.25rem' }}>{sposi}</p>
        {dataMatrimonio && (
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {format(dataMatrimonio, "d MMMM yyyy", { locale: it })}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, tema }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ height: '2px', width: '2rem', background: tema.primary, borderRadius: '1px' }} />
        <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: tema.text }}>
          {title}
        </h2>
        <div style={{ height: '2px', flex: 1, background: tema.border, borderRadius: '1px' }} />
      </div>
      {children}
    </section>
  );
}

function LocationCard({ loc, tema }) {
  const tipo = TIPO_LABEL[loc.tipo] || loc.tipo;
  return (
    <div style={{ background: '#fff', border: `1px solid ${tema.border}`, borderRadius: '0.875rem', padding: '1.25rem', borderTop: `3px solid ${tema.primary}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: tema.text, background: tema.light, border: `1px solid ${tema.border}`, padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>
          {tipo}
        </span>
      </div>
      <h3 style={{ fontWeight: 700, color: '#111827', fontSize: '1.125rem', marginBottom: '0.25rem' }}>{loc.nome}</h3>
      {loc.indirizzo && (
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.5rem' }}>
          <MapPin size={14} style={{ flexShrink: 0, marginTop: '0.15rem', color: tema.primary }} />
          {loc.indirizzo}
        </p>
      )}
      {(loc.contatto || loc.telefono) && (
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.4rem' }}>
          {loc.contatto}{loc.contatto && loc.telefono ? ' · ' : ''}{loc.telefono}
        </p>
      )}
      {loc.note && (
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem', fontStyle: 'italic' }}>{loc.note}</p>
      )}
    </div>
  );
}
