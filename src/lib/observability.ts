import "server-only";

import * as Sentry from "@sentry/nextjs";

type SafeContext = {
  operation: string;
  analysisId?: string;
  attempt?: number;
  code?: string;
};

export function reportServerError(error: unknown, context: SafeContext) {
  console.error(
    JSON.stringify({
      event: "server_operation_failed",
      ...context,
    }),
  );

  Sentry.withScope((scope) => {
    scope.setContext("rarely", context);
    scope.setLevel("error");
    Sentry.captureException(error);
  });
}

