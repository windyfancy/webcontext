const Url=require("url");
const http=require("http");
const https = require('https');

module.exports={
    _rules:[],
    loadRules(rules){
         
        for(var key in rules){
            this.addRule(key,rules[key]);
        }
         
    },
    addRule:function (lookFor,sendTo){
        this._rules.push({lookFor:lookFor,sendTo:sendTo});
    },
    matchRules:function (ctx){
        for(var i=0;i<this._rules.length;i++){
            let item=this._rules[i];
            var reg=item.lookFor;
            if(typeof reg=="string"){
                reg=new RegExp(reg);
            }
            var m=ctx.request.url.match(reg);
            if(m){
                if(item.sendTo.indexOf("http:")>=0 || item.sendTo.indexOf("https:")>=0){
                    this.httpProxy(ctx,item.sendTo);
                }else{
                    ctx.request.url=ctx.request.url.replace(reg,item.sendTo);
                    var obj=Url.parse(ctx.request.url,true);
                    ctx.request.path=obj.pathname;
                    ctx.request.query=obj.query;
                }
                break;
            }
        }
        
    },
    httpProxy:function (ctx,url){
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

}