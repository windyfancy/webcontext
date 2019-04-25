var WebContext=require("../lib/webapplication.js");
var app=new WebContext();
app.listen();


app.onRequest("/test/count",function (ctx){
    ctx.database.count("todo_list").then(function (count){
        ctx.response.body="count:"+count;
    })

})

app.onRequest("/test/exists",function (ctx){
    ctx.database.exists("todo_list",{id:5}).then(function (e){
        ctx.response.body="exists:"+e;
    })
})

app.onRequest("/test/selectWithCount",function (ctx){
    ctx.database.select("todo_list",{id:5},{count:true}).then(function (e){
        ctx.render(e);
    })
})

app.onRequest("/test/session",async function (ctx){
   await ctx.session.set({userName:"windy",msg:"hello"});
   
   var session=await ctx.session.load();
   
   ctx.render(session);

})

app.onRequest("/test/server",async function (ctx){
 
    if(ctx.request.query["name"]){
        ctx.request.query["name"]="windyfancy"
    }
    var url=ctx.request.makeUrl();
    
    ctx.render(url);
 
 })