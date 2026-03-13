import { extractApiErrorDetails, extractApiErrorMessage } from "@/lib/api-error";

describe("api error helpers", () => {
  it("prefers the backend detail message over the raw HTTP error text", async () => {
    const error = {
      response: new Response(JSON.stringify({ detail: "Need at least 2 completed signals to run synthesis (currently 1)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    };

    await expect(extractApiErrorMessage(error, "Request failed.")).resolves.toBe(
      "Need at least 2 completed signals to run synthesis (currently 1)."
    );
  });

  it("flattens FastAPI validation errors into a single message", async () => {
    const error = {
      response: new Response(
        JSON.stringify({
          detail: [{ msg: "field required" }, { msg: "value is not a valid UUID" }]
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" }
        }
      )
    };

    await expect(extractApiErrorDetails(error, "Request failed.")).resolves.toEqual({
      status: 422,
      message: "field required; value is not a valid UUID"
    });
  });
});
