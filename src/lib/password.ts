// Règles de mot de passe partagées entre le formulaire (affichage en temps réel)
// et la Server Action d'inscription (validation qui fait foi).

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "Au moins 8 caractères", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "Au moins une majuscule", test: (p) => /\p{Lu}/u.test(p) },
  { id: "digit", label: "Au moins un chiffre", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "Au moins un caractère spécial (!@#$%^&*…)",
    test: (p) => /[^\p{L}\p{N}\s]/u.test(p),
  },
];

/** Limite imposée par Supabase Auth (bcrypt). */
export const PASSWORD_MAX_LENGTH = 72;

export function isPasswordValid(password: string) {
  return (
    password.length <= PASSWORD_MAX_LENGTH && PASSWORD_RULES.every((rule) => rule.test(password))
  );
}
