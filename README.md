# jenkins-trigger-action
Trigger jenkins job in github action and wait for job completion.

## Usage
### Generate API token for Jenkins API
Please see [How to get the API Token for Jenkins](https://stackoverflow.com/questions/45466090/how-to-get-the-api-token-for-jenkins)
> 1. Log in Jenkins.
> 2. Click you name (upper-right corner).
> 3. Click Configure (left-side menu).
> 4. Use "Add new Token" button to generate a new one then name it.
> 5. You must copy the token when you generate it as you cannot view the token afterwards.
> 6. Revoke old tokens when no longer needed. 
### Inputs
| name | required | description |
| ---- | -------- | ----------- |
| url  | `true`   | Jenkins full URL including http/https protocol |
| user_name | `true` | User name of Jenkins |
| api_token | `true` | Jenkins API token |
| job_name | `true` | Jenkins job name |
| parameter | false | Job parameter in JSON format. ex) {"param1":"value1"} |
| wait | false | Set true as default. Waiting for job completion or not |
| timeout | false | Set 600 seconds as default. Timeout (seconds) for github action. |

### Example
```yaml
- name: Trigger jenkins job
  uses: jabbukka/jenkins-trigger@master
  with:
    url: ${{ secrets.JENKINS_URL }}
    job_name: "build_web_application"
    user_name: ${{ secrets.JENKINS_USER }}
    api_token: ${{ secrets.JENKINS_TOKEN }}
    wait: "true"
    timeout: "1000"
```
