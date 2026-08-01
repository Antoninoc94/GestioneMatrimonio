import { createContext, useContext, useState, useEffect } from 'react';

const defaults = { app_name: 'Il Nostro Matrimonio', app_emoji: '💍', login_subtitle: '' };

const AppConfigContext = createContext({ ...defaults, updateAppConfig: () => {} });

function applyConfig(cfg) {
  document.title = cfg.app_name || defaults.app_name;
  const emoji = cfg.app_emoji || defaults.app_emoji;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '52px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 36);
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = canvas.toDataURL('image/png');
    document.head.appendChild(link);
  } catch {}
}

export function AppConfigProvider({ children }) {
  const [appConfig, setAppConfig] = useState(defaults);

  useEffect(() => {
    fetch('/api/config/public')
      .then(r => r.json())
      .then(data => {
        const cfg = { ...defaults, ...data };
        setAppConfig(cfg);
        applyConfig(cfg);
      })
      .catch(() => applyConfig(defaults));
  }, []);

  const updateAppConfig = (partial) => {
    const cfg = { ...appConfig, ...partial };
    setAppConfig(cfg);
    applyConfig(cfg);
  };

  return (
    <AppConfigContext.Provider value={{ ...appConfig, updateAppConfig }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export const useAppConfig = () => useContext(AppConfigContext);
