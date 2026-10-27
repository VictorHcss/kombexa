/** Preferência de tema (claro, escuro ou sistema), guardada por aparelho num cookie. */
export type ThemeChoice = "light" | "dark" | "system";
export const THEME_COOKIE = "kombexa-theme";

/** Roda antes da pintura (inline no <head>): aplica a escolha salva. Só lê o cookie de tema. */
export const THEME_BOOT_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;
