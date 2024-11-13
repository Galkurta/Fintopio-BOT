const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { DateTime } = require("luxon");
const displayBanner = require("./config/banner");
const logger = require("./config/logger");
const colors = require("./config/colors");
const FakeDataGenerator = require("./config/fakeData");

// =================== Configuration Constants ===================
const API_CONFIG = {
  BASE_URL: "https://fintopio-tg.fintopio.com/api",
  ENDPOINTS: {
    AUTH: "/auth/telegram",
    PROFILE: "/referrals/data",
    DAILY_CHECKIN: "/daily-checkins",
    FARMING: {
      STATE: "/farming/state",
      FARM: "/farming/farm",
      CLAIM: "/farming/claim",
    },
    DIAMOND: {
      STATE: "/clicker/diamond/state",
      COMPLETE: "/clicker/diamond/complete",
    },
    SPACE_TAPPER: {
      SETTINGS: "/hold/space-tappers/game-settings",
      SUBMIT_RESULT: "/hold/space-tappers/add-new-result",
    },
    TASKS: {
      LIST: "/hold/tasks",
      START: (id) => `/hold/tasks/${id}/start`,
      CLAIM: (id) => `/hold/tasks/${id}/claim`,
    },
    LEADERBOARD: {
      ALL_TIME: "/hold/leaderboard?range=all",
      WEEK: "/hold/leaderboard?range=week",
      MONTH: "/hold/leaderboard?range=month",
    },
    INVENTORY: {
      GEMS: "/hold/inventory/gems",
    },
  },
  DEFAULT_HEADERS: {
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://fintopio-tg.fintopio.com/",
    "Sec-Ch-Ua":
      '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
  },
};

const TIME_CONFIG = {
  SPACE_TAPPER: {
    MIN_GAMES: 1,
    MAX_GAMES: 10,
    PLAY_TIME: {
      MIN: 20,
      MAX: 45,
    },
    WAIT_TIME: {
      MIN: 10,
      MAX: 60,
    },
    BETWEEN_GAMES: {
      MIN: 10,
      MAX: 60,
    },
    SCORE: {
      MIN_PERCENT: 70,
      MAX_PERCENT: 95,
    },
  },
  RANDOM_DELAY: {
    MIN: 10,
    MAX: 60,
    NOISE: 2,
  },
};

const FORMATTING = {
  DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
  BORDERS: {
    HEADER: "━━━━━━━━━",
    SECTION: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  },
};

class Fintopio {
  constructor() {
    this.config = {
      baseUrl: API_CONFIG.BASE_URL,
      headers: API_CONFIG.DEFAULT_HEADERS,
    };

    this.state = {
      firstAccountFinishTime: null,
    };
  }

  // =================== Utility Methods ===================
  async waitWithCountdown(seconds, msg = "continue", showCountdown = true) {
    const formatTime = (secs) => {
      const hours = Math.floor(secs / 3600);
      const minutes = Math.floor((secs % 3600) / 60);
      const remainingSeconds = Math.floor(secs % 60);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const endTime = DateTime.now().plus({ seconds });
    logger.info(`${colors.timerCount}Waiting ${msg}...${colors.reset}`);

    while (DateTime.now() < endTime) {
      const remaining = endTime.diff(DateTime.now()).as("seconds");
      if (remaining <= 0) break;

      if (showCountdown) {
        process.stdout.write(
          `${colors.timerCount}\rTime remaining: ${formatTime(remaining)}${
            colors.reset
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (showCountdown) {
      process.stdout.write("\r\x1b[K"); // Clear the line
    }
  }

  generateRandomTime() {
    const { MIN, MAX, NOISE } = TIME_CONFIG.RANDOM_DELAY;
    const baseTime = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
    const noise = Math.random() < 0.5 ? -NOISE : NOISE;
    return Math.max(MIN, Math.min(MAX, baseTime + noise));
  }

  // =================== Authentication Methods ===================
  async auth(userData) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.AUTH}?${userData}`,
        { headers: { ...this.config.headers, Webapp: "true" } }
      );
      return response.data.token;
    } catch (error) {
      logger.error(
        `${colors.error}Authentication error: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  // =================== Profile Methods ===================
  async getProfile(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.PROFILE}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            Webapp: "false, true",
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching profile: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  // =================== Check-in Methods ===================
  async checkInDaily(token) {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.DAILY_CHECKIN}`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const { dailyReward, totalDays } = response.data;
      logger.success(
        `${colors.taskComplete}Daily check-in successful!${colors.reset}`
      );
      logger.info(
        `${colors.faucetSuccess}Daily Reward: ${dailyReward}${colors.reset}`
      );
      logger.info(
        `${colors.accountInfo}Total Days Check-in: ${totalDays}${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Daily check-in error: ${error.message}${colors.reset}`
      );
    }
  }

  // =================== Farming Methods ===================
  async getFarmingState(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.FARMING.STATE}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching farming state: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  async handleFarming(token) {
    const farmingState = await this.getFarmingState(token);
    if (!farmingState) return;

    if (farmingState.state === "idling") {
      const startDelay = this.generateRandomTime();
      logger.info(
        `${colors.timerWarn}Generated random wait time: ${startDelay} seconds${colors.reset}`
      );
      await this.waitWithCountdown(startDelay, "start Farming", false);
      await this.startFarming(token);
    } else if (["farmed", "farming"].includes(farmingState.state)) {
      const finishTimestamp = farmingState.timings?.finish;
      if (finishTimestamp) {
        await this.handleFarmingCompletion(token, finishTimestamp);
      }
    }
  }

  async handleFarmingCompletion(token, finishTimestamp) {
    const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
      DateTime.DATETIME_FULL
    );
    logger.info(
      `${colors.timerCount}Farming completion time: ${finishTime}${colors.reset}`
    );

    const currentTime = DateTime.now().toMillis();
    if (currentTime > finishTimestamp) {
      const claimDelay = this.generateRandomTime();
      logger.info(
        `${colors.timerWarn}Generated random wait time: ${claimDelay} seconds${colors.reset}`
      );
      await this.waitWithCountdown(claimDelay, "claim Farming", false);
      await this.claimFarming(token);

      const startDelay = this.generateRandomTime();
      logger.info(
        `${colors.timerWarn}Generated random wait time: ${startDelay} seconds${colors.reset}`
      );
      await this.waitWithCountdown(startDelay, "start new Farming", false);
      await this.startFarming(token);
    }
  }

  async startFarming(token) {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.FARMING.FARM}`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const finishTimestamp = response.data.timings?.finish;
      if (finishTimestamp) {
        const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
          DateTime.DATETIME_FULL
        );
        logger.success(`${colors.taskComplete}Starting farm...${colors.reset}`);
        logger.info(
          `${colors.timerCount}Farming completion time: ${finishTime}${colors.reset}`
        );
      }
    } catch (error) {
      logger.error(
        `${colors.error}Error starting farming: ${error.message}${colors.reset}`
      );
    }
  }

  async claimFarming(token) {
    try {
      await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.FARMING.CLAIM}`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.success(
        `${colors.taskComplete}Farm claimed successfully!${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Error claiming farm: ${error.message}${colors.reset}`
      );
    }
  }

  // =================== Space Tapper Methods ===================
  async getSpaceTapperSettings(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.SPACE_TAPPER.SETTINGS}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching space tapper settings: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  async submitSpaceTapperResult(token, score = 0) {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.SPACE_TAPPER.SUBMIT_RESULT}`,
        { score },
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const actualReward = response.data.actualReward;
      logger.success(
        `${colors.taskComplete}Space Tapper completed with score: ${score}${colors.reset}`
      );
      logger.info(
        `${colors.faucetSuccess}Received reward: ${actualReward} diamonds${colors.reset}`
      );
      return true;
    } catch (error) {
      logger.error(
        `${colors.error}Error submitting space tapper result: ${error.message}${colors.reset}`
      );
      return false;
    }
  }

  async handleSpaceTapper(token) {
    try {
      const settings = await this.getSpaceTapperSettings(token);
      if (!settings) return;

      const gamesToPlay =
        Math.floor(Math.random() * TIME_CONFIG.SPACE_TAPPER.MAX_GAMES) +
        TIME_CONFIG.SPACE_TAPPER.MIN_GAMES;
      logger.info(
        `${colors.taskInProgress}Will play Space Tapper ${gamesToPlay} times${colors.reset}`
      );

      for (let i = 0; i < gamesToPlay; i++) {
        const startDelay =
          Math.floor(
            Math.random() *
              (TIME_CONFIG.SPACE_TAPPER.WAIT_TIME.MAX -
                TIME_CONFIG.SPACE_TAPPER.WAIT_TIME.MIN +
                1)
          ) + TIME_CONFIG.SPACE_TAPPER.WAIT_TIME.MIN;
        logger.info(
          `${colors.taskInProgress}Game ${
            i + 1
          }/${gamesToPlay} Waiting ${startDelay} seconds before playing...${
            colors.reset
          }`
        );
        await this.waitWithCountdown(startDelay, "start Space Tapper", false);

        const playTime =
          Math.floor(
            Math.random() *
              (TIME_CONFIG.SPACE_TAPPER.PLAY_TIME.MAX -
                TIME_CONFIG.SPACE_TAPPER.PLAY_TIME.MIN +
                1)
          ) + TIME_CONFIG.SPACE_TAPPER.PLAY_TIME.MIN;
        logger.info(
          `${colors.timerCount}Playing Space Tapper for ${playTime} seconds...${colors.reset}`
        );
        await this.waitWithCountdown(playTime, "complete Space Tapper", false);

        const score = this.generateRandomScore(settings.maxScore);
        await this.submitSpaceTapperResult(token, score);

        if (i < gamesToPlay - 1) {
          const betweenGamesDelay =
            Math.floor(
              Math.random() *
                (TIME_CONFIG.SPACE_TAPPER.BETWEEN_GAMES.MAX -
                  TIME_CONFIG.SPACE_TAPPER.BETWEEN_GAMES.MIN +
                  1)
            ) + TIME_CONFIG.SPACE_TAPPER.BETWEEN_GAMES.MIN;
          logger.info(
            `${colors.timerWarn}Waiting ${betweenGamesDelay} seconds before next game...${colors.reset}`
          );
          await this.waitWithCountdown(
            betweenGamesDelay,
            "next Space Tapper game",
            false
          );
        }
      }
    } catch (error) {
      logger.error(
        `${colors.error}Error in Space Tapper handler: ${error.message}${colors.reset}`
      );
    }
  }

  generateRandomScore(maxScore) {
    const { MIN_PERCENT, MAX_PERCENT } = TIME_CONFIG.SPACE_TAPPER.SCORE;
    const percentage =
      Math.random() * (MAX_PERCENT - MIN_PERCENT) + MIN_PERCENT;
    return Math.floor((maxScore * percentage) / 100);
  }

  // =================== Task Methods ===================
  async handleTasks(token) {
    const taskState = await this.getTask(token);
    if (!taskState) return;

    const filteredTasks = taskState.tasks.filter(
      (task) =>
        !task.slug.includes("telegram-boost") &&
        !(task.type === "social" && task.subtype === "boost")
    );

    for (const item of filteredTasks) {
      if (item.status === "available") {
        await this.startTask(token, item.id, item.slug);
      } else if (item.status === "verified") {
        await this.claimTask(token, item.id, item.slug, item.rewardAmount);
      } else if (item.status === "in-progress") {
        continue;
      } else {
        logger.info(
          `${colors.taskInProgress}Verifying task ${item.slug}!${colors.reset}`
        );
      }
    }
  }

  async getTask(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.TASKS.LIST}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching task state: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  async startTask(token, taskId, slug) {
    try {
      await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.TASKS.START(taskId)}`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
            origin: "https://fintopio-tg.fintopio.com",
          },
        }
      );
      logger.success(
        `${colors.taskComplete}Starting task ${slug}!${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Error starting task: ${error.message}${colors.reset}`
      );
    }
  }

  async claimTask(token, taskId, slug, rewardAmount) {
    try {
      await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.TASKS.CLAIM(taskId)}`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
            origin: "https://fintopio-tg.fintopio.com",
          },
        }
      );
      logger.success(
        `${colors.taskComplete}Task ${slug} complete, reward ${colors.faucetSuccess}${rewardAmount} diamonds${colors.reset}!${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Error claiming task: ${error.message}${colors.reset}`
      );
    }
  }

  // =================== Diamond Methods ===================
  async handleDiamonds(token, isFirstAccount) {
    try {
      const diamond = await this.getDiamondInfo(token);
      if (!diamond) return;

      if (diamond.state === "available") {
        const randomWaitTime = this.generateRandomTime();
        logger.info(
          `${colors.timerWarn}Generated random wait time: ${randomWaitTime} seconds${colors.reset}`
        );

        await this.waitWithCountdown(randomWaitTime, "claim Diamonds", false);
        await this.claimDiamond(
          token,
          diamond.diamondNumber,
          diamond.settings.totalReward
        );
      } else if (diamond.timings?.nextAt) {
        const nextDiamondTime = DateTime.fromMillis(
          diamond.timings.nextAt
        ).toLocaleString(DateTime.DATETIME_FULL);
        logger.info(
          `${colors.timerCount}Next Diamond time: ${nextDiamondTime}${colors.reset}`
        );

        if (isFirstAccount) {
          this.state.firstAccountFinishTime = diamond.timings.nextAt;
        }
      }
    } catch (error) {
      logger.error(
        `${colors.error}Error processing diamond info: ${error.message}${colors.reset}`
      );
    }
  }

  async getDiamondInfo(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.DIAMOND.STATE}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data?.state ? response.data : null;
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching diamond state: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  async claimDiamond(token, diamondNumber, totalReward) {
    try {
      await axios.post(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.DIAMOND.COMPLETE}`,
        { diamondNumber },
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.success(
        `${colors.faucetSuccess}Success claim ${totalReward} diamonds!${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Error claiming Diamond: ${error.message}${colors.reset}`
      );
    }
  }

  // =================== Leaderboard Methods ===================
  async getLeaderboards(token) {
    try {
      const [allTime, week, month] = await Promise.all([
        axios.get(
          `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.LEADERBOARD.ALL_TIME}`,
          {
            headers: {
              ...this.config.headers,
              Authorization: `Bearer ${token}`,
            },
          }
        ),
        axios.get(
          `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.LEADERBOARD.WEEK}`,
          {
            headers: {
              ...this.config.headers,
              Authorization: `Bearer ${token}`,
            },
          }
        ),
        axios.get(
          `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.LEADERBOARD.MONTH}`,
          {
            headers: {
              ...this.config.headers,
              Authorization: `Bearer ${token}`,
            },
          }
        ),
      ]);

      return {
        allTime: allTime.data,
        week: week.data,
        month: month.data,
      };
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching leaderboards: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  // =================== Inventory Methods ===================
  async getGemsInventory(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}${API_CONFIG.ENDPOINTS.INVENTORY.GEMS}`,
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data?.gems || [];
    } catch (error) {
      logger.error(
        `${colors.error}Error fetching gems inventory: ${error.message}${colors.reset}`
      );
      return null;
    }
  }

  async displayGemsInventory(token) {
    const gems = await this.getGemsInventory(token);
    if (!gems) return null;

    return gems
      .filter((gem) => parseInt(gem.count) > 0)
      .map((gem) => ({
        ...gem,
        name: this.formatGemName(gem.name),
        rarity: this.formatGemRarity(gem.rarity),
      }));
  }

  // =================== Formatting Methods ===================
  formatGemRarity(rarity) {
    return rarity.toUpperCase();
  }

  formatGemName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  formatUserAgent(userAgent) {
    const match = userAgent.match(/Android [^;]+; ([^)]+)/);
    if (match) {
      return match[0];
    }
    return userAgent.substring(0, 30) + "...";
  }

  formatLeaderboardInfo(position, level, type) {
    const formattedPosition = this.formatPosition(position);
    return level
      ? `${type}: ${formattedPosition} | Level: ${level}`
      : `${type}: ${formattedPosition}`;
  }

  formatPosition(position) {
    if (position >= 1000000) {
      return (position / 1000000).toFixed(1) + "M";
    } else if (position >= 1000) {
      return (position / 1000).toFixed(1) + "K";
    }
    return position.toString();
  }

  formatNumber(number) {
    const num = parseFloat(number).toFixed(1);
    const [integerPart, decimalPart] = num.split(".");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${formattedInteger}.${decimalPart}`;
  }

  // =================== Helper Methods ===================
  extractFirstName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.first_name || "Unknown";
    } catch (error) {
      logger.error(
        `${colors.error}Error extracting first_name: ${error.message}${colors.reset}`
      );
      return "Unknown";
    }
  }

  extractLastName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.last_name || "";
    } catch (error) {
      logger.error(
        `${colors.error}Error extracting last_name: ${error.message}${colors.reset}`
      );
      return "";
    }
  }

  calculateWaitTime(firstAccountFinishTime) {
    if (!firstAccountFinishTime) return 5000;

    const now = DateTime.now();
    const finishTime = DateTime.fromMillis(firstAccountFinishTime);
    const duration = finishTime.diff(now);

    return Math.max(duration.as("milliseconds"), 5000);
  }

  // =================== Main Process ===================
  async processAccount(userData, accountIndex) {
    const fakeData = FakeDataGenerator.generateFakeData();
    this.config = {
      baseUrl: API_CONFIG.BASE_URL,
      headers: fakeData.headers,
    };

    const first_name = this.extractFirstName(userData);
    const last_name = this.extractLastName(userData);

    // Header section
    logger.info(
      `${colors.accountName}[ Account ${
        accountIndex + 1
      } | ${first_name} ${last_name} ]${colors.reset}`
    );
    logger.info(
      `${colors.menuBorder}${FORMATTING.BORDERS.HEADER} Device Info ${FORMATTING.BORDERS.HEADER}${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> Model: ${fakeData.deviceInfo.deviceModel}${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> Platform: ${fakeData.deviceInfo.platform}${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> Screen: ${fakeData.deviceInfo.screenResolution}${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> GPU: ${fakeData.deviceInfo.webGLVendor}${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> Fingerprint: ${fakeData.fingerprint.substring(
        0,
        8
      )}...${colors.reset}`
    );
    logger.info(
      `${colors.accountInfo}> UA: ${this.formatUserAgent(fakeData.userAgent)}${
        colors.reset
      }`
    );
    logger.info(
      `${colors.menuBorder}${FORMATTING.BORDERS.SECTION}${colors.reset}`
    );

    const token = await this.auth(userData);
    if (!token) return;

    logger.success(`${colors.taskComplete}Login successful!${colors.reset}`);

    const [profile, leaderboards] = await Promise.all([
      this.getProfile(token),
      this.getLeaderboards(token),
    ]);

    if (!profile) return;

    // Account Info section
    logger.info(
      `${colors.accountInfo}Balance: ${this.formatNumber(profile.balance)}${
        colors.reset
      }`
    );

    // Gems section
    const gems = await this.displayGemsInventory(token);
    if (gems) {
      logger.info(
        `${colors.menuBorder}${FORMATTING.BORDERS.HEADER} Gems Info ${FORMATTING.BORDERS.HEADER}${colors.reset}`
      );
      gems.forEach((gem) => {
        logger.info(
          `${colors.accountInfo}> ${gem.name} | Rarity: ${gem.rarity} | Count: ${gem.count}${colors.reset}`
        );
      });
      logger.info(
        `${colors.menuBorder}${FORMATTING.BORDERS.SECTION}${colors.reset}`
      );
    }

    // Leaderboard section
    if (leaderboards) {
      logger.info(
        `${colors.menuBorder}${FORMATTING.BORDERS.HEADER} Leaderboards ${FORMATTING.BORDERS.HEADER}${colors.reset}`
      );

      const allTimeData = leaderboards.allTime?.user;
      if (allTimeData?.position) {
        logger.info(
          `${colors.accountInfo}${this.formatLeaderboardInfo(
            allTimeData.position,
            allTimeData.level?.name,
            "Referral Titans"
          )}${colors.reset}`
        );
      }

      const weekData = leaderboards.week?.user;
      if (weekData?.position) {
        logger.info(
          `${colors.accountInfo}${this.formatLeaderboardInfo(
            weekData.position,
            weekData.level?.name,
            "Solo Legends (Week)"
          )}${colors.reset}`
        );
      }

      const monthData = leaderboards.month?.user;
      if (monthData?.position) {
        logger.info(
          `${colors.accountInfo}${this.formatLeaderboardInfo(
            monthData.position,
            monthData.level?.name,
            "Solo Legends (Month)"
          )}${colors.reset}`
        );
      }
      logger.info(
        `${colors.menuBorder}${FORMATTING.BORDERS.SECTION}${colors.reset}`
      );
    }

    // Daily Activities section
    logger.info(
      `${colors.menuBorder}${FORMATTING.BORDERS.HEADER} Daily Activities ${FORMATTING.BORDERS.HEADER}${colors.reset}`
    );

    // Do daily check-in first
    await this.checkInDaily(token);

    // Then handle other activities in parallel
    await Promise.all([
      this.handleDiamonds(token, accountIndex === 0),
      this.handleFarming(token),
      this.handleTasks(token),
      this.handleSpaceTapper(token),
    ]);

    logger.info(
      `${colors.menuBorder}${FORMATTING.BORDERS.SECTION}${colors.reset}`
    );
  }

  async main() {
    displayBanner();

    while (true) {
      const dataFile = path.join(__dirname, "data.txt");
      const data = await fs.readFile(dataFile, "utf8");
      const users = data.split("\n").filter(Boolean);

      for (let i = 0; i < users.length; i++) {
        await this.processAccount(users[i], i);
      }

      const waitTime = this.calculateWaitTime(
        this.state.firstAccountFinishTime
      );
      await this.waitWithCountdown(Math.floor(waitTime / 1000));
    }
  }
}

// Bootstrap
if (require.main === module) {
  const fintopio = new Fintopio();
  fintopio.main().catch((err) => {
    logger.error(`${colors.error}${err}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = Fintopio;
