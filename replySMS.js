const { fork } = require('child_process');
const { RestClient } = require('@signalwire/node');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const Keyword = require('./keywords');
let cookiesArr = [];

// const $ = require('cheerio');


process.on('message', msg => {
    if (msg.start) {
        monitorReplyMessages();
    }
    if (msg.cookiesList)
        cookiesArr = msg.cookiesList;
});
let interval;
async function monitorReplyMessages() {
    let keywordList = await Keyword.getKeys();

    interval = setInterval(() => {
        db.query(`SELECT * FROM replies WHERE unread=1 LIMIT 1`, (error, row) => {
            if (row.length) {
                db.query(`UPDATE replies SET unread = 2 WHERE id=${row[0].id}`, (error, item) => {

                    if (keywordList.includes(row[0].sender)) {
                        let cookiesObj = cookiesArr.find(item => item.inmate_number == Number(row[0].recipient));
                        if (cookiesObj) {
                            replySMS(cookiesObj.cookies, row[0], Number(row[0].recipient), row[0].sender);
                        }
                    } else if (row[0].sender == "New Message") {
                        let cookiesObj = cookiesArr.find(item => item.inmate_number == Number(row[0].recipient));
                        if (cookiesObj) {
                            replySMS(cookiesObj.cookies, row[0], Number(row[0].recipient), row[0].sender);
                        }
                    } else {
                        db.query(`SELECT * FROM inmates WHERE phone_number="+${row[0].recipient}"`, async(error, user) => {
                            if (user.length) {
                                let inmateNumber = user[0].number.replace(/[^0-9]/g, '');
                                let contactList = await Keyword.getContactList(inmateNumber);
                                let contactItem = contactList.find(item => item[1] == row[0].recipient);
                                let sender = contactItem ? contactItem[0] : row[0].sender;
                                let cookiesObj = cookiesArr.find(item => item.inmate_number == inmateNumber);
                                if (cookiesObj) {
                                    replySMS(cookiesObj.cookies, row[0], Number(inmateNumber), sender);
                                }
                            } else {
                                db.query(`UPDATE replies SET unread = 3 WHERE id=${row[0].id}`, (error, item) => {

                                });
                            }
                        });
                    }
                });
            } else {

                db.query(`UPDATE replies SET unread=1 WHERE unread=2`, (error, user) => {

                });
                // console.log('no reply messgage');
            }
        });
    }, 10000)
}
async function replySMS(cookies, row, inmateNumber, senderPhoneNumber) {
    console.log('reply started')
    console.log("From: ", row.sender);
    console.log("To: ", inmateNumber);
    console.log("content: ", row.content.toString().slice(0, 20) + '...');
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

    try {
        const page = await browser.newPage();
        await page.setCookie(...cookies);

        await page.goto('https://www.corrlinks.com/NewMessage.aspx'); // Opens page as logged user
        await page.screenshot({ path: 'newMessage.png' });
        var table;
        do {
            const addressTextBox = await page.waitForSelector('#ctl00_mainContentPlaceHolder_addressBox_addressTextBox', { timeout: 60000 })
            await addressTextBox.click();
            table = await page.$$('#ctl00_mainContentPlaceHolder_addressBox_addressGrid');
        } while (table.length == 0);
        const address = await page.$x(`//th[contains(text(), "${inmateNumber}")]`);
        const tr = (await address[0].$x('..'))[0];
        const checkBox = await tr.$$('td > div > span > input');
        await checkBox[0].click();
        console.log('checked OK');

        const okBtn = await page.waitForSelector('#ctl00_mainContentPlaceHolder_addressBox_okButton');
        await okBtn.click();
        console.log('OK button clicked');

        await timeout(3000);

        const subjectTextBox = await page.waitForSelector('#ctl00_mainContentPlaceHolder_subjectTextBox')
        await subjectTextBox.type(row.content.toString().slice(0, 20) + '...');

        const messageTextBox = await page.waitForSelector('#ctl00_mainContentPlaceHolder_messageTextBox')
        await messageTextBox.type(`${senderPhoneNumber}\n` + row.content.toString());

        const sendMessageBtn = await page.waitForSelector('#ctl00_mainContentPlaceHolder_sendMessageButton');
        await sendMessageBtn.click();
        await page.screenshot({ path: 'send.png' });
        db.query(`DELETE FROM replies WHERE id=${row.id}`, (error, item) => {
            db.query(`UPDATE inmates SET receive_count = receive_count+1 WHERE number="${inmateNumber}"`, (error, count) => {
                if (error) console.log(error);
            });
            console.log('the message was replied correctly');
        });
        try { await browser.close() } catch (error) {}
    } catch (error) {
        await browser.close();
        console.log('reply error');
        console.log(new Date());
        console.log(error);
        clearInterval(interval);
        monitorReplyMessages();
    }
}

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