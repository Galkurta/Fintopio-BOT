const Fingerprint2 = require("fingerprintjs2");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

class FakeDataGenerator {
  // Tracking used data to avoid duplicates
  static usedData = {
    fingerprints: new Set(),
    userAgents: new Set(),
    deviceConfigs: new Set(),
  };

  static userAgents = null;

  static platforms = [
    "Android 10",
    "Android 11",
    "Android 12",
    "Android 13",
    "Android 12L",
    "Android 11.0.1",
    "Android 10.0.1",
    "Android 13.0.1",
  ];

  static deviceModels = [
    "SM-G998B",
    "SM-G991B",
    "SM-A526B",
    "SM-G973F", // Samsung models
    "M2102J20SG",
    "M2103K19G",
    "M2012K11AG", // Xiaomi models
    "IN2023",
    "KB2001",
    "LE2101", // OnePlus models
    "V2045",
    "V2026",
    "V2023", // Vivo models
    "ASUS_I001DA",
    "ASUS_I003DD", // ASUS models
    "RMX3081",
    "RMX3151",
    "RMX3381", // Realme models
    "NOH-NX9",
    "ELS-NX9",
    "YAL-L41", // Huawei models
  ];

  static screenResolutions = [
    "1080x2400",
    "1440x3200",
    "1080x2340",
    "1440x2960",
    "1080x2460",
    "1440x3040",
    "1080x2280",
    "1440x2880",
    "1080x2520",
    "1440x3120",
    "1080x2300",
    "1440x2800",
  ];

  static webGLVendors = [
    "Qualcomm",
    "ARM",
    "Mali-G78",
    "PowerVR",
    "Adreno 660",
    "Mali-G77",
    "Adreno 650",
    "Mali-G76",
    "Adreno 640",
    "Mali-G72",
  ];

  static sanitizeUserAgent(userAgent) {
    return userAgent
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim(); // Remove leading/trailing whitespace
  }

  static loadUserAgents() {
    if (!this.userAgents) {
      const filePath = path.join(__dirname, "UserAgents.txt");
      try {
        const content = fs.readFileSync(filePath, "utf8");
        this.userAgents = content
          .split("\n")
          .map((line) => this.sanitizeUserAgent(line))
          .filter((line) => line && line.length > 0);

        if (this.userAgents.length === 0) {
          throw new Error("UserAgents.txt is empty or contains invalid data");
        }
      } catch (error) {
        logger.error(`Error loading UserAgents.txt: ${error.message}`);
        throw error;
      }
    }
    return this.userAgents;
  }

  static getRandomItem(array, exclude = new Set()) {
    const availableItems = array.filter((item) => !exclude.has(item));
    if (availableItems.length === 0) {
      this.clearUsedData(); // Reset if no more unique items
      return this.getRandomItem(array); // Try again with cleared data
    }
    return availableItems[Math.floor(Math.random() * availableItems.length)];
  }

  static getRandomUserAgent() {
    const userAgents = this.loadUserAgents();
    let userAgent;
    let attempts = 0;

    do {
      userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      userAgent = this.sanitizeUserAgent(userAgent);
      attempts++;

      if (attempts > 10) {
        this.usedData.userAgents.clear();
        break;
      }
    } while (this.usedData.userAgents.has(userAgent));

    this.usedData.userAgents.add(userAgent);
    return userAgent;
  }

  static generateUniqueConfig() {
    const deviceModel = this.getRandomItem(
      this.deviceModels,
      this.usedData.deviceConfigs
    );
    const platform = this.getRandomItem(this.platforms);
    const screenResolution = this.getRandomItem(this.screenResolutions);
    const webGLVendor = this.getRandomItem(this.webGLVendors);

    const config = `${deviceModel}-${platform}-${screenResolution}-${webGLVendor}`;
    this.usedData.deviceConfigs.add(config);

    return {
      deviceModel,
      platform,
      screenResolution,
      webGLVendor,
    };
  }

  static generateUniqueFingerprint(components) {
    let fingerprint;
    let attempts = 0;

    do {
      const uniqueComponent = Date.now() + Math.random();
      const values = [...Object.values(components), uniqueComponent];
      fingerprint = Fingerprint2.x64hash128(values.join(""), 31);
      attempts++;

      if (attempts > 10) {
        this.usedData.fingerprints.clear();
        break;
      }
    } while (this.usedData.fingerprints.has(fingerprint));

    this.usedData.fingerprints.add(fingerprint);
    return fingerprint;
  }

  static generateFakeData() {
    try {
      const config = this.generateUniqueConfig();
      const userAgent = this.getRandomUserAgent();

      // Validate user agent
      if (!userAgent || userAgent.length < 10) {
        throw new Error("Invalid user agent generated");
      }

      const fingerprint = this.generateUniqueFingerprint(config);

      return {
        userAgent,
        fingerprint,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://fintopio-tg.fintopio.com/",
          "Sec-Ch-Ua":
            '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
          "Sec-Ch-Ua-Mobile": "?1",
          "Sec-Ch-Ua-Platform": `"${config.platform}"`,
          "User-Agent": userAgent,
          "X-Fingerprint": fingerprint,
          "X-Device-Model": config.deviceModel,
          "X-Platform": config.platform,
          "X-Screen-Resolution": config.screenResolution,
          "X-GPU-Vendor": config.webGLVendor,
        },
        deviceInfo: config,
      };
    } catch (error) {
      logger.error(`Error generating fake data: ${error.message}`);
      return this.generateDefaultFakeData();
    }
  }

  static generateDefaultFakeData() {
    const config = this.generateUniqueConfig();
    const defaultUserAgent =
      "Mozilla/5.0 (Linux; Android 10; Generic) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
    const fingerprint = this.generateUniqueFingerprint(config);

    return {
      userAgent: defaultUserAgent,
      fingerprint,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://fintopio-tg.fintopio.com/",
        "Sec-Ch-Ua":
          '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": `"${config.platform}"`,
        "User-Agent": defaultUserAgent,
        "X-Fingerprint": fingerprint,
        "X-Device-Model": config.deviceModel,
        "X-Platform": config.platform,
        "X-Screen-Resolution": config.screenResolution,
        "X-GPU-Vendor": config.webGLVendor,
      },
      deviceInfo: config,
    };
  }

  static clearUsedData() {
    this.usedData.fingerprints.clear();
    this.usedData.userAgents.clear();
    this.usedData.deviceConfigs.clear();
  }
}

module.exports = FakeDataGenerator;
