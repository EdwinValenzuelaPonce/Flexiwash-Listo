import { useEffect, useState } from "react";

const PREFIX = "fw:v1:";

// Como useState, pero guarda el valor en localStorage. Nunca lanza: si el
// almacenamiento no está disponible o el dato está corrupto, usa el valor inicial.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch { /* ignorar */ }
    return typeof initial === "function" ? initial() : initial;
  });
  useEffect(() => {
    try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* cuota o modo privado */ }
  }, [key, value]);
  return [value, setValue];
}

export function clearPersistedState() {
  try {
    Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => window.localStorage.removeItem(k));
  } catch { /* ignorar */ }
}
