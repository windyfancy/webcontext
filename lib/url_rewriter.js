const Url=require("url");
const http=require("http");
const https = require('https');
/**
 * 
 *   proxy:{
            "/login": {
                target: "https://192.168.1.1/", 
                cookieDomainRewrite: true,  
                rewrite:  "/web/login"
                onProxy:function(proxyRes, req, res) {
	            }
}

 */
module.exports={
    _rules:{},
    loadRules(rules){
         
        for(var key in rules){
            this._rules[key]=rules[key];
        }
         
    },
    // addRule:function (lookFor,sendTo){
    //     this._rules.push({lookFor:lookFor,sendTo:sendTo});
    // },
    matchRules:function (ctx){
        
        for(var key in this._rules){
            let item=this._rules[key];
            var reg=key;
            if(typeof reg=="string"){
                reg=new RegExp(reg);
            }
            var m=ctx.request.url.match(reg);
            if(m){
                
                let sendTo=item.rewrite;
                sendTo=ctx.request.url.replace(reg,sendTo)
                sendTo=item.target+sendTo;
                
                if(item.referer){
                    ctx.request.headers["referer"]=item.referer;
                }
                
                if(sendTo.indexOf("http:")>=0 || sendTo.indexOf("https:")>=0){
                    //this.httpProxy(ctx,item.sendTo);
                    ctx.server.proxy(sendTo,(result)=>{
                        if(result.headers["set-cookie"]){
                            result.headers["set-cookie"]=result.headers["set-cookie"].map((item)=>{
                                item= item.replace(/\s+Secure(;)?/,""); 
                                return item.replace(/Domain=.+?[;$]/,"");
                            })
                        }

                        if(item.onProxy){
                            item.onProxy(result)
                        }
                    })
                }else{
                    ctx.request.url=ctx.request.url.replace(reg,sendTo);
                    var obj=Url.parse(ctx.request.url,true);
                    ctx.request.path=obj.pathname;
                    ctx.request.query=obj.query;
                }
                break;
            }
        }
        
    }
    

}