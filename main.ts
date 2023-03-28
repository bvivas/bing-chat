import { BingChat } from './src'
import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatMessage } from 'bing-chat'

dotenv.config()

let context = undefined;

async function main() {
    // Defining API
    const api = new BingChat({ cookie: process.env.BING_COOKIE })


    const prompt = 'Explícame lo que es un número primo en dos frases.'

    // Checking prompt for reset command
    restartHandler(prompt)


    const test = await callBing(api, prompt)
    console.log("TEST: ", test)

    return 0

  
    // Prompt 1
    restartHandler(prompt)

    let res = await oraPromise(api.sendMessage(prompt), {
      text: prompt
    })
     

    printJSON(res)
  
    //consocallBingle.log('\n' + res.text + '\n')


    return
  
    // Prompt 2
    const prompt2 = '¿Me puedes dar un ejemplo en Java para saber si un número es primo o no?'

    res = await oraPromise(api.sendMessage(prompt2, res), {
      text: prompt2
    })
    console.log('\n' + res.text + '\n')
    printChatMessage(res)

    // Si la respuesta contiene un bloque de codigo
    if(res.text.includes('```')) {
      let codeSnippet = parseCode(res.text);

      summaryPrompt = summaryPrompt + '\n' + codeSnippet
  
      res = await oraPromise(api.sendMessage(summaryPrompt, res), {
        text: summaryPrompt
      })

      console.log(res.text)
      printChatMessage(res)
    }
  
    const prompt3 = '¿Qué tiempo va a hacer en Semana Santa de 2023 en Alicante?'
  
    res = await oraPromise(api.sendMessage(prompt3, res), {
      text: prompt3
    })
    console.log('\n' + res.text + '\n')
    printChatMessage(res)
  
    const prompt4 = '¿De qué estábamos hablando al principio de la conversación?'
  
    res = await oraPromise(api.sendMessage(prompt4, res), {
      text: prompt4
    })
    console.log('\n' + res.text + '\n')
    printChatMessage(res)
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
  console.log(objTmp)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
  })