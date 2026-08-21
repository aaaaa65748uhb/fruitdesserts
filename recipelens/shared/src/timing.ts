/**
 * One number both sides agree on.
 *
 * Every request that makes the server call a model has to outlast the server's
 * own budget for that call (AI_TOTAL_BUDGET_MS). When it does not, the client
 * abandons work the server is still doing and reports a failure for a request
 * that was about to succeed — which is exactly the bug this constant exists to
 * prevent recurring. The server's configuration is checked against it in
 * server/tests/budget.test.ts.
 */
export const AI_CLIENT_TIMEOUT_MS = 240_000;
