const Emitter = require('events').EventEmitter;
const path=require("path");
const fs=require("fs");
const Url=require("url");

module.exports = class Request extends Emitter {
    constructor(req,res,config) {
        super();
         
       var obj=Url.parse(req.url,true);
       this.method=req.method
       this.headers=req.headers
       this.cookies={}
       this.host=req.headers["host"]
       this.type=req.headers["content-type"]
       this.url=req.url,
       this.path=obj.pathname.replace(/\.\./g,"") //security
       this.query=obj.query
       this.clientIP=req.connection.remoteAddress
       this.userAgent=req.headers["user-agent"]

       

       if(this.path=="/" && config["index"]){ //set default page
            this.path=config["index"];
        }

        this.relativePath=this.path;

        if(config.rootPath && config.rootPath.length>1 && this.path.startsWith(config.rootPath)){
            this.relativePath=this.path.replace(config.rootPath,"");
        }
        
        const cookies = req.headers['cookie'];
        if(cookies){
            var arr=cookies.split(";");
            arr.forEach( (item)=>{
                var m=item.match(/(.+?)=(.+)/)
                var key=m[1].trim();
                var val=m[2].trim();
                this.cookies[key]=val;
            })

        }

       
    }

    makeUrl (input){
        if(!input){input={};}
        var queryCopy=Object.assign({},this.query)
        Object.assign(queryCopy,input);
        return this.path+"?"+JSON.stringify(queryCopy);
    }
}