// Avatar de Lumeo : rendu sans erreur pour chaque expression et chaque taille. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { LumeoAvatar, LUMEO_EXPRESSIONS, LUMEO_SIZES } = await import("../components/lumeo/lumeo-avatar.ts");
const { LUMEO_TEXTS } = await import("./lumeo-texts.ts");

const render = (props) => renderToStaticMarkup(createElement(LumeoAvatar, props));

test("8 expressions et 5 tailles", () => {
  assert.deepEqual([...LUMEO_SIZES], [24, 36, 56, 72, 96]);
  assert.equal(LUMEO_EXPRESSIONS.length, 8);
});

test("chaque expression se rend à chaque taille", () => {
  for (const expression of LUMEO_EXPRESSIONS) {
    for (const size of LUMEO_SIZES) {
      const svg = render({ size, expression });
      assert.match(svg, /^<svg[^>]* viewBox="0 0 48 48"/, `${expression} ${size}`);
      assert.match(svg, new RegExp(`width="${size}" height="${size}"`), `${expression} ${size}`);
      assert.match(svg, new RegExp(`data-expression="${expression}"`));
      // Tête, antenne et au moins un trait du visage.
      assert.ok((svg.match(/<(rect|circle|ellipse|path)\b/g) ?? []).length >= 6, `${expression} ${size}`);
    }
  }
});

test("les expressions se distinguent les unes des autres", () => {
  const svgs = LUMEO_EXPRESSIONS.map((expression) =>
    render({ size: 36, expression }).replace(/ data-expression="[^"]*"/, ""),
  );
  assert.equal(new Set(svgs).size, LUMEO_EXPRESSIONS.length);
});

test("accessibilité : caché par défaut, annoncé « Lumeo » seul", () => {
  const decorative = render({});
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="img"/);
  const standalone = render({ standalone: true });
  assert.match(standalone, /role="img"/);
  assert.match(standalone, /aria-label="Lumeo"/);
  assert.doesNotMatch(standalone, /aria-hidden/);
});

test("couleurs : noir #0A0A0A et bleu #2563EB, version inversée blanche, sans ombre ni dégradé", () => {
  const svg = render({ expression: "content" });
  assert.match(svg, /#0A0A0A/);
  assert.match(svg, /#2563EB/);
  assert.match(render({ inverse: true }), /--lumeo-body:#FFFFFF/);
  for (const expression of LUMEO_EXPRESSIONS) {
    assert.doesNotMatch(render({ expression }), /Gradient|filter|shadow/i);
  }
});

test("l'animation de réflexion respecte prefers-reduced-motion", () => {
  assert.match(render({ expression: "reflechit" }), /animate-pulse motion-reduce:animate-none/);
  assert.doesNotMatch(render({ expression: "content" }), /animate-/);
});

test("« felicite » fêtée : seules les deux étincelles s'animent, une fois", () => {
  assert.doesNotMatch(render({ expression: "felicite" }), /animate-/);
  const svg = render({ expression: "felicite", celebrate: true });
  assert.equal((svg.match(/class="animate-sparkle-once"/g) ?? []).length, 2);
  // Le marqueur interne n'est jamais rendu ; sans étincelles, celebrate ne change rien.
  assert.doesNotMatch(svg, /sparkle="/);
  assert.equal(render({ expression: "content", celebrate: true }), render({ expression: "content" }));
});

test("textes de Lumeo : courts, au tutoiement", () => {
  assert.equal(LUMEO_TEXTS.name, "Lumeo");
  for (const [key, text] of Object.entries(LUMEO_TEXTS)) {
    assert.ok(text.length <= 120, key);
    assert.doesNotMatch(text, /\bvous\b|\bvotre\b|\bvos\b/i, key);
  }
});
