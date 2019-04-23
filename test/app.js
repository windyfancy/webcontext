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