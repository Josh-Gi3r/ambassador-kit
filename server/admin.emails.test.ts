import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the admin email whitelist logic in isolation
describe("Admin email whitelist", () => {
  it("should parse comma-separated ADMIN_EMAILS env var correctly", () => {
    const raw = "admin@example.com,owner@example.com";
    const adminEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    expect(adminEmails).toContain("admin@example.com");
    expect(adminEmails).toContain("owner@example.com");
    expect(adminEmails).toHaveLength(2);
  });

  it("should match emails case-insensitively", () => {
    const raw = "admin@example.com,owner@example.com";
    const adminEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    expect(adminEmails.includes("Admin@Example.com".toLowerCase())).toBe(true);
    expect(adminEmails.includes("OWNER@EXAMPLE.COM".toLowerCase())).toBe(true);
  });

  it("should handle empty ADMIN_EMAILS gracefully", () => {
    const raw = "";
    const adminEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    expect(adminEmails).toHaveLength(0);
  });

  it("should handle whitespace around emails", () => {
    const raw = " admin@example.com , owner@example.com ";
    const adminEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    expect(adminEmails).toContain("admin@example.com");
    expect(adminEmails).toContain("owner@example.com");
  });
});
