const mysql = require('mysql')
const config = require('./config');

config.db.connect(function(error) {
    if (!!error) {
        console.log(error);
    } else {
        console.log('Connected..!');
    }
});
module.exports = config.db;