const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

colors.setTheme({
  info: ['brightBlue', 'bold'],
  warn: ['brightYellow', 'bold'],
  success: ['brightGreen', 'bold'],
  error: ['brightRed', 'bold'],
  highlight: ['brightMagenta', 'bold'],
  balance: ['brightCyan', 'bold'],
  time: ['brightWhite', 'bold'],
  account: ['green', 'bold'],
});

class Fintopio {
    constructor() {
        this.baseUrl = 'https://fintopio-tg.fintopio.com/api';
        this.headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Referer': 'https://fintopio-tg.fintopio.com/',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
        };
    }

    log(msg, type = 'info') {
        const timestamp = DateTime.now().toFormat('HH:mm:ss');
        console.log(`[${timestamp.gray}] ${msg[type]}`);
    }

    async waitWithCountdown(milliseconds) {
        const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frameIndex = 0;
    
        let duration = DateTime.now().plus({ milliseconds }).diffNow(['hours', 'minutes', 'seconds']);
        let { hours, minutes, seconds } = duration.toObject();
    
        for (let i = milliseconds; i >= 0; i -= 100) {
            readline.cursorTo(process.stdout, 0);
            const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
            process.stdout.write(`${spinner.cyan} ${'Waiting'.info} ${timeString.time} ${'to continue'.info} ${spinner.cyan}`);
            await new Promise(resolve => setTimeout(resolve, 100));
    
            frameIndex++;
            duration = DateTime.now().plus({ milliseconds: i }).diffNow(['hours', 'minutes', 'seconds']);
            ({ hours, minutes, seconds } = duration.toObject());
        }
        console.log('');
    }    

    async auth(userData) {
        const url = `${this.baseUrl}/auth/telegram`;
        const headers = { ...this.headers, 'Webapp': 'true' };

        try {
            const response = await axios.get(`${url}?${userData}`, { headers });
            return response.data.token;
        } catch (error) {
            this.log(`Authentication error: ${error.message}`, 'error');
            return null;
        }
    }

    async getProfile(token) {
        const url = `${this.baseUrl}/referrals/data`;
        const headers = { 
            ...this.headers, 
            'Authorization': `Bearer ${token}`,
            'Webapp': 'false, true'
        };

        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            this.log(`Failed to fetch profile: ${error.message}`, 'error');
            return null;
        }
    }

    async checkInDaily(token) {
        const url = `${this.baseUrl}/daily-checkins`;
        const headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            await axios.post(url, {}, { headers });
            this.log('Daily check-in successful! 🎉', 'success');
        } catch (error) {
            this.log(`Daily check-in failed: ${error.message}`, 'error');
        }
    }

    async getFarmingState(token) {
        const url = `${this.baseUrl}/farming/state`;
        const headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`
        };

        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            this.log(`Failed to get farming state: ${error.message}`, 'error');
            return null;
        }
    }

    async startFarming(token) {
        const url = `${this.baseUrl}/farming/farm`;
        const headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await axios.post(url, {}, { headers });
            const finishTimestamp = response.data.timings.finish;

            if (finishTimestamp) {
                const finishTime = DateTime.fromMillis(finishTimestamp).toFormat('MMMM dd, yyyy \'at\' hh:mm a');
                this.log(`🌱 Farming started...`, 'info');
                this.log(`🎯 Farm completion: ${finishTime}`, 'highlight');
            } else {
                this.log('No completion time available.', 'warn');
            }
        } catch (error) {
            this.log(`Failed to start farming: ${error.message}`, 'error');
        }
    }

    async claimFarming(token) {
        const url = `${this.baseUrl}/farming/claim`;
        const headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            await axios.post(url, {}, { headers });
            this.log('🎊 Farm claimed successfully!', 'success');
        } catch (error) {
            this.log(`Farm claim failed: ${error.message}`, 'error');
        }
    }

    extractFirstName(userData) {
        try {
            const userPart = userData.match(/user=([^&]*)/)[1];
            const decodedUserPart = decodeURIComponent(userPart);
            const userObj = JSON.parse(decodedUserPart);
            return userObj.first_name || 'Unknown';
        } catch (error) {
            this.log(`Failed to extract first name: ${error.message}`, 'error');
            return 'Unknown';
        }
    }

    calculateWaitTime(firstAccountFinishTime) {
        if (!firstAccountFinishTime) return null;
        
        const now = DateTime.now();
        const finishTime = DateTime.fromMillis(firstAccountFinishTime);
        const duration = finishTime.diff(now);
        
        return duration.as('milliseconds');
    }

    async main() {
        while (true) {
            const dataFile = path.join(__dirname, 'data.txt');
            const data = await fs.readFile(dataFile, 'utf8');
            const users = data.split('\n').filter(Boolean);

            let firstAccountFinishTime = null;

            for (let i = 0; i < users.length; i++) {
                const userData = users[i];
                const first_name = this.extractFirstName(userData);
                console.log(`\n${'='.repeat(20)} ${'Account'.account} ${(i + 1).toString().brightYellow} | ${first_name.brightGreen} ${'='.repeat(20)}`.bold);
                const token = await this.auth(userData);
                if (token) {
                    this.log(`👤 Logged in successfully!`, 'success');
                    const profile = await this.getProfile(token);
                    if (profile) {
                        const balance = profile.balance;
                        this.log(`💰 Balance: ${balance}`, 'balance');

                        await this.checkInDaily(token);

                        const farmingState = await this.getFarmingState(token);

                        if (farmingState) {
                            if (farmingState.state === 'idling') {
                                await this.startFarming(token);
                            } else if (farmingState.state === 'farming') {
                                const finishTimestamp = farmingState.timings.finish;
                                if (finishTimestamp) {
                                    const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(DateTime.DATETIME_FULL);
                                    this.log(`🌾 Farm completion: ${finishTime}`, 'highlight');

                                    if (i === 0) {
                                        firstAccountFinishTime = finishTimestamp;
                                    }

                                    const currentTime = DateTime.now().toMillis();
                                    if (currentTime > finishTimestamp) {
                                        await this.claimFarming(token);
                                        await this.startFarming(token);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const waitTime = this.calculateWaitTime(firstAccountFinishTime);
            if (waitTime && waitTime > 0) {
                await this.waitWithCountdown(Math.floor(waitTime));
            } else {
                this.log('No valid waiting time, continuing immediately.', 'warn');
                await this.waitWithCountdown(5 * 1000);
            }
        }
    }
}

if (require.main === module) {
    const fintopio = new Fintopio();
    fintopio.main().catch(err => {
        console.error(err.brightRed);
        process.exit(1);
    });
}