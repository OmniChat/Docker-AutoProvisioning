module.exports = function Slack(params) {
  
  //Slack
  var Slack = require('slack-node');
  var slack = new Slack();
  slack.setWebhook(params.slackChannel);
  
  this.username = params.username;
  this.iconUrl = params.iconUrl;

  this.postError = function (message) { 
  	slack.webhook({
  		username: this.username,
  		text: message,
  		icon_emoji: this.iconUrl
  	}, function(error, response) {
  		if (error) {
  			console.log('Slack error: ' + response);
  		}
  	});
  }

  this.postMessage = function (message) {
  	slack.webhook({
  		username: this.username,
  		text: message,
  		icon_emoji: this.iconUrl
  	}, function(error, response) {
  		if (error) {
  			console.log('Slack error: ' + response);
  		}
  	});
  }

}