const Emitter = require('events').EventEmitter;
const path=require("path");
const fs=require("fs");
const Url=require("url");
const ejs = require('ejs');
const Session=require("./session.js");
const queryString = require("querystring");

const Request=require("./request.js")
const Response=require("./response.js")

module.exports = class Context {
    constructor(req,res,config) {
        
        // return this.createContext(req,res,config);
        if(req){
          this._req=req;
          this._res=res;
          this.isHandled=false
          this.config=config
          
          
          this.request=new Request(req,res,config)
          this.response=new Response(req,res,config)

          this.render=this.__render;

          this.session=new Session(this);
      

        }

    }

    __render (content){
      var html="";
      if(arguments.length==1){
        if(typeof arguments[0]=="string" ){
          html=arguments[0];
          if(html.startsWith("{")){
            this.response.headers["Content-Type"]="application/json";
          }
        }else if(typeof arguments[0]=="object"){
          let options=arguments[0];
          options.context=this;
          var tempFilePath=path.resolve(process.cwd(),"service/"+this.request.path+".ejs");
          if(fs.existsSync(tempFilePath)){
            var temp=fs.readFileSync(tempFilePath).toString();
            var renderObj=options;
            renderObj.filename=tempFilePath;
            html=ejs.render(temp, options);
          }else{
            this.response.headers["Content-Type"]="application/json";
            delete options.context;
            html=JSON.stringify(options,null,"    ");
          }

          if(options.contentType=="json"){
            this.response.headers["Content-Type"]="application/json";
          }
         
        }
      }else if(arguments.length>1){
        let options=arguments[1];
        options.context=this;
        html=ejs.render(arguments[0],options);
      }

      this.response.body=html;

    }
    

}