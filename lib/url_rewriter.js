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
                    //this.httpProxy(ctx,item.sendTo);
                    ctx.server.proxy(item.sendTo);
                }else{
                    ctx.request.url=ctx.request.url.replace(reg,item.sendTo);
                    var obj=Url.parse(ctx.request.url,true);
                    ctx.request.path=obj.pathname;
                    ctx.request.query=obj.query;
                }
                break;
            }
        }
        
    }
    

}