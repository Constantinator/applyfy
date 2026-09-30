"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { saveAccountName } from "@/lib/account";
import { readPdfUpload } from "@/lib/cv-file";
import { validateAccountName } from "@/lib/person-name";
import { CV_NAME_MAX_LENGTH } from "@/lib/cv-types";
import {
  ProfileCvError,
  addProfileCv,
  deleteProfileCv,
  renameProfileCv,
  saveReminderSettings,
} from "@/lib/profile";
import { isFirstReminderOption, isSecondReminderOption } from "@/lib/reminders";

export type ProfileActionResult = { ok: true; message: string } | { ok: false; error: string };

function validateName(value: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Donne un nom à ce CV (ex. « CV Data »)." };
  if (name.length > CV_NAME_MAX_LENGTH) {
    return { ok: false, error: `Nom trop long (${CV_NAME_MAX_LENGTH} caractères max).` };
  }
  return { ok: true, name };
}

async function run(context: string, task: () => Promise<string>): Promise<ProfileActionResult> {
  try {
    const message = await task();
    revalidatePath("/profil");
    return { ok: true, message };
  } catch (error) {
    unstable_rethrow(error); // redirection vers /login si la session a expiré
    if (error instanceof ProfileCvError) return { ok: false, error: error.message };
    console.error(`[${context}]`, error);
    return { ok: false, error: "L'opération a échoué. Réessaie dans un instant." };
  }
}

export async function addProfileCvAction(formData: FormData): Promise<ProfileActionResult> {
  const name = validateName(formData.get("name"));
  if (!name.ok) return name;
  const upload = await readPdfUpload(formData.get("cv"));
  if (!upload.ok) return { ok: false, error: upload.error };

  return run("addProfileCv", async () => {
    await addProfileCv(name.name, upload.fileName, upload.bytes);
    return `✓ « ${name.name} » ajouté à ton profil.`;
  });
}

export async function renameProfileCvAction(id: string, rawName: string): Promise<ProfileActionResult> {
  const name = validateName(rawName);
  if (!name.ok) return name;
  return run("renameProfileCv", async () => {
    await renameProfileCv(String(id), name.name);
    return `✓ CV renommé en « ${name.name} ».`;
  });
}

export async function saveAccountNameAction(firstName: unknown, lastName: unknown): Promise<ProfileActionResult> {
  const name = validateAccountName(firstName, lastName);
  if (!name.ok) return name;
  return run("saveAccountName", async () => {
    await saveAccountName(name.name);
    return "✓ Prénom et nom enregistrés.";
  });
}

export async function deleteProfileCvAction(id: string): Promise<ProfileActionResult> {
  return run("deleteProfileCv", async () => {
    await deleteProfileCv(String(id));
    return "CV supprimé.";
  });
}

export async function saveReminderSettingsAction(input: {
  enabled: boolean;
  firstDays: number;
  secondDays: number;
}): Promise<ProfileActionResult> {
  const firstDays = Number(input?.firstDays);
  const secondDays = Number(input?.secondDays);
  if (!isFirstReminderOption(firstDays) || !isSecondReminderOption(secondDays)) {
    return { ok: false, error: "Délai invalide." };
  }
  return run("saveReminderSettings", async () => {
    await saveReminderSettings({ enabled: input.enabled === true, firstDays, secondDays });
    return "✓ Préférences de rappel enregistrées.";
  });
}