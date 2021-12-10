const { fork } = require('child_process')

const { RestClient } = require('@signalwire/node');
const db = require('./database')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-extra')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')
const Keyword = require('./keywords');
// const Constants = require('./Constants');
const express = require('express');
const app = express();
client = new RestClient("b2973d44-31f1-4c87-8f77-dbbe49b347af",
    "PTfb041e2b957431da84be8c062d1b1d72a319f134c906cc62", {
        signalwireSpaceUrl: 'ojochat.signalwire.com',
    });
let cookiesArr = [];
process.on('message', msg => {
    if (msg.monitor) {
        monitorSendMessages();
    }
    if (msg.start) {
        saveSMS();
    }
    if (msg.cookiesList)
        cookiesArr = msg.cookiesList;
});

async function monitorSendMessages() {
    setInterval(() => {
        db.query(`SELECT * FROM sms WHERE unread=1 LIMIT 1`, (error, row) => {
            if (row.length) {
                console.log("from: ", row[0].sender);
                console.log("to: ", row[0].recipient);
                let phoneNumber = row[0].recipient.replace(/[^0-9]/g, '');
                phoneNumber = "+" + phoneNumber;

                db.query(`SELECT * FROM inmates WHERE number="${row[0].sender}"`, (error, user) => {

                    if (user.length) {
                        let limitDate = new Date(user[0].approved_until).getDate - new Date().getDate();
                        sendSMS(user[0].phone_number, row[0].recipient, row[0].content, row[0].id);
                        if (limitDate >= 0) {} else {
                            let content = "Your service already is expired. Please make your payment as soon as possible";
                            db.query(`INSERT INTO replies (sender, recipient, content) VALUES ("New Message", "${user[0].number}", "${content}")`, (error, item) => {
                                console.log(item.insertId, "Limit reply message saved correctly");
                            });
                        }
                    } else {

                        db.query(`UPDATE sms SET unread = 2 WHERE id=${row[0].id}`, (error) => {})
                    }
                })
            } else {
                db.query(`UPDATE sms SET unread=1 WHERE unread=2`, (error, user) => {

                });
                // console.log('no SMS in DB');
            }
        });
        db.query(`SELECT * FROM inmates WHERE state=0`, (error, item) => (error, users) => {
            for (let i = 0; i < users.length; i++) {
                let limitDate = new Date(users[i].approved_until).getDate - new Date().getDate();
                if (limitDate < 5) {
                    let content = "Your service will expire on <date>. Please make your payment before <date> to avoid an interruption in your service.";
                    db.query(`INSERT INTO replies (sender, recipient, content) VALUES ("New Message", "${user[0].number}", "${content}")`, (error, item) => {
                        db.query(`UPDATE inmates SET state = 1 WHERE id=${users[i].id}`, (error) => {
                            console.log(error);
                        })
                        console.log(item.insertId, "Limit reply message saved correctly");
                    });
                }
            }
        })
    }, 10000)
}

async function saveSMS() {
    try {
        let unitCount = 20;
        do {
            for (let i = 0;;) {
                let min = i * unitCount
                let max = (i + 1) * unitCount;
                await Promise.all(
                    cookiesArr.filter((item, index) => index >= min && index < max).map(async item => {
                        return new Promise(async resolve => {
                            let keywordList = await Keyword.getKeys();

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
                            try {
                                await page.setCookie(...item.cookies);
                                await page.goto('https://www.corrlinks.com/Inbox.aspx?UnreadMessages'); // Open unreadMessageList page            
                                const unreadRow = await page.waitForSelector('#ctl00_mainContentPlaceHolder_inboxGridView > tbody > tr:nth-child(2) ', { timeout: 60000 });
                                await unreadRow.click();

                                var panel;
                                do {
                                    panel = await page.$$('#ctl00_mainContentPlaceHolder_messagePanel');
                                } while (panel.length == 0);
                                console.log('Message detailpage is opened');
                                const messageData = await page.evaluate(async() => {
                                    var from = document.querySelector('#ctl00_mainContentPlaceHolder_fromTextBox').value || '';
                                    var date = document.querySelector('#ctl00_mainContentPlaceHolder_dateTextBox').value || '';
                                    var subject = document.querySelector('#ctl00_mainContentPlaceHolder_subjectTextBox').value || '';
                                    var message = document.querySelector('#ctl00_mainContentPlaceHolder_messageTextBox').value || '';

                                    return JSON.stringify({ from, date, subject, message });
                                });
                                console.log('get Message body OK');
                                let fromInmateNumber = JSON.parse(messageData).from.replace(/[^0-9]/g, '');
                                fs.writeFileSync('message.json', messageData);
                                let data = JSON.parse(messageData).message;
                                let phoneNumber = data.slice(0, data.indexOf('\n'));
                                await timeout(3000);
                                console.log("First Line content: ", phoneNumber);
                                console.log("-----------------------------------------")
                                console.log(keywordList.slice());
                                if (keywordList.find(item => item == phoneNumber.toLowerCase())) {

                                    let keyword = phoneNumber.toLowerCase();
                                    let inmateNumber = fromInmateNumber;
                                    console.log('keyword:', keyword)
                                    console.log('fromInmateNumber:', fromInmateNumber)
                                    db.query(`SELECT content from keywords where keyword="${phoneNumber.toLowerCase()}"`, (error, content) => {
                                        if (content.length) {
                                            db.query(`INSERT INTO replies (sender, recipient, content, unread) VALUES ("${keyword}", "${inmateNumber}", "${content[0].content.replace(/"/g, '\\"')}", 1)`, (error, item) => {
                                                console.log(item.insertId, "Keyword reply message saved correctly");
                                            });
                                        }
                                    });
                                } else {
                                    let recipient = phoneNumber.replace(/[^0-9]/g, '');
                                    let content = data.slice(data.indexOf('\n') + 1, data.indexOf('-----'));
                                    content = content.replace(/"/g, '\\"');
                                    if (recipient.length == 11)
                                        recipient = "+" + recipient;
                                    else if (recipient.length == 10)
                                        recipient = "+1" + recipient;
                                    else
                                        recipient = '';
                                    console.log("recipient:", recipient);
                                    if (fromInmateNumber && recipient) {
                                        db.query(`INSERT INTO sms (sender, recipient, content) VALUES ("${fromInmateNumber}", "${recipient}", "${content}")`, (error, item) => {
                                            if (error) console.log(error);
                                            console.log(item.insertId, " : SMS is recorded successfully in db");
                                        });
                                    }
                                }
                            } catch (error) {
                                // console.log('no unread message in inBox');
                            }
                            await browser.close();
                            resolve();
                        })
                    })
                ).then(() => {
                    if (cookiesArr.length)
                        i++;
                    if (min > cookiesArr.length)
                        i = 0;
                })
                await timeout(5000)
            }
        } while (true);



    } catch (error) {
        console.log(error)
    }
}

async function sendSMS(sender, recipient, content, smsId) {
    do {
        let message = client.messages.create({
            from: sender,
            body: content.slice(0, 1590),
            to: recipient
        }).then(msg => {
            console.log(msg.sid);
            db.query(`DELETE FROM sms WHERE id=${smsId}`, (error, item) => {
                db.query(`UPDATE inmates SET send_count = send_count+1 WHERE phone_number="${sender}"`, (error, count) => {
                    if (error) console.log(error);
                });
                console.log('the SMS was sent correctly');
            });
        }).done();
        content = content.slice(1590);
    } while (content.length);
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