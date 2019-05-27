
var WebContext=require("../lib/webapplication.js");
var Path=require("path")
var app=new WebContext();
app.config.serviceDir="test/service"
var assert=require("assert");

console.log(process.cwd())
var httpRequest=function (url,options){
    var siteRoot="http://localhost:"+app.config.port;
    if(url.indexOf("http:")==-1){
        url=siteRoot+url;
    }
    return app.server.request(url,options);
}


describe('http server', function() {

    it('1.index page response 200', function(done) {
        httpRequest("/").then(function (result){
            assert.equal(result.code,200);
            done();
        })
        
    });


    it('2.post with form', function(done) {
        let msg=Math.random().toString();
        httpRequest("/",{postData:"msg="+msg}).then(function (result){
            assert.ok(result.body.indexOf(msg)>=0);
            done();
        })
        
    });

    it('3.post with json', function(done) {
        let msg=Math.random().toString();
        httpRequest("/",{postData:{msg:msg}}).then(function (result){
            assert.ok(result.body.indexOf(msg)>=0);
            done();
        })
        
    });


    it('4.request external url:https://www.baidu.com', function(done) {
        app.onRequest("/test/request",function (ctx){
            ctx.server.request("https://www.baidu.com").then(function (result){
                ctx.response.body=result.body;
            })
        })

        httpRequest("/test/request").then(function (result){
            assert.ok(result.body.indexOf("baidu")>=0);
            done();
        })
        
    });

    it('5.test read and write session ', function(done) {
        
        app.onRequest("/test/sessionWrite",async function (ctx){
            let userName="windy"+Math.random();
            await ctx.session.set(
             {
               userName:userName,
               level:"9",
               msg:"hello,world"
            });
            result={
                code:"ok",
                userName:userName,
                sessionId:ctx.session.sessionId
            }
            ctx.render(JSON.stringify(result));
         })

         app.onRequest("/test/sessionRead",async function (ctx){
            var session=await ctx.session.load();
            var userName=session["userName"]
            ctx.render(userName);
         })

        httpRequest("/test/sessionWrite").then(function (result){
            assert.ok(result.body.indexOf("ok")>=0);
            let obj=JSON.parse(result.body);
            let options={headers:{Cookie:app.config.sessionKey+"="+obj.sessionId}};
            httpRequest("/test/sessionRead",options).then(function (result){
                assert.ok(result.body.indexOf(obj.userName)>=0);
                done();
            });
            
        })
        
    });
})
 
app.rewriter({ 
    "/tag\/(.+?)": "/index?code=$1",
    "/baidu":"https://www.baidu.com/"
})

app.onRequest("/test/count",function (ctx){
    ctx.database.count("todo_list").then(function (count){
        ctx.response.body="count:"+count;
    })

})

app.onRequest("/test/insert",function (ctx){
    ctx.database.insert("todo_list",{title:"good",status:1} ).then(function (e){
        ctx.response.body="insert success:"+JSON.stringify(e);
    })

})

app.onRequest("/test/update",function (ctx){
    ctx.database.update("todo_list",{ status:1},{id:[7,8,9]} ).then(function (e){
        ctx.response.body="update success:"+JSON.stringify(e);
    })

})

app.onRequest("/test/exists",function (ctx){
    ctx.database.exists("todo_list",{id:5}).then(function (e){
        ctx.response.body="exists:"+e;
    })
})

app.onRequest("/test/deleteBat",function (ctx){
    ctx.database.delete("wb_article",{id:[39,40]}).then(function (res){
        ctx.response.body="count:"+JSON.stringify(res);
    })

})

app.onRequest("/test/selectWithCount",function (ctx){
    ctx.database.select("todo_list",{id:5},{count:true}).then(function (e){
        ctx.render(e);
    })
})



app.onRequest("/test/join",async function (ctx){
    var params={
        "b.tagId":1
    }
    ctx.database.select("wb_article a",params,{
        join:{
            table:"wb_article_tag b",
            on:{
                "a.id":"b.articleId"
            }
        },
        orderBy:"createTime desc",
        columns:["a.id,a.title"],
        pageIndex:1,
        pageSize:20
    }).then((res)=>{
        ctx.response.body=JSON.stringify(res);
    })
})

app.onRequest("/test/server",async function (ctx){
 
    if(ctx.request.query["name"]){
        ctx.request.query["name"]="windyfancy"
    }
    var url=ctx.request.makeUrl();
    
    ctx.render(url);
 
 })

 app.onRequest("/test/orm",async function (ctx){
    //  var ToDo=ctx.models["todo"];
    //  var todo=await ToDo.fetch(5);
    //  console.log(todo);
    //  todo.title="hello,world";
    //  todo.save();

     var ToDo=ctx.models["todo"];
     var todo=new ToDo({id:5});
     todo.delete();
 });

app.mixin({
     async checkSession(){
         var sessions=await this.session.load();
         if(sessions["userName"]){
             return sessions["userName"]
         }else{
             return "anymous"
         }
     }
 })

