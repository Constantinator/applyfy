"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { readPdfUpload } from "@/lib/cv-file";
import { deleteProfileCv, saveProfileCv } from "@/lib/profile";

export type ProfileCvState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function uploadProfileCvAction(
  _prev: ProfileCvState,
  formData: FormData,
): Promise<ProfileCvState> {
  const upload = await readPdfUpload(formData.get("cv"));
  if (!upload.ok) return { status: "error", message: upload.error };

  try {
    await saveProfileCv(upload.fileName, upload.bytes);
  } catch (error) {
    unstable_rethrow(error); // redirection vers /login si la session a expiré
    console.error("[uploadProfileCv]", error);
    return { status: "error", message: "L'enregistrement de ton CV a échoué. Réessaie dans un instant." };
  }

  revalidatePath("/profil");
  return { status: "success", message: "✓ CV enregistré dans ton profil." };
}

export async function deleteProfileCvAction(): Promise<ProfileCvState> {
  try {
    await deleteProfileCv();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[deleteProfileCv]", error);
    return { status: "error", message: "La suppression a échoué. Réessaie dans un instant." };
  }
  revalidatePath("/profil");
  return { status: "success", message: "CV supprimé de ton profil." };
}
