const fork = require('child_process').fork;
const events = require('events');
let pdbLib = require('pdb-lib');
let streams =require('stream');
let utils = require('util');
/*
  Module API
*/



function restore(keyID, cacheDir, squeueBin, pCount) {
  let emiter = new events.EventEmitter();
  const options = {
    stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
  };
  let parameters = ['-c', cacheDir ,'-k', keyID ,'-s', squeueBin];
  if (pCount) parameters = parameters.concat(['-p', pCount]);
  const child = fork(__dirname + '/lib/childProcess.js', parameters, options);
  child.on('message', message => {
   
    if(!message.hasOwnProperty('status'))
      throw(`${utils.inspect(message)}`)
   
    if (message.status === 'OK'){
      let pdbAsStream = new streams.Readable();
      pdbAsStream.push(message.pdbObjAsString);
      pdbAsStream.push(null);
      pdbLib.parse({rStream : pdbAsStream}).on('end', function(pdbObj) { 
        emiter.emit('completed', pdbObj, message.jobStatus.completed.length);
        });
    }
    else if (message.status === 'errJobs'){
      emiter.emit('errJobs');
    }
    else if (message.status === 'errKey'){
      emiter.emit('errKey');
    }
    else if (message.status === 'notFinished'){
      emiter.emit('notFinished', message.jobStatus);
    }
    else {
      console.log('unhandled packet signature');
      console.log(`${utils.inspect(message)}`);
    }
  })
  .on('error', (e)=>{console.log('Error:' + e )})
  .on('close', (e)=>{console.log('close:' + e )})
  .stdout.on('data',(d) => {
    console.log(d.toString())
  });
  return emiter;
}

module.exports = {
  restore : restore
}