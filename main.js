const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { DateTime } = require("luxon");

class Fintopio {
  constructor() {
    this.baseUrl = "https://fintopio-tg.fintopio.com/api";
    this.headers = {
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
    };
  }

  log(msg, color = "white") {
    console.log(msg[color]);
  }

  async waitWithCountdown(seconds, msg = "continue") {
    const spinners = ["|", "/", "-", "\\"];
    let i = 0;
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let remainingSeconds = seconds % 60;
    for (let s = seconds; s >= 0; s--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `${spinners[i]} Waiting ${hours}h ${minutes}m ${remainingSeconds}s to ${msg} ${spinners[i]}`
          .cyan
      );
      i = (i + 1) % spinners.length;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      remainingSeconds--;
      if (remainingSeconds < 0) {
        remainingSeconds = 59;
        minutes--;
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
      }
    }
    console.log("");
  }

  async auth(userData) {
    const url = `${this.baseUrl}/auth/telegram`;
    const headers = { ...this.headers, Webapp: "true" };

    try {
      const response = await axios.get(`${url}?${userData}`, { headers });
      return response.data.token;
    } catch (error) {
      this.log(`Authentication error: ${error.message}`, "red");
      return null;
    }
  }

  async getProfile(token) {
    const url = `${this.baseUrl}/referrals/data`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      Webapp: "false, true",
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Error fetching profile: ${error.message}`, "red");
      return null;
    }
  }

  async checkInDaily(token) {
    const url = `${this.baseUrl}/daily-checkins`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      await axios.post(url, {}, { headers });
      this.log("Daily check-in successful!", "green");
    } catch (error) {
      this.log(`Daily check-in error: ${error.message}`, "red");
    }
  }

  async getFarmingState(token) {
    const url = `${this.baseUrl}/farming/state`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Error fetching farming state: ${error.message}`, "red");
      return null;
    }
  }

  async startFarming(token) {
    const url = `${this.baseUrl}/farming/farm`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.post(url, {}, { headers });
      const finishTimestamp = response.data.timings.finish;

      if (finishTimestamp) {
        const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
          DateTime.DATETIME_FULL
        );
        this.log(`Starting farm...`, "yellow");
        this.log(`Farming completion time: ${finishTime}`, "green");
      } else {
        this.log("No completion time available.", "yellow");
      }
    } catch (error) {
      this.log(`Error starting farming: ${error.message}`, "red");
    }
  }

  async claimFarming(token) {
    const url = `${this.baseUrl}/farming/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      await axios.post(url, {}, { headers });
      this.log("Farm claimed successfully!", "green");
    } catch (error) {
      this.log(`Error claiming farm: ${error.message}`, "red");
    }
  }

  async getDiamondInfo(token) {
    const url = `${this.baseUrl}/clicker/diamond/state`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.data && response.data.state) {
        return response.data;
      } else {
        this.log("Error fetching diamond state: Invalid response data", "red");
        return null;
      }
    } catch (error) {
      this.log(`Error fetching diamond state: ${error.message}`, "red");
      return null;
    }
  }

  async claimDiamond(token, diamondNumber, totalReward) {
    const url = `${this.baseUrl}/clicker/diamond/complete`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const payload = { diamondNumber: diamondNumber };

    try {
      await axios.post(url, payload, { headers });
      this.log(`Success claim ${totalReward} diamonds!`, "green");
    } catch (error) {
      this.log(`Error claiming Diamond: ${error.message}`, "red");
    }
  }

  async getTask(token) {
    const url = `${this.baseUrl}/hold/tasks`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Error fetching task state: ${error.message}`, "red");
      return null;
    }
  }

  async startTask(token, taskId, slug) {
    const url = `${this.baseUrl}/hold/tasks/${taskId}/start`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      origin: "https://fintopio-tg.fintopio.com",
    };
    try {
      await axios.post(url, {}, { headers });
      this.log(`Starting task ${slug}!`, "green");
    } catch (error) {
      this.log(`Error starting task: ${error.message}`, "red");
    }
  }

  async claimTask(token, taskId, slug, rewardAmount) {
    const url = `${this.baseUrl}/hold/tasks/${taskId}/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      origin: "https://fintopio-tg.fintopio.com",
    };
    try {
      await axios.post(url, {}, { headers });
      this.log(
        `Task ${slug} complete, reward ${rewardAmount} diamonds!`,
        "green"
      );
    } catch (error) {
      this.log(`Error claiming task: ${error.message}`, "red");
    }
  }

  extractFirstName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.first_name || "Unknown";
    } catch (error) {
      this.log(`Error extracting first_name: ${error.message}`, "red");
      return "Unknown";
    }
  }

  calculateWaitTime(firstAccountFinishTime) {
    if (!firstAccountFinishTime) return null;

    const now = DateTime.now();
    const finishTime = DateTime.fromMillis(firstAccountFinishTime);
    const duration = finishTime.diff(now);

    return duration.as("milliseconds");
  }

  async main() {
    while (true) {
      const dataFile = path.join(__dirname, "data.txt");
      const data = await fs.readFile(dataFile, "utf8");
      const users = data.split("\n").filter(Boolean);

      let firstAccountFinishTime = null;

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        const first_name = this.extractFirstName(userData);
        console.log(`[ Account ${i + 1} | ${first_name} ]`);
        const token = await this.auth(userData);
        if (token) {
          this.log(`Login successful!`, "green");
          const profile = await this.getProfile(token);
          if (profile) {
            const balance = profile.balance;
            this.log(`Balance: ${balance}`, "green");

            await this.checkInDaily(token);

            try {
              const diamond = await this.getDiamondInfo(token);
              if (diamond && diamond.state === "available") {
                await this.waitWithCountdown(
                  Math.floor(Math.random() * (21 - 10)) + 10,
                  "claim Diamonds"
                );
                await this.claimDiamond(
                  token,
                  diamond.diamondNumber,
                  diamond.settings.totalReward
                );
              } else if (diamond && diamond.timings && diamond.timings.nextAt) {
                const nextDiamondTimeStamp = diamond.timings.nextAt;
                const nextDiamondTime = DateTime.fromMillis(
                  nextDiamondTimeStamp
                ).toLocaleString(DateTime.DATETIME_FULL);
                this.log(`Next Diamond time: ${nextDiamondTime}`, "green");

                if (i === 0) {
                  firstAccountFinishTime = nextDiamondTimeStamp;
                }
              } else {
                this.log("Unable to process diamond info", "yellow");
              }
            } catch (error) {
              this.log(
                `Error processing diamond info: ${error.message}`,
                "red"
              );
            }

            const farmingState = await this.getFarmingState(token);

            if (farmingState) {
              if (farmingState.state === "idling") {
                await this.startFarming(token);
              } else if (
                farmingState.state === "farmed" ||
                farmingState.state === "farming"
              ) {
                const finishTimestamp = farmingState.timings.finish;
                if (finishTimestamp) {
                  const finishTime = DateTime.fromMillis(
                    finishTimestamp
                  ).toLocaleString(DateTime.DATETIME_FULL);
                  this.log(`Farming completion time: ${finishTime}`, "green");

                  //   if (i === 0) {
                  //     firstAccountFinishTime = finishTimestamp;
                  //   }

                  const currentTime = DateTime.now().toMillis();
                  if (currentTime > finishTimestamp) {
                    await this.claimFarming(token);
                    await this.startFarming(token);
                  }
                }
              }
            }

            const taskState = await this.getTask(token);

            if (taskState) {
              for (const item of taskState.tasks) {
                if (item.status === "available") {
                  await this.startTask(token, item.id, item.slug);
                } else if (item.status === "verified") {
                  await this.claimTask(
                    token,
                    item.id,
                    item.slug,
                    item.rewardAmount
                  );
                } else if (item.status === "in-progress") {
                  continue;
                } else {
                  this.log(`Veryfing task ${item.slug}!`, "green");
                }
              }
            }
          }
        }
      }

      const waitTime = this.calculateWaitTime(firstAccountFinishTime);
      if (waitTime && waitTime > 0) {
        await this.waitWithCountdown(Math.floor(waitTime / 1000));
      } else {
        this.log("No valid wait time, continuing loop immediately.", "yellow");
        await this.waitWithCountdown(5);
      }
    }
  }
}

if (require.main === module) {
  const fintopio = new Fintopio();
  fintopio.main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
