import test from "node:test";
import assert from "node:assert/strict";

import { canAccessRoute, getRoute } from "../public/js/menu.js";
import {
  clearDeviceWorkspace,
  loadDeviceWorkspace,
  personalWorkspaceEnabled,
  saveDeviceWorkspace
} from "../public/js/services/workspace-service.js";

test("ambientes separam rotas profissionais e pessoais", () => {
  const professional = {
    role: "professional",
    activeWorkspace: "professional",
    professionalProfile: { personalWorkspaceEnabled: true },
    activePatient: null
  };
  assert.equal(canAccessRoute(getRoute("/agenda"), professional), true);
  assert.equal(canAccessRoute(getRoute("/dashboard"), professional), false);

  professional.activePatient = { uid: "patient-1" };
  assert.equal(canAccessRoute(getRoute("/dashboard"), professional), true);

  professional.activePatient = null;
  professional.activeWorkspace = "personal";
  assert.equal(canAccessRoute(getRoute("/dashboard"), professional), true);
  assert.equal(canAccessRoute(getRoute("/agenda"), professional), false);
});

test("preferência de ambiente permanece somente no armazenamento do dispositivo", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };

  assert.equal(loadDeviceWorkspace("professional-1", true), "professional");
  saveDeviceWorkspace("professional-1", "personal");
  assert.equal(loadDeviceWorkspace("professional-1", true), "personal");
  assert.equal(loadDeviceWorkspace("professional-1", false), "professional");
  clearDeviceWorkspace("professional-1");
  assert.equal(loadDeviceWorkspace("professional-1", true), "professional");
  delete globalThis.localStorage;
});

test("ambiente pessoal exige perfil profissional e habilitação", () => {
  assert.equal(personalWorkspaceEnabled({
    role: "professional",
    professionalProfile: null
  }), false);
  assert.equal(personalWorkspaceEnabled({
    role: "professional",
    professionalProfile: {}
  }), true);
  assert.equal(personalWorkspaceEnabled({
    role: "professional",
    professionalProfile: { personalWorkspaceEnabled: false }
  }), false);
  assert.equal(personalWorkspaceEnabled({
    role: "user",
    professionalProfile: {}
  }), false);
});
