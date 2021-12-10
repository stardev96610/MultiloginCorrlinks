const mysql = require('mysql')
const puppeteer = require('puppeteer-extra')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "friend.b617",
    database: "corrlinks",
});
module.exports.db = db;
puppeteer.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: '1f5625b7bce2ba96e85ef0f29409f302' // REPLACE THIS WITH YOUR OWN 2CAPTCHA API KEY ⚡
        },
        visualFeedback: true // colorize reCAPTCHAs (violet = detected, green = solved)
    })
)