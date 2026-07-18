import net from 'node:net';
const server=net.createServer();
server.listen(process.argv[2],()=>process.stdout.write('READY\n'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
setInterval(()=>{},1000);
