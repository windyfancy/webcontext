
const Emitter = require('events');
const mysql=require("mysql")

module.exports = class DataBase extends Emitter {
    constructor(options) {
       
       super();
       try{ 
            this.connectionOptions=options;
            var connection = mysql.createConnection(options);
            connection.connect();
            this.connection=connection;
       }catch(ex){
           console.error(ex.toString());
       }
    }


    query(sql,params){
        return new Promise(  (resolve,reject)=>{
            this.connection.query(sql,params,function (error, results, fields) {
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
                    id int unsigned not null auto_increment primary key,
                    token char(20),
                    s_key char(20),
                    s_value char(128),
                    last_access char(30),
                    INDEX (token),
                    unique index(token,s_key)
                )ENGINE=MEMORY DEFAULT CHARSET=utf8;`

                return self.query(sql).catch(function (e){
                    reject(e);
                });
            })
        }
        createTable().catch(function (e){
            if(e.code=="ER_NOT_SUPPORTED_AUTH_MODE" ){
                let o=self.connectionOptions;
                let sql=`ALTER USER '${o.user}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${o.password}'`
                console.error("密码认证协议不支持，请用mysql workbench连接并执行："+sql);

            }
        })
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
      
        sql="select count(*) as count from "+tableName;

        if(where && JSON.stringify(where) != "{}"){
            for(let key in where){
                data.push(where[key]);
                c1.push(key+"=?");

            }
            sql+=" where "+c1.join(" and ")
        }

        return new Promise((resolve)=>{
            this.query(sql,data).then((result)=>{
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
            let arr=[];
            for(let key in columns){
                arr.push(key);
            }
            columns=arr.join(",")
        }
        sql="select "+columns+" from "+tableName;

        if(where && JSON.stringify(where) != "{}"){
            for(let key in where){
                data.push(where[key]);
                c1.push(key+"=?");

            }
            sql+=" where "+c1.join(" and ")
        }

        if(options.orderBy){
            sql+=" order by "+options.orderBy;
        }

        if(options.pageIndex!=undefined){
            sql+=" limit "+(options.pageIndex-1)*options.pageSize+","+options.pageSize;
        }
        if(options.count){
            let promise1=this.count(tableName,where);
            let promise2=this.query(sql,data);
            return new Promise((resolve)=>{
                Promise.all([promise1,promise2]).then((values)=>{
                    resolve({
                        totalCount:values[0],
                        rows:values[1]
                    });
                })
            })
        }else{

            return this.query(sql,data)
        }
    }

    insert(tableName,columns){
        var data=[];
        var c1=[],c2=[];
        for(let key in columns){
            data.push(columns[key]);
            c1.push(key);
            c2.push("?");
        }

        return this.query("insert into "+tableName+" ("+c1.join(",")+") values("+c2.join(",")+")",data)
    }

    replace(tableName,columns){
        var data=[];
        var c1=[],c2=[];
        for(let key in columns){
            data.push(columns[key]);
            c1.push(key);
            c2.push("?");
        }

        return this.query("replace into "+tableName+" ("+c1.join(",")+") values("+c2.join(",")+")",data)
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
                data.push(where[key]);
                c2.push(key+"=?");
            }
        }else{
            throw(new Error("where params is undefind.update(tableName,columns,where) "))
        }

        var sql="update "+tableName+" set "+c1.join(",")+" where "+c2.join(" and ");
        return this.query(sql,data);
    }

    delete(tableName,where){
        var c1=[],data=[];
        for(let key in where){
            data.push(where[key]);
            c1.push(key+"=?");
        }
        var sql="delete from "+tableName+" where "+c1.join(" and ");
        return this.query(sql,data);
    }

}

 