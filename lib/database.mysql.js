
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
    cleanSessionTable(period){
        this.query("select token from session_memory where s_key='lass_access_time' and TIMESTAMPDIFF(MINUTE,from_unixtime(s_value),now())>=? limit 100",[period]).then((result)=>{
            var arr=[];
            result.forEach((item)=>{
                arr.push(item["token"])
            })
            if(arr.length>0){
                database.delete("session_memory",{token:arr});
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
                    //c1.push(key+"=?");
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
            sql+=" limit "+(options.pageIndex-1)*options.pageSize+","+options.pageSize;          
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

    insert(tableName,columns,options){
        var sql="insert into "
        if(options && options.isReplace){
            sql="replace into "
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
       return this.insert(tableName,columns,{isReplace:true})
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

 