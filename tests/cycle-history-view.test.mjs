import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../js/views/profile-view.js", import.meta.url),
  "utf8"
);

test("consulta de projeto filtra medições pelo ciclo selecionado", () => {
  assert.match(
    source,
    /\.filter\(\(entry\) => entry\.cycleId === cycle\.id\)/
  );
  assert.match(source, /Histórico deste projeto/);
  assert.match(source, /Medições isoladas dos demais ciclos/);
});

test("consulta apresenta resultado final do projeto", () => {
  assert.match(source, /Peso final registrado/);
  assert.match(source, /Cintura final registrada/);
  assert.match(source, /IMC final/);
  assert.match(source, /Motivo do encerramento/);
});

test("avanço da linha de base não depende da validação nativa do navegador", () => {
  assert.match(source, /id="new-cycle-baseline-form" novalidate/);
  assert.match(source, /id="continue-new-cycle-goal" type="button"/);
  assert.match(source, /addEventListener\("click", continueToGoal\)/);
  assert.match(source, /Não foi possível avançar\. Revise os dados e tente novamente\./);
});
