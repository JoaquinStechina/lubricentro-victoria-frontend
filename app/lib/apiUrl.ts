// URL base de la API. Separada de api.ts para que sesion.ts la use sin
// importar api.ts (que a su vez usa sesion.ts).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
