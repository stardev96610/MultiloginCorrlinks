const { fork } = require('child_process')

const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-extra')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')

const express = require('express');
const app = express();
const db = require('./database');
const Accounts = require('./accounts');
let Constants = require('./Constants');

puppeteer.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: '1f5625b7bce2ba96e85ef0f29409f302' // REPLACE THIS WITH YOUR OWN 2CAPTCHA API KEY ⚡
        },
        visualFeedback: true // colorize reCAPTCHAs (violet = detected, green = solved)
    })
)

app.get('/', function(req, res) {
    res.send('Hello');
});

app.get('/multiwebhook', function(req, res) {
    let data = req.query.Body.replace(/"/g, '\\"');
    if (req.query.From && req.query.To && req.query.Body) {
        db.query(`INSERT INTO replies (sender, recipient, content) VALUES ("${req.query.From.slice(1)}", "${req.query.To.slice(1)}", "${data}")`, (error, item) => {
            console.log(item.insertId, "reply message saved correctly");
            res.send(JSON.stringify(req.query));
        });
    }
});

let server = app.listen(8000, function() {
    var host = server.address().address;
    var port = server.address().port
    console.log("Example app listening at http://%s:%s", host, port);
});

//setCookies 
(async() => {
    try {
        const sendSMS = fork(path.join(__dirname, 'sendSMS'));
        sendSMS.send({
            start: true,
            monitor: true
        });

        // sendSMS.on('message', async msg => {
        //     if (msg.unread) {
        //         console.log('sendSMS is restarted with new cookies');
        //         sendSMS.send({
        //             start: true,
        //             cookies: cookies
        //         })
        //     }
        // });

        const replySMS = fork(path.join(__dirname, 'replySMS'));
        replySMS.send({
            start: true,
        });

        // replySMS.on('message', async msg => {
        //     if (msg.replyError) {
        //         console.log('reply Error');
        //         replySMS.send({
        //             start: true,
        //             cookies: cookies
        //         })
        //     }
        // });

        let accountList = await Accounts.getAccounts();

        for (let i = 0;;) {
            sendSMS.send({
                cookiesList: Constants.getCookies()
            });
            replySMS.send({
                cookiesList: Constants.getCookies()
            });
            const browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args: [
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--ignore-certificate-errors',
                    '--ignore-certificate-errors-spki-list'
                ]
            });
            const page = await browser.newPage();
            if (!Constants.isCookieExist(accountList[i].inmate_number)) {
                try {
                    console.log(accountList[i].inmate_number, ": No Cookies");
                    const response = await page.goto('https://www.corrlinks.com/Login.aspx', { waitUntil: 'load', timeout: 0 });
                    const inputEmail = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginUserNameTextBox')
                    await inputEmail.type(accountList[i].email);
                    const inputPassword = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginPasswordTextBox')
                    await inputPassword.type(accountList[i].password);
                    const submitBtn = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginButton')
                    await submitBtn.click()

                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 0 });
                    let loop;
                    do {
                        const {
                            captchas,
                            filtered,
                            solutions,
                            solved,
                            error
                        } = await page.solveRecaptchas();
                        loop = error;
                        if (loop) await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });

                    } while (loop)
                    const proceedBtn = await page.waitForSelector('#ctl00_mainContentPlaceHolder_captchaFNameLNameSubmitButton');
                    await proceedBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 0 });

                    // Get cookies
                    let cookies = await page.cookies();
                    let time = new Date();
                    console.log(accountList[i].inmate_number, ': Get Cookie is OK');
                    Constants.addCookies({
                        inmate_number: accountList[i].inmate_number,
                        cookies,
                        time
                    });
                    await browser.close();
                } catch (error) {
                    console.log(error);
                    await browser.close();
                }
            } else {
                try {
                    let cookies = Constants.getCookies().find(item => item.inmate_number == accountList[i].inmate_number).cookies;
                    await page.setCookie(...cookies);
                    await page.goto('https://www.corrlinks.com/Default.aspx', { timeout: 30000 }); // Open unreadMessageList page
                    cookies = await page.cookies();
                    Constants.removeCookies(accountList[i].inmate_number)
                    let time = new Date();
                    Constants.addCookies({
                        inmate_number: accountList[i].inmate_number,
                        cookies,
                        time
                    });
                    await browser.close();
                    console.log(accountList[i].inmate_number, ": Cookies OK");
                    await timeout(5000);
                } catch (error) {
                    console.log(error);
                    await browser.close();
                }
            }
            i++;
            if (i == accountList.length)
                i = 0;
        }
    } catch (error) {
        console.log(error);
    }
})()

async function timeout(ms, logTimer) {
    if (logTimer) console.log(`Tempo: ${ms / 1000}`)
    async function timer(time, logTimer) {
        if (time >= 0) {
            if (logTimer) console.log(`Aguardando: ${time}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return await timer(--time, logTimer)
        }
    }
    await timer(ms / 1000, logTimer)
}