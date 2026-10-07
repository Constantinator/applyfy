import "server-only";

// Localisation saisie (ville ou numéro de département) → code de département, via l'API
// publique Découpage administratif (geo.api.gouv.fr, sans clé).

const GEO_API = "https://geo.api.gouv.fr";

/** `name` : libellé affiché (« Rhône (Lyon) ») ; `departmentName` : nom seul du département. */
export type Department = { code: string; name: string; departmentName: string };

const DEPARTMENT_CODE = /^(\d{2,3}|2[ab])$/i;

export async function resolveDepartment(input: string): Promise<Department | null> {
  const query = input.trim();
  if (!query) return null;

  try {
    if (DEPARTMENT_CODE.test(query)) {
      const code = query.toUpperCase();
      const response = await fetch(`${GEO_API}/departements/${encodeURIComponent(code)}?fields=nom,code`, {
        next: { revalidate: 86_400 },
      });
      if (!response.ok) return null;
      const dep = (await response.json()) as { code: string; nom: string };
      return { code: dep.code, name: dep.nom, departmentName: dep.nom };
    }

    // Ville : la commune la plus peuplée portant ce nom.
    const params = new URLSearchParams({
      nom: query,
      fields: "nom,codeDepartement,departement",
      boost: "population",
      limit: "1",
    });
    const response = await fetch(`${GEO_API}/communes?${params}`, { next: { revalidate: 86_400 } });
    if (!response.ok) return null;
    const [commune] = (await response.json()) as {
      nom: string;
      codeDepartement: string;
      departement?: { nom: string };
    }[];
    if (!commune) return null;
    const departmentName = commune.departement?.nom ?? commune.codeDepartement;
    return { code: commune.codeDepartement, name: `${departmentName} (${commune.nom})`, departmentName };
  } catch (error) {
    console.error("[geo] résolution de la localisation", error);
    return null;
  }
}
