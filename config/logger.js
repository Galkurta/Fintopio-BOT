const winston = require("winston");
const colors = require("./colors");

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    success: 3,
    custom: 4,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "cyan",
    success: "green",
    custom: "magenta",
  },
};

const padLevel = (level) => {
  const padLength = 7;
  return level.toUpperCase().padEnd(padLength);
};

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message }) => {
    const levelColor = {
      error: colors.error,
      warn: colors.warning,
      info: colors.info,
      success: colors.success,
      custom: colors.custom,
    };
    return `${colors.dim}${timestamp}${colors.reset} | ${
      levelColor[level]
    }${padLevel(level)}${colors.reset} | ${message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: "custom",
  format: customFormat,
  transports: [new winston.transports.Console()],
});

winston.addColors(customLevels.colors);

module.exports = logger;
