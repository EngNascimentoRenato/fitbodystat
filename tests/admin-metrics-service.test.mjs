import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminMetrics } from "../public/js/services/admin-metrics-service.js";

const now = new Date("2026-08-01T12:00:00-04:00");

test("resume ativação e uso sem depender de dados corporais", () => {
  const users = [
    {
      id: "u1",
      role: "user",
      createdAt: "2026-07-30T12:00:00-04:00",
      lastAccessAt: "2026-08-01T10:00:00-04:00",
      profileCompleted: true,
      hasActiveProject: true,
      hasAnyRecord: true,
      appVersion: "0.2.0-alpha.54",
      deviceType: "mobile"
    },
    {
      id: "p1",
      role: "professional",
      createdAt: "2026-05-01T12:00:00-04:00",
      lastAccessAt: "2026-06-01T12:00:00-04:00",
      appVersion: "0.2.0-alpha.53",
      deviceType: "desktop"
    }
  ];
  const metrics = buildAdminMetrics(
    users,
    [{ status: "active" }],
    [{ status: "pending" }, { status: "accepted" }],
    now
  );

  assert.equal(metrics.total, 2);
  assert.equal(metrics.professionals, 1);
  assert.equal(metrics.new7, 1);
  assert.equal(metrics.active7, 1);
  assert.equal(metrics.active30, 1);
  assert.equal(metrics.stale30, 1);
  assert.equal(metrics.activeProjects, 1);
  assert.equal(metrics.firstRecords, 1);
  assert.equal(metrics.activeLinks, 1);
  assert.equal(metrics.pendingInvitations, 1);
  assert.equal(metrics.acceptedInvitations, 1);
  assert.deepEqual(metrics.devices, [["mobile", 1], ["desktop", 1]]);
});

test("mantém contas antigas fora da cobertura até novo acesso", () => {
  const metrics = buildAdminMetrics([{ id: "legacy", role: "user" }], [], [], now);
  assert.equal(metrics.telemetryCoverage, 0);
  assert.equal(metrics.active7, 0);
  assert.equal(metrics.recentUsers.length, 0);
});
