const Emitter = require('events');
const path=require("path");
const fs=require("fs");
const Url=require("url");
const ejs = require('ejs');
const Session=require("./session.js");
const queryString = require("querystring");

module.exports = class Application extends Emitter {
    constructor(req,res,config) {
        super();
        return this.createContext(req,res,config);
    }

    createContext(req,res,config) {
        var obj=Url.parse(req.url,true);
        let context={
          _req:req,
          _res:res,
          isHandled:false,
          config:config,
          session:{},
          request:{
            method:req.method,
            headers:req.headers,
            cookies:{},
            host:req.headers["host"],
            type:req.headers["content-type"],
            url:req.url,
            path:obj.pathname.replace(/\.\./g,""),//security
            query:obj.query,
            clientIP:req.connection.remoteAddress,
            userAgent:req.headers["user-agent"],
            makeUrl:function (input){
              if(!input){input={};}
              var queryCopy=Object.assign({},this.query)
              Object.assign(queryCopy,input);
              return this.path+"?"+queryString.stringify(queryCopy);
            }
          },
          response:{
            headers:{
              'Content-Type': 'text/html;charset=utf-8'
            },
            cookies:{},
            __body:"",
            __isFinish:false,
            code:200,
            redirect:function (url){
              res.writeHead(301, {'Location': url});
              res.end();
            },
            end:function (text,code){
              res.writeHead(code || 200, { 'Content-Type': 'text/plain' });
              res.end(text);
              this.__isFinish=true;
            },
            writeFile(localPath){
              var stream = fs.createReadStream(localPath);
              stream.pipe(res);
            },
            writeStream(stream){
              stream.pipe(res);
            }
          }
        }
        if(context.request.path=="/" && config["index"]){ //set default page
            context.request.path=config["index"];
        }
        
        const cookies = req.headers['cookie'];
        if(cookies){
          var arr=cookies.split(";");
          arr.forEach(function (item){
            var m=item.match(/(.+?)=(.+)/)
            var key=m[1].trim();
            var val=m[2].trim();
            context.request.cookies[key]=val;
          })
    
        }
    
        context.session=new Session(context);
       
        let timerId;
        Object.defineProperty(context.response,"body", {
          get : function(){
            return context.response.__body;
          },
          set : function(newValue){
            context.response.__body = newValue;
            clearImmediate(timerId);
            timerId=setImmediate(function (){
              doResponse();
            }) 
    
          },
          enumerable : true,
          configurable : true
        })
    
        context.render=function (){
          var html="";
          if(arguments.length==1){
            if(typeof arguments[0]=="string" ){
              html=arguments[0]
            }else if(typeof arguments[0]=="object"){
              var tempFilePath=path.resolve(process.cwd(),"service/"+this.request.path+".ejs");
              if(fs.existsSync(tempFilePath)){
                var temp=fs.readFileSync(tempFilePath).toString();
                var renderObj=arguments[0];
                renderObj.filename=tempFilePath;
                html=ejs.render(temp, arguments[0]);
              }else{
                html=JSON.stringify(arguments[0]);
              }
             
            }
          }else if(arguments.length>1){
            html=ejs.render(arguments[0],arguments[1]);
          }
    
          this.response.body=html;
    
        }


          function doResponse(){
            let _res=context._res;
            let response=context.response;
            if(response.__isFinish){
              return ;
            }
        
            var cookieList=[];
            for(var key in response.cookies){
              var item=response.cookies[key];
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
              response.headers['set-cookie']=cookieList;
            }
            
            
            _res.writeHead(200, response.headers);
            _res.end(response.__body);
        }
        
     
        return context;
      }

      
    

}