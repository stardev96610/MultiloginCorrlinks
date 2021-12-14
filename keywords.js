const db = require('./database')
exports.getKeys = () => {
    return new Promise(resolve => {
        db.query(`SELECT keyword FROM keywords`, (error, keywords) => {
            resolve(keywords.map(item => item.keyword.toLowerCase()));
        });
    })
}
exports.getContactList = (inmateId) => {
    return new Promise(resolve => {
        db.query(`SELECT * FROM contacts WHERE inmate_id=${inmateId}`, (error, contactList) => {
            resolve(contactList.map(item => [item.contact_name.toLowerCase(), item.contact_number]));
        });
    })
}