let glob = require("glob");
let jsonfile = require('jsonfile');
let path = require('path');
let pdbLib = require("pdb-lib");
let events = require('events');
const cluster = require('cluster');
let stream = require('stream');
//var Worker = require('webworker-threads').Worker;

let child = require('child_process');

/*
Working on safe resurrect
https://stackoverflow.com/questions/27729411/node-js-is-async-read-write-safe
Async operations on opening json results file content may occur while file is
still being written
we had the cp/mv operations to corescript
*/

let cacheDir = "/data/prod/ardock/tmp/persistantNslurmCache_prod/";
//let keyID = "90d864a0-ca66-4a09-8bab-cda728d41a56";
let squeueBin = null;
let pCount = 25;

/*

function webWorkerThreadWrapper(keyID) {
  let emiter = new events.EventEmitter
// You may also pass in a function:

      //console.log(`SetUp ${squeueBin} ${cacheDir}`);
      squeue().then((squeueRes) => {
        let worker = new Worker(function(){
          postMessage({"eventType": 'blindStart'});
          this.onmessage = function(event) {
            console.log('receiving key ::' + event.data);            
            
            yieldArDockCounts(keyID)
              .then((results)=>{
                if(results.type === 'completed') {
              //emiter.emit('completed', results.status, results.pdbObj);
                postMessage({"eventType": 'completed'});
                self.close();
                } else if(results.type === 'notFinished') {
                  if (checkQueue(results.status.running, squeueRes) 
               && checkQueue(results.status.pending, squeueRes)) {
          //emitter.emit('notFinished', results.status);
                  postMessage({"eventType": 'notFinished'});
                  self.close();
                } else {
          //emitter.emit('errJobs');
                postMessage({"eventType": 'errJobs'});
                self.close();
              }
            }
            console.log("closing");
            //self.close();
          })
          .catch((e)=>{ 
            console.log("yieldArDockCounts Error catching");
            if (e.type ==='keyNotFound')  { 
              postMessage({"eventType": 'errKey'});//emiter.emit('errKey');
              self.close();
            }
            if (e.type === 'probeLeft') {
              console.log("ProbeLeft signal ->" + e.status + '<-');
        //emiter.emit('notFinished', e.status);    
              postMessage({"eventType": 'notFinished'});
              self.close();
            }
            console.log("closing");
            //self.close();
          });
          console.log("running");
        postMessage({"eventType": 'blindStop'});
       // self.close();
        }
      });
    worker.onmessage = function(event) {
      let eventType = event.data.eventType;
      console.dir(event);
      console.log("Worker said this : " + eventType);
    //emiter.emit(eventType);
    };
    worker.postMessage(keyID);
  });
  return emiter;
}

*/

function getDate(){
  return Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

// Here presume all files are in safe read-access

function yieldArDockCounts (key) {
  return new Promise((resolve, reject)=> {
    ardockGlob(key)
    .then((results)=>{
      console.log("ardockGlob match following folders:\n" + results);
      Promise.all(results.map(extractFolderInfo))
      .then((statusArray) => { // [{id:'UUID', status : 'completed', data : obj.rawCounts}, ... ]
        let jobStatus = {
          "completed" : [],
          "pending" : [],
          "running" :[]
        }
        statusArray.forEach((e) => {
          jobStatus[e.status].push(e.id);
        });

        if(statusArray.length != pCount) {
          reject({'type':'aborted', 'status' : jobStatus});
          return;
        }
        if (jobStatus.pending.length > 0 || jobStatus.running.length > 0) {
          resolve({'type':'missing', 'status' : jobStatus});
          return;
        }
        
        let countingObj = countReduce( statusArray.map((e) => {return e.data;}) );
        pickPdbFile(statusArray[0].path).then( (pdbObj)=> {
          bFactorUpdate(pdbObj, countingObj);
          resolve({'type':'completed', 'status' : jobStatus, 'pdbObj' : pdbObj});
        });
      });
    })
    .catch((e)=>{
      console.log("Glob rejected");
      reject({'type':'keyNotFound', 'val' : undefined});
    });
  });
}

function pickPdbFile (folder){
  return new Promise((resolve, reject)=>{
    let pdbPath = folder + '/input/targetPdbFile.inp';
      pdbLib.parse({file : pdbPath}).on('end', function(pdbObj) { // parse the PDB file
      resolve(pdbObj);
      });
  });
}

// emiting pdb structure update, return emitter
var bFactorUpdate = function(pdbObj, countingObj) {
  //if (!'rawCounts' in dataObj) return;
  // Assign bfactor as count increment, renormalize by listing current bfactor first ?
  for (let resID in countingObj) {
    let e = countingObj[resID];
    pdbObj.model(1).chain(e.data.chain).resSeq(e.data.resSeq).bFactor(e.count, 'increment');
  } 
};




// Reduce a list of rawCounts to an accumulator
/*
{
  'A  9 ': { 'data' : { chain: 'A', resSeq: '   9', AChar: null } 'count' : 10 },
  ....
}
*/
function countReduce(countArray) {
  let accumulator = {};
  countArray.forEach( (probeCounts)=>{ 
 //   console.log(probeCounts);
    probeCounts.forEach((c)=>{   
      let key = c.chain + c.resSeq;
      key += c.AChar == null ? ' ' : c.AChar;
      if (!accumulator.hasOwnProperty(key))
        accumulator[key] = { 'data' : c, 'count' : 0 };
      accumulator[key].count += 1;
    });
  });
  return accumulator;
}

// Map work folder to a jobStat container
function extractFolderInfo(folder){
  return new Promise((resolve, reject)=>{
    let outputFileGlob = folder + '/*.out';
    glob(outputFileGlob, function (er, files) {
      if(files.length > 1) reject('too many *.out files', files);

      let jobStat = { 'path' : folder, 'id' : folder.split('/').pop(), 'status' : undefined, 'data' : undefined };

      if(files.length == 0) {
        jobStat.status = 'pending';
        resolve(jobStat);       
      } else {
        jsonfile.readFile(files[0], function(err, obj) {

          if(err) { 
            jobStat.status = 'running';
          } else {        
            jobStat.status = 'completed';
            jobStat.data = obj.rawCounts
          }
          resolve(jobStat);
        });
      }
    });
  });
}

// Return list of folder matching request 
function ardockGlob(keyID) {
    console.log("Yielding arDock results, please wait...");
    return new Promise((resolve,reject)=>{
      glob(cacheDir + '/**/' + keyID + '/*/jobID.json', function (er, files) {
       
        if(files.length == 0) {
          reject('keyNotFound');
          return;
        }
        console.log("indexed w/ probeCount of " + pCount);
        Promise.all(files.map(isHexFolder)).then((values)=>{
          /*console.log("We re in " + values.length);
          console.log(values);*/
          resolve(values.filter((i)=>{ return i !== null;}).map((e)=>path.dirname(e)));
        });
    })
  });
}

// Promise return jobID path if it is hex
function isHexFolder(absPathJobID) {
  return new Promise((resolve,reject)=> {
    jsonfile.readFile(absPathJobID, function(err, obj) {
      if(err) reject(err);
      if(obj.tagTask === 'hex') resolve(absPathJobID);
      resolve(null);
      });
    });
}

// Original
function _keyRestore(keyID) {
    let emiter = new events.EventEmitter();
    yieldArDockCounts(keyID)
    .then((results)=>{

        console.dir('current Yield status:\n' + results.status);
        if(results.type === 'completed') {
            emiter.emit('completed', results.status, results.pdbObj);
        } else if(results.type === 'missing') {
            squeue().then((squeueRes) => {                
                if ( checkQueue(results.status.running, squeueRes) 
                &&   checkQueue(results.status.pending, squeueRes) ){                   
                    emiter.emit('notFinished', results.status);
                }
                else {
                    emiter.emit('errJobs');
                }
            })
        }
    })
    .catch((e)=>{ 
        console.log("yieldArDockCounts Error catching");
        console.log(e);
        if (e.type ==='keyNotFound') emiter.emit('errKey');
        if(e.type === 'aborted') {
        //console.log("ProbeLeft signal ->" + e.status + '<-');
            emiter.emit('errJobs'/*, e.status*/);    
        }
    });

    return emiter;
}

/*
* Make a squeue command to know the jobs still running, pending or else
*/
function squeue() {
  return new Promise ((resolve, reject) => {
    let exec_cmd = require('child_process').exec;    
    exec_cmd(squeueBin + ' -o \"\%j \%t\"', function (err, stdout, stderr) {
      if (err) reject(err)
        squeueRes = ('' + stdout).replace(/\"/g, '');
        resolve(squeueRes);
    });
  });
}

var checkQueue = function (jobList, squeueRes) {
  if (! jobList) throw 'No jobStatus specified';
  if (! squeueRes) throw 'No squeueRes specified';
  var bError = false;

  // for running jobs
  jobList.forEach(function (job) {
      //console.log(job)
      var reg = new RegExp(job + ' ([A-Z]{1,2})\n');
      if (! reg.test(squeueRes)) { // the job is not in the queue
          console.log('Error : the job ' + job + ' is not finished AND is not in the queue...');
          bError = true;
      }
      // if we found the job in the queue, possibility to access the status
      //status = reg.exec(squeueRes);
      //console.log('status >' + status[1] + '<');
  });

  if (bError) return false;
  else return true;
}


//keyRestore(key).

module.exports = {
    block : function(key, _cache, _squeueBin, _pCount) {
    cacheDir = _cache;
    squeueBin = _squeueBin;
    pCount = _pCount;
    //return webWorkerThreadWrapper(key);
    return _keyRestore(key);
    //return fiberWrap(key);
  },
    fork : function(key, _cache, _squeueBin) {
      cacheDir = _cache;
      squeueBin = _squeueBin;
      //return webWorkerThreadWrapper(key);
      return forkWrapper(key);
  }
};