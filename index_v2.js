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

async function requestJenkinsJobWithParam(jobName, params) {
	const result = await CallJobJenkinsWithParameters(jobName, params);
	console.log(result);

}

async function requestJenkinsJobWithoutParam(jobName, params) {
	const result = await CallJobJenkinsWithoutParameters(jobName, params);
	console.log(result);

} 
function CallJobJenkinsWithParameters(jobName, params) {
  const jenkinsEndpoint = core.getInput('url');
  const req = {
    method: 'POST',
    url: `${jenkinsEndpoint}/job/${jobName}/buildWithParameters`,
    form: params,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  return new Promise((resolve, reject) => request(req)
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

function CallJobJenkinsWithoutParameters(jobName, params) {
  const jenkinsEndpoint = core.getInput('url');
  const req = {
    method: 'POST',
    url: `${jenkinsEndpoint}/job/${jobName}/build`,
    //form: params,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  return new Promise((resolve, reject) => request(req)
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
  const jenkinsEndpoint = core.getInput('url');
  const req = {
    method: 'get',
    url: `${jenkinsEndpoint}/job/${jobName}/lastBuild/api/json`,
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
      params = JSON.parse(core.getInput('parameter'));
	  
      core.info(`>>> Parameter ${params.toString()}`);
	  requestJenkinsJobWithParam(jobName, params);
    }
	else{
		requestJenkinsJobWithoutParam(jobName, params);
	}
    // POST API call
    //requestJenkinsJob(jobName, params);

    // Waiting for job completion
    if (core.getInput('wait') == 'true') {
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
