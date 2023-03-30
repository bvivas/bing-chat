import { BingChat } from './src'
import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatMessage } from 'bing-chat'
import * as types from 'src/types'
import { createRequire } from 'module'

dotenv.config()


async function main() {

  let prompt = undefined
  let contextFile = undefined

  const require = createRequire(import.meta.url)
  const fs = require('fs')

  // Context to follow-up conversations
  let context = undefined;

  // JSON to restart conversation
  const restartJSON = {
    "msg": "restart conversation"
  }

  // Check program input
  if(process.argv.length < 3 || process.argv.length > 4) {
    // Wrong number of params
    process.exit(1)
  } else {
      // Get prompt
      prompt = process.argv[2]
  }
  if(process.argv.length == 4) {
    // If there is context
    contextFile = process.argv[3]
    // Store the contents in the context variable
    context = JSON.parse(fs.readFileSync(contextFile))
  }
    
  // Get the API with a valid cookie
  const api = new BingChat({ cookie: process.env.BING_COOKIE })

  // Check if the prompt is a reset conversation command
  const restartMsg = restartHandler(prompt)
  if(restartMsg == "restart") {
    // Unset the context
    context = undefined
    // Delete the context file
    try {
      fs.unlinkSync('prueba.txt')
    } catch(error) {
      console.log(error)
    }
    // Send message to restart the conversation
    console.log(restartJSON)
    process.exit(0)
  }

  // Get response from Bing Chat
  const res = await callBing(api, prompt, context)

  // Check if there is a code block and replaces it
  // with its proper explanation
  let parsedRes = await checkCode(api, res)

  // Delete special characters which might break JSON
  // and make a non-fluid answer
  let finalRes = parseRes(parsedRes)

  console.log(toJSON(finalRes))

  process.exit(0)

}


function restartHandler(prompt) {

  // List of keywords
  let keyPrompts = [
    'reinicia la conversación',
    'vamos a hablar de otra cosa',
    'reinicia',
    'abre otra conversación'
  ]

  // If the prompt includes any of the restart keywords
  // unset the context
  if(prompt.includes(keyPrompts)) {
    return "restart"
  } else {
    return "no restart"
  }
}


async function callBing (api, prompt, context=undefined) {

  let res: ChatMessage = undefined

  // Regular expression for detecting references
  let regex = /\[\^(.*?)\^\]+/g

  if (context) {
    // Call API with context
    let resContext: ChatMessage = JSONtoRes(context)

    res = await oraPromise(api.sendMessage(prompt, resContext), {
      text: prompt
    })
  } else {
    // Call API without context
    res = await oraPromise(api.sendMessage(prompt), {
      text: prompt
    })
  }

  // Delete references
  res.text = res.text.replace(regex, "")

  return res
}


/**
 * Deletes special characters and expression from responses to get a correct JSON
 * format and make fluid conversations
 * @param res 
 * @returns new formatted response
 */
function parseRes(res) {

  // Regex for the end of lines
  const regexNewLine = /[\n]/g
  const regexBacktick = /`/g
  const regexDoubleQuotes = /"/g
  const regexAsterisk = /\*/g

  // Delete end of lines to match JSON format
  res.text = res.text.replace(regexNewLine, " ")
  res.text = res.text.replace(regexBacktick, "")
  res.text = res.text.replace(regexDoubleQuotes, "")
  res.text = res.text.replace(regexAsterisk, "")

  return res
}


/**
 * Check whether the passed in response contains a block code. If it does,
 * it takes out the code snipped and asks Bing Chat for an explanation, then
 * it appends such explanation to the previous answer without the code snippet
 * @param api 
 * @param res 
 * @returns new explained response without the code
 */
async function checkCode(api, res) {

  let newRes = res

  // If the response contains a code block we give
  // an explanation instead of the code
  if(res.text.includes('```')) {

    // Get the code block
    const codeSnippet = res.text.substring(res.text.indexOf('```') + 3, res.text.lastIndexOf('```'))

    // Get the explanation
    let summaryPrompt = '¿Puedes explicar con palabras lo que hace este código sin mostrar más código? Responde únicamente la explicación del código, no me saludes.'
    summaryPrompt += '\n' + codeSnippet

    newRes = await callBing(api, summaryPrompt)

    // Merge both answers
    let finalRes = res.text.substring(0, res.text.indexOf('```'))
    finalRes = finalRes + newRes.text
    newRes.text = finalRes

    return newRes
  }

  // If there is no code, return the same res
  return newRes
}


/**
 * Parses a ChatMessage fields to write them into JSON format
 * @param res 
 * @returns string with a correct JSON format
 */
function toJSON(res: ChatMessage) {

  // Build the JSON string
  const jsonString =
  '{\n\t"id":"' + res.id + '",\n' +
  '\t"text":"'+ res.text + '",\n' +
  '\t"author":"' + res.author + '",\n' +
  '\t"conversationId":"' + res.conversationId + '",\n' +
  '\t"clientId":"' + res.clientId + '",\n' +
  '\t"conversationSignature":"' + res.conversationSignature + '",\n' +
  '\t"conversationExpiryTime":"' + res.conversationExpiryTime + '",\n' +
  '\t"invocationId":"' + res.invocationId + '"\n}'

  return jsonString
}


/**
 * Extracts a JSON file fields and assigns them to a ChatMessage object to retrieve
 * a past conversation's context
 * @param context 
 * @returns new ChatMessage object with the previous context
 */
function JSONtoRes(context) {

  // Build the res object
  const res: types.ChatMessage = {
    id: context.id,
    text: context.text,
    author: context.author,
    conversationId: context.conversationId,
    clientId: context.clientId,
    conversationSignature: context.conversationSignature,
    conversationExpiryTime: context.conversationExpiryTime,
    invocationId: context.invocationId
  }

  return res
}


main().catch((err) => {
    console.error(err)
    process.exit(1)
  })