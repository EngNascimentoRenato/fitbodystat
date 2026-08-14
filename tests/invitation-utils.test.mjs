import test from "node:test";
import assert from "node:assert/strict";
import { invitationIsPending } from "../public/js/utils/invitation-utils.js";

function timestamp(milliseconds) {
  return { toDate: () => new Date(milliseconds) };
}

test("convite antigo sem validade permanece compatível", () => {
  assert.equal(invitationIsPending({ status: "pending" }, 1000), true);
});

test("convite vencido deixa de ser exibido como pendente", () => {
  assert.equal(invitationIsPending({ status: "pending", expiresAt: timestamp(999) }, 1000), false);
  assert.equal(invitationIsPending({ status: "pending", expiresAt: timestamp(1001) }, 1000), true);
});
