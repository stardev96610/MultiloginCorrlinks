const db = require('./database')
exports.getAccounts = () => {
    return new Promise(resolve => {
        db.query(`SELECT * FROM accounts`, (error, accounts) => {
            resolve(accounts.map(item => { return { email: item.email, password: item.password, inmate_number: item.inmate_number } }));
        });
    })
}