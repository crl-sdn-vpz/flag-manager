# 0002. Request ID in the error envelope

Date: 2026-11-20 / Status: accepted

Context: every API failure uses one error shape, and the template's convention is `{code, message, details}`. We also want each request traceable end to end. The API sets an `X-Request-Id` response header and writes the ID on its log lines. When someone reports a failure, they usually have the response body (a UI error, a pasted curl output, a client log) but not the headers. The convention has no field for the ID.

Options considered:
- Header only. Keeps the template shape unchanged. But the ID is easy to lose: most UIs and error reports show the body, not the headers.
- Inside `details` (`details.requestId`). No new top-level field. But `details` holds error-specific data (for example validation issues), so its contents would vary by error and clients would need to know where to look.
- A top-level `requestId` field. Every error carries the ID in the same place, and the generated client types it as required. But it departs from the template's three-field shape, and every error path must pass the ID in.

Decision: `{code, message, details, requestId}`, with `requestId` always present. It comes from Hono's built-in `hono/request-id` middleware, which runs first. That middleware accepts a well-formed incoming `X-Request-Id` (at most 255 characters, matching `[\w\-=]+`) and generates a UUID otherwise. The value is the same one sent in the response header and written on the log lines.

Consequences:
- A support conversation can go straight from an error message to its log lines.
- `errorBody` and `toErrorResponse` now take the request ID, so error helpers need the request context. Every path does this: the validation hook, `notFound` and `onError`.
- The generated `ErrorResponse` type gains `requestId`.
- Follow-up: propose to the hub that the Hono rule's error shape include `requestId` (`/capture-learning`).
