import test from "node:test";
import assert from "node:assert/strict";
import { skinfoldCalculator } from "../public/js/components/skinfold-calculator.js";
import { entryForm } from "../public/js/components/entry-form.js";

test("formulário de medidas não é bloqueado por campos ocultos do adipômetro", () => {
  const html = entryForm({ trackedCircumferences: ["waist"], sex: "male" });
  assert.match(html, /id="entry-form"[^>]*novalidate/);
});

test("calculadora de dobras não cria formulário aninhado", () => {
  const html = skinfoldCalculator("test", {
    sex: "male",
    birthDate: "1987-01-01"
  });

  assert.doesNotMatch(html, /<form/i);
  assert.match(html, /data-calculate-skinfold/);
  assert.match(html, /data-use-skinfold/);
  assert.match(html, /id="test-skinfold-result"/);
});

test("calculadora apresenta resultado já armazenado", () => {
  const html = skinfoldCalculator("test", { sex: "female" }, {
    protocol: "jackson-pollock-3",
    bodyFatPercent: 24.6,
    sumMm: 52.4,
    readingsMm: {
      tricepsMm: 18,
      suprailiacMm: 16,
      thighMm: 18.4
    }
  });

  assert.match(html, /24,6%/);
  assert.match(html, /52,4 mm/);
  assert.doesNotMatch(html, /data-use-skinfold type="button"\s+disabled/);
});
