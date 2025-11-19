export type CoreLogger = {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export const createNoopLogger = (): CoreLogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});
