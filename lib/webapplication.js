
const http = require('http');
const Emitter = require('events');
const path=require("path");
const fs=require("fs");
const Url=require("url");
const formidable = require('formidable');
const log4js = require('log4js');
const DataBase=require("./database.js");
const Context = require('./context.js');
const Session = require('./session.js');
const zlib = require('zlib');
const serverUtility=require("./server_utility.js")
const urlRewriter=require("./url_rewriter.js")

var _dataBase=null;
var logger=null;
var loggerAccess=null;
var workDirectory=process.cwd();

module.exports = class Application extends Emitter {

  
  constructor(options) {
    super();
    // default setting
    var config={
      port:"80",
      index:"/index",
      sessionKey:"webcontext_session_id",
      errorStackTrace:true,
      uploadDir:"upload",
      serviceDir:"service",
      clientDir:"frontend",
      staticFileType:"js|css|jpg|jpeg|png|svg|html|htm|txt|woff|woff2|ttf|eot",
      gzipFileType:"html|htm|xml|txt|css|js",
      corsAllowOrigin:"localhost",
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
    if(config.rewriterRules){
      urlRewriter.loadRules(config.rewriterRules);
    }

    if(config["database"]){
      _dataBase=new DataBase(config["database"]);
      _dataBase.createSessionTable();// create memory table


      //60秒清理一次无效的session
      setInterval(()=>{
        Session.cleanSchedule(_dataBase);
      },1000*60);
     
    }

    this.config=config;

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

    this.httpHandlerList = [];
    this.context = {}

    this.watchServiceFile();
    
    this.listen();



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
  
  rewriter(config){
    urlRewriter.loadRules(config);
  }


  createHttpHandler() {

    const handleRequest = async (req, res) => {
      
      //return this.handleRequest(ctx, fn);
      const ctx = this.createContext(req, res);
      ctx.workDirectory=workDirectory;
      ctx.server=serverUtility;
      urlRewriter.matchRules(ctx);
      if(!ctx.isProxy){
        this.createStaticServer(ctx,loggerAccess);
      }

      await this.getRequestBody(ctx);

      var serviceFilePath=path.resolve(workDirectory,this.config["serviceDir"]+"/"+ctx.request.path+".js");
      if(fs.existsSync(serviceFilePath)){
        ctx.isHandled=true;
        var obj=require(serviceFilePath);
        Object.setPrototypeOf(ctx,obj);
        if(ctx.onRequest){
          try{
            if(ctx._req.method=="GET" || ctx._req.method=="POST"){
              ctx.logger.info("serviceUrl="+ctx.request.path+"|ip="+ctx.request.clientIP+"|ua="+ctx.request.userAgent);
              ctx.onRequest(ctx);
            }
          }catch(ex){
            console.error(ex.stack);
            ctx.logger.error(ex.stack.toString())
            ctx._res.statusCode = 500;
            if(ctx.config["errorStackTrace"]){
              ctx._res.end("<h1>Internal Server Error</h1><p>"+htmlEncode(ex.stack)+"</p>");
            }else{
              ctx._res.end("<h1>Internal Server Error</h1>");
            }
             

          }

        }else{
          throw new Error("onRequest method is undefined!");
        }
      }

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

        this.handleCORS(ctx);

        if(!ctx.isHandled){
          res.statusCode = 404
          res.end("404 Not Found");
          loggerAccess.error("404 Not Found:"+ctx.request.url)
        }

        function htmlEncode(input){
          return input.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\n/g,"<br>");
        }
      

    };

    return handleRequest;


  }

  handleCORS(ctx){
    ctx.response.headers['Access-Control-Allow-Origin']= ctx.config["corsAllowOrigin"]; 
    if (ctx.request.method == 'OPTIONS') {
       
      ctx.response.headers['Access-Control-Allow-Headers']='Content-Type,Content-Length,Authorization,Accept,X-Requested-With,Cookie';
      ctx.response.headers['Access-Control-Allow-Methods']='POST,GET,OPTIONS';
      ctx.response.headers['Access-Control-Allow-Credentials']='true';
      ctx.response.body="";
        
    }
  }

  
  createContext(req, res) {
    let context= new Context(req,res,this.config);
 
    if(_dataBase){ //set database reference
      context.database=_dataBase;
    }
    context.logger=logger;
 
    return context;

  }



  getRequestBody(ctx) {
    return new Promise((resolve, reject) => {
      try {
        var ctype = ctx.request.type;

        //file upload
        if (typeof ctype == "string" && ctype.indexOf("multipart/form-data") >= 0) {
          let form = new formidable.IncomingForm();
          form.encoding = 'utf-8';
          form.keepExtensions = true;
          //form.maxFieldsSize = 2 * 1024 * 1024; 
          form.multiples = true;
          var uploadDir= path.resolve(workDirectory, ctx.config["uploadDir"] || "./upload/")  // save path
          if(!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir);
          }

          form.uploadDir=uploadDir;
          form.parse(ctx._req, function (err, fileds, files) {
            if (err) { return console.log(err) }

            ctx.request.files = files;
            resolve();

          })
        } else {
          var chunks = [], size = 0;
          ctx._req.on('data', (data) => {
            chunks.push(data);
            size += data.length;
          });
          ctx._req.on('end', () => {

            let result = "";
            if (typeof ctype == "string" && ctype.indexOf("application/x-www-form-urlencoded") >= 0) {
              result = Buffer.concat(chunks, size).toString("utf-8");
              ctx.request.data = Url.parse("url?" + result, true)["query"];
            } else if (typeof ctype == "string" && ctype.indexOf("application/json") >= 0) {
              result = Buffer.concat(chunks, size).toString("utf-8");
              ctx.request.data = JSON.parse(result);
            }
            ctx.request.body = result;
            resolve(result);
          });
        }

      } catch (e) {
        ctx.body = e.toString();
        reject(e);
      }
    })
  }

  watchServiceFile() {
    var serviceDir = path.resolve(workDirectory,this.config["serviceDir"]);
    if(!fs.existsSync(serviceDir)){
      createInitFile(serviceDir);
    }
    fs.watch(serviceDir,{
        persistent: true,
        recursive: true
    },function(event,filename){
        if (event === "change") {
            let fullName=path.resolve(serviceDir,filename);
            if(path.extname(fullName)==".js"){
              cleanCache(fullName);
              try {
                  require(fullName);
                  console.log("reload module",filename);
              } catch (ex) {
                  console.error('module update failed');
              }
            }
        }
    });
    

    function createInitFile(fullpath){
      fs.mkdirSync(fullpath);
      let indexFile=path.resolve(fullpath,"index.js");
      let content=`module.exports= {  
  onRequest() {  
      this.render({msg:'hello'});
  }
}`
      fs.writeFileSync(indexFile,content);

      indexFile=path.resolve(fullpath,"index.ejs");
      content="<h1><%=msg%>,this is the homepage</h2>\r\n<p>the template file location is /service/index.ejs</p>";
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
        require.cache[modulePath] = null;
    }
 
};
 

  createStaticServer(ctx,loggerAccess) {
    const req = ctx._req;
    const res = ctx._res;
    const p = ctx.request.path;
    const extName=path.extname(p).substr(1);
    if (extName.match(new RegExp(ctx.config["staticFileType"]))) {
      ctx.isHandled=true;
      var localPath = path.resolve(workDirectory, this.config["clientDir"] + p);
      if (fs.existsSync(localPath)) {
        var mineTypeMap={
          html:'text/html;charset=utf-8',
          htm:'text/html;charset=utf-8',
          xml:"text/xml;charset=utf-8",
          png:"image/png",
          jpg:"image/jpeg",
          jpeg:"image/jpeg",
          gif:"image/gif",
          css:"text/css;charset=utf-8",
          txt:"text/plain;charset=utf-8",
          mp3:"audio/mpeg",
          mp4:"video/mp4",
          ico:"image/x-icon",
          tif:"image/tiff",
          svg:"image/svg+xml",
          zip:"application/zip",
          ttf:"font/ttf",
          woff:"font/woff",
          woff2:"font/woff2",

        }
        if (mineTypeMap[extName]) {
          res.setHeader('Content-Type', mineTypeMap[extName]);
        }
        var stream = fs.createReadStream(localPath);
        


        if (extName.match(new RegExp(ctx.config["gzipFileType"]))) {
          res.setHeader('Content-Encoding', "gzip");
          const gzip = zlib.createGzip();
          stream.pipe(gzip).pipe(res);
        }else{
          stream.pipe(res);
        }
        loggerAccess.info("url="+ "|ip="+ctx.request.clientIP+"|ua="+ctx.request.userAgent);

      } else {
        console.error("file not exists:", localPath, req.url);
        loggerAccess.error("msg=file not exists|local="+ localPath+"|url="+ req.url);
      }
    }
  }

}
