

const Emitter = require('events');
const DataModel=require("./model.js")
 
module.exports = class ModelFactory extends Emitter{
    
    constructor(context) {
        super();
        let models=context.config["models"];
        for(let key in models){
            Object.defineProperty(this,key,{
                get:function (){
                    return DataModel._create(context,key,models[key])
                }
            })
        }
      
 
    }
    

}
