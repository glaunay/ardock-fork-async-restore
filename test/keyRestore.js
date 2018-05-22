
let globAsyncRestore = require('../index.js');
let parser = require('../lib/parser.js').parser;

/*   Test script 
    See parser module fo fork API or use 
    node test/keyRestore.js -c /data/dev/ardock/tmp/persistantNslurmCache_dvl  \
        -s /opt/slurm/bin/squeue -p 5 -k 486519de-94cb-4520-83db-260641768523
*/
//setInterval( ()=>{console.log("Ding dong");}, 1000);

let program = parser(process);
console.log(`Running test with key ${program.key} in cache ${program.cache}, ${program.squeue} and ${program.probeCount}`);

globAsyncRestore.restore(program.key, program.cache, program.squeue, program.probeCount)
    .on('notFinished', (jobStatus)=>{
        console.log(jobStatus);
       // process.send(jobStatus);
        //process.exit();
    })
    .on('errJobs', ()=>{
        console.log("err Jobs");
        //process.send({status : 'errJobs'});
        //process.exit();
    })
    .on('errKey', ()=>{
        console.log("err Key");
        //process.send({ status : 'errJobs' });
        //process.exit();
    })
    .on('completed', (jobStatus, pdbObj)=>{
        console.log("OK");
        console.dir(jobStatus);
        console.log(pdbObj.model(1).dump());
        console.log("===");
        //process.send({ status : 'OK' });
        //process.exit();
    });