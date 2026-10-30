import { test } from "node:test";
import assert from "node:assert/strict";
import { hostName, rejectReason } from "./local-only";

const req = (method: string, host: string | null, origin: string | null = null) => rejectReason({ method, host, origin });

test("host names with ports and IPv6", () => {
  assert.equal(hostName("LocalHost:3000"), "localhost");
  assert.equal(hostName("[::1]:3000"), "[::1]");
  assert.equal(hostName("127.0.0.1"), "127.0.0.1");
});

test("only local host names are served", () => {
  assert.equal(req("GET", "localhost:3000"), null);
  assert.equal(req("GET", "127.0.0.1:3000"), null);
  assert.equal(req("GET", "[::1]:3000"), null);
  assert.equal(req("GET", "evil.example:3000"), "Unknown host"); // DNS rebinding
  assert.equal(req("GET", "192.168.1.20:3000"), "Unknown host"); // another device on the network
  assert.equal(req("GET", null), "Unknown host");
});

test("writes must come from a local page", () => {
  assert.equal(req("POST", "localhost:3000", "http://localhost:3000"), null);
  assert.equal(req("POST", "localhost:3000", "http://127.0.0.1:3000"), null);
  assert.equal(req("POST", "localhost:3000", null), null); // curl / scripts on this machine
  assert.equal(req("POST", "localhost:3000", "https://evil.example"), "Cross-site request");
  assert.equal(req("POST", "localhost:3000", "null"), "Cross-site request"); // sandboxed iframe
  assert.equal(req("DELETE", "localhost:3000", "not a url"), "Bad origin");
  assert.equal(req("GET", "localhost:3000", "https://evil.example"), null); // reads are covered by the host check
});

test("extra hosts can be allowed explicitly", () => {
  process.env.LEDGER_ALLOWED_HOSTS = "ledger.test, my-pc";
  try {
    assert.equal(req("GET", "ledger.test:3000"), null);
    assert.equal(req("POST", "my-pc:3000", "http://my-pc:3000"), null);
  } finally {
    delete process.env.LEDGER_ALLOWED_HOSTS;
  }
});
