import { describe, expect, it } from "vitest";
import { searchParamsToQuery } from "@/lib/query";

describe("searchParamsToQuery", () => {
  it("returns an empty object for no parameters", () => {
    expect(searchParamsToQuery(new URLSearchParams(""))).toEqual({});
  });

  it("keeps single values as strings", () => {
    expect(searchParamsToQuery(new URLSearchParams("field=web&x=1"))).toEqual({
      field: "web",
      x: "1",
    });
  });

  it("keeps repeated keys as arrays, in order", () => {
    expect(searchParamsToQuery(new URLSearchParams("a=1&a=2&b=3&a=4"))).toEqual({
      a: ["1", "2", "4"],
      b: "3",
    });
  });

  it("keeps empty values and decoded characters", () => {
    expect(searchParamsToQuery(new URLSearchParams("q=&r=a%20b"))).toEqual({
      q: "",
      r: "a b",
    });
  });
});
