

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

            context.response.cookies[sessionkey]={
                value:sessionId,
                httpOnly:true
            };
        }
        //context.session=_sessionData[sessionId];
        this.sessionId=sessionId;
        return _sessionData[sessionId];

    }



}
