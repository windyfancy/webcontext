const crypto = require('crypto');
const path=require("path");
const queryString = require("querystring");
const Emitter = require('events');
const Url=require("url");
const http=require("http");
const https = require('https');

module.exports =class ServerUtility extends Emitter {
    constructor(ctx) {
        super();

        this.context=ctx;
        this.workDirectory=process.cwd();

    }
    
    mapPath (p){
        return path.resolve(this.workDirectory,p)
    }

    htmlEncode (str){
        if (typeof str != "string") return "";
            str = str.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/\'/g, "&#39;")
                .replace(/ /g, "&nbsp;")
            return str;
    }
    htmlDecode (){
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
            
    }
    urlEncode (input){
        return queryString.escape(input);
    }
    urlDecode (input){
        return queryString.unescape(input);
    }
    request (url,options){
        if(!options){options={}}
        return new Promise( (resolve)=>{
            var obj=Url.parse(url);
            const params = {
                hostname: obj.hostname,
                port: obj.protocol=="https:"?443:obj.port,
                path: obj.path,
                method: 'GET',
  
              };
              var postData=null;
              if(options && options.postData){
                  params.method="POST";
                  params.headers= {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(options.postData)
                  }
                  postData=options.postData;
                  delete options.postData;
              }
              Object.assign(params,options)
            var httpObj=http;
            if(obj.protocol=="https:"){
                httpObj=https;
            }
            
            var req = httpObj.request(params, function (res) {
                //res.setEncoding('utf8');
                var chunks = [], size = 0;
                res.on('data', function (chunk) {
                    chunks.push(chunk);
                    size += chunk.length;      
                }).on('end', function () {
                    let result = Buffer.concat(chunks, size).toString("utf-8");
                    resolve(result);
                });
            });
            if(postData){
                req.write(postData);
            }
            req.end();
        })
    }
    proxy(url){
        let ctx=this.context;
        ctx.isHandled=true;
        ctx.isProxy=true;
        var req=ctx._req;
        var res=ctx._res;
        var obj=Url.parse(url);
        
        var headers=Object.assign({},req.headers);
        delete headers.host;
        var options = {
            //protocol : obj.protocol,
            host: obj.host,
            port: obj.protocol=="https:"?443:obj.port,
            path:  obj.path,
            method: req.method,
            headers: headers 
          };
          var httpObj=http;
          if(obj.protocol=="https:"){
            httpObj=https;
          }
          var request = httpObj.request(options,function(response){
            res.statusCode = response.statusCode;
            response.pipe(res);
          }).on("error",function(e){
              debugger;
            res.statusCode = 503;
            res.end();
          });
          res.setHeader('Content-Type', "text/html;charset=utf-8");
          if(headers["accept-encoding"].indexOf("gzip")>=0){
            res.setHeader('Content-Encoding', "gzip");
          }
          req.pipe(request);
          
       
    }
    md5 (input){
        return crypto.createHash('md5').update(input).digest("hex");
    }
    formatDate (date,fmt){ 
        var o = {
            "M+" : date.getMonth()+1,                 //月份
            "d+" : date.getDate(),                    //日
            "h+" : date.getHours(),                   //小时
            "m+" : date.getMinutes(),                 //分
            "s+" : date.getSeconds(),                 //秒
            "q+" : Math.floor((date.getMonth()+3)/3), //季度
            "S"  : date.getMilliseconds()             //毫秒
        };
        if(/(y+)/.test(fmt))
            fmt=fmt.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length));
        for(var k in o)
            if(new RegExp("("+ k +")").test(fmt))
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        return fmt;
    }

 
}