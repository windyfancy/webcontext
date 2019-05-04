var WebContext=require("../lib/webapplication.js");
var app=new WebContext();
 
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

app.onRequest("/test/session",async function (ctx){

   
   var session=await ctx.session.load();


   await ctx.session.set(
    {
      userName:"windy",
      level:"9",
      msg:"hello,world"
 });

   ctx.render(session);

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