
const http = require('http');
const Emitter = require('events');
const path=require("path");
const fs=require("fs");
const Url=require("url");
const log4js = require('log4js');
const DataBase=require("./database.mysql.js");
const ModelFactory=require("./model_factory.js");
const Context = require('./context.js');
const Session = require('./session.js');
const zlib = require('zlib');
const requestBody=require("./request_body.js");
const ServerUtility=require("./server_utility.js");
const StaticServer=require("./static_server.js");
const urlRewriter=require("./url_rewriter.js");

var _dataBase=null;
var _modelFactory=null;
var logger=null;
var loggerAccess=null;
var workDirectory=process.cwd();
var _mixins=[];



class Application extends Emitter {

  
  constructor(options) {
    super();
    // default setting
    var config={
      port:"80",
      index:"/index",
      sessionKey:"webcontext_session_id",
      sessionPeriod:60,
      errorStackTrace:true,
      uploadDir:"upload",
      serviceDir:"service",
      clientDir:"www",
      staticFileType:"js|css|jpg|jpeg|png|svg|html|htm|txt|json|woff|woff2|ttf|eot|zip|rar",
      gzipFileType:"html|htm|xml|txt|css|js",
      cors:{
        allowOrigin:"localhost"
      },
      ssl:{
        "enable":false,
        "port":443,
        "key": "ssl/privatekey.pem",
        "cert": "ssl/certificate.pem"
     }
    }
    var configFileName=path.resolve(workDirectory,"./web.config.json");
    if(fs.existsSync(configFileName)){
        var content=fs.readFileSync(configFileName).toString();
        var config2=eval("("+content+")");
        config=Object.assign(config,config2);
        
        
    }else{
      fs.writeFileSync(configFileName,JSON.stringify(config,null,"    "))
      console.log("auto create web.config.json file.")
    }
    if(config.proxy){
      urlRewriter.loadRules(config.proxy);
    }
    this.config=config;
    this.data={};
    
    if(config["database"]){
      var dbConfig;
      if(!Array.isArray(config["database"])){
        dbConfig=[config["database"]]
      } else{
        dbConfig=config["database"];
      }
      _dataBase=[];
      dbConfig.forEach(function (configItem,idx){
        if(configItem.type=="sqlite"){
          let SqliteDataBase=require("./database.sqlite");
          _dataBase[idx]=new SqliteDataBase(configItem);
        }else{
          _dataBase[idx]=new DataBase(configItem);
        }
      })

     
      this.emit("dbReady");

      // _dataBase[0].createSessionTable();// create memory table

      this.database=_dataBase[0];

      _modelFactory=new ModelFactory(this);
       

      // this.emit("sessionReady")


      //60秒清理一次无效的session
      // setInterval(()=>{
      //   Session.cleanSchedule(_dataBase[0],config.sessionPeriod);
      //   this.emit("sessionClear");
      // },1000*60);

      setInterval(()=>{
        this.emit("timer",this);
      },1000);
     
    }

    

    log4js.configure({
      appenders: { 
        app: { 
          type: 'file', 
          filename: path.resolve(workDirectory,"logs/app"),
          pattern : 'yyyy-MM-dd.log',
          "alwaysIncludePattern": true
        } ,
          access: { 
            type: 'file', 
            filename: path.resolve(workDirectory,"logs/access"),
            pattern : 'yyyy-MM-dd.log',
            "alwaysIncludePattern": true,
          }
      },
      categories: { 
          default: { appenders: ['app'], level: 'info' },
           access: { appenders: [ 'access'], level: 'info' } 
      }
    });
    
    logger = log4js.getLogger();
    loggerAccess=log4js.getLogger('access');

    this.logger=logger;
    this.httpHandlerList = [];
    this.context = {}
    this.server=new ServerUtility();

    this.watchServiceFile();
    this.listen();
    var port =this.config["port"]==80?"":":"+this.config["port"];
    console.log("WebContext Running on http://localhost"+port+"/ (Press CTRL+C to quit)")
    this.emit("ready");

  }

  mixin(obj){
    _mixins.push(obj);
  }

  listen() {
    let config=this.config;
    if(config.ssl && config.ssl.enable){
      let sslOptions={
        key: fs.readFileSync(path.resolve(workDirectory,'ssl/privatekey.pem')), // 私钥
        cert: fs.readFileSync(path.resolve(workDirectory,'ssl/certificate.pem')) // 公钥
      }
      const http2 =require('http2');
      var sslServer=http2.createSecureServer(sslOptions, this.createHttpHandler());
      sslServer.listen(config.ssl.port)
    }
    const port=this.config["port"];
    const server = http.createServer(this.createHttpHandler());
    process.on("uncaughtException",(err)=>{
      console.error(err.stack)
    })
    server.listen(port);
  }

  onRequest(path,handler) {
   
    var obj={
      path:arguments[0],
      handler:arguments[1],
    }
    this.httpHandlerList.push(obj);
    return this;
  }
  
  proxy(config){
    urlRewriter.loadRules(config);
  }


  createHttpHandler() {

    const handleRequest = async (req, res) => {

      //return this.handleRequest(ctx, fn);
      const ctx = this.createContext(req, res);
      ctx.workDirectory=workDirectory;
      ctx.server=new ServerUtility(ctx);
      ctx.application=this;
      
      
      this.handleCORS(ctx);
      if(ctx.request.method == 'OPTIONS'){ //如果是cors options请求，不再往下执行
        return 
      }

      urlRewriter.matchRules(ctx);
      

      if(!ctx.isProxy){
        //this.createStaticServer(ctx,loggerAccess);
        new StaticServer(ctx,loggerAccess);

        await requestBody.parse(ctx);

        this.autoRouter(ctx);
  
          this.httpHandlerList.sort(function (a,b){
            return !a.path?0:1
          })
  
          for (var i=0;i<this.httpHandlerList.length;i++){
            let item=this.httpHandlerList[i];
            let fn=item.handler;
            let p=ctx.request.path;
            if((typeof item.path=="string" && p==item.path) || (item.path instanceof RegExp && p.match(item.path))){
              
              var ret=fn.call(ctx,ctx);
              if(ret!=false){
                ctx.isHandled=true;  
              }
              if(ctx.response.__isFinish){
                break;
              }
            }
            
          }
  
          
  
          if(!ctx.isHandled){
            res.statusCode = 404
            res.end("404 Not Found");
            loggerAccess.error("404 Not Found:"+ctx.request.url)
          }


      }

  


      

    };

    return handleRequest;


  }

  autoRouter(ctx){
    
    var routerFile=async (filePath,fileType,methodName)=>{
      
        ctx.isHandled=true;
        var obj=require(filePath);
        if(typeof obj=="function"){ //如果是class则创建实例
          var proto=obj.prototype;
          var nameList=Object.getOwnPropertyNames(proto);//class的方法和属性不可枚举，只能这样遍历

          nameList.forEach((key)=>{
            if(key!="constructor"){
              ctx[key]=proto[key];// copy方法
            }
            
          })
        }else{
           Object.setPrototypeOf(ctx,obj);
        }
        if(_mixins.length>0){
          Object.assign(obj,..._mixins);
        }

       
        if(fileType=="ejs"){
          ctx.onLoad=function (){
            this.render({context:ctx,contentType:"json"});
          }
        }
        //if(ctx.onRequest){ctx.onLoad=ctx.onRequest;}//事件改名，做下兼容
        var onLoadResult=null;
        if(ctx.onLoad){
          try{
            if(ctx._req.method.toUpperCase()=="GET" || ctx._req.method.toUpperCase()=="POST"){
              ctx.logger.info("serviceUrl="+ctx.request.path+"|ip="+ctx.request.clientIP+"|ua="+ctx.request.userAgent);
              if(typeof ctx.onLoad=="function"){
                  if(ctx.onLoad.constructor.toString().indexOf("AsyncFunction")>=0){ //异步函数
                    onLoadResult=await ctx.onLoad(ctx);
                  }else{
                    onLoadResult=ctx.onLoad(ctx);
                  }
              }
              
            }
          }catch(ex){
            console.error(ex.stack);
            ctx.logger.error(ex.stack.toString())
            ctx._res.statusCode = 500;
            if(ctx.config["errorStackTrace"]){
              function htmlEncode(input){
                return input.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\n/g,"<br>");
              }
              ctx._res.end("<h1>Internal Server Error</h1><p>"+htmlEncode(ex.stack)+"</p>");
            }else{
              ctx._res.end("<h1>Internal Server Error</h1>");
            }
            

          }

        }
        
        //if(onLoadResult!=false && methodName){
        if( methodName){
           if(ctx[methodName]){
              ctx[methodName](ctx);
           }
        }
      
    }
    
    var reqPath=ctx.request.relativePath;//ctx.request.path;
    var methodName=null;
    if(reqPath.indexOf(":")>=0){
      methodName=reqPath.match(/:([^\?$]+)/)[1];
      reqPath=reqPath.replace(/:\w+$/,"");
    }
    var serviceFilePath=path.resolve(workDirectory,this.config["serviceDir"]+"/"+reqPath+".js");
    if(fs.existsSync(serviceFilePath)){
      routerFile(serviceFilePath,"js",methodName);
    }else{
      let tempFilePath=path.resolve(workDirectory,this.config["serviceDir"]+"/"+reqPath+".ejs");
      if(fs.existsSync(tempFilePath)){
        routerFile(tempFilePath,"ejs");
      }
    }
  }

  handleCORS(ctx){
    if(ctx.config["cors"]){
      ctx.response.headers['Access-Control-Allow-Origin']= ctx.config["cors"]["allowOrigin"]; 
      if (ctx.request.method == 'OPTIONS') {
        
        ctx.response.headers['Access-Control-Allow-Headers']='Content-Type,Content-Length,Authorization,Accept,X-Requested-With,Cookie';
        ctx.response.headers['Access-Control-Allow-Methods']='POST,GET,OPTIONS';
        ctx.response.headers['Access-Control-Allow-Credentials']='true';
        ctx.response.body="";
      
          
      }
    }
  }

  
  createContext(req, res) {
    let context= new Context(req,res,this.config);

    
 
    if(_dataBase){ //set database reference
      context.databaseList=_dataBase;
      context.database=_dataBase[0];
      context.models=_modelFactory;
    }
    context.logger=logger;
    return context;
  }


  watchServiceFile() {
    var serviceDir = path.resolve(workDirectory,this.config["serviceDir"]);
    if(!fs.existsSync(serviceDir)){
      createInitFile(serviceDir);
    }

    var clientDir = path.resolve(workDirectory,this.config["clientDir"]);
    console.log("clientDir",clientDir)
    if(!fs.existsSync(clientDir)){
      fs.mkdirSync(clientDir);
    }

    try{ //avoid watch recursively is unavailable on the current platform
    
        fs.watch(serviceDir,{
            persistent: true,
            recursive: true
        },function(event,filename){
            if (event === "change") {
                let fullName=path.resolve(serviceDir,filename);
                if(path.extname(fullName)==".js"){
                  if(fs.existsSync(fullName)){
                    
                    try {
                        cleanCache(fullName);
                        //var m=require(fullName);
                        console.log("reload module",filename);
                    } catch (ex) {
                        console.error('module update failed');
                    }
                  }
                }
            }
        });
    }catch(ex){
      console.error(ex.stack);
    }
    

    function createInitFile(fullpath){
      fs.mkdirSync(fullpath);
      
      let indexFile=path.resolve(fullpath,"index.js");
      let content=`module.exports= {  
  onLoad() {  
      this.render({msg:'hello'});
  }
}`
      fs.writeFileSync(indexFile,content);

      indexFile=path.resolve(fullpath,"index.ejs");
      content=`<h1>homepage</h2>\r\n
      <p>1.the template file location is /service/index.ejs</p>
      <p>2.put your static files in /www folder </p>
      `;
      fs.writeFileSync(indexFile,content)
      console.warn("/service directory is not exists,auto created it!")
    }

    function cleanCache(modulePath) {
        var module = require.cache[modulePath];
        if (!module) {
            return;
        }
    
        if (module.parent) {
            module.parent.children.splice(module.parent.children.indexOf(module), 1);
        }
        require.cache[modulePath] = require(modulePath);
    }
 
};
 

 

}

module.exports = {
  Application,
  Context,
  Session
}
