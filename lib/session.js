

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
        return new Promise( (resolve)=>{
            this.context.database.select("session_memory",{token:this.sessionId}).then( (e)=>{
                var obj={};
                e.forEach(function (item){
                    obj[item.s_key]=item.s_value;
                });
                this.set({}); //update the session timespan
                resolve(obj)
            })
        });
    }
    clear(){
        return new Promise( (resolve)=>{
            this.context.database.delete("session_memory",{token:this.sessionId})
        });
    }
    
    set(params){
        var list=[];
        for(var key in params){
            let val=params[key];
            
            list.push({
                token:this.sessionId,
                s_key:key,
                s_value:val
            })

        }
        list.push({token:this.sessionId,s_key:"lass_access_time",s_value:Math.floor(new Date().getTime()/1000)})
        return this.context.database.replace("session_memory",list);
            
         
    }

    static createTable(database){ }
    static cleanSchedule(database,period){
        database.query("select token from session_memory where s_key='lass_access_time' and TIMESTAMPDIFF(MINUTE,from_unixtime(s_value),now())>=? limit 50",[period]).then((result)=>{
            var arr=[];
            result.forEach((item)=>{
                arr.push(item["token"])
            })
            if(arr.length>0){
                database.delete("session_memory",{token:arr});
            }
            
        })
     }
}
