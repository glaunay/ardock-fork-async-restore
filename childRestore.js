
let globAsyncRestore = require('./index.js');
let parser = require('./lib/parser.js').parser;
/*
    Prototype of a MicroService jobManager 
    Testing engine 
*/
/*let program = require('commander');
program
  .version('0.1.0')
  .option('-c, --cache [path to cache folder]', 'Cache localization', '/data/prod/ardock/tmp/persistantNslurmCache_prod/')
  .option('-k, --key [UUID]', 'job Key to restore', '90d864a0-ca66-4a09-8bab-cda728d41a56')
  .option('-s, --squeue [squeue binary]', 'Path to squeue binary', '/data/www_dev/ardock/bin/slurm/bin/squeue')
  
  .parse(process.argv);
//setInterval( ()=>{console.log("Ding dong");}, 1000);
*/

let program = parser(process.argv);
console.log(`Running test with key ${program.key} in cache ${program.cache} and ${program.squeue}`);

globAsyncRestore.restore(program.key, program.cache, program.squeue)
    .on('notFinished', (jobStatus)=>{
        console.log(jobStatus);
        console.log("Not finished");
    })
    .on('errJobs', ()=>{
        console.log("err Jobs");
        process.exit();
    })
    .on('errKey', ()=>{
        console.log("err Key");
        process.exit();
    })
    .on('completed', (jobStatus, pdbObj)=>{
        console.log("OK");
    });

//node test/keyRestore.js -k 6a5308a4-f6a0-4c3a-9c87-bb84f9d96569
    
