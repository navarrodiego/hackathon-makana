const clock = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const clockSeconds = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Hora de 24 h en Santiago, «22:10». */
export const hhmm = (instant: string | number) => clock.format(new Date(instant));
export const hhmmss = (instant: string | number) => clockSeconds.format(new Date(instant));
