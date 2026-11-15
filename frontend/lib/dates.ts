// Aurora returns UTC timestamps without a zone ("2026-11-15 04:10:32.6"); mark them as UTC
export const parseUtc = (s: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
