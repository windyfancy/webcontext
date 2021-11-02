const Emitter = require('events').EventEmitter;

const path=require("path");
const fs=require("fs");
const Url=require("url");
const ejs = require('ejs');
const queryString = require("querystring");

module.exports = class Response extends Emitter {

    constructor(req,res,config) {
        super();
        this.headers={
            'Content-Type': 'text/html;charset=utf-8'
          }
        this.cookies={}
        this.__body=""
        this.__isFinish=false
        this.code=200;

        this.__req=req;
        this.__res=res;
 
         
    }

      get body(){
        return  this.__res.__body;
      } 

      set body(newValue){

        this.__body = newValue;
        clearImmediate(this.timerId);
        this.timerId=setImmediate( ()=>{ //延迟写入
          this.end(newValue,200)
        }) 

      }

      __writeCookie(){  //将cookie写入response
        if(this.__isFinish){
          return ;
        }
    
        var cookieList=[];
        for(var key in this.cookies){
          var item=this.cookies[key];
          if(typeof item=="string"){
            item={"value":item}
          }
          var cookieStr=key+"="+item.value+";";
    
          if(item.path){cookieStr+=" path="+item.path+";"}
          if(item.domain){cookieStr+=" domain="+item.domain+";"}
          if(item.expires){cookieStr+=" expires="+item.expires.toGMTString()+";"}
          if(item.maxAge){cookieStr+=" max-age="+item.maxAge+";"}
          if(item.httpOnly){cookieStr+=" httpOnly;"}
          cookieList.push(cookieStr);
        }
        if(cookieList.length>0){
          this.headers['set-cookie']=cookieList;
        }
        
        
        this.__res.writeHead(this.code, this.headers);

    }

      redirect (url){
        this.__res.writeHead(301, {'Location': url});
        this.__res.end();
      }

      end (text,code){
        this.__res.writeHead(code || 200, { 'Content-Type': 'text/html' });
        this.__writeCookie();
        this.__res.end(text);
        this.__isFinish=true;
      }


      writeFile(localPath){
        if(fs.existsSync(localPath)){
        var stream = fs.createReadStream(localPath);
        stream.pipe(this.__res);
        }else{
            this.__res.writeHead(404);
            this.__res.end();
        }
      }
      writeStream(stream){
        stream.pipe(this.__res);
      }

}