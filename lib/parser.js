let program = require('commander');



module.exports  = {
    parser: function(process) {
        program
        .version('0.1.0')
        .option('-c, --cache [path to cache folder]', 'Cache localization', '/data/prod/ardock/tmp/persistantNslurmCache_prod/')
        .option('-k, --key [UUID]', 'job Key to restore', '90d864a0-ca66-4a09-8bab-cda728d41a56')
        .option('-p, --probeCount [Integer]', 'Number of probe', 25)
        .option('-s, --squeue [squeue binary]', 'Path to squeue binary', '/data/www_dev/ardock/bin/slurm/bin/squeue')
        .option('-f, --fork', 'Forking process')
        .parse(process.argv);
        return program;
    }
}
