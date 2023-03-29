import { BingChat } from './src'
import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatMessage } from 'bing-chat'

dotenv.config()


// Context to follow-up conversations
let context = undefined;


async function main() {

  let prompt = undefined

  // Check program input
  if(process.argv.length < 3 || process.argv.length > 4) {
    // Wrong number of params
    process.exit(1)
  } else {
      // Get prompt
      prompt = process.argv[2]
  }
  if(process.argv.length == 4) {
    // If there is context we get it
    context = process.argv[3]
  }
    
  // Get the API with a valid cookie
  const api = new BingChat({ cookie: process.env.BING_COOKIE })

  // Check if the prompt is a reset conversation command
  restartHandler(prompt)

  // Get response from Bing Chat
  const res = await callBing(api, prompt)
  // Check if there is a code block and replace it
  // with its proper explanation
  let parsedRes = await checkCode(api, res)

  // Delete special characters which might break JSON
  // and make a non-fluid answer
  let finalRes = parseRes(parsedRes)

  console.log(toJSON(finalRes))

  process.exit(0)

}


function restartHandler(prompt) {
  // Defining list of reset key prompts
  let keyPrompts = [
    'reinicia la conversación',
    'vamos a hablar de otra cosa',
    'reinicia',
    'abre otra conversación'
  ]

  // Resetting context if command requests reset
  if(keyPrompts.includes(prompt)) {
    context = undefined // TODO REVISAR COMO RESETEAR (HAY QUE VACIAR ARCHIVO)
  }
}


async function callBing (api, prompt, context=undefined) {

  let res: ChatMessage = undefined

  // Regular expression for detecting references
  let regex = /\[\^(.*?)\^\]+/g

  if (context) {
    // Call API with context
    res = await oraPromise(api.sendMessage(prompt, context), {
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


main().catch((err) => {
    console.error(err)
    process.exit(1)
  })