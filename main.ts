import { BingChat } from './src'
import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatMessage } from 'bing-chat'
import { json } from 'stream/consumers'

dotenv.config()

let context = undefined;

async function main() {
    // Defining API
    const api = new BingChat({ cookie: process.env.BING_COOKIE })


    const prompt = 'Explícame lo que es un número primo en dos frases.'

    // Checking prompt for reset command
    restartHandler(prompt)


    const test = await callBing(api, prompt)
    console.log(toJSON(test))

    return 0

}

function restartHandler(prompt) {
  // Defining list of reset key prompts
  let keyPrompts = [
    'reinicia la conversación',
    'vamos a hablar de otra cosa',
    'reinicia'
  ]

  // Resetting context if command requests reset
  if(keyPrompts.includes(prompt)) {
    context = undefined // TODO REVISAR COMO RESETEAR (HAY QUE VACIAR ARCHIVO)
  }
}

async function callBing (api, prompt, context=undefined) {
  let res = undefined

  // Calling Bing Chat with or without context
  if (context) {
    res = await oraPromise(api.sendMessage(prompt), {
      text: prompt
    })
  } else {
    res = await oraPromise(api.sendMessage(prompt, context), {
      text: prompt
    })
  }

  // Returning response
  return res
}

async function checkCode (api, res) {
  let newRes = res

  // Detecting code block
  if(res.text.includes('```')) {
    const codeSnippet = res.text.substring(res.text.indexOf('```') + 3, res.text.lastIndexOf('```'))

    // Generating new query to explain code verbally
    let summaryPrompt = '¿Puedes explicar con palabras lo que hace este código sin mostrar más código? Sólo responde la explicación del código.'
    summaryPrompt += '\n' + codeSnippet

    // Calling Bing Chat
    newRes = await callBing(api, summaryPrompt)

    // Substituting original code block in response with new explanation
    // TODO
  }

  // Returning appropiate response
  return newRes
}

function printJSON(res: ChatMessage) {
  // Obtaining all JSON fields
  const objTmp = {
    ...res
  }

  // Printing JSON object
  return objTmp
}

function toJSON(res: ChatMessage) {

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

main().catch((err) => {
    console.error(err)
    process.exit(1)
  })