// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleComplaintRequest } from "./handler.mjs";

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    end(value = "") {
      this.body = String(value);
    },
    headers
  };
}

function validPayload(overrides = {}) {
  return {
    subject: "ระบบไอที",
    name: "สมชาย ใจดี",
    email: "somchai@example.com",
    phone: "081-234-5678",
    complaint: "ทดสอบรายละเอียดเรื่องร้องเรียน",
    ua: "vitest",
    files: [
      {
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        data: Buffer.from("%PDF-1.7\nfixture").toString("base64")
      }
    ],
    ...overrides
  };
}

function request(body, headers = {}) {
  return {
    method: "POST",
    headers: {
      host: "www.rcat.ac.th",
      origin: "https://www.rcat.ac.th",
      "x-forwarded-proto": "https",
      ...headers
    },
    body
  };
}

const env = {
  COMPLAINT_API_URI: "https://script.google.com/macros/s/fixture-deployment-id/exec"
};

describe("complaint proxy", () => {
  it("normalizes and forwards a validated complaint", async () => {
    const response = createResponse();
    const fetchImpl = vi.fn(async (_url, init) => {
      const forwarded = JSON.parse(String(init.body));
      expect(forwarded.phone).toBe("0812345678");
      expect(forwarded.files).toHaveLength(1);
      return new Response(JSON.stringify({ ok: true, message: "received" }), { status: 200 });
    });

    await handleComplaintRequest(request(validPayload()), response, { env, fetchImpl });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, message: "received" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a file whose declared type does not match its content", async () => {
    const response = createResponse();
    const fetchImpl = vi.fn();

    await handleComplaintRequest(
      request(
        validPayload({
          files: [
            {
              fileName: "fake.pdf",
              mimeType: "application/pdf",
              data: Buffer.from("not a pdf").toString("base64")
            }
          ]
        })
      ),
      response,
      { env, fetchImpl }
    );

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects cross-origin browser submissions", async () => {
    const response = createResponse();
    const fetchImpl = vi.fn();

    await handleComplaintRequest(request(validPayload(), { origin: "https://attacker.example" }), response, {
      env,
      fetchImpl
    });

    expect(response.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
