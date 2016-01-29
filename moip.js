var express = require('express');
var url = require('url');
var Parse = require('parse-cloud-express').Parse;

/* 
 * We must have the application key + javasript key as we are saving objects back to Parse 
 * via Javascript SDK
*/
if (!process.env.PARSE_APP_ID || !process.env.PARSE_JAVASCRIPT_KEY || !process.env.PARSE_MASTER_KEY) {
    console.log("PARSE_APP_ID = " + process.env.PARSE_APP_ID);
    console.log("PARSE_JAVASCRIPT_KEY = " + process.env.PARSE_JAVASCRIPT_KEY);
    console.log("PARSE_MASTER_KEY = " + process.env.PARSE_MASTER_KEY);
    logError('*** WARNING *** Parse Environment variables are not set!');
    process.exit(0);

} else {
    Parse.initialize(
        process.env.PARSE_APP_ID,   //application key
        process.env.PARSE_JAVASCRIPT_KEY,   //javasript key
        process.env.PARSE_MASTER_KEY //master key
        );
}

/* 
 * Moip Keys
*/
if (!process.env.MOIP_URL || !process.env.MOIP_APP_ID || !process.env.MOIP_APP_SECRET || 
!process.env.MOIP_APP_REDIRECTURI || !process.env.MOIP_APP_TOKEN || !process.env.MOIP_WEBHOOKS_SERVER) {
    console.error('*** WARNING *** MOIP Environment variables are not set!: ',process.env);
    process.exit(0);
}


var router = express.Router();
var moip;

router.get('/', function (req, res) {
    console.log("[webhook - moip] - :" + req.url);
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;

    if (!query.retailer_id || !query.code) {
        console.error('[webhook - moip] - missing query paramenters:' + JSON.stringify(query));
        res.status(400);
        res.send('Missing query paramenters');
        res.end();
        return;
    }

    var Retailer = Parse.Object.extend("Retailer");
    var retailerQuery = new Parse.Query(Retailer);
    retailerQuery.include("moip");
    retailerQuery.get(query.retailer_id).then(function (retailer) {
        moip = retailer.get("moip");
        if (moip) {
            return getOAuthToken(query.code);

        } else {
            return Parse.Promise.error("retailer is missing retation moip");
        }
    }).then(function (result) {
        // Save moip object back to Parse
        console.log('[webhook - moip] - json answer:' + JSON.stringify(moipJSONAnswer));
        var moipJSONAnswer = JSON.parse(result);
        moip.set("accountId", moipJSONAnswer.id);
        moip.set("oauth", moipJSONAnswer.accessToken);
        moip.set("scope", moipJSONAnswer.scope);
        return moip.save();

    }).then(function () {
        return getPublicKey(moip.get("oauth"));

    }).then(function (publicKey) {
        moip.set("publicKey", publicKey);
        return moip.save();

    }).then(function (result) {
        return setWebHooks(moip.get("oauth"));

    }).then(function () {
        moip.set("status", 'READY');
        moip.set("errorMessage", '');
        return moip.save().then(function () {
            console.log('[webhook - moip] - all good');
            res.writeHead(301, { Location: query.successUri });
            res.end();
        });

    }, function (error) {
        moip.set("status", 'ERROR');
        moip.set("errorMessage", error);
        return moip.save().then(function () {
            console.error('[webhook - moip] - ', error);
            res.writeHead(301, { Location: query.errorUri });
            res.end();
        });
    });
});


/*
* Support methods
*/

function getOAuthToken(code) {
    var moipJSON = {
        "appId": process.env.MOIP_APP_ID,
        "appSecret": process.env.MOIP_APP_SECRET,
        "redirectUri": process.env.MOIP_APP_REDIRECTURI,
        "grantType": "AUTHORIZATION_CODE",
        "code": code
    };

    return Parse.Cloud.httpRequest({
        method: 'POST',
        url: process.env.MOIP_URL + '/oauth/accesstoken',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': process.env.MOIP_APP_TOKEN
        },
        body: JSON.stringify(moipJSON)
    }).then(function (httpResponse) {
        if (httpResponse.statusCode === 200) {
            console.log(httpResponse.body);
            return Parse.Promise.as(httpResponse.body);

        } else {
            var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
            return Parse.Promise.error(errorMessage);
        }
    }, function (httpResponse) {
        var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
        return Parse.Promise.error(errorMessage);
    });
}

function getPublicKey(oauth) {
    return Parse.Cloud.httpRequest({
        method: 'GET',
        url: process.env.MOIP_URL + '/v2/keys',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': 'OAuth ' + oauth
        }
    }).then(function (httpResponse) {
        if (httpResponse.statusCode === 200) {
            console.log(httpResponse.body);
            return Parse.Promise.as(httpResponse.body);

        } else {
            var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
            return Parse.Promise.error(errorMessage);
        }
    }, function (httpResponse) {
        var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
        return Parse.Promise.error(errorMessage);

    }).then(function (result) {
        var moipJSONAnswer = JSON.parse(result);

        if (moipJSONAnswer.keys.encryption) {
            return Parse.Promise.as(moipJSONAnswer.encryption);

        } else {
            console.error('[webhook - moip] - no public key?');
            return Parse.Promise.error('[webhook - moip] - no public key?');
        }
    });
}

function setWebHooks(oauth) {
    var moipJSON = {
        "events": [
            "PAYMENT.IN_ANALYSIS",
            "PAYMENT.AUTHORIZED",
            "PAYMENT.CANCELLED",
            "ORDER.CREATED",
            "ORDER.PAID"
        ],
        "target": process.env.MOIP_WEBHOOKS_SERVER,
        "media": "WEBHOOK"
    };

    return Parse.Cloud.httpRequest({
        method: 'POST',
        url: process.env.MOIP_URL + '/v2/preferences/notifications',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': 'OAuth ' + oauth
        },
        body: JSON.stringify(moipJSON)
    }).then(function (httpResponse) {
        if (httpResponse.statusCode === 201) {
            console.log(httpResponse.body);
            return Parse.Promise.as(httpResponse.body);

        } else {
            var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
            return Parse.Promise.error(errorMessage);
        }
    }, function (httpResponse) {
        var errorMessage = httpResponse.statusCode + ' ' + httpResponse.statusMessage + '-' + httpResponse.body;
        return Parse.Promise.error(errorMessage);
    });
}


module.exports = router;