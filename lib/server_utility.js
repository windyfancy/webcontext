const crypto = require('crypto');
const path=require("path");
const queryString = require("querystring");

module.exports = {
    workDirectory:process.cwd(),
    mapPath:function (p){
        return path.resolve(workDirectory,p)
    },
    htmlEncode:function (str){
        if (typeof str != "string") return "";
            str = str.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/\'/g, "&#39;")
                .replace(/ /g, "&nbsp;")
            return str;
    },
    htmlDecode:function (){
        if (typeof text != "string") return "";
            var map = {
                '&amp;': '&',
                '&quot;': '"',
                '&lt;': '<',
                '&gt;': '>',
                "&nbsp;": " ",
                "&#39;": "'"
            };
            return text.replace(/(&quot;|&lt;|&gt;|&amp;|&nbsp;|&#39;)/g, function (str, item) {
                return map[item];
            });
            
    },
    urlEncode:function (input){
        return queryString.escape(input);
    },
    urlDecode:function (input){
        return queryString.unescape(input);
    },
    md5:function (input){
        return crypto.createHash('md5').update(input).digest("hex");
    }
}