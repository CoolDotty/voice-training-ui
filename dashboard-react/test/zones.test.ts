import { describe, expect, it } from "vitest";
import { isReliableF3 } from "../src/zones";

describe("isReliableF3", () => {
  it("accepts plausible F3 values and rejects outliers", () => {
    expect(isReliableF3(1800, 2900)).toBe(true);
    expect(isReliableF3(1800, 3465)).toBe(false);
    expect(isReliableF3(2500, 2600)).toBe(false);
    expect(isReliableF3(1800, null)).toBe(false);
  });
});
