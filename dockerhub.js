var express = require('express');
var url = require('url');
var bodyParser = require('body-parser');

var sys = require('sys')
var exec = require('child_process').exec;

// create application/json parser
var jsonParser = bodyParser.json()

var Slack = require('./slack');
var slack = new Slack({
    "slackChannel":process.env.SLACK_CHANNEL,
    "username":"OmniChat Docker Auto Provisioning",
    "iconUrl":"https://raw.githubusercontent.com/MWers/docker-docset/master/assets/docset/icon@2x.png"});

var router = express.Router();

/*
* Docker hub will POST the following JSON
{
   "push_data": {
      "pushed_at": 1449017033,
      "images": [],
      "tag": "newtag",
      "pusher": "biscarch"
   },
   "callback_url": "https://registry.hub.docker.com/u/biscarch/webhook-tester-repo/hook/2i5e3gj1bi354asb3f05gchi4ccjg0gas/",
   "repository": {
      "status": "Active",
      "description": "",
      "is_trusted": false,
      "full_description": null,
      "repo_url": "https://registry.hub.docker.com/u/biscarch/webhook-tester-repo/",
      "owner": "biscarch",
      "is_official": false,
      "is_private": false,
      "name": "webhook-tester-repo",
      "namespace": "biscarch",
      "star_count": 0,
      "comment_count": 0,
      "date_created": 1449016916,
      "repo_name": "biscarch/webhook-tester-repo"
   }
}
*/

router.post('/', jsonParser, function (req, res) {
    var body = req.body;

    if (body.push_data && body.push_data.tag == 'devel') {
        var imageName = '[' + body.repository.name + ':' + body.push_data.tag + ']';
        var message = imageName + ' -  Image has been rebuilt from a PUSH by ' + body.push_data.pusher + ' at Docker Hub - ' + body.repository.repo_url;
        slack.postMessage(message);
        console.log(message);
        res.sendStatus(200);

        exec('/opt/docker-scripts/update-' + body.repository.name + '.sh', function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log(imageName + error);
                slack.postError(imageName + error);
            }
        });

    } else {
        res.sendStatus(400);
    }

    res.end();
});

module.exports = router;
