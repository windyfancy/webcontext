
const http = require('http');
const Emitter = require('events');
const path=require("path");
const fs=require("fs");
const Url=require("url");
const formidable = require('formidable');
const DataBase=require("./database.js");
const Context = require('./context.js');
const Session = require('./session.js');

var _dataBase=null;
var workDirectory=process.cwd();

module.exports = class Application extends Emitter {

  
  constructor() {
    super();
    // default setting
    var config={
      port:"80",
      index:"/index",
      sessionKey:"my_session_id",
      uploadDir:"./upload",
      serviceDir:"./service",
      clientDir:"./frontend"
    }
    var configFileName=path.resolve(workDirectory,"./web.conf");
    if(fs.existsSync(configFileName)){
        var content=fs.readFileSync(configFileName).toString();
        var config2=eval("("+content+")");
        config=Object.assign(config,config2);
        
        
    }else{
      fs.writeFileSync(configFileName,JSON.stringify(config,null,"    "))
      
    }


    if(config["database"]){
      _dataBase=new DataBase(config["database"]);
      Session.createTable(_dataBase);// create memory table
    }

    this.config=config;
    

    this.httpHandlerList = [];
    this.context = {}

    this.watchServiceFile();

  }


  listen(...args) {
    if(args.length==0){
      args[0]=this.config["port"];
    }
    const server = http.createServer(this.createHttpHandler());
    return server.listen(...args);
  }



  onRequest(path,handler) {
   
    var obj={
      path:arguments[0],
      handler:arguments[1],
    }
    this.httpHandlerList.push(obj);
    return this;
  }


  createHttpHandler() {

    const handleRequest = async (req, res) => {
      
      //return this.handleRequest(ctx, fn);
      const ctx = this.createContext(req, res);
      this.createStaticServer(ctx);

      await this.getRequestBody(ctx);

      var serviceFilePath=path.resolve(workDirectory,this.config["serviceDir"]+"/"+ctx.request.path+".js");
      if(fs.existsSync(serviceFilePath)){
        ctx.isHandled=true;
        var obj=require(serviceFilePath);
        Object.setPrototypeOf(obj,ctx) 
        if(obj.onRequest){
          obj.onRequest(ctx);

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

        if(!ctx.isHandled){
          res.statusCode = 404
          res.end("404 Not Found");
        }
      

    };

    return handleRequest;


  }

  
  createContext(req, res) {
    let context= new Context(req,res,this.config);
 
    if(_dataBase){ //set database reference
      context.database=_dataBase;
    }
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
          form.uploadDir = path.resolve(workDirectory, ctx.config["uploadDir"] || "./upload/")  // save path
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
    var fullpath = path.resolve(workDirectory,this.config["serviceDir"]);
    fs.watch(fullpath,{
        persistent: true, // 设为false时，不会阻塞进程。
        recursive: true
    },function(event,filename){
        if (event === "change") {
            let fullName=path.resolve(fullpath,filename);
            cleanCache(fullName);
            try {
                require(fullName);
                console.log("reload module",filename);
            } catch (ex) {
                console.error('module update failed');
            }
        }
    });

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
 

  createStaticServer(ctx) {
    const req = ctx._req;
    const res = ctx._res;
    const p = ctx.request.path;
    if (p.match(/\.(js|css|jpg|png|html|htm)$/)) {
      ctx.isHandled=true;
      var localPath = path.resolve(workDirectory, this.config["clientDir"] + p);
      if (fs.existsSync(localPath)) {
        if (p.match(/(html|htm)$/)) {
          res.setHeader('Content-Type', 'text/html;charset=utf-8');
        }
        var stream = fs.createReadStream(localPath);
        stream.pipe(res);
      } else {
        console.error("file not exists:", localPath, req.url);
      }
    }
  }

}
