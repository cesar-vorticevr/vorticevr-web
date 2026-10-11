import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root=process.argv[2], port=+process.argv[3];
const T={".html":"text/html; charset=utf-8",".js":"text/javascript",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".glb":"model/gltf-binary",".mind":"application/octet-stream"};
http.createServer((q,r)=>{let p=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(p.endsWith(path.sep)||p.endsWith("/"))p=path.join(p,"index.html");
fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end("404")}r.writeHead(200,{"content-type":T[path.extname(p)]||"application/octet-stream"});r.end(d)})}).listen(port,()=>console.log("listo "+port));
