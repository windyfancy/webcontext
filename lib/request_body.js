const formidable = require('formidable');
const fs=require("fs");

module.exports={
    parse(ctx) {
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
}