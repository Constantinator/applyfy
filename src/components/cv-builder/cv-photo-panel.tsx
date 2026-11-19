"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { templateHasPhoto, type CvTemplateId } from "@/lib/cv-builder-types";
import {
  INITIAL_CROP,
  PHOTO_MESSAGES,
  PHOTO_SIZE,
  PHOTO_ZOOM_MAX,
  PHOTO_ZOOM_MIN,
  clampCrop,
  keyboardCrop,
  photoFileProblem,
  zoomCrop,
  type Crop,
} from "@/lib/cv-photo";

import { decodePhoto, drawCrop, encodePhoto, type Source } from "./cv-photo-encode";

// Bloc « Photo (facultatif) » de l'onglet Style du CV : ajout, recadrage dans un cercle (souris,
// doigt, clavier), changement et suppression. Traitement de l'image : cv-photo-encode.ts. La
// photo n'est envoyée nulle part ici : l'éditeur l'enregistre avec le CV.

/** Côté de la zone de recadrage à l'écran, en pixels CSS. */
const VIEW = 288;

/** Fenêtre de recadrage : la partie dans le cercle apparaîtra sur le CV. */
function CropDialog({ source, onCancel, onDone }: { source: Source; onCancel: () => void; onDone: (photo: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const helpId = useId();
  const zoomId = useId();
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Crop } | null>(null);
  const { width, height } = source;

  useEffect(() => {
    dialogRef.current?.showModal();
    areaRef.current?.focus();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawCrop(canvas, source, crop, Math.round(VIEW * Math.min(2, window.devicePixelRatio || 1)));
  }, [source, crop]);

  // Molette : zoom (écouteur non passif pour ne pas faire défiler la page).
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCrop((c) => zoomCrop(c, c.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), width, height));
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const toOutput = PHOTO_SIZE / VIEW;
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: crop };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setCrop(clampCrop({ ...d.start, x: d.start.x + (e.clientX - d.x) * toOutput, y: d.start.y + (e.clientY - d.y) * toOutput }, width, height));
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyboardCrop(crop, e.key, e.shiftKey, width, height);
    if (!next) return;
    e.preventDefault();
    setCrop(next);
  };

  async function validate() {
    setBusy(true);
    setError(null);
    try {
      onDone(await encodePhoto(source, crop));
    } catch (e) {
      setError(e instanceof Error && Object.values(PHOTO_MESSAGES).includes(e.message as never) ? e.message : PHOTO_MESSAGES.unreadable);
      setBusy(false);
    }
  }

  const percent = Math.round(crop.zoom * 100);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-white p-0 backdrop:bg-slate-900/60 dark:bg-slate-900"
    >
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="text-lg font-bold text-ink dark:text-white">
          Recadrer ta photo
        </h2>
        <p id={helpId} className="text-sm text-muted dark:text-slate-400">
          Fais glisser la photo et règle le zoom : la partie dans le cercle apparaîtra sur ton CV. Au clavier : flèches pour
          déplacer, + et − pour zoomer, 0 pour recentrer.
        </p>
        <div
          ref={areaRef}
          tabIndex={0}
          role="group"
          aria-label="Zone de recadrage de ta photo"
          aria-describedby={helpId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="ui-focus relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-block bg-slate-100 active:cursor-grabbing dark:bg-slate-800"
          style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Aperçu du recadrage, zoom ${percent} % : seule la partie de ta photo dans le cercle apparaîtra sur le CV.`}
            className="block h-full w-full"
          />
          {/* Coins assombris hors du cercle (décoratif). */}
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <path d="M0 0H100V100H0Z M50 0A50 50 0 1 0 50 100A50 50 0 1 0 50 0Z" fillRule="evenodd" fill="rgba(15,23,42,0.55)" />
            <circle cx="50" cy="50" r="49.6" fill="none" stroke="white" strokeWidth="0.8" />
          </svg>
        </div>
        <div className="space-y-1">
          <label htmlFor={zoomId} className="text-sm font-medium text-ink dark:text-slate-200">
            Zoom
          </label>
          <input
            id={zoomId}
            type="range"
            min={PHOTO_ZOOM_MIN}
            max={PHOTO_ZOOM_MAX}
            step={0.01}
            value={crop.zoom}
            aria-valuetext={`${percent} %`}
            onChange={(e) => setCrop((c) => zoomCrop(c, Number(e.target.value), width, height))}
            className="w-full"
          />
        </div>
        {error ? (
          <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="ui-btn-secondary">
            Annuler
          </button>
          <button type="button" onClick={validate} disabled={busy} className="ui-btn-primary">
            {busy ? "Préparation…" : "Valider"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Bloc « Photo (facultatif) ». Modèles sans emplacement de photo : une phrase l'explique ; une
 * photo existante est gardée dans les données et réapparaît sur un modèle qui la montre.
 */
export function CvPhotoPanel({
  photo,
  templateId,
  onChange,
}: {
  photo: string | null;
  templateId: CvTemplateId;
  onChange: (photo: string | null) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const shown = templateHasPhoto(templateId);

  const closeCrop = useCallback(() => {
    setSource((s) => {
      if (s?.image instanceof ImageBitmap) s.image.close();
      return null;
    });
    buttonRef.current?.focus();
  }, []);

  async function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
      const problem = photoFileProblem(head, file.size);
      if (problem) return setError(problem);
      const decoded = await decodePhoto(file).catch(() => null);
      if (!decoded || !decoded.width || !decoded.height) return setError(PHOTO_MESSAGES.unreadable);
      setSource(decoded);
    } finally {
      setReading(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="font-semibold text-ink dark:text-white">
        Photo (facultatif)
      </h2>
      <p className="text-sm text-muted dark:text-slate-400">En France, la photo n&apos;est pas obligatoire. À toi de voir selon le poste.</p>
      {!shown ? (
        <p className="text-sm text-prose dark:text-slate-300">
          Ce modèle n&apos;affiche pas de photo.
          {photo ? " Ta photo est gardée : elle réapparaîtra si tu choisis un modèle qui en montre une." : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo en data URL, déjà réduite à 400 px
          <img
            src={photo}
            alt={shown ? "Ta photo de CV, telle qu'elle apparaît dans le cercle du modèle" : "Ta photo de CV (non affichée par ce modèle)"}
            className={`h-16 w-16 rounded-full object-cover ring-1 ring-line dark:ring-slate-700 ${shown ? "" : "opacity-60"}`}
          />
        ) : null}
        {shown ? (
          <button ref={buttonRef} type="button" onClick={() => inputRef.current?.click()} disabled={reading} className="ui-btn-secondary">
            {reading ? "Lecture…" : photo ? "Changer la photo" : "Ajouter une photo"}
          </button>
        ) : null}
        {photo ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange(null);
            }}
            className="ui-btn-secondary"
          >
            Supprimer la photo
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {source ? (
        <CropDialog
          source={source}
          onCancel={closeCrop}
          onDone={(next) => {
            onChange(next);
            closeCrop();
          }}
        />
      ) : null}
    </section>
  );
}
