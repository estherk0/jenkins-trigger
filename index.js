const request = require('request');
const core = require('@actions/core');

// create auth token for Jenkins API
const API_TOKEN = Buffer.from(`${core.getInput('user_name')}:${core.getInput('api_token')}`).toString('base64');

let timer = setTimeout(() => { 
  core.setFailed("Job Timeout");
  core.error("Exception Error: Timed out"); 
  }, (Number(core.getInput('timeout')) * 1000));

const sleep = (seconds) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, (seconds * 1000));
  });
};

async function requestJenkinsJob(jobName, params) {
  const req = {
    method: 'POST',
    url: `https://jenkins.hanu-ci.io/job/${jobName}/buildWithParameters`,
    form: params,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  await new Promise((resolve, reject) => request(req)
    .on('response', (res) => {
      core.info(`>>> Job is started!`);  
      resolve();
    })
    .on("error", (err) => {
      core.setFailed(err);
      core.error(JSON.stringify(err)); 
      clearTimeout(timer);
      reject();
    })
  );
}

async function getJobStatus(jobName) {
  const req = {
    method: 'get',
    url: `http://jenkins.hanu-ci.io/job/${jobName}/lastBuild/api/json`,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  return new Promise((resolve, reject) => 
      request(req, (err, res, body) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
        }
        resolve(JSON.parse(body));
      })
    );
}
async function waitJenkinsJob(jobName, timestamp) {
  core.info(`>>> Waiting for "${jobName}" ...`);
  while (true) {
    let data = await getJobStatus(jobName);
    if (data.timestamp < timestamp) {
      core.info(`>>> Job is not started yet... Wait 5 seconds more...`)
    } else if (data.result == "SUCCESS") {
      core.info(`>>> Job "${data.fullDisplayName}" successfully completed!`);        
      break;
    } else if (data.result == "FAILURE" || data.result == "ABORTED") {
      throw new Error(`Failed job ${data.fullDisplayName}`);
    } else {
      core.info(`>>> Current Duration: ${data.duration}. Expected: ${data.estimatedDuration}`);
    }
    await sleep(5); // API call interval 
  }
}

async function main() {
  try {
    let params = {};
    let startTs = + new Date();
    let jobName = core.getInput('job_name');
    if (core.getInput('parameter')) {
      param = JSON.parse(core.getInput('parameter'));
    }
    // POST API call
    await requestJenkinsJob(jobName, params);
    
    // Waiting for job completion
    if (core.getInput('wait' == 'true')) {
      await waitJenkinsJob(jobName, startTs);
    }    
  } catch (err) {
    core.setFailed(err.message);
    core.error(err.message);
  } finally {
    clearTimeout(timer);
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";
main();