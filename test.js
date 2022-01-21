const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-extra')

const express = require('express');
const app = express();

(async() => {
    try {
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
            const response = await page.goto('https://www.corrlinks.com/Login.aspx', {
                waitUntil: 'load',
                timeout: 0
            });
            // const response = await page.goto('https://www.google.com', { waitUntil: 'load', timeout: 0 });
            await page.screenshot({
                path: 'login.png',
                fullPage: true
            });

            const inputEmail = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginUserNameTextBox', {
                timeout: 0
            })
            await inputEmail.type('aaa');
            const inputPassword = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginPasswordTextBox')
            await inputPassword.type('bbb');
            const submitBtn = await page.waitForSelector('#ctl00_mainContentPlaceHolder_loginButton')
            await submitBtn.click()

            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 0
            });

            await browser.close();
        } catch (error) {
            console.log(error);
            await browser.close();
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