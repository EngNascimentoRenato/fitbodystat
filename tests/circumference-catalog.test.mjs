import test from "node:test";
import assert from "node:assert/strict";
import {
  circumferenceValue,
  normalizeCircumferenceKeys
} from "../public/js/data/circumference-catalog.js";

test("normaliza somente circunferências conhecidas", () => {
  assert.deepEqual(
    normalizeCircumferenceKeys(["chest", "thigh", "chest", "invalid"]),
    ["waist", "chest", "thigh"]
  );
});

test("mantém cintura mesmo quando não vem na seleção", () => {
  assert.deepEqual(normalizeCircumferenceKeys([]), ["waist"]);
});

test("não seleciona quadril por padrão", () => {
  assert.deepEqual(normalizeCircumferenceKeys(), ["waist"]);
});

test("lê campos legados e novas circunferências pelo mesmo catálogo", () => {
  const entry = {
    waistCm: 90,
    circumferences: { chest: 102 }
  };
  assert.equal(circumferenceValue(entry, "waist"), 90);
  assert.equal(circumferenceValue(entry, "chest"), 102);
});

test("lê medidas bilaterais e preserva o formato numérico antigo", () => {
  const current = {
    circumferences: {
      thigh: { right: 58.2, left: 57.8 }
    }
  };
  const legacy = {
    circumferences: {
      thigh: 56
    }
  };

  assert.equal(circumferenceValue(current, "thigh", "", "right"), 58.2);
  assert.equal(circumferenceValue(current, "thigh", "", "left"), 57.8);
  assert.equal(circumferenceValue(legacy, "thigh", "", "right"), 56);
  assert.equal(circumferenceValue(legacy, "thigh", "", "left"), null);
});
