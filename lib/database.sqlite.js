
const Emitter = require('events');
const sqlite3=require('sqlite3').verbose();

module.exports = class DataBase extends Emitter {
    constructor(options) {
       
       super();
       try{ 
            this.connectionOptions=options;
            var connection = new sqlite3.Database(options.database);

            this.connection=connection;
       }catch(ex){
           console.error(ex.toString());
       }
    }


    query(sql,params=[]){
        if(sql.toLowerCase().indexOf("select")>=0){
            return this.queryResult(sql,params);
        }else{
            return new Promise(  (resolve,reject)=>{
                var statement=this.connection.prepare(sql);
                statement.run(params,function (error) {
                    if (error) {
                        console.error(error.message);
                        reject(error);

                        //throw error;
                    }else{
                        var result={
                            "insertId":this.lastID,
                            "affectedRows":this.changes,
                        }
                        resolve(result);
                    }
                })
                
            })
        }
       
    }
    queryResult(sql,params=[]){
        return new Promise(  (resolve,reject)=>{
            this.connection.all(sql,params,function (error, results, fields) {
                if (error) {
                    console.error(error.message);
                    reject(error);

                    //throw error;
                }else{
                    resolve(results);
                }
              })
            
        })
       
    }
    createSessionTable(){
        var self=this;
        function createTable(){
            return new Promise(function (resolve,reject){

                var sql=`create table IF NOT EXISTS session_memory
                (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    token varchar,
                    s_key varchar,
                    s_value varchar,
                    last_access varchar,
                    CONSTRAINT token_key UNIQUE(token,s_key)
                );
                CREATE INDEX token_idx ON session_memory (token);
                `

                return self.query(sql).catch(function (e){
                    reject(e);
                });
            })
        }
        createTable().catch(function (e){
            throw(e)
        })
    }
    cleanSessionTable(period){
        // this.query("select token,(julianday('now')-julianday(datetime(s_value,'unixepoch')))*24 eclipseTime  From session_memory where s_key='lass_access_time' and eclipseTime>=? limit 100",[period]).then((result)=>{
        //     var arr=[];
        //     if(result){
        //         result.forEach((item)=>{
        //             arr.push(item["token"])
        //         })
        //         if(arr.length>0){
        //             database.delete("session_memory",{token:arr});
        //         }
        //     }
            
        // })
    }
    exists(table,where){
        return new Promise((resolve)=>{
            this.count(table,where).then( (count)=>{
                var result=count>0?true:false;
                resolve(result);
            })
        });
    }

    count(tableName,where){
        var sql="";
        var columns="*";
        var data=[],c1=[],c2=[];
        if(tableName.indexOf("select")>=0){
            sql="select count(*) as count from ("+tableName+") as countTable";
            data=where;
        }else{
            sql="select count(*) as count from "+tableName;
            if(where && JSON.stringify(where) != "{}"){
                for(let key in where){
                    data.push(where[key]);
                    c1.push(key+"=?");
    
                }
                sql+=" where "+c1.join(" and ")
            }
        }



        return new Promise((resolve)=>{
            this.queryResult(sql,data).then((result)=>{
                resolve(result[0].count)
            })
        })
    }

    select(tableName,where,options){
        var sql="";
        var columns="*";
        var data=[],c1=[],c2=[];
        if(!options){options={};}

        if(options.columns){
            columns=options.columns.join(",")
        }
        if(tableName.indexOf("select")==-1){
            sql="select "+columns+" from "+tableName;
        }else{
            sql=tableName;
        }
        
        if(options["join"] && options["join"]["on"]){

            sql+=" inner join "+options["join"]["table"]+" on (";

            var obj=options["join"]["on"];
            for(var key in obj){
                sql+=key+"="+obj[key];
            }
            sql+=")"
        }

        if(where && JSON.stringify(where) != "{}"){
            for(let key in where){
                let item=where[key];
                 
                if(options.join && key.indexOf(".")==-1){
                    data.push(item);
                    c1.push("a."+key+"=?");
                }else{
                    if(Array.isArray(item)){
                        data=data.concat(item);
                        var str=item.map(()=>{return "?"}).join(",");
                        c1.push(key+" in ("+str+")");
                    }else{
                        data.push(item);
                        c1.push(key+"=?");
                    }
                }

            }
            sql+=" where "+c1.join(" and ")
        }

        if(options.orderBy){
            sql+=" order by "+options.orderBy;
        }

        if(options.pageIndex!=undefined){
            let promise1=this.count(sql,data);
            sql+=" limit "+options.pageSize+" offset "+(options.pageIndex-1)*options.pageSize;          
            let promise2=this.queryResult(sql,data);
            return new Promise((resolve)=>{
                Promise.all([promise1,promise2]).then((values)=>{
                    resolve({
                        totalCount:values[0],
                        rows:values[1]
                    });
                })
            })
        }else{

            return this.queryResult(sql,data)
        }
    }

    insert(tableName,columns,options){
        var sql="insert into "
        if(options && options.isReplace){
            sql="insert or replace into "
        }
        
        var updateList=[];
        var data=[];
        if(Array.isArray(columns)){
            updateList=columns;
        }else{
            updateList=[columns]
        }
        updateList.forEach((item,idx)=>{
            let c1=[],c2=[];
            for(let key in item){
                data.push(item[key]);
                c1.push(key);
                c2.push("?");
            }
            if(idx==0){
                sql+= tableName+" ("+c1.join(",")+") values ";
            }
            sql+="("+c2.join(",")+")";
            if(idx<updateList.length-1){
                sql+=",";
            }
        });

        return this.query(sql,data)
    }

    replace(tableName,columns){
        if(Array.isArray(columns)){ //batch operation
            var plist=[];
            columns.forEach((item)=>{
                let p=this.insert(tableName,item,{isReplace:true})
                plist.push(p);
            });
            return new Promise((resolve,reject)=>{
                Promise.all(plist).then((resultList)=>{
                    let affectedRows=0;
                    resultList.forEach(function (item){
                        affectedRows+=item.affectedRows;
                    })
                    var result={
                        "insertId":resultList[resultList.length-1].insertId,
                        "affectedRows":affectedRows,
                    }
                    resolve(result);
                })

            })
        }else{
            return this.insert(tableName,columns,{isReplace:true})
        }
       
    }

    update(tableName,columns,where){
        
        var data=[];
        var c1=[],c2=[];
        for(let key in columns){
            data.push(columns[key]);
            c1.push(key+"=?");
        }
        if(columns.id){
            where={id:columns.id};
            delete columns.id;
        }
        if(where){
            for(let key in where){
                // data.push(where[key]);
                // c2.push(key+"=?");

                let item=where[key];
                if(Array.isArray(item)){
                    data=data.concat(item);
                    var str=item.map(()=>{return "?"}).join(",");
                    c2.push(key+" in ("+str+")");
                }else{
                    data.push(item);
                    c2.push(key+"=?");
                }

                
            }
        }else{
            throw(new Error("where params is undefind. update(tableName,columns,where) "))
        }

        var sql="update "+tableName+" set "+c1.join(",")+" where "+c2.join(" and ");
        return this.query(sql,data);
    }

    delete(tableName,where){
        var c1=[],data=[];
        for(let key in where){
            let item=where[key];
            if(Array.isArray(item)){
                data=data.concat(item);
                var str=item.map(()=>{ return "?" }).join(",");
                c1.push(key+" in ("+str+")");
            }else{
                data.push(item);
                c1.push(key+"=?");
            }
        }
        var sql="delete from "+tableName+" where "+c1.join(" and ");
        return this.query(sql,data);
    }

}

 