import "server-only";

import * as Sentry from "@sentry/nextjs";

type SafeContext = {
  operation: string;
  analysisId?: string;
  generationId?: string;
  attempt?: number;
  code?: string;
};

type ErrorDetails = {
  name?: string;
  message: string;
  status?: string | number;
  code?: string | number;
  stack?: string;
  cause?: Omit<ErrorDetails, "cause">;
};

function errorDetails(error: unknown): ErrorDetails {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }

  const candidate = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    code?: unknown;
    stack?: unknown;
    cause?: unknown;
  };
  const details: ErrorDetails = {
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : "Unknown server error",
  };

  if (typeof candidate.name === "string") details.name = candidate.name;
  if (
    typeof candidate.status === "string" ||
    typeof candidate.status === "number"
  ) {
    details.status = candidate.status;
  }
  if (
    typeof candidate.code === "string" ||
    typeof candidate.code === "number"
  ) {
    details.code = candidate.code;
  }
  if (typeof candidate.stack === "string") details.stack = candidate.stack;
  if (candidate.cause !== undefined) {
    const cause = errorDetails(candidate.cause);
    details.cause = {
      name: cause.name,
      message: cause.message,
      status: cause.status,
      code: cause.code,
      stack: cause.stack,
    };
  }

  return details;
}

export function reportServerError(error: unknown, context: SafeContext) {
  console.error(
    JSON.stringify({
      event: "server_operation_failed",
      ...context,
      ...(process.env.NODE_ENV === "development"
        ? { error: errorDetails(error) }
        : {}),
    }),
  );

  Sentry.withScope((scope) => {
    scope.setContext("rarely", context);
    scope.setLevel("error");
    Sentry.captureException(error);
  });
}
