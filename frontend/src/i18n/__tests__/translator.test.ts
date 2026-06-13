import { get, interpolate, createTranslator } from "../translator";

describe("get", () => {
  const obj = { a: { b: { c: "leaf" }, n: 5 }, x: "top" };
  it("reads nested leaf string", () => {
    expect(get(obj, "a.b.c")).toBe("leaf");
  });
  it("reads top-level value", () => {
    expect(get(obj, "x")).toBe("top");
  });
  it("returns undefined for missing path", () => {
    expect(get(obj, "a.b.z")).toBeUndefined();
  });
  it("returns undefined when intermediate is not an object", () => {
    expect(get(obj, "x.y")).toBeUndefined();
  });
});

describe("interpolate", () => {
  it("replaces {{name}} with value", () => {
    expect(interpolate("hello {{name}}", { name: "world" })).toBe("hello world");
  });
  it("handles multiple placeholders and numbers", () => {
    expect(interpolate("{{a}}/{{b}}", { a: 1, b: 2 })).toBe("1/2");
  });
  it("leaves unknown placeholders intact when no vars", () => {
    expect(interpolate("hi {{name}}")).toBe("hi {{name}}");
  });
  it("leaves unknown placeholders intact when var missing", () => {
    expect(interpolate("hi {{name}}", { other: "x" })).toBe("hi {{name}}");
  });
});

describe("createTranslator", () => {
  const dict = { greet: "hi {{name}}", bye: "bye", nested: { ok: "ok" } };
  const { t } = createTranslator(dict);

  it("translates a leaf key", () => {
    expect(t("bye")).toBe("bye");
  });
  it("translates a nested key", () => {
    expect(t("nested.ok")).toBe("ok");
  });
  it("interpolates vars", () => {
    expect(t("greet", { name: "ann" })).toBe("hi ann");
  });
  it("returns the path itself for missing key", () => {
    expect(t("nope" as never)).toBe("nope");
  });
  it("warns in dev for missing key", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    t("missing" as never);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("missing translation key"));
    spy.mockRestore();
  });
});
