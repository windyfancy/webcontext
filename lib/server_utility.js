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
        if(ctx){
            this.context=ctx;
        }
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
        process.env.NODE_TLS_REJECT_UNAUTHORIZED ='0'; //避免产生ssl证书错误：CERT_HAS_EXPIRED
        if(!options){options={}}
        return new Promise( (resolve)=>{
            var obj=Url.parse(url);
            const params = {
                hostname: obj.hostname,
                port: obj.protocol=="https:"?443:obj.port,
                path: obj.path,
                method: 'GET',
                strictSSL: false
  
              };
              var postData=null;
              if(options && options.postData){
                  params.method="POST";
                  params.headers= {}
                  postData=options.postData;
                  if(!options.headers){
                      if(typeof postData=="string"){
                        params["headers"]['Content-Type']= 'application/x-www-form-urlencoded';
                        params["headers"]['Content-Length']= Buffer.byteLength(options.postData)
                      }else if(typeof postData=="object"){
                        params["headers"]['Content-Type']= 'application/json';
                      }
                  }
                  
                  delete options.postData;
              }
              Object.assign(params,options)
            var httpObj=http;
            if(obj.protocol=="https:"){
                httpObj=https;
            }
            
            var req = httpObj.request(params, function (res) {
                //res.setEncoding('utf8');
                var result={
                    code:res.statusCode,
                    headers:res.headers
                }
                var chunks = [], size = 0;
                res.on('data', function (chunk) {
                    chunks.push(chunk);
                    size += chunk.length;      
                }).on('end', function () {
                    let bf=Buffer.concat(chunks, size);
                    let body = bf.toString("utf-8");
                    result.body=body;
                    result.bodyBuffer=bf;
                    resolve(result);
                });
            });
            if(postData){
                if(typeof postData=="object"){
                    postData=JSON.stringify(postData);
                }
                req.write(postData);
            }
            req.end();
        })
    }
    proxy(url,callback){
        process.env.NODE_TLS_REJECT_UNAUTHORIZED ='0'; //避免产生ssl证书错误：CERT_HAS_EXPIRED
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
            strictSSL: false,
            headers: headers 
        };

        var httpObj=http;
        if(obj.protocol=="https:"){
            httpObj=https;
        }
        var request = httpObj.request(options,function(response){
            if(ctx.response.headers["Access-Control-Allow-Origin"]){
                response.headers["Access-Control-Allow-Origin"]=ctx.response.headers["Access-Control-Allow-Origin"];
            }
            // res.statusCode = res.statusCode;
            if(callback){
                var result={
                    req,res,
                    path:obj.path,
                    proxyResponse:response,
                    code:response.statusCode,
                    headers:response.headers
                }
                var chunks = [], size = 0;
                response.on('data', function (chunk) {
                    chunks.push(chunk);
                    size += chunk.length;      
                }).on('end', function () {
                    let bf=Buffer.concat(chunks, size);
                    // let body = bf.toString("utf-8");
                    // result.body=body;
                    result.body=bf;
                    callback(result);

                    result.headers["content-length"]=result.body.byteLength;
                    res.writeHead(result.code,result.headers);
                    res.end(result.body);

                  
                });

            }else{
                response.pipe(res);
            }
        }).on("error",function(e){
            
            console.error(e)
            res.statusCode = 503;
            res.end();
        });
        // res.setHeader('Content-Type', "text/html;charset=utf-8");
        // if(headers["accept-encoding"].indexOf("gzip")>=0){
        //     res.setHeader('Content-Encoding', "gzip");
        // }
        req.pipe(request);

        
          
       
    }
    md5 (input){
        return crypto.createHash('md5').update(input).digest("hex");
    }
    formatDate (date,fmt){ 
        var o = {
            "M+" : date.getMonth()+1,                 //月份
            "d+" : date.getDate(),                    //日
            "w+": "日一二三四五六".charAt(date.getDay()),
            "h+" : date.getHours(),                   //小时
            "m+" : date.getMinutes(),                 //分
            "s+" : date.getSeconds(),                 //秒
            "q+" : Math.floor((date.getMonth()+3)/3), //季度
            "S"  : date.getMilliseconds()           //毫秒
        };
        if(/(y+)/.test(fmt))
            fmt=fmt.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length));
        for(var k in o)
            if(new RegExp("("+ k +")").test(fmt))
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        return fmt;
    }
    getRelativeDate(date, now) {
        if (!date) return "";
        if (typeof date == "string"){
            date=Number(date);
        }
        if (typeof date == "number") date = new Date(date * 1000);
        now = now || new Date();
        var result;
        //今天的
        var t = now.getTime() - date.getTime(); 	//相差毫秒
        var deltaDay=Math.round(t/(24*60*60*1000)); //相差天数
        if (t < 0) {
            result = this.formatDate(date,"yyyy-M-dd");
        }
        else if (date.getYear() == now.getYear() && date.getMonth() == now.getMonth() && date.getDate() == now.getDate()) {
            var minutes = Math.round(t / 1000 / 60);
            if (minutes == 0) {
                result = "刚刚";
            } else if (minutes > 0 && minutes < 60) {
                result = minutes + "分钟前";
            } else {
                result = Math.floor(minutes / 60) + "小时前";
            }
        }else if(deltaDay<=3){
            result = deltaDay + "天前";
        } else if (date.getYear() == new Date().getYear()) {
            result = this.formatDate(date,"M-dd(周w)");
        } else {
            result = this.formatDate(date,"yyyy-M-dd(周w)");
        }
        return result;
    }

 
}