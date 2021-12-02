let CookiesList = [];

exports.getCookies = () => {
    return CookiesList;
}
exports.addCookies = (value) => {
    CookiesList.push(value);
    return CookiesList;
}
exports.removeCookies = (value) => {
    CookiesList = CookiesList.filter(item => item.inmate_number != value);
    return CookiesList;
}
exports.isCookieExist = (inmate_number) => {
    let cookieInfo = CookiesList.find(item => item.inmate_number == inmate_number);
    let expireTime = cookieInfo ? (new Date()) - cookieInfo.time : 3600000;
    if (!cookieInfo || expireTime >= 3600000) {
        this.removeCookies(inmate_number)
        return false;
    }
    return true;
}