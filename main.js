const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { DateTime } = require("luxon");
const printBanner = require("./config/banner");
const logger = require("./config/logger");
const FakeDataGenerator = require("./config/fakeData");

class Fintopio {
  constructor() {
    // API Configuration
    this.config = {
      baseUrl: "https://fintopio-tg.fintopio.com/api",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://fintopio-tg.fintopio.com/",
        "Sec-Ch-Ua":
          '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": '"Android"',
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
      },
    };

    // State Management
    this.state = {
      firstAccountFinishTime: null,
    };
  }

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

    logger.info(`Waiting ${msg}...`);
    while (DateTime.now() < endTime) {
      const remaining = endTime.diff(DateTime.now()).as("seconds");
      if (remaining <= 0) break;

      if (showCountdown) {
        process.stdout.write(`\rTime remaining: ${formatTime(remaining)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (showCountdown) {
      process.stdout.write("\r\x1b[K"); // Clear the line
    }
  }

  // Authentication Methods
  async auth(userData) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/auth/telegram?${userData}`,
        { headers: { ...this.config.headers, Webapp: "true" } }
      );
      return response.data.token;
    } catch (error) {
      logger.error(`Authentication error: ${error.message}`);
      return null;
    }
  }

  // Profile Methods
  async getProfile(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/referrals/data`,
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
      logger.error(`Error fetching profile: ${error.message}`);
      return null;
    }
  }

  // Check-in Methods
  async checkInDaily(token) {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/daily-checkins`,
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
      logger.info("Daily check-in successful!");
      logger.info(`Daily Reward: ${dailyReward}`);
      logger.info(`Total Days Check-in: ${totalDays}`);
    } catch (error) {
      logger.error(`Daily check-in error: ${error.message}`);
    }
  }

  // Farming Methods
  async handleFarming(token) {
    const farmingState = await this.getFarmingState(token);
    if (!farmingState) return;

    if (farmingState.state === "idling") {
      await this.startFarming(token);
    } else if (["farmed", "farming"].includes(farmingState.state)) {
      const finishTimestamp = farmingState.timings.finish;
      if (finishTimestamp) {
        await this.handleFarmingCompletion(token, finishTimestamp);
      }
    }
  }

  async getFarmingState(token) {
    try {
      const response = await axios.get(`${this.config.baseUrl}/farming/state`, {
        headers: { ...this.config.headers, Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching farming state: ${error.message}`);
      return null;
    }
  }

  async handleFarmingCompletion(token, finishTimestamp) {
    const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
      DateTime.DATETIME_FULL
    );
    logger.info(`Farming completion time: ${finishTime}`);

    const currentTime = DateTime.now().toMillis();
    if (currentTime > finishTimestamp) {
      await this.claimFarming(token);
      await this.startFarming(token);
    }
  }

  async startFarming(token) {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/farming/farm`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const finishTimestamp = response.data.timings.finish;
      if (finishTimestamp) {
        const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
          DateTime.DATETIME_FULL
        );
        logger.info("Starting farm...");
        logger.info(`Farming completion time: ${finishTime}`);
      }
    } catch (error) {
      logger.error(`Error starting farming: ${error.message}`);
    }
  }

  async claimFarming(token) {
    try {
      await axios.post(
        `${this.config.baseUrl}/farming/claim`,
        {},
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info("Farm claimed successfully!");
    } catch (error) {
      logger.error(`Error claiming farm: ${error.message}`);
    }
  }

  // Diamond Methods
  async handleDiamonds(token, isFirstAccount) {
    try {
      const diamond = await this.getDiamondInfo(token);
      if (!diamond) return;

      if (diamond.state === "available") {
        const randomWaitTime = this.generateRandomTime();
        logger.info(`Generated random wait time: ${randomWaitTime} seconds`);

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
        logger.info(`Next Diamond time: ${nextDiamondTime}`);

        if (isFirstAccount) {
          this.state.firstAccountFinishTime = diamond.timings.nextAt;
        }
      }
    } catch (error) {
      logger.error(`Error processing diamond info: ${error.message}`);
    }
  }

  async getDiamondInfo(token) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/clicker/diamond/state`,
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
      logger.error(`Error fetching diamond state: ${error.message}`);
      return null;
    }
  }

  async claimDiamond(token, diamondNumber, totalReward) {
    try {
      await axios.post(
        `${this.config.baseUrl}/clicker/diamond/complete`,
        { diamondNumber },
        {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(`Success claim ${totalReward} diamonds!`);
    } catch (error) {
      logger.error(`Error claiming Diamond: ${error.message}`);
    }
  }

  // Task Methods
  async handleTasks(token) {
    const taskState = await this.getTask(token);
    if (!taskState) return;

    for (const item of taskState.tasks) {
      if (item.status === "available") {
        await this.startTask(token, item.id, item.slug);
      } else if (item.status === "verified") {
        await this.claimTask(token, item.id, item.slug, item.rewardAmount);
      } else if (item.status === "in-progress") {
        continue;
      } else {
        logger.info(`Verifying task ${item.slug}!`);
      }
    }
  }

  async getTask(token) {
    try {
      const response = await axios.get(`${this.config.baseUrl}/hold/tasks`, {
        headers: {
          ...this.config.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching task state: ${error.message}`);
      return null;
    }
  }

  async startTask(token, taskId, slug) {
    try {
      await axios.post(
        `${this.config.baseUrl}/hold/tasks/${taskId}/start`,
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
      logger.info(`Starting task ${slug}!`);
    } catch (error) {
      logger.error(`Error starting task: ${error.message}`);
    }
  }

  async claimTask(token, taskId, slug, rewardAmount) {
    try {
      await axios.post(
        `${this.config.baseUrl}/hold/tasks/${taskId}/claim`,
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
      logger.info(`Task ${slug} complete, reward ${rewardAmount} diamonds!`);
    } catch (error) {
      logger.error(`Error claiming task: ${error.message}`);
    }
  }

  async getLeaderboards(token) {
    try {
      const [allTime, week, month] = await Promise.all([
        axios.get(`${this.config.baseUrl}/hold/leaderboard?range=all`, {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
          },
        }),
        axios.get(`${this.config.baseUrl}/hold/leaderboard?range=week`, {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
          },
        }),
        axios.get(`${this.config.baseUrl}/hold/leaderboard?range=month`, {
          headers: {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      return {
        allTime: allTime.data,
        week: week.data,
        month: month.data,
      };
    } catch (error) {
      logger.error(`Error fetching leaderboards: ${error.message}`);
      return null;
    }
  }

  // Helper Methods
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
  generateRandomTime() {
    // Generate truly random time between 10-30 seconds
    const minTime = 10;
    const maxTime = 60;

    // Add some noise to make it more random
    const baseTime =
      Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    const noise = Math.random() < 0.5 ? -2 : 2; // Random -2 or +2 seconds noise

    // Ensure final time is within bounds
    const finalTime = Math.max(minTime, Math.min(maxTime, baseTime + noise));
    return finalTime;
  }

  extractFirstName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.first_name || "Unknown";
    } catch (error) {
      logger.error(`Error extracting first_name: ${error.message}`);
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
      logger.error(`Error extracting last_name: ${error.message}`);
      return "";
    }
  }

  calculateWaitTime(firstAccountFinishTime) {
    if (!firstAccountFinishTime) return 5000; // Return 5 seconds instead of null

    const now = DateTime.now();
    const finishTime = DateTime.fromMillis(firstAccountFinishTime);
    const duration = finishTime.diff(now);

    return Math.max(duration.as("milliseconds"), 5000); // Minimum 5 seconds wait
  }

  // Main Process
  async processAccount(userData, accountIndex) {
    const fakeData = FakeDataGenerator.generateFakeData();
    this.config = {
      baseUrl: "https://fintopio-tg.fintopio.com/api",
      headers: fakeData.headers,
    };

    const first_name = this.extractFirstName(userData);
    const last_name = this.extractLastName(userData);
    logger.info(`${first_name} ${last_name}`);

    logger.info("Device Configuration:");
    logger.info(`> Model: ${fakeData.deviceInfo.deviceModel}`);
    logger.info(`> Platform: ${fakeData.deviceInfo.platform}`);
    logger.info(`> Screen: ${fakeData.deviceInfo.screenResolution}`);
    logger.info(`> GPU: ${fakeData.deviceInfo.webGLVendor}`);
    logger.info(`> Fingerprint: ${fakeData.fingerprint.substring(0, 8)}...`);
    logger.info(`> UA: ${this.formatUserAgent(fakeData.userAgent)}`);

    const token = await this.auth(userData);
    if (!token) return;

    logger.info("Login successful!");
    const [profile, leaderboards] = await Promise.all([
      this.getProfile(token),
      this.getLeaderboards(token),
    ]);

    if (!profile) return;

    logger.info(`Balance: ${this.formatNumber(profile.balance)}`);

    if (leaderboards) {
      // Referral Titans (All-time)
      const allTimeData = leaderboards.allTime?.user;
      if (allTimeData?.position) {
        logger.info(
          this.formatLeaderboardInfo(
            allTimeData.position,
            allTimeData.level?.name,
            "Referral Titans"
          )
        );
      }

      // Solo Legends (Weekly)
      const weekData = leaderboards.week?.user;
      if (weekData?.position) {
        logger.info(
          this.formatLeaderboardInfo(
            weekData.position,
            weekData.level?.name,
            "Solo Legends (Week)"
          )
        );
      }

      // Solo Legends (Monthly)
      const monthData = leaderboards.month?.user;
      if (monthData?.position) {
        logger.info(
          this.formatLeaderboardInfo(
            monthData.position,
            monthData.level?.name,
            "Solo Legends (Month)"
          )
        );
      }
    }

    await this.checkInDaily(token);
    await Promise.all([
      this.handleDiamonds(token, accountIndex === 0),
      this.handleFarming(token),
      this.handleTasks(token),
    ]);
  }

  async main() {
    printBanner();

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

if (require.main === module) {
  const fintopio = new Fintopio();
  fintopio.main().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
