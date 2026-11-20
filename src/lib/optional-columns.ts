// Insertion qui survit à une migration pas encore appliquée : si une colonne facultative manque en
// base (42703 côté Postgres, PGRST204 côté PostgREST), on réessaie sans elle et on journalise une
// ligne. Fonction pure : l'appel à Supabase est passé en paramètre.

export type DbError = { code?: string; message?: string } | null;

export function isMissingColumn(error: DbError, column: string) {
  return Boolean(
    error && (error.code === "42703" || error.code === "PGRST204") && (error.message ?? "").includes(column),
  );
}

/**
 * Appelle `insert` avec les colonnes facultatives ; retire une à une celles que la base ne connaît
 * pas (au plus une fois chacune). Toute autre erreur est rendue telle quelle.
 */
export async function insertWithOptionalColumns<T>(
  optional: Record<string, unknown>,
  insert: (optional: Record<string, unknown>) => PromiseLike<{ data: T | null; error: DbError }>,
  migrations: Record<string, string>,
  context: string,
): Promise<{ data: T | null; error: DbError }> {
  const values = { ...optional };
  let result = await insert(values);
  for (let retry = 0; result.error && retry < Object.keys(optional).length; retry++) {
    const missing = Object.keys(values).find((column) => isMissingColumn(result.error, column));
    if (!missing) break;
    console.error(`[${context}] colonne ${missing} absente (migration ${migrations[missing] ?? "?"})`);
    delete values[missing];
    result = await insert(values);
  }
  return result;
}
