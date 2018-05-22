let globAsyncRestore = require('./core.js');
let parser = require('./parser.js').parser;
/*    Module intended to be forked
    expected argument
let program = require('commander');
program
  .version('0.1.0')
  .option('-c, --cache [path to cache folder]', 'Cache localization', '/data/prod/ardock/tmp/persistantNslurmCache_prod/')
  .option('-k, --key [UUID]', 'job Key to restore', '90d864a0-ca66-4a09-8bab-cda728d41a56')
  .option('-s, --squeue [squeue binary]', 'Path to squeue binary', '/data/www_dev/ardock/bin/slurm/bin/squeue')
  
  .parse(process.argv);
//setInterval( ()=>{console.log("Ding dong");}, 1000);
*/

let program = parser(process);
console.log(`Running Child Process with key ${program.key} in cache ${program.cache}, ${program.squeue} and ${program.probeCount}`);

globAsyncRestore.block(program.key, program.cache, program.squeue, program.probeCount)
    .on('notFinished', (jobStatus)=>{
        console.log('child:notFinished' + jobStatus);
        process.send({status : 'notFinished', 'jobStatus' : jobStatus});
        //process.exit();
    })
    .on('errJobs', ()=>{
        console.log("child:err Jobs");
        process.send({status : 'errJobs'});
        //process.exit();
    })
    .on('errKey', ()=>{
        console.log("child:err Key");
        process.send({ status : 'errKey' });
        //process.exit();
    })
    .on('completed', (jobStatus, pdbObj)=>{
        console.log("child:OK");
        process.send({ status : 'OK', pdbObjAsString : pdbObj.model(1).dump(), jobStatus: jobStatus });
        //process.exit();
    });
//node test/keyRestore.js -k 6a5308a4-f6a0-4c3a-9c87-bb84f9d96569
    