

const Emitter = require('events');
 

module.exports = class DataModel extends Emitter{
    
    constructor() {
        super();
        var database,options;
        function Model (data){
           
            if(data){
                Object.assign(this,data);
            }else{
                for(let key in options.columns){
                    options.columns[key]=null;
                }
            }
        }
        Model.init=function (db,op){
            database=db;
            options=op;
        }
        Model.fetch=function (id){ 
            return new Promise(function (resolve,reject){
                var primaryKey=options["primary"];
                    var where={};
                    where[primaryKey]=id;
                    database.select(options.table,where).then(function (result){
                    if(result.length>0){
                        var model=new Model(result[0]);
                        resolve(model);
                    }else{
                        resolve(null)
                    }
                })
            })
            
        }
    
        Model.update=function (id){ 
            var primaryKey=options["primary"];
            database.select(options.table,{primaryKey:id})
        }

        Model.prototype.save=function (){
            var primaryKey=options["primary"];
            var params={};
            for(let key in this){
                if(this.hasOwnProperty(key)){
                    params[key]=this[key];
                }
            }
            return database.replace(options.table,params,{primaryKey:this[primaryKey]})
        }

        Model.prototype.delete=function (){
            var primaryKey=options["primary"];
            var where={};
            where[primaryKey]=this[primaryKey];
            return database.delete(options.table,where)
        }

        return Model;
 
    }
    
    
    static _create(context,key,options){

        var Model= new DataModel();
        Model.init(context.database,options);
        //Model.name=key;
        return Model;
    }
    

}
