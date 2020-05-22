var AWS = require("aws-sdk");
AWS.config.update({region: "us-east-1"});
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: "us-east-1:aa9f17f8-1cd9-46c4-b961-83a085489af8",
    RoleArn: "arn:aws:iam::482400037159:role/Cognito_JerseyQuizGameUnauth_Role"
    });
    
const tableName = "QuizMaster";

var dbHelper = function () { };
var docClient = new AWS.DynamoDB.DocumentClient();

dbHelper.prototype.getQuiz = (quizID) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            Key:{
                "PK": quizID,
                "SK": quizID
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
            resolve(data.Items)
            
        })
    });
}

dbHelper.prototype.getUserProfile = (deviceId) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            Key:{
                "PK": deviceId,
                "SK": "DEVICE"
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("getUserProfile: Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("getUserProfile: GetItem succeeded:", JSON.stringify(data, null, 2));
            resolve(data)
            
        })
    });
}

dbHelper.prototype.createUserProfile = (deviceId, profile, last_quiz, current_score) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            Item:{
                "PK": deviceId,
                "SK": "DEVICE",
                "profile": profile,
                 "last_quiz": last_quiz,
                "current_score": current_score
            }
        }
        docClient.put(params, (err, data) => {
            if (err) {
                console.error("createUserProfile: Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("createUserProfile: Create succeeded:", JSON.stringify(data, null, 2));
            resolve(data.Items)
            
        })
    });
}

dbHelper.prototype.updateDeviceScore = (deviceId, last_quiz, current_score) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName:tableName,
            Key:{
                "PK": deviceId,
                "SK": "DEVICE"
            },
            UpdateExpression: "set last_quiz = :lq, current_score = :cs",
            ExpressionAttributeValues:{
                ":lq":last_quiz,
                ":cs":current_score
            },
            ReturnValues:"NONE"
        };
        docClient.update(params, (err, data) => {
            if (err) {
                console.log(`updateDeviceScore: params: ${JSON.stringify(params, null, 2)}`);
                console.error("updateDeviceScore: Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("updateDeviceScore: Update succeeded:", JSON.stringify(data, null, 2));
            resolve(data.Items)
            
        })
    });
}

dbHelper.prototype.recordQuizResultsForDevice = (quizId, deviceId, description, result) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            Item:{
                "PK": quizId,
                "SK": "RESULT",
                "device": deviceId,
                "description": description,
                "result": result
            }
        }
        docClient.put(params, (err, data) => {
            if (err) {
                console.log(`recordQuizResultsForDevice: params: ${JSON.stringify(params, null, 2)}`);
                console.error("recordQuizResultsForDevice: Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("recordQuizResultsForDevice: Update succeeded:", JSON.stringify(data, null, 2));
            resolve(data.Items)
            
        })
    });
}

dbHelper.prototype.getQuizSetForUser = (count) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            KeyConditionExpression: "#quizID = :quiz_id",
            ExpressionAttributeNames: {
                "#quizID": "quizId"
            },
            ExpressionAttributeValues: {
                ":quiz_id": count
            }
        }
        docClient.query(params, (err, data) => {
            if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
            resolve(data.Items)
            
        })
    });
}

dbHelper.prototype.getNextQuiz = (quizId) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: tableName,
            Key:{
                "PK": quizId,
                "SK": 'QUIZ'
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("getNextQuiz: Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("getNextQuiz: GetItem succeeded:", JSON.stringify(data, null, 2));
            resolve(data)
            
        })
    });
}

module.exports = new dbHelper();