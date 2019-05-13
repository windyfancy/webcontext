

const Emitter = require('events');
const path=require("path");
const fs=require("fs");
const Url=require("url");
const zlib = require('zlib');

module.exports = class StaticServer extends Emitter{
    
    constructor(ctx,logger) {
        super();
        this.context=ctx;
        this.logger=logger;

        this.createServer()
    }

    createServer() {
        const ctx=this.context;
        const req = ctx._req;
        const res = ctx._res;
        const p = ctx.request.path;
        const extName=path.extname(p).substr(1);
        if (extName.match(new RegExp(ctx.config["staticFileType"]))) {
          ctx.isHandled=true;
          var localPath = path.resolve(ctx.workDirectory, ctx.config["clientDir"] + p);
          if (fs.existsSync(localPath)) {
            var mineTypeMap={
              html:'text/html;charset=utf-8',
              htm:'text/html;charset=utf-8',
              xml:"text/xml;charset=utf-8",
              json:"application/json",
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

    
            if (req.headers["accept-encoding"].indexOf("gzip")>=0 && extName.match(new RegExp(ctx.config["gzipFileType"]))) {
              res.setHeader('Content-Encoding', "gzip");
              const gzip = zlib.createGzip();
              stream.pipe(gzip).pipe(res);
            }else{
              stream.pipe(res);
            }
            this.logger.info("url="+ "|ip="+ctx.request.clientIP+"|ua="+ctx.request.userAgent);
    
          } else {
            console.error("file not exists:", localPath, req.url);
            this.logger.error("msg=file not exists|local="+ localPath+"|url="+ req.url);
          }
        }
      }

}
