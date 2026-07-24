export {};

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Setup: (options: {
        eventHandler: (event: { event: string; data?: unknown }) => void;
      }) => void;
      Refresh: () => void;
      Url: {
        Open: (url: string) => void;
        Close: () => void;
      };
    };
  }
}
