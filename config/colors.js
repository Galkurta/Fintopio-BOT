const colors = {
  // Basic colors
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Message type colors
  success: "\x1b[92m", // Bright green
  error: "\x1b[91m", // Bright red
  warning: "\x1b[93m", // Bright yellow
  info: "\x1b[96m", // Bright cyan
  custom: "\x1b[95m", // Bright magenta

  // Task colors
  taskComplete: "\x1b[92m", // Bright green
  taskFailed: "\x1b[91m", // Bright red
  taskInProgress: "\x1b[96m", // Bright cyan
  taskWaiting: "\x1b[93m", // Bright yellow

  // Quack colors
  quackPositive: "\x1b[92m", // Bright green
  quackNegative: "\x1b[91m", // Bright red
  quackCount: "\x1b[95m", // Bright magenta
  quackDecibel: "\x1b[96m", // Bright cyan

  // Account colors
  accountName: "\x1b[95m", // Bright magenta
  accountInfo: "\x1b[96m", // Bright cyan
  accountWarning: "\x1b[93m", // Bright yellow

  // Faucet colors
  faucetSuccess: "\x1b[92m", // Bright green
  faucetError: "\x1b[91m", // Bright red
  faucetWait: "\x1b[93m", // Bright yellow
  faucetInfo: "\x1b[96m", // Bright cyan

  // Timer colors
  timerCount: "\x1b[96m", // Bright cyan
  timerWarn: "\x1b[93m", // Bright yellow

  // Banner colors
  bannerText: "\x1b[96m", // Bright cyan
  bannerBorder: "\x1b[36m", // Cyan
  bannerLinks: "\x1b[95m", // Bright magenta

  // Menu colors
  menuTitle: "\x1b[95m", // Bright magenta
  menuOption: "\x1b[96m", // Bright cyan
  menuBorder: "\x1b[36m", // Cyan
};

module.exports = colors;
