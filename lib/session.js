

const Emitter = require('events');
var _sessionData={};
module.exports = class Session extends Emitter{
    
    constructor(context) {
        super();
        this.context=context;

        var sessionkey=context.config["sessionKey"];
        var sessionId=context.request.cookies[sessionkey]
        if(sessionId){
            if(!_sessionData[sessionId]){
                _sessionData[sessionId]={};//初始化
            }
           
        }else{
            sessionId=(Math.random().toString(36)+new Date().getTime().toString(36)).substring(2);
            _sessionData[sessionId]={};

            context.response.cookies[sessionkey]=sessionId;
        }
        //context.session=_sessionData[sessionId];
        this.sessionId=sessionId;

    }

    load(callback){
        this.context.database.select("session_memory",{token:this.sessionId}).then(function (e){
            var obj={};
            e.forEach(function (item){
                obj[item.s_key]=item.s_value;
            });

            callback(obj)
        })
    }
    set(params){
        var plist=[];
        for(var key in params){
            let val=params[key];
            let promise=this.context.database.replace("session_memory",{
                token:this.sessionId,
                s_key:key,
                s_value:val
            })
            plist.push(promise)

        }
        return Promise.all(plist);
            
         
    }

    static createTable(database){
        this.isCreated=new Promise(function (resolve){

            var sql=`create table IF NOT EXISTS session_memory
            (
                id int unsigned not null auto_increment primary key,
                token char(20),
                s_key char(20),
                s_value char(128),
                last_access char(30),
                INDEX (token),
                unique index(token,s_key)
            )ENGINE=MEMORY DEFAULT CHARSET=utf8;`

            database.query(sql).then(function (e){
                resolve(e);
            })
        })

    }

}
