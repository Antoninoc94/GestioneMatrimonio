import { useEffect, useState } from 'react';
import axios from 'axios';
import { MapPin, Heart } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

const toUtc = s => s && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;

const TEMI = {
  rose:    { primary: '#be185d', light: '#fdf2f8', border: '#f9a8d4', text: '#9d174d', mid: '#ec4899', dark: '#831843' },
  lavanda: { primary: '#6d28d9', light: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6', mid: '#8b5cf6', dark: '#4c1d95' },
  salvia:  { primary: '#047857', light: '#ecfdf5', border: '#6ee7b7', text: '#065f46', mid: '#10b981', dark: '#064e3b' },
  cielo:   { primary: '#0369a1', light: '#f0f9ff', border: '#7dd3fc', text: '#075985', mid: '#0ea5e9', dark: '#0c4a6e' },
  oro:     { primary: '#b45309', light: '#fffbeb', border: '#fcd34d', text: '#92400e', mid: '#f59e0b', dark: '#78350f' },
};

const TIPO_LABEL = { chiesa: 'Cerimonia', ricevimento: 'Ricevimento', altro: 'Location' };
const TIPO_EMOJI = { cerimonia: '⛪', ricevimento: '🥂', aperitivo: '🍾', cena: '🍽️', ballo: '💃', altro: '✨' };

// SVG ornamento botanico per divisori
function BotanicalDivider({ color, small = false }) {
  const size = small ? 80 : 140;
  return (
    <svg width={size} height={24} viewBox="0 0 140 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto' }}>
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round">
        <path d="M0 12 C18 12 22 4 30 9 M8 12 C12 7 17 5 22 8 M22 9 C25 4 28 3 32 6"/>
        <line x1="40" y1="12" x2="56" y2="12"/>
        <path d="M140 12 C122 12 118 4 110 9 M132 12 C128 7 123 5 118 8 M118 9 C115 4 112 3 108 6"/>
        <line x1="100" y1="12" x2="84" y2="12"/>
      </g>
      <path d="M70 5 L74 12 L70 19 L66 12 Z" fill={color} opacity="0.7"/>
    </svg>
  );
}

// SVG onda per transizione hero → contenuto
function HeroWave({ bg }) {
  return (
    <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '70px', marginTop: '-1px' }}>
      <path d="M0,35 C240,70 480,0 720,35 C960,70 1200,0 1440,35 L1440,70 L0,70 Z" fill={bg} />
    </svg>
  );
}

export default function Landing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inietta Google Fonts solo su questa pagina
    if (!document.getElementById('wedding-fonts')) {
      const link = document.createElement('link');
      link.id = 'wedding-fonts';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Great+Vibes&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    axios.get('/api/landing/info').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const bg = '#faf7f4';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ color: '#be185d', fontSize: '2.5rem', animation: 'pulse 1.5s infinite' }}>💍</div>
      </div>
    );
  }

  const { config = {}, locations = [], cronologia = [] } = data || {};
  const tema = TEMI[config.landing_tema] || TEMI.rose;

  if (!config.landing_abilitata) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tema.light, flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '4rem' }}>💍</div>
        <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', color: tema.text, fontSize: '2rem', fontWeight: 400 }}>Pagina in arrivo</h1>
        <p style={{ color: '#9ca3af', fontFamily: 'system-ui, sans-serif' }}>La pagina del matrimonio sarà presto disponibile.</p>
      </div>
    );
  }

  const nome1 = config.nome_sposo1 || '';
  const nome2 = config.nome_sposo2 || '';
  const sposi = [nome1, nome2].filter(Boolean).join(' & ');
  const dataMatrimonio = config.data_matrimonio ? parseISO(toUtc(config.data_matrimonio + 'T00:00:00Z')) : null;
  const giorniMancanti = dataMatrimonio ? differenceInDays(dataMatrimonio, new Date()) : null;

  const chiesa = locations.find(l => l.tipo === 'chiesa');
  const ricevimento = locations.find(l => l.tipo === 'ricevimento');
  const altreLocation = locations.filter(l => l.tipo !== 'chiesa' && l.tipo !== 'ricevimento');
  const hasLocation = chiesa || ricevimento || altreLocation.length > 0;

  const hasDressCode = !!config.landing_dress_code;
  const hasInfo = !!config.landing_info_pratiche;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: bg, minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────── */}
      <div style={{ position: 'relative', height: config.landing_foto ? '52vh' : '38vh', minHeight: '300px', maxHeight: '560px', overflow: 'hidden' }}>
        {config.landing_foto ? (
          <>
            <img
              src={`/uploads/landing/${config.landing_foto}`}
              alt="Foto matrimonio"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: config.landing_foto_posizione || 'center top' }}
            />
            {/* vignette top */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55) 100%)' }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${tema.dark} 0%, ${tema.primary} 60%, ${tema.mid} 100%)` }}>
            {/* Pattern decorativo */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="2" fill="white"/>
                  <circle cx="0" cy="0" r="1" fill="white"/>
                  <circle cx="40" cy="0" r="1" fill="white"/>
                  <circle cx="0" cy="40" r="1" fill="white"/>
                  <circle cx="40" cy="40" r="1" fill="white"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)"/>
            </svg>
          </div>
        )}

      </div>

      {/* Onda di transizione */}
      <HeroWave bg={bg} />

      {/* ── NAME CARD (sovrapposta all'hero) ─────── */}
      <div style={{ maxWidth: '560px', margin: '-6rem auto 0', position: 'relative', zIndex: 10, padding: '0 1.5rem' }}>
        <div style={{
          background: '#fff',
          borderRadius: '1.25rem',
          padding: '2.25rem 2.5rem',
          textAlign: 'center',
          boxShadow: '0 25px 60px -10px rgba(0,0,0,0.18), 0 8px 20px -5px rgba(0,0,0,0.08)',
          border: `1px solid ${tema.border}`,
        }}>
          {/* Intestazione */}
          <p style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.7rem', fontWeight: 600,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: tema.mid, marginBottom: '0.75rem',
          }}>
            ✦ vi invitiamo al nostro matrimonio ✦
          </p>

          {/* Ornamento */}
          <div style={{ marginBottom: '0.75rem' }}>
            <BotanicalDivider color={tema.mid} />
          </div>

          {/* Nomi con script font */}
          <h1 style={{
            fontFamily: '"Great Vibes", cursive',
            fontSize: 'clamp(2.5rem, 8vw, 3.75rem)',
            fontWeight: 400,
            color: tema.dark,
            lineHeight: 1.1,
            margin: '0.25rem 0',
          }}>
            {sposi || 'Il Nostro Matrimonio'}
          </h1>

          {/* Ornamento sotto il nome */}
          <div style={{ margin: '0.75rem 0' }}>
            <BotanicalDivider color={tema.mid} small />
          </div>

          {/* Data */}
          {dataMatrimonio && (
            <p style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '1rem',
              fontStyle: 'italic',
              color: '#6b7280',
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}>
              {format(dataMatrimonio, "d MMMM yyyy", { locale: it })}
            </p>
          )}

          {/* Countdown */}
          {giorniMancanti !== null && giorniMancanti > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: tema.light, border: `1px solid ${tema.border}`, borderRadius: '2rem', padding: '0.45rem 1.25rem', color: tema.text, fontSize: '0.8125rem' }}>
              <Heart size={13} fill="currentColor" />
              Mancano <strong>{giorniMancanti}</strong> giorni
            </div>
          )}
          {giorniMancanti === 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: tema.light, border: `1px solid ${tema.border}`, borderRadius: '2rem', padding: '0.45rem 1.25rem', color: tema.text, fontSize: '0.8125rem' }}>
              <span>🎉</span> È oggi!
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENUTO PRINCIPALE ─────────────────── */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '3.5rem 1.5rem 2rem' }}>

        {/* Messaggio benvenuto */}
        {config.landing_messaggio && (
          <div style={{ textAlign: 'center', margin: '0 auto 4rem', maxWidth: '600px', position: 'relative' }}>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '6rem', color: tema.border, lineHeight: 0, display: 'block', marginBottom: '-1.5rem', userSelect: 'none' }}>"</span>
            <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#4b5563', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
              {config.landing_messaggio}
            </p>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '6rem', color: tema.border, lineHeight: 0, display: 'block', marginTop: '-0.5rem', userSelect: 'none' }}>"</span>
          </div>
        )}

        {/* Location */}
        {hasLocation && (
          <Section title="Dove ci troviamo" tema={tema}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {[chiesa, ricevimento, ...altreLocation].filter(Boolean).map(loc => (
                <LocationCard key={loc.id} loc={loc} tema={tema} />
              ))}
            </div>
          </Section>
        )}

        {/* Cronologia */}
        {cronologia.length > 0 && (
          <Section title="Il programma del giorno" tema={tema}>
            <div style={{ position: 'relative', paddingLeft: '3rem' }}>
              {/* Linea verticale */}
              <div style={{ position: 'absolute', left: '0.875rem', top: '0.5rem', bottom: '0.5rem', width: '1px', background: `linear-gradient(to bottom, ${tema.border}, transparent)` }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                {cronologia.map((ev, i) => (
                  <div key={ev.id} style={{ position: 'relative' }}>
                    {/* Dot */}
                    <div style={{ position: 'absolute', left: '-2.25rem', top: '0.125rem', width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: i === 0 ? tema.primary : '#fff', border: `2px solid ${i === 0 ? tema.primary : tema.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', boxShadow: '0 0 0 3px ' + bg }}>
                      <span>{TIPO_EMOJI[ev.tipo] || '✦'}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '0.8125rem', color: tema.text, fontWeight: 600, letterSpacing: '0.05em' }}>
                          {ev.ora?.slice(0, 5)}
                        </span>
                        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 600, color: '#1f2937', fontSize: '1rem' }}>{ev.titolo}</span>
                      </div>
                      {ev.luogo && (
                        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                          <MapPin size={12} style={{ color: tema.mid }} /> {ev.luogo}
                        </p>
                      )}
                      {ev.descrizione && (
                        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.15rem', fontStyle: 'italic' }}>{ev.descrizione}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Dress code + Info pratiche affiancate */}
        {(hasDressCode || hasInfo) && (
          <div style={{ display: 'grid', gridTemplateColumns: hasDressCode && hasInfo ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: '1.5rem', marginBottom: '3.5rem' }}>
            {hasDressCode && (
              <InfoBox icon="👗" title="Dress Code" tema={tema}>
                {config.landing_dress_code}
              </InfoBox>
            )}
            {hasInfo && (
              <InfoBox icon="📍" title="Informazioni pratiche" tema={tema}>
                {config.landing_info_pratiche}
              </InfoBox>
            )}
          </div>
        )}

        {/* RSVP CTA */}
        {config.conferma_abilitata && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0 2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <BotanicalDivider color={tema.border} />
            </div>
            <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.375rem', fontStyle: 'italic', color: '#374151', marginBottom: '0.5rem' }}>
              Sei dei nostri?
            </p>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '1.5rem' }}>
              Conferma la tua presenza entro la data indicata nell'invito.
            </p>
            <a
              href="/conferma"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
                background: tema.primary, color: '#fff',
                padding: '0.875rem 2.5rem', borderRadius: '3rem',
                textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem',
                letterSpacing: '0.04em', boxShadow: `0 8px 20px -4px ${tema.primary}60`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 28px -4px ${tema.primary}70`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px -4px ${tema.primary}60`; }}
            >
              <Heart size={16} fill="currentColor" />
              Conferma la presenza
            </a>
          </div>
        )}

      </div>

      {/* ── FOOTER ───────────────────────────────── */}
      <footer style={{ background: tema.light, borderTop: `1px solid ${tema.border}`, padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BotanicalDivider color={tema.mid} />
        </div>
        <p style={{ fontFamily: '"Great Vibes", cursive', fontSize: '2.5rem', color: tema.dark, lineHeight: 1.2, margin: '0.5rem 0' }}>
          {sposi}
        </p>
        {dataMatrimonio && (
          <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {format(dataMatrimonio, "d MMMM yyyy", { locale: it })}
          </p>
        )}
        <p style={{ color: tema.mid, fontSize: '1.25rem', marginTop: '1.25rem' }}>✦</p>
      </footer>
    </div>
  );
}

function Section({ title, children, tema }) {
  return (
    <section style={{ marginBottom: '3.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: '1.375rem', fontWeight: 600, color: tema.dark, marginBottom: '0.5rem',
        }}>
          {title}
        </h2>
        <BotanicalDivider color={tema.border} small />
      </div>
      {children}
    </section>
  );
}

function LocationCard({ loc, tema }) {
  const tipo = TIPO_LABEL[loc.tipo] || loc.tipo;
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${tema.border}`,
      borderRadius: '1rem',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 16px -4px rgba(0,0,0,0.08)',
    }}>
      {/* Banda colorata a sinistra */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: tema.primary, borderRadius: '1rem 0 0 1rem' }} />
      <div style={{ paddingLeft: '0.5rem' }}>
        <span style={{
          display: 'inline-block', fontSize: '0.65rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.12em', color: tema.text,
          background: tema.light, border: `1px solid ${tema.border}`,
          padding: '0.2rem 0.6rem', borderRadius: '0.375rem', marginBottom: '0.6rem',
        }}>
          {tipo}
        </span>
        <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 600, color: '#111827', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
          {loc.nome}
        </h3>
        {loc.indirizzo && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
            <MapPin size={14} style={{ flexShrink: 0, marginTop: '0.2rem', color: tema.primary }} />
            {loc.indirizzo}
          </p>
        )}
        {(loc.contatto || loc.telefono) && (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.4rem' }}>
            {[loc.contatto, loc.telefono].filter(Boolean).join(' · ')}
          </p>
        )}
        {loc.note && (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.4rem', fontStyle: 'italic' }}>{loc.note}</p>
        )}
      </div>
    </div>
  );
}

function InfoBox({ icon, title, children, tema }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${tema.border}`,
      borderRadius: '1rem',
      padding: '1.5rem',
      boxShadow: '0 4px 16px -4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 600, color: tema.dark, fontSize: '1rem' }}>{title}</h3>
      </div>
      <p style={{ color: '#4b5563', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontSize: '0.9375rem' }}>{children}</p>
    </div>
  );
}
