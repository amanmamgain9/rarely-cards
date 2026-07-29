const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentryPromise: Promise<typeof import("@sentry/nextjs")> | null = null;

function loadSentry() {
  if (!dsn) return Promise.resolve(null);
  sentryPromise ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0.02,
      beforeSend(event) {
        delete event.user;
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          delete event.request.headers;
          delete event.request.query_string;
        }
        event.extra = undefined;
        return event;
      },
    });
    return Sentry;
  });
  return sentryPromise;
}

if (dsn) {
  const schedule = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => void loadSentry(), { timeout: 2500 });
    } else {
      setTimeout(() => void loadSentry(), 1500);
    }
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  void loadSentry().then((Sentry) =>
    Sentry?.captureRouterTransitionStart(url, navigationType),
  );
}

