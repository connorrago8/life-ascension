export function statements(sql){
 const out=[];let start=0,quote=null,line=false,block=0;
 for(let i=0;i<sql.length;i++){
  if(line){if(sql[i]==='\n')line=false;continue}
  if(block){if(sql.slice(i,i+2)==='/*'){block++;i++}else if(sql.slice(i,i+2)==='*/'){block--;i++}continue}
  if(quote){if(sql.startsWith(quote,i)){if(quote==="'"&&sql[i+1]==="'"){i++;continue}i+=quote.length-1;quote=null}continue}
  if(sql.slice(i,i+2)==='--'){line=true;i++;continue}
  if(sql.slice(i,i+2)==='/*'){block=1;i++;continue}
  if(sql[i]==="'"||sql[i]==='"'){quote=sql[i];continue}
  const dollar=sql.slice(i).match(/^\$[a-zA-Z_0-9]*\$/);if(dollar){quote=dollar[0];i+=quote.length-1;continue}
  if(sql[i]===';'){out.push(sql.slice(start,i+1));start=i+1}
 }
 if(sql.slice(start).trim())out.push(sql.slice(start));return out;
}
