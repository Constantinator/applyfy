"use server";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { status: "error", message: "Entre une adresse email valide." };
  }

  if (!isSupabaseConfigured()) {
    console.info(`[waitlist] (mode démo, non enregistré) ${email}`);
    return { status: "success", message: "C'est noté ! (mode démo : email non enregistré)" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").insert({ email });

  // 23505 = email déjà inscrit : on répond pareil pour ne pas révéler qui est inscrit.
  if (error && error.code !== "23505") {
    console.error("[waitlist]", error);
    return { status: "error", message: "Oups, l'inscription a échoué. Réessaie dans un instant." };
  }

  return { status: "success", message: "C'est noté ! On te prévient dès l'ouverture." };
}
