import { pinGate } from "#bookser-reader";
import { weeklyReport } from "./report.mjs";
import { hasReadingConsent } from "./bot.mjs";

const fail = code => ({ ok: false, code });
const valid = pin => typeof pin === "string" && pinGate.isValidPin(pin);
const find = (state, user) => state.families.find(f => f.user === user);
export async function credential(pin, confirmPin) {
  if (!valid(pin) || pin !== confirmPin) return null;
  const salt = crypto.randomUUID();
  return { salt, hash: await pinGate.hashPin(pin, salt), ...pinGate.initialGateState() };
}

/** Only a positive unlock creates a short-lived capability. Its value never enters a snapshot. */
function grant(runtime, user, parent) {
  const token = crypto.randomUUID(), at = runtime.now();
  runtime.parentSessions.set(user, { token, at, salt: parent.salt });
  return { ok: true, token, expiresAt: at + pinGate.UNLOCK_TTL_MS };
}
const blocked = (state, now) => ({ ok: false, code: "locked", retryAfter: pinGate.lockoutSecondsLeft(state, now) });

export async function parentAction(runtime, user, input) {
  const row = find(runtime.state, user);
  if (!hasReadingConsent(row?.data.consent) || !input || typeof input !== "object") return fail("unavailable");
  const { action, pin, token, childId } = input;
  if (action === "setup") {
    // Legacy local demo families may enrol on their first parent visit, as in Bookser.
    if (row.parent?.hash || !valid(pin)) return fail("invalid");
    if (pin !== input.confirmPin) return fail("mismatch");
    const parent = await credential(pin, input.confirmPin);
    let result = fail("unavailable");
    runtime.commit(s => {
      const live = find(s, user);
      if (!hasReadingConsent(live?.data.consent) || live.parent?.hash || live.data.consent.givenAt !== row.data.consent.givenAt) return;
      live.parent = { ...live.parent, ...parent };
      result = { ok: true };
    });
    return result.ok ? grant(runtime, user, parent) : result;
  }
  if (action === "unlock") {
    if (!row.parent?.hash || !valid(pin)) return fail("invalid");
    if (pinGate.isLockedOut(row.parent, runtime.now())) return blocked(row.parent, runtime.now());
    const hashed = await pinGate.hashPin(pin, row.parent.salt);
    let result = fail("unavailable");
    runtime.commit(s => {
      const live = find(s, user)?.parent, now = runtime.now();
      if (!live || live.salt !== row.parent.salt || !hasReadingConsent(find(s, user)?.data.consent)) return;
      if (pinGate.isLockedOut(live, now)) { result = blocked(live, now); return; }
      if (hashed !== live.hash) {
        Object.assign(live, pinGate.registerFailure(live, now));
        result = pinGate.isLockedOut(live, now) ? blocked(live, now) : { ...fail("wrong"), remaining: pinGate.attemptsLeft(live) };
      } else {
        Object.assign(live, pinGate.registerSuccess());
        result = { ok: true };
      }
    });
    return result.ok ? grant(runtime, user, row.parent) : result;
  }
  const session = runtime.parentSessions.get(user);
  if (!session || session.token !== token || session.salt !== row.parent?.salt || !pinGate.isUnlockFresh(session.at, runtime.now())) return fail("expired");
  if (action === "lock") { runtime.parentSessions.delete(user); return { ok: true }; }
  if (action === "delete") {
    runtime.commit(s => {
      for (const job of s.pending) if (job.user === user || job.newUser === user) s.seen[job.key] = runtime.now();
      s.pending = s.pending.filter(job => job.user !== user && job.newUser !== user);
      s.families = s.families.filter(f => f.user !== user);
    });
    runtime.parentSessions.delete(user);
    return { ok: true, family: runtime.publicFamily(user) };
  }
  if (action === "weekly") {
    if (typeof input.enabled !== "boolean") return fail("invalid");
    runtime.commit(s => {
      const parent = find(s, user).parent;
      parent.weeklyReports = { ...parent.weeklyReports, enabled: input.enabled };
      if (!input.enabled) delete parent.weeklyNotice;
    });
    return { ok: true, weeklyEnabled: input.enabled };
  }
  const child = row.data.children.find(c => c.id === childId);
  if (!child) return fail("unavailable");
  const items = (row.parent.reviewItems ?? []).filter(item => item.childId === childId);
  if (action === "report") {
    if (row.parent.weeklyNotice) runtime.commit(s => { delete find(s, user).parent.weeklyNotice; });
    return { ok: true, report: weeklyReport(child, runtime.now(), row.data.lang),
      reviewItems: items.map(({ id, at }) => ({ id, at })), weeklyEnabled: row.parent.weeklyReports?.enabled === true };
  }
  if (action === "review" && items.some(item => item.id === input.itemId)) {
    runtime.commit(s => {
      const parent = find(s, user).parent;
      parent.reviewItems = parent.reviewItems.filter(item => item.childId !== childId || item.id !== input.itemId);
    });
    return { ok: true };
  }
  return fail("invalid");
}
