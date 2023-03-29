import { BingChat } from './src'
import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatMessage } from 'bing-chat'

dotenv.config()

let context = undefined;


async function main() {
    
    // Get the API with a valid cookie
    const api = new BingChat({ cookie: process.env.BING_COOKIE })

    const prompt = '¿Qué es una mitocondria?'

    // Check if the prompt is a reset conversation command
    restartHandler(prompt)


    const res = await callBing(api, prompt)
    const parsedRes = await checkCode(api, res)
    console.log(toJSON(parsedRes))

    return 0

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
  let regex = /\[\^(.*?)\^\]+/g

  // Calling Bing Chat with or without context
  if (context) {
    res = await oraPromise(api.sendMessage(prompt, context), {
      text: prompt
    })
  } else {
    res = await oraPromise(api.sendMessage(prompt), {
      text: prompt
    })
  }

  res.text = res.text.replace(regex, "")

  // Returning response
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