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
  // Context to follow-up conversations
  let context = undefined
  // JSON to restart conversation
  const restartJSON = {
    "msg": "new conversation"
  }

  const require = createRequire(import.meta.url)
  const fs = require('fs')

  // Check program input
  if(process.argv.length != 4) {
    // Wrong number of params
    process.exit(1)
  } else {
      // Get prompt
      prompt = process.argv[2]
      contextFile = process.argv[3]
      // Store the contents in the context variable
      context = JSON.parse(fs.readFileSync(contextFile))
  }
    
  // Get the API with a valid cookie
  const api = new BingChat({ cookie: process.env.BING_COOKIE })

  // Check if the prompt is a reset conversation command
  const restartMsg = restartHandler(prompt)
  if(restartMsg) {
    // Unset the context
    context = undefined
    // Send message to restart the conversation
    console.log(restartJSON)
    fs.writeFileSync(contextFile, writeRestartJSON())
    process.exit(0)
  }

  // If the JSON indicates to start a new conversation, the context is deleted
  if(JSON.stringify(context) === JSON.stringify(restartJSON)) {
    context = undefined
  }

  // Get response from Bing Chat
  const res = await callBing(api, prompt, context)

  // Check if there is a code block and replaces it
  // with its proper explanation
  const noCodeRes = await checkCode(api, res)

  // Delete special characters which might break JSON
  // and make a non-fluid answer
  const finalRes = parseRes(noCodeRes)

  // Writes the final JSON with the answer
  console.log(resToJSON(finalRes))
  fs.writeFileSync(contextFile, resToJSON(finalRes))

  process.exit(0)
}


/**
 * Checks if the prompt contains one of the keyphrases to start a new
 * conversation
 * @param prompt 
 * @returns true if a keyphrase is included, false otherwise
 */
function restartHandler(prompt) {

  // List of keywords
  const keyPrompts = [
    "reinicia la conversación",
    "vamos a hablar de otra cosa",
    "abre otra conversación",
    "nueva conversación"
  ]

  let included = false

  // Check if the prompt includes any of the restart keywords
  for (let i = 0; i < keyPrompts.length; i++) {
    if (prompt.toLowerCase().includes(keyPrompts[i])) {
      included = true
      break
    }
  }

  return included
}


/**
 * Calls Bing Chat and obtains an answer.
 * If it has previous context, it will be converted to a correct ChatMessage
 * object and serve as a previous response to the API. Otherwise, it will be
 * treated as a new answer
 * @param api 
 * @param prompt 
 * @param context 
 * @returns 
 */
async function callBing (api, prompt, context=undefined) {

  let res: ChatMessage = undefined

  if(context) {
    // Call API with context
    let resContext: ChatMessage = JSONToRes(context)

    res = await oraPromise(api.sendMessage(prompt, resContext), {
      text: prompt
    })
  } else {
    // Call API without context
    res = await oraPromise(api.sendMessage(prompt), {
      text: prompt
    })
  }

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
  // Regex for backticks
  const regexBacktick = /`/g
  // Regex for double quotes
  const regexDoubleQuotes = /"/g
  // Regex for asterisks
  const regexAsterisk = /\*/g
  // Regex for references
  const regexReferences = /\[\^(.*?)\^\]+/g

  // Delete end of lines to match JSON format
  res.text = res.text.replace(regexNewLine, " ")
  res.text = res.text.replace(regexBacktick, "")
  res.text = res.text.replace(regexDoubleQuotes, "")
  res.text = res.text.replace(regexAsterisk, "")
  res.text = res.text.replace(regexReferences, "")

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
function resToJSON(res: ChatMessage) {

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
function JSONToRes(context) {

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

/**
 * Builds the new conversation string in a correct JSON format
 * @returns new conversation JSON string
 */
function writeRestartJSON() {

  // Build the JSON string
  const jsonRestartString =
    '{\n\t"msg": "new conversation"\n}'

  return jsonRestartString
}


main().catch((err) => {
    console.error(err)
    process.exit(1)
  })