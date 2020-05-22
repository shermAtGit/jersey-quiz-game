// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const dbHelper = require('dbHelper.js');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
     async handle(handlerInput) {
        // return user?
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        
        var speakOutput = '';        
        var currentDateTime = Date.now();
                
        const data = await checkForSavedDevice(handlerInput);
        
        // captures quizes taken
        sessionAttributes.counter = 0;
        // get a voice for this session
        sessionAttributes.voice = ALEXA_VOICES[getRandom(0, ALEXA_VOICES.length - 1)];
        
        // keep track of correct answers for the session
        sessionAttributes.session_score = 0;

        if (data.Item !== undefined && data.Item !== null){
            // save to session    
            sessionAttributes.deviceId = data.Item.PK;             
            sessionAttributes.currentQuizPosition = data.Item.last_quiz;
            sessionAttributes.current_score = data.Item.current_score;

            speakOutput = RETURN_LAUNCH;
        }
        else {

            const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;            
            const userProfile = {
                "createDateTime": Date.now(),
                "name":'',
                "currentLocation": ''
            };            
            sessionAttributes.deviceId = deviceId;

            //save user to db
            await dbHelper.createUserProfile(deviceId, userProfile,0, 0);
            console.log("LaunchRequestHandler - Saved to DB");

            speakOutput = FIRST_TIME_LAUNCH;
        }

        attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const QuizIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'QuizIntent' 
            || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'; 
    },
    async handle(handlerInput) {
        
        //initiate sesssion attributes to set quiz counter
         console.log("Inside QuizHandler - handle");
         const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
         const response = handlerInput.responseBuilder;
         const deviceId = sessionAttributes.hasOwnProperty('deviceId') ? sessionAttributes.deviceId : 0;
         const deviceQuizPosition = sessionAttributes.hasOwnProperty('currentQuizPosition') ? sessionAttributes.currentQuizPosition : 0;
         var counter = sessionAttributes.hasOwnProperty('counter') ? sessionAttributes.counter : 0;
         var speakOutput = '';
        
        
        const data = await getQuestion(handlerInput, deviceQuizPosition);
        //save curent quiz and answer
        if (data.Item !== undefined && data.Item !== null) {
            
            console.log("QuizHandler Quiz data:", JSON.stringify(data, null, 2));
            counter+=1;
            sessionAttributes.counter = counter;
            speakOutput = getVoice(sessionAttributes.voice, data.Item.description);
            console.log(`QuizHandler: ${speakOutput}`);
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
        else
        {
            speakOutput = LAST_QUIZ_MSG;
            return handlerInput.responseBuilder
                .speak(speakOutput)
                //.reprompt(speakOutput)
                .getResponse();
        }
        
        
    }
};

const AnswerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AnswerIntent';
    },
    async handle(handlerInput) {
        console.log("Inside AnswerIntentHandler - handle");
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();        
        const response = handlerInput.responseBuilder;
        var speakOutput = ``;
        var repromptOutput = ``;  
        var result = '';
        var currentScore = 0;
        var counter = 0;

        // get quiz data stored in session by GetQuestion
        const correctAnswer = sessionAttributes.hasOwnProperty('currentQuizAns') ? sessionAttributes.currentQuizAns : ''; 
        const correction = sessionAttributes.hasOwnProperty('currentCorrection') ? sessionAttributes.currentCorrection : ''; 
        const deviceCurrentQuizPosition = sessionAttributes.hasOwnProperty('currentQuizPosition') ? sessionAttributes.currentQuizPosition : 0;
        const deviceId = sessionAttributes.hasOwnProperty('deviceId') ? sessionAttributes.deviceId : 0;
        currentScore = sessionAttributes.hasOwnProperty('current_score') ? sessionAttributes.current_score : 0;
    
        const isCorrect = compareSlots(handlerInput.requestEnvelope.request.intent.slots, correctAnswer);
        
        if(isCorrect) {
          speakOutput = getSpeechCon(true);
          sessionAttributes.session_score+=1;
          currentScore+=1;
          result = 'PASS';
         
        }
        else {
            speakOutput = getSpeechCon(false)  +
                          getVoice(sessionAttributes.voice, correction);

            result = 'FAIL';
        }
        

        //debugging
        console.log(`AnswerIntentHandler: counter -  ${sessionAttributes.counter}`);
        console.log(`AnswerIntentHandler: correctAnswer -  ${correctAnswer}`);
        console.log(`AnswerIntentHandler: user answer -  ${Alexa.getSlotValue(handlerInput.requestEnvelope, 'answer')}`);
        console.log(`AnswerIntentHandler: current_score -  ${sessionAttributes.current_score}`);

        await saveQuizAnswer(deviceId, deviceCurrentQuizPosition, currentScore);
        await recordQuizResultsForDevice(sessionAttributes.currentQuizId, deviceId, sessionAttributes.currentQuiz, result);

        if (sessionAttributes.counter < MAX_QUIZ_COUNT) {
            // tack on another question
            sessionAttributes.counter+=1;
            sessionAttributes.current_score = currentScore;
            
            // get next quiz 
            // get next quiz for user
            const data = await getQuestion(handlerInput, deviceCurrentQuizPosition);
            
            if (data.Item !== undefined && data.Item !== null)
            {  
              speakOutput += getVoice(sessionAttributes.voice, NEXT_MSG[getRandom(0, NEXT_MSG.length - 1)])   + 
                             '<break time="1s"/>'                        +
                             getVoice(sessionAttributes.voice, data.Item.description);
              repromptOutput =  getVoice(sessionAttributes.voice, data.Item.description); 
              
              handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
              return response
                 .speak(speakOutput)
                 .reprompt(repromptOutput)
                 .getResponse();
            }
            else
            {
                speakOutput += LAST_QUIZ_MSG + getEndQuizMsg(sessionAttributes.session_score);
                                                          
                repromptOutput = LAST_QUIZ_MSG;
                
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);  
                return response
                   .speak(speakOutput)
                   //.reprompt(repromptOutput)
                   .getResponse();
                
            }
            
        
        }
        else {
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                speakOutput += getEndQuizMsg(sessionAttributes.session_score);  
            return response
              .speak(speakOutput)
              .getResponse();
        }
    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.RepeatIntent';
    },
    handle(handlerInput) {
        console.log("RepeatIntentHandler - handle");
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();    
        const speakOutput = getVoice(sessionAttributes.voice, sessionAttributes.currentQuiz) ;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log("FallbackIntent - handle");
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();    
        const speakOutput = getVoice(sessionAttributes.voice, FALLBACK_MSG) ;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// CONSTANTS
const MAX_QUIZ_COUNT = 5;
const FIRST_TIME_LAUNCH = "<s>Hi, Welcome to Jersey Quiz.</s><s>Let's see how much you know about the Garden State.</s>  Are you Ready to play?";
const ALEXA_VOICES = ['Ivy', 'Joanna', 'Joey', 'Justin', 'Kendra', 'Kimberly', 'Matthew', 'Salli'];
const RETURN_LAUNCH = "<s>Hello, welcome back!</s><s>Thanks for playing again.</s>  Are you ready to get started?";
const speechConsCorrect = ['Booya', 'All righty', 'Bam', 'Bazinga', 'Bingo', 'Boom', 'Bravo', 'Cha Ching', 'Cheers', 'Dynomite', 'Hip hip hooray', 'Hurrah', 'Hurray', 'Huzzah', 'Oh dear.  Just kidding.  Hurray', 'Kaboom', 'Kaching', 'Oh snap', 'Phew','Righto', 'Way to go', 'Well done', 'Whee', 'Woo hoo', 'Yay', 'Wowza', 'Yowsa'];
const speechConsWrong = ['Argh', 'Aw man', 'Blarg', 'Blast', 'Boo', 'Bummer', 'Darn', "D'oh", 'Dun dun dun', 'Eek', 'Honk', 'Le sigh', 'Mamma mia', 'Oh boy', 'Oh dear', 'Oof', 'Ouch', 'Ruh roh', 'Shucks', 'Uh oh', 'Wah wah', 'Whoops a daisy', 'Yikes'];

//currently not using
const WRONG_ANSWER_MSG = ['Gosh, darn.  So close','That is incorrect', 'You did not answer that correctly', 'Nope','Wrong, but do not give up','oh dear', 'Quite untrue I am afraid','Better luck next time'];
const NEXT_MSG = ["Next one.  ","Next up.  ","Here's another.  ","This one is a toughie.  ", "Let's keep going.  ","Ok, moving on.  ", "ok, got another one for you.  "];
const FALLBACK_MSG = "Hmmm.. not sure where you're going with that.  I need True or False only.";
const LAST_QUIZ_MSG = "<s>Wow!.  You have answered all that we have so far.</s>  Thanks for playing!";

// HELPER FUNCTIONS

function getRandom(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function getSpeechCon(type) {
  if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]}! </say-as><break strength='strong'/>`;
  return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}

function compareSlots(slots, value) {
  for (const slot in slots) {
    if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
      if (slots[slot].value.toString().toLowerCase() === value.toString().toLowerCase()) {
        return true;
      }
    }
  }
}

function getVoice(voice, quizDesc)
{
    var output = ''
    //var voice = ALEXA_VOICES[getRandom(0, ALEXA_VOICES.length - 1)];
    output = `<voice name="${voice}"><lang xml:lang="en-US">${quizDesc}</lang></voice>`;
    //<voice name="Brian"><lang xml:lang="en-GB">Your secret is safe with me!</lang></voice>

    console.log(`getVoice: ${output}`);  
    return output;
}

function getEndQuizMsg(currentScore)
{
    var speakOutput = `You answered ${currentScore} correctly out of ${MAX_QUIZ_COUNT}.`  + 
                  `  You can play again.  We should have some more for you.  Thanks for playing!`;
                  
    return speakOutput;                  

}

async function saveQuizAnswer(deviceId, currentQuizPosition, current_score)
{
   // record current score for device  
   await dbHelper.updateDeviceScore(deviceId, currentQuizPosition, current_score);
}

async function recordQuizResultsForDevice(quizId, deviceId, description, result)
{
     // record pass/fail for quiz result
     await dbHelper.recordQuizResultsForDevice(quizId, deviceId, description, result);
}
async function checkForSavedDevice(handlerInput)
{

    const data = await dbHelper.getUserProfile(handlerInput.requestEnvelope.context.System.device.deviceId) || {};
    return data;

}

async function getQuestion(handlerInput, currentQuizPosition) {
  
  console.log("Function getQuestion()");
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  
  
  // get next quiz
  const nextQuizPosition = currentQuizPosition+1;
  const nextQuizId = 'Quiz_' + nextQuizPosition;
  const data = await dbHelper.getNextQuiz(nextQuizId);
  
  if (data.Item !== undefined && data.Item !== null) {
            
       sessionAttributes.currentQuizId = data.Item.PK;
       sessionAttributes.currentQuiz = data.Item.description;
       sessionAttributes.currentQuizAns = data.Item.answer;
       sessionAttributes.currentCorrection = data.Item.correction;
       sessionAttributes.currentQuizPosition = nextQuizPosition;
  }
  
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
  //debug 
  console.log(`curr: ${currentQuizPosition}, next: ${nextQuizPosition}, nextQuid: ${nextQuizId}`);
  console.log(`getQuestion result: ${JSON.stringify(data, null, 2)}`);
  
  return data;
}

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        QuizIntentHandler,
        AnswerIntentHandler,
        RepeatIntentHandler,
        FallbackIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )    
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
