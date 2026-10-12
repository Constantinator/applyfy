"use client";

import Image from "next/image";
import { useRef } from "react";

/**
 * Image de la landing qui s'ouvre en grand au clic (fond noir semi-transparent). Fermeture par
 * la croix, un clic en dehors de l'image ou la touche Échap (gérée par <dialog>).
 */
export function ImageLightbox({
  src,
  alt,
  width,
  height,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Agrandir l'image"
        className="block w-full cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={className}
        />
      </button>

      <dialog
        ref={dialogRef}
        aria-label={alt}
        // Clic en dehors de l'image (fond, marges) : fermeture.
        onClick={(event) => {
          if (!(event.target instanceof HTMLImageElement)) dialogRef.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/80"
      >
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-10">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="100vw"
            className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fermer"
          className="fixed top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
        >
          ✕
        </button>
      </dialog>
    </>
  );
}
