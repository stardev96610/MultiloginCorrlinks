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
        console.log("inmateId:", inmateId)
        db.query(`SELECT * FROM contacts WHERE inmate_id=${inmateId}`, (error, contactList) => {
            if (error) console.log(error);
            if (contactList.length) {
                resolve(contactList.map(item => [item.contact_name.toLowerCase(), item.contact_number]));
            } else {
                resolve([]);
            }
        });
    })
}
exports.getInmateIdByNumber = (inmateNumber) => {
    return new Promise(resolve => {
        db.query(`SELECT * FROM inmates WHERE number=${inmateNumber}`, (error, inmate) => {
            if (error) console.log(error);
            if (inmate.length) {
                resolve(inmate[0].id)
            } else {
                resolve('');
            }
        });
    })
}
exports.getInmateIdByPhoneNumber = (phoneNumber) => {
    return new Promise(resolve => {
        db.query(`SELECT * FROM inmates WHERE phone_number=${phoneNumber}`, (error, inmate) => {
            if (error) console.log(error);
            if (inmate.length) {
                resolve(inmate[0].id)
            } else {
                resolve('');
            }
        });
    })
}