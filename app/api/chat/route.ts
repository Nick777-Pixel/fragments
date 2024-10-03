import {
  streamObject,
  LanguageModel,
  CoreMessage,
} from 'ai'

import ratelimit, { Duration } from '@/lib/ratelimit'
import { Templates, templatesToPrompt } from '@/lib/templates'
import { getModelClient, getDefaultMode } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { artifactSchema as schema } from '@/lib/schema'
import { toPrompt } from '@/lib/prompt'

export const maxDuration = 60

const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 10
const ratelimitWindow = process.env.RATE_LIMIT_WINDOW ? process.env.RATE_LIMIT_WINDOW as Duration : '1d'

export async function POST(req: Request) {
  const limit = await ratelimit(req.headers.get('x-forwarded-for'), rateLimitMaxRequests, ratelimitWindow)
  if (limit) {
    return new Response('You have reached your request limit for the day.', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.amount.toString(),
        'X-RateLimit-Remaining': limit.remaining.toString(),
        'X-RateLimit-Reset': limit.reset.toString()
      }
    })
  }

  const { messages, userID, template, model, config }: { messages: CoreMessage[], userID: string, template: Templates, model: LLMModel, config: LLMModelConfig } = await req.json()
  console.log('userID', userID)
  // console.log('template', template)
  console.log('model', model)
  console.log('config', config)

  const { model: modelNameString, apiKey: modelApiKey, ...modelParams } = config
  const modelClient = getModelClient(model, config)

  const stream = await streamObject({
    model: modelClient as LanguageModel,
    schema,
    system: toPrompt(template),
    messages,
    mode: getDefaultMode(model),
    ...modelParams,
  })

  return stream.toTextStreamResponse()
}
