type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const resolveLevel = (): LogLevel => {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
};

const currentLevel = resolveLevel();

const formatMessage = (level: LogLevel, message: string) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
};

const shouldLog = (level: LogLevel) => levelPriority[level] >= levelPriority[currentLevel];

export const logger = {
  debug: (msg: string) => {
    if (shouldLog("debug")) console.debug(formatMessage("debug", msg));
  },
  info: (msg: string) => {
    if (shouldLog("info")) console.info(formatMessage("info", msg));
  },
  warn: (msg: string) => {
    if (shouldLog("warn")) console.warn(formatMessage("warn", msg));
  },
  error: (msg: string) => {
    if (shouldLog("error")) console.error(formatMessage("error", msg));
  },
};
