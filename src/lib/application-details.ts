// Limites des champs modifiables sur la fiche (partagées entre formulaires et actions).

export const NOTES_MAX_LENGTH = 10_000;
export const CONTACT_NAME_MAX_LENGTH = 120;
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Délai sans frappe avant l'enregistrement automatique des notes. */
export const NOTES_AUTOSAVE_DELAY_MS = 2000;
