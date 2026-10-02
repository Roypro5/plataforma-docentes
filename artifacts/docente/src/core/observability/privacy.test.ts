import { describe, expect, it } from "vitest";
import { sanitizeEvent } from "./privacy";

describe("Telemetry privacy boundary", () => {
  it("removes identity, request data, arbitrary logs and stack data", () => {
    const event = sanitizeEvent({
      event_id: "synthetic-event",
      message: "sensitive-fixture",
      exception: { values: [{ type: "sensitive-fixture", value: "sensitive-fixture", stacktrace: { frames: ["sensitive-fixture"] } }] },
      user: { email: "sensitive-fixture" },
      request: { headers: { authorization: "sensitive-fixture" } },
      extra: { form: "sensitive-fixture" },
      contexts: { trace: "sensitive-fixture" },
      breadcrumbs: [{ message: "sensitive-fixture" }],
      tags: { detail: "sensitive-fixture" },
    });
    expect(JSON.stringify(event)).not.toContain("sensitive-fixture");
    expect(event.event_id).toBe("synthetic-event");
  });
  it("handles events with no optional fields", () => {
    expect(sanitizeEvent({})).toMatchObject({});
  });
  it("does not mutate the original event", () => {
    const source = { message: "original", user: { id: "fixture" } };
    sanitizeEvent(source);
    expect(source.user.id).toBe("fixture");
    expect(source.message).toBe("original");
  });
});